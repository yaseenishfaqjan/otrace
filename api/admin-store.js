/**
 * Orders already live in `orders` (webhook, INSERT IGNORE). Two new tables
 * sit beside it: a Stripe snapshot the dashboard can read when the API is
 * down, and fulfilment the shop types in. Nothing here drops or rewrites
 * an existing table.
 */
import { CURRENCY, unpackItems } from './catalog.js';
import { normalizeCheckoutSession, normalizeLegacyRow } from './admin-orders.js';

export const ADMIN_TABLE_SQL = [
  `CREATE TABLE IF NOT EXISTS order_cache (
      stripe_session_id   VARCHAR(255) NOT NULL PRIMARY KEY,
      kind                 VARCHAR(16)  NOT NULL DEFAULT 'complete',
      created_at_unix      INT NOT NULL,
      email                VARCHAR(255) NULL,
      customer_name        VARCHAR(255) NULL,
      country              CHAR(2) NULL,
      currency             VARCHAR(10) NOT NULL DEFAULT 'usd',
      amount_total_cents   INT NOT NULL DEFAULT 0,
      payment_status       VARCHAR(50) NULL,
      session_status       VARCHAR(32) NULL,
      snapshot_json        JSON NOT NULL,
      updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY order_cache_created (created_at_unix),
      KEY order_cache_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS order_fulfilment (
      stripe_session_id VARCHAR(255) NOT NULL PRIMARY KEY,
      status            VARCHAR(32) NOT NULL DEFAULT 'unfulfilled',
      tracking_number   VARCHAR(128) NULL,
      carrier           VARCHAR(64) NULL,
      note              TEXT NULL,
      updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export async function ensureAdminTables(pool) {
  for (const sql of ADMIN_TABLE_SQL) await pool.query(sql);
}

function clip(value, max) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

/**
 * Same INSERT the webhook has always used. INSERT IGNORE plus the unique
 * session id is what makes a second delivery, or the success page, a no-op.
 */
export async function insertOrderRow(pool, session) {
  const items = unpackItems(session.metadata);
  const shipping = session.collected_information?.shipping_details ?? session.shipping_details ?? null;
  // The webhook's session has payment_intent as an id string. A dashboard
  // refresh expands it to an object; store the id either way. A string is
  // unchanged, which is what redelivered webhooks already wrote.
  const paymentIntent = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
  await pool.query(
    `INSERT IGNORE INTO orders
       (stripe_session_id, payment_intent, email, customer_name, phone,
        amount_total_cents, currency, payment_status, items_json, shipping_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      paymentIntent,
      session.customer_details?.email ?? null,
      session.customer_details?.name ?? shipping?.name ?? null,
      session.customer_details?.phone ?? null,
      session.amount_total ?? 0,
      session.currency ?? CURRENCY,
      session.payment_status ?? null,
      JSON.stringify(items),
      JSON.stringify(shipping),
    ],
  );
}

export async function upsertOrderCache(pool, order) {
  const open = order.sessionStatus === 'open' || order.sessionStatus === 'expired';
  await pool.query(
    `INSERT INTO order_cache
       (stripe_session_id, kind, created_at_unix, email, customer_name, country,
        currency, amount_total_cents, payment_status, session_status, snapshot_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       kind = VALUES(kind),
       created_at_unix = VALUES(created_at_unix),
       email = VALUES(email),
       customer_name = VALUES(customer_name),
       country = VALUES(country),
       currency = VALUES(currency),
       amount_total_cents = VALUES(amount_total_cents),
       payment_status = VALUES(payment_status),
       session_status = VALUES(session_status),
       snapshot_json = VALUES(snapshot_json)`,
    [
      order.id,
      open ? 'open' : 'complete',
      order.created || 0,
      clip(order.email, 255),
      clip(order.customerName, 255),
      clip(order.shipping?.country, 2),
      clip(order.currency, 10) || 'usd',
      order.totalCents || 0,
      clip(order.paymentStatus, 50),
      clip(order.sessionStatus, 32),
      JSON.stringify(order),
    ],
  );
}

export async function recordCheckoutSession(pool, session) {
  if (!pool || !session?.id) return;
  await insertOrderRow(pool, session);
  try {
    const snapshot = normalizeCheckoutSession(session);
    if (snapshot) await upsertOrderCache(pool, snapshot);
  } catch (err) {
    console.warn('[order] cache update failed:', err.message);
  }
}

function fulfilmentFrom(row) {
  return {
    id: row.stripe_session_id,
    status: row.status || 'unfulfilled',
    trackingNumber: row.tracking_number || '',
    carrier: row.carrier || '',
    note: row.note || '',
  };
}

export function createMysqlOrderStore(pool) {
  return {
    async upsertCache(order) {
      await upsertOrderCache(pool, order);
    },
    async listCache() {
      const [rows] = await pool.query(
        'SELECT snapshot_json FROM order_cache ORDER BY created_at_unix DESC LIMIT 2000',
      );
      const out = [];
      for (const row of rows) {
        try {
          const snap = typeof row.snapshot_json === 'string'
            ? JSON.parse(row.snapshot_json)
            : row.snapshot_json;
          if (snap?.id) out.push(snap);
        } catch {
          // One bad snapshot should not hide the rest of the desk.
        }
      }
      return out;
    },
    async insertLegacy(session) {
      await insertOrderRow(pool, session);
    },
    async listLegacy() {
      const [rows] = await pool.query(
        `SELECT stripe_session_id, payment_intent, email, customer_name, phone,
                amount_total_cents, currency, payment_status, items_json, shipping_json,
                UNIX_TIMESTAMP(created_at) AS created_unix
           FROM orders
          ORDER BY id DESC
          LIMIT 2000`,
      );
      return rows.map(normalizeLegacyRow).filter(Boolean);
    },
    async listFulfilment() {
      const [rows] = await pool.query(
        `SELECT stripe_session_id, status, tracking_number, carrier, note
           FROM order_fulfilment`,
      );
      return rows.map(fulfilmentFrom);
    },
    async saveFulfilment(id, fields) {
      await pool.query(
        `INSERT INTO order_fulfilment (stripe_session_id, status, tracking_number, carrier, note)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           status = VALUES(status),
           tracking_number = VALUES(tracking_number),
           carrier = VALUES(carrier),
           note = VALUES(note)`,
        [
          id,
          fields.status,
          clip(fields.trackingNumber, 128),
          clip(fields.carrier, 64),
          fields.note ? String(fields.note).slice(0, 2000) : null,
        ],
      );
      return {
        id,
        status: fields.status,
        trackingNumber: fields.trackingNumber || '',
        carrier: fields.carrier || '',
        note: fields.note || '',
      };
    },
  };
}

export function createMemoryOrderStore() {
  const cache = new Map();
  const legacy = new Map();
  const fulfilment = new Map();
  return {
    async upsertCache(order) {
      cache.set(order.id, order);
    },
    async listCache() {
      return [...cache.values()];
    },
    async insertLegacy(session) {
      const order = normalizeCheckoutSession(session);
      if (!order?.id || legacy.has(order.id)) return;
      legacy.set(order.id, order);
    },
    async listLegacy() {
      return [...legacy.values()];
    },
    async listFulfilment() {
      return [...fulfilment.values()];
    },
    async saveFulfilment(id, fields) {
      const row = {
        id,
        status: fields.status,
        trackingNumber: fields.trackingNumber || '',
        carrier: fields.carrier || '',
        note: fields.note || '',
      };
      fulfilment.set(id, row);
      return row;
    },
  };
}
