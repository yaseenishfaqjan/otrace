/**
 * Storefront lead helpers. The API persists the row; Klaviyo runs server-side.
 */

export const EMAIL_CONSENT =
  'You’ll get the oversized fit guide and a note before the next drop. Unsubscribe any time.';

export const SMS_CONSENT =
  'Text me about drops. Msg & data rates may apply, reply STOP to opt out, consent is not a condition of purchase.';

export const WHATSAPP_CONSENT =
  'WhatsApp me about fit and drops. We only message you if this box is ticked.';

const KEY = 'otrace-lead-capture';
const COOKIE = 'otrace_capture';
export const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export const POPUP_DELAY_MS = 8000;

export type CaptureRecord = {
  subscribed?: boolean;
  dismissedAt?: number;
};

export type CaptureMode = 'timed' | 'exit' | 'both' | 'off';

/** Timed popup stays off the cart and the order-success page. Checkout itself is Stripe-hosted. */
export function captureMode(path: string): CaptureMode {
  if (path === '/cart') return 'exit';
  if (path === '/order/success' || path.startsWith('/order/')) return 'off';
  if (path.startsWith('/product/')) return 'both';
  return 'timed';
}

function readCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const pair = document.cookie.split('; ').find((part) => part.startsWith(`${COOKIE}=`));
  return pair ? decodeURIComponent(pair.slice(COOKIE.length + 1)) : null;
}

export function readCapture(): CaptureRecord {
  let stored: CaptureRecord = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw) as CaptureRecord;
  } catch {
    stored = {};
  }
  const cookie = readCookie();
  if (cookie === 'subscribed') return { ...stored, subscribed: true };
  if (cookie === 'dismissed' && !stored.dismissedAt) return { ...stored, dismissedAt: Date.now() };
  return stored;
}

export function writeCapture(next: CaptureRecord) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    const value = next.subscribed ? 'subscribed' : 'dismissed';
    const age = next.subscribed ? 60 * 60 * 24 * 365 : Math.floor(DISMISS_COOLDOWN_MS / 1000);
    document.cookie = `${COOKIE}=${value}; Max-Age=${age}; Path=/; SameSite=Lax`;
  } catch {
    // Private mode can throw. The popup may show again; the signup itself still posts.
  }
}

export function shouldAutoOpen(record: CaptureRecord, now = Date.now()) {
  if (record.subscribed) return false;
  if (!record.dismissedAt) return true;
  return now - record.dismissedAt >= DISMISS_COOLDOWN_MS;
}

export function shouldShowTeaser(record: CaptureRecord, now = Date.now()) {
  if (record.subscribed || !record.dismissedAt) return false;
  return now - record.dismissedAt < DISMISS_COOLDOWN_MS;
}
