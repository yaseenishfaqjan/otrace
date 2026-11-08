/**
 * Server-rendered dashboard. Order fields are HTML, not a script payload,
 * so a logged-out response has nothing to scrape from JavaScript.
 */
import { SIZES } from './catalog.js';
import {
  FULFILMENT_STATUSES,
  formatAddress,
  formatBoth,
  money,
  orderReference,
  stripeDashboardUrl,
} from './admin-orders.js';

const COLOURS = ['Onyx Black', 'Warm Cream'];

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function block(value) {
  return esc(value).replace(/\n/g, '<br>');
}

function shell({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(title)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 15px/1.45 ui-sans-serif, system-ui, sans-serif; color: #111; background: #fff; }
    a { color: inherit; }
    header, main { width: min(1180px, calc(100% - 28px)); margin: 0 auto; }
    header { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 18px 0; border-bottom: 1px solid #111; }
    .word { letter-spacing: 0.18em; font-weight: 650; text-decoration: none; }
    .muted { color: #333; font-size: 13px; }
    button, .button { background: #111; color: #fff; border: 1px solid #111; padding: 8px 14px; font: inherit; cursor: pointer; text-decoration: none; display: inline-block; }
    button.ghost { background: #fff; color: #111; }
    input, select, textarea { font: inherit; border: 1px solid #111; padding: 8px; width: 100%; background: #fff; color: #111; }
    textarea { min-height: 88px; resize: vertical; }
    label span { display: block; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 4px; }
    .tabs { display: flex; gap: 18px; margin: 18px 0; }
    .tabs a { text-underline-offset: 4px; }
    .tabs a[aria-current="page"] { font-weight: 700; }
    .cards, .units { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .cards article, .units div, .panel { border: 1px solid #111; padding: 12px; }
    .cards h2, .units h2 { margin: 0 0 6px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 650; }
    .cards .count { margin: 0; font-size: 28px; line-height: 1.1; }
    .cards p, .units p { margin: 4px 0 0; }
    .units { grid-template-columns: 1fr 1fr; margin-top: 8px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px 14px; margin: 0; padding: 0; list-style: none; }
    .filters { display: grid; grid-template-columns: 1.4fr repeat(5, 1fr) auto; gap: 8px; align-items: end; margin: 16px 0; }
    .table-wrap { overflow-x: auto; border-top: 1px solid #111; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #111; text-align: left; padding: 8px 8px 8px 0; vertical-align: top; }
    th { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
    .warn, .alert { border: 1px solid #111; padding: 10px 12px; margin: 12px 0; }
    .pager { display: flex; gap: 16px; align-items: center; margin: 16px 0 28px; }
    dl { display: grid; grid-template-columns: 160px 1fr; gap: 6px 12px; margin: 0 0 18px; }
    dt { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
    dd { margin: 0; }
    form.stack { display: grid; gap: 10px; max-width: 520px; }
    .login { max-width: 380px; margin: 10vh auto; padding: 0 16px; }
    .login h1 { letter-spacing: 0.18em; font-weight: 650; font-size: 20px; }
    @media (max-width: 860px) {
      .cards { grid-template-columns: 1fr 1fr; }
      .filters { grid-template-columns: 1fr 1fr; }
      .units, dl { grid-template-columns: 1fr; }
      table, thead, tbody, tr, td { display: block; }
      thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      tr { border-bottom: 1px solid #111; padding: 10px 0; }
      td { border: 0; padding: 3px 0; }
      td::before { content: attr(data-label); display: block; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; }
    }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function header(base, { authed }) {
  const out = authed
    ? `<form method="post" action="${esc(base)}/logout"><button class="ghost" type="submit">Log out</button></form>`
    : '';
  return `<header>
    <a class="word" href="${esc(base)}">OTRACE</a>
    ${out}
  </header>`;
}

export function renderLogin({ base, error }) {
  const alert = error ? `<p class="alert" role="alert">${esc(error)}</p>` : '';
  return shell({
    title: 'Sign in — OTRACE',
    body: `<main class="login">
      <h1>OTRACE</h1>
      <p class="muted">Orders. This page is not indexed.</p>
      ${alert}
      <form method="post" action="${esc(base)}/login">
        <label><span>Password</span><input type="password" name="password" autocomplete="current-password" autofocus required></label>
        <p><button type="submit">Sign in</button></p>
      </form>
    </main>`,
  });
}

function href(base, path, query, overrides = {}) {
  const params = new URLSearchParams();
  const merged = { ...query, ...overrides };
  for (const key of ['tab', 'q', 'status', 'from', 'to', 'country', 'product', 'page']) {
    const value = merged[key];
    if (value == null || value === '') continue;
    if (key === 'tab' && value === 'paid' && overrides.tab !== 'open') continue;
    if (key === 'page' && String(value) === '1') continue;
    params.set(key, String(value));
  }
  if (overrides.tab === 'paid') params.delete('tab');
  const qs = params.toString();
  return `${base}${path}${qs ? `?${qs}` : ''}`;
}

function option(value, label, current) {
  const selected = value === current ? ' selected' : '';
  return `<option value="${esc(value)}"${selected}>${esc(label)}</option>`;
}

function chips(entries) {
  if (!entries.length) return '<p class="muted">None in the last 30 days.</p>';
  return `<ul class="chips">${entries.map(([label, count]) => `<li>${esc(label)} <b>${count}</b></li>`).join('')}</ul>`;
}

function itemSummary(order) {
  const items = order.items || [];
  if (!items.length) return '—';
  const first = items[0];
  const bits = [first.product, first.colour, first.size].filter(Boolean).join(' · ');
  const qty = `× ${first.quantity}`;
  const more = items.length > 1 ? ` +${items.length - 1} more` : '';
  return `${bits} ${qty}${more}`;
}

function paymentLabel(status) {
  if (status === 'paid') return 'Paid';
  if (status === 'unpaid') return 'Unpaid';
  if (status === 'no_payment_required') return 'No payment required';
  return status || '—';
}

function refundLabel(status) {
  if (status === 'none') return 'None';
  if (status === 'partial') return 'Partial';
  if (status === 'refunded') return 'Refunded';
  return 'Unknown';
}

function fulfilmentLabel(status) {
  if (status === 'unfulfilled') return 'Unfulfilled';
  if (status === 'packed') return 'Packed';
  if (status === 'shipped') return 'Shipped';
  if (status === 'delivered') return 'Delivered';
  return 'Unfulfilled';
}

export function renderOrders({ base, orders, page, summary, query, warning, countries }) {
  const tab = query.tab === 'open' ? 'open' : 'paid';
  const sizeEntries = [
    ...SIZES.map((size) => [size, summary.units.size[size] || 0]),
    ...Object.keys(summary.units.size).filter((size) => !SIZES.includes(size)).map((size) => [size, summary.units.size[size]]),
  ];
  const colourEntries = [
    ...COLOURS.map((name) => [name, summary.units.colour[name] || 0]),
    ...Object.keys(summary.units.colour).filter((name) => !COLOURS.includes(name)).map((name) => [name, summary.units.colour[name]]),
  ];
  const countryOptions = ['', ...(countries || [])].map((code) => option(code, code || 'All countries', query.country || ''));
  const rows = orders.map((order) => {
    const when = formatBoth(order.created);
    const ship = order.shipping || {};
    const where = [ship.city, ship.country].filter(Boolean).join(', ') || '—';
    const promo = (order.promoCodes || []).join(', ');
    const fulfil = order.fulfilment || {};
    const track = [fulfil.carrier, fulfil.trackingNumber].filter(Boolean).join(' ');
    return `<tr>
      <td data-label="Date">${esc(when.pkt)}<br><span class="muted">${esc(when.utc)}</span></td>
      <td data-label="Order"><a href="${esc(base)}/orders/${esc(order.id)}">${esc(orderReference(order.id))}</a><br><span class="muted">${esc(order.id)}</span></td>
      <td data-label="Customer">${esc(order.customerName || '—')}<br>${esc(order.email || '')}<br>${esc(order.phone || '')}</td>
      <td data-label="Ship to">${esc(where)}</td>
      <td data-label="Items">${esc(itemSummary(order))}</td>
      <td data-label="Discount">${esc(money(order.discountCents, order.currency))}${promo ? `<br>${esc(promo)}` : ''}</td>
      <td data-label="Shipping">${esc(money(order.shippingCents, order.currency))}</td>
      <td data-label="Tax">${esc(money(order.taxCents, order.currency))}</td>
      <td data-label="Total">${esc(money(order.totalCents, order.currency))}</td>
      <td data-label="Payment">${esc(paymentLabel(order.paymentStatus))}</td>
      <td data-label="Refund">${esc(refundLabel(order.refundStatus))}</td>
      <td data-label="Fulfilment">${esc(fulfilmentLabel(fulfil.status))}${track ? `<br><span class="muted">${esc(track)}</span>` : ''}</td>
    </tr>`;
  }).join('');
  const from = page.total ? (page.page - 1) * page.perPage + 1 : 0;
  const to = Math.min(page.total, page.page * page.perPage);
  const prev = page.page > 1 ? `<a href="${esc(href(base, '', query, { page: page.page - 1 }))}">Previous</a>` : '<span class="muted">Previous</span>';
  const next = page.page < page.pages ? `<a href="${esc(href(base, '', query, { page: page.page + 1 }))}">Next</a>` : '<span class="muted">Next</span>';
  const card = (title, stat, extra = '') => `<article><h2>${title}</h2><p class="count">${stat.count}</p><p>${esc(money(stat.revenueCents))}</p>${extra}</article>`;

  return shell({
    title: 'Orders — OTRACE',
    body: `${header(base, { authed: true })}
    <main>
      <p class="muted">Times are Asia/Karachi (PKT, UTC+5) and UTC. Stripe is the source of truth; saved orders fill in when Stripe is quiet.</p>
      ${warning ? `<p class="warn">${esc(warning)}</p>` : ''}
      <nav class="tabs">
        <a href="${esc(href(base, '', query, { tab: 'paid', page: 1 }))}"${tab === 'paid' ? ' aria-current="page"' : ''}>Orders</a>
        <a href="${esc(href(base, '', query, { tab: 'open', page: 1 }))}"${tab === 'open' ? ' aria-current="page"' : ''}>Abandoned</a>
        <a href="${esc(href(base, '/export.csv', query, { page: '' }))}">Export CSV</a>
      </nav>
      <section class="cards">
        ${card('Today', summary.today)}
        ${card('7 days', summary.days7)}
        ${card('30 days', summary.days30)}
        <article><h2>AOV, 30 days</h2><p class="count">${esc(money(summary.days30.aovCents))}</p><p class="muted">After refunds</p></article>
      </section>
      <section class="units">
        <div><h2>Units by size, 30 days</h2>${chips(sizeEntries)}</div>
        <div><h2>Units by colour, 30 days</h2>${chips(colourEntries)}</div>
      </section>
      <form class="filters" method="get" action="${esc(base)}">
        <input type="hidden" name="tab" value="${tab === 'open' ? 'open' : 'paid'}">
        <label><span>Search</span><input name="q" value="${esc(query.q || '')}" placeholder="Email, name, or order id"></label>
        <label><span>Fulfilment</span><select name="status">${option('', 'All statuses', query.status || '')}${FULFILMENT_STATUSES.map((status) => option(status, fulfilmentLabel(status), query.status || '')).join('')}</select></label>
        <label><span>From</span><input type="date" name="from" value="${esc(query.from || '')}"></label>
        <label><span>To</span><input type="date" name="to" value="${esc(query.to || '')}"></label>
        <label><span>Country</span><select name="country">${countryOptions.join('')}</select></label>
        <label><span>Product</span><select name="product">
          ${option('', 'All products', query.product || '')}
          ${option('hoodie', 'Hoodie', query.product || '')}
          ${option('sweatpant', 'Sweatpant', query.product || '')}
          ${option('set', 'Complete set', query.product || '')}
        </select></label>
        <button type="submit">Filter</button>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Date</th><th>Order</th><th>Customer</th><th>Ship to</th><th>Items</th>
            <th>Discount</th><th>Shipping</th><th>Tax</th><th>Total</th>
            <th>Payment</th><th>Refund</th><th>Fulfilment</th>
          </tr></thead>
          <tbody>
            ${rows || '<tr><td colspan="12">No orders in this view.</td></tr>'}
          </tbody>
        </table>
      </div>
      <nav class="pager">${prev}<span>${from}–${to} of ${page.total}</span>${next}</nav>
    </main>`,
  });
}

function row(label, value) {
  return `<dt>${esc(label)}</dt><dd>${value}</dd>`;
}

export function renderOrder({ base, order, saved, error }) {
  const when = formatBoth(order.created);
  const ship = formatAddress(order.shipping);
  const items = (order.items || []).map((item) => {
    const bits = [item.product, item.colour, item.size].filter(Boolean).join(' · ');
    return `<li>${esc(bits)} · × ${esc(item.quantity)} · ${esc(money(item.unitPriceCents, order.currency))} · ${esc(money(item.lineTotalCents, order.currency))}</li>`;
  }).join('');
  const fulfil = order.fulfilment || {};
  const statusOptions = FULFILMENT_STATUSES.map((status) => option(status, fulfilmentLabel(status), fulfil.status || 'unfulfilled')).join('');
  const open = order.sessionStatus === 'open' || order.sessionStatus === 'expired';
  const back = open ? `${base}?tab=open` : base;
  return shell({
    title: `${orderReference(order.id)} — OTRACE`,
    body: `${header(base, { authed: true })}
    <main>
      <p><a href="${esc(back)}">All orders</a></p>
      <h1>${esc(orderReference(order.id))}</h1>
      <p class="muted">${esc(order.id)}</p>
      ${saved ? '<p class="warn" role="status">Saved.</p>' : ''}
      ${error ? `<p class="alert" role="alert">${esc(error)}</p>` : ''}
      <dl>
        ${row('Date', `${esc(when.pkt)}<br><span class="muted">${esc(when.utc)}</span>`)}
        ${row('Customer', esc(order.customerName || '—'))}
        ${row('Email', esc(order.email || '—'))}
        ${row('Phone', esc(order.phone || '—'))}
        ${row('Shipping address', ship ? block(ship) : '—')}
        ${row('Items', items ? `<ul>${items}</ul>` : '—')}
        ${row('Discount', esc(`${money(order.discountCents, order.currency)}${order.promoCodes?.length ? ` (${order.promoCodes.join(', ')})` : ''}`))}
        ${row('Shipping', esc(money(order.shippingCents, order.currency)))}
        ${row('Tax', esc(money(order.taxCents, order.currency)))}
        ${row('Subtotal', Number.isFinite(order.subtotalCents) ? esc(money(order.subtotalCents, order.currency)) : '—')}
        ${row('Total', esc(money(order.totalCents, order.currency)))}
        ${row('Payment', esc(paymentLabel(order.paymentStatus)))}
        ${row('Refund', esc(refundLabel(order.refundStatus)))}
        ${row('Stripe', `<a href="${esc(stripeDashboardUrl(order))}">Open in Stripe</a>`)}
      </dl>
      <form class="stack panel" method="post" action="${esc(base)}/orders/${esc(order.id)}">
        <h2>Fulfilment</h2>
        <label><span>Status</span><select name="status">${statusOptions}</select></label>
        <label><span>Tracking number</span><input name="tracking_number" value="${esc(fulfil.trackingNumber || '')}" maxlength="128"></label>
        <label><span>Carrier</span><input name="carrier" value="${esc(fulfil.carrier || '')}" maxlength="64" placeholder="DHL, UPS, USPS"></label>
        <label><span>Internal note</span><textarea name="note" maxlength="2000">${esc(fulfil.note || '')}</textarea></label>
        <p><button type="submit">Save fulfilment</button></p>
      </form>
    </main>`,
  });
}

export function renderMessage({ base, title, message }) {
  return shell({
    title: `${title} — OTRACE`,
    body: `${header(base, { authed: true })}
    <main>
      <p><a href="${esc(base)}">All orders</a></p>
      <h1>${esc(title)}</h1>
      <p>${esc(message)}</p>
    </main>`,
  });
}
