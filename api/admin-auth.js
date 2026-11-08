/**
 * Private dashboard session.
 *
 * The password is compared as two SHA-256 digests so the check stays
 * constant-time when the typed password and ADMIN_PASSWORD differ in length
 * (timingSafeEqual throws on a length mismatch). The cookie holds only an
 * expiry, signed with HMAC-SHA256. ADMIN_SESSION_SECRET is the key when it
 * is set; otherwise the key is scrypt(ADMIN_PASSWORD), which is not the
 * password and stays stable across restarts.
 */
import { createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'otrace_admin';
export const SESSION_MS = 12 * 60 * 60 * 1000;
export const SESSION_MAX_AGE = 12 * 60 * 60;
export const LOGIN_MAX_ATTEMPTS = 8;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function adminPasswordSet(value = process.env.ADMIN_PASSWORD) {
  return typeof value === 'string' && value.length > 0;
}

export function passwordsMatch(input, expected) {
  const given = createHash('sha256').update(String(input), 'utf8').digest();
  const actual = createHash('sha256').update(String(expected), 'utf8').digest();
  return timingSafeEqual(given, actual);
}

function fixedEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length === b.length && a.length > 0) return timingSafeEqual(a, b);
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
  return false;
}

export function createSessionCodec({ secret = () => '', password = () => '' } = {}) {
  let memo = null;
  const key = () => {
    const explicit = String(secret() || '');
    if (explicit) return explicit;
    const pw = String(password() || '');
    if (!memo || memo.pw !== pw) {
      memo = { pw, key: scryptSync(pw, 'otrace-admin-session-v1', 32) };
    }
    return memo.key;
  };
  const sign = (body) => createHmac('sha256', key()).update(body).digest('base64url');

  return {
    issue(now = Date.now()) {
      const body = Buffer.from(JSON.stringify({ exp: now + SESSION_MS })).toString('base64url');
      return `${body}.${sign(body)}`;
    },
    read(token, now = Date.now()) {
      if (typeof token !== 'string') return null;
      const dot = token.indexOf('.');
      if (dot <= 0) return null;
      const body = token.slice(0, dot);
      const sig = token.slice(dot + 1);
      if (!fixedEqual(sig, sign(body))) return null;
      try {
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (!payload || typeof payload.exp !== 'number' || payload.exp <= now) return null;
        return payload;
      } catch {
        return null;
      }
    },
  };
}

export function sessionCookie(token, { maxAge = SESSION_MAX_AGE } = {}) {
  return [
    `${ADMIN_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

export function clearSessionCookie() {
  return sessionCookie('', { maxAge: 0 });
}

export function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq <= 0 || trimmed.slice(0, eq) !== name) continue;
    try { return decodeURIComponent(trimmed.slice(eq + 1)); }
    catch { return trimmed.slice(eq + 1); }
  }
  return '';
}

/**
 * Failed password attempts per IP. A correct password clears the counter.
 * The window is in-process; one API container is the shop.
 */
export function createLoginLimiter({
  max = LOGIN_MAX_ATTEMPTS,
  windowMs = LOGIN_WINDOW_MS,
  now = () => Date.now(),
} = {}) {
  const hits = new Map();
  const current = (ip) => {
    const row = hits.get(ip);
    if (!row) return null;
    if (now() - row.start >= windowMs) {
      hits.delete(ip);
      return null;
    }
    return row;
  };
  return {
    blocked(ip) {
      const row = current(ip);
      return Boolean(row && row.count >= max);
    },
    fail(ip) {
      const row = current(ip);
      if (!row) hits.set(ip, { start: now(), count: 1 });
      else row.count += 1;
    },
    reset(ip) {
      hits.delete(ip);
    },
  };
}
