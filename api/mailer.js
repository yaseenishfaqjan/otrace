/**
 * Getting mail out of this VPS.
 *
 * Both shops on this VPS sent through a cPanel mailbox over SMTP, which
 * cannot work here: measured 26 Oct 2026, the cPanel host 95.216.22.216 is
 * unreachable from 209.145.55.76 on EVERY port - 25, 465, 587, 2525, and also
 * 80, 443, 993, 995 - with 100% packet loss on ping. That is an IP-level block
 * between the two machines, not an anti-spam port policy, so no SMTP_HOST,
 * port or TLS change can fix it.
 *
 * The only symptom was one quiet line, `[mail] welcome failed: Connection
 * timeout`. Every order receipt and every owner notification has been failing
 * that way, while the shop looked healthy.
 *
 * Resend goes over HTTPS on 443, which IS reachable, so it is tried first.
 * SMTP is kept as a fallback and tried second, so the day a reachable relay
 * exists this file needs no change.
 *
 * Three outcomes, deliberately distinct:
 *   sent            - a provider accepted it
 *   not_configured  - nothing was set up; NOT a failure, and it must not read
 *                     like an outage in the logs
 *   failed          - a provider was tried and refused
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * @param {object} o
 * @param {string} [o.resendApiKey]
 * @param {string} o.from          default From header, e.g. "Shop" <info@...>
 * @param {object} [o.smtpTransport] a nodemailer transport, or null
 * @param {Function} [o.fetchImpl]   injectable for tests; nothing is sent when stubbed
 */
export function createMailer({ resendApiKey, from, smtpTransport, fetchImpl, cidBase } = {}) {
  const doFetch = fetchImpl ?? globalThis.fetch;

  /**
   * The branded emails reference their images as `cid:hero.jpg` and ship them
   * as inline attachments, which is an SMTP convention. Resend's API has no
   * equivalent, so for that path the references are rewritten to the real URLs
   * - the same files are served publicly at <site>/email/<name> - and the
   * attachments are dropped. Without this the Resend copy of every order email
   * arrives with broken images.
   */
  const inlineToUrls = (html) => {
    if (!html || !cidBase) return html;
    return String(html).replace(
      /(["'(])cid:([A-Za-z0-9._-]+)/g,
      (_m, open, file) => `${open}${String(cidBase).replace(/\/$/, '')}/${file}`,
    );
  };

  /**
   * Transient network faults must not lose an order confirmation.
   *
   * Measured 26 Oct 2026 from inside the container: the same request failed
   * with `fetch failed / EAI_AGAIN` - a DNS hiccup - and succeeded 1.2s later.
   * With no retry that one blip is a customer who paid and heard nothing.
   *
   * Only network errors are retried. An HTTP 4xx means Resend understood us
   * and said no (unverified domain, bad key), and repeating it just delays the
   * log line that explains the problem.
   */
  const NETWORK_RETRIES = 3;
  const backoffMs = (attempt) => 400 * attempt;

  async function viaResend(message) {
    if (!resendApiKey) return { status: 'not_configured', provider: 'resend' };
    let lastError = null;
    for (let attempt = 1; attempt <= NETWORK_RETRIES; attempt += 1) {
      const result = await resendOnce(message);
      if (result.status !== 'network_error') return result;
      lastError = result.reason;
      if (attempt < NETWORK_RETRIES) {
        console.warn(`[mail] resend attempt ${attempt} failed (${result.reason}), retrying`);
        await new Promise((r) => setTimeout(r, backoffMs(attempt)));
      }
    }
    return { status: 'failed', provider: 'resend', reason: `${lastError} after ${NETWORK_RETRIES} attempts` };
  }

  async function resendOnce(message) {
    try {
      const res = await doFetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${resendApiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from ?? from,
          to: [message.to],
          subject: message.subject,
          ...(message.html ? { html: inlineToUrls(message.html) } : {}),
          ...(message.text ? { text: message.text } : {}),
        }),
      });
      if (res.ok) return { status: 'sent', provider: 'resend' };
      // Resend puts the real reason in the body; the status alone is useless
      // for the commonest failure, an unverified sending domain.
      const detail = await res.text().catch(() => '');
      return { status: 'failed', provider: 'resend', reason: `HTTP ${res.status} ${detail.slice(0, 200)}` };
    } catch (err) {
      // `fetch failed` hides the real reason; the cause carries the code.
      const cause = err?.cause?.code || err?.cause?.message || '';
      return {
        status: 'network_error',
        provider: 'resend',
        reason: cause ? `${err.message} (${cause})` : err.message,
      };
    }
  }

  async function viaSmtp(message) {
    if (!smtpTransport) return { status: 'not_configured', provider: 'smtp' };
    try {
      await smtpTransport.sendMail({
        from: message.from ?? from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.attachments ? { attachments: message.attachments } : {}),
      });
      return { status: 'sent', provider: 'smtp' };
    } catch (err) {
      return { status: 'failed', provider: 'smtp', reason: err.message };
    }
  }

  /**
   * Try each provider in turn. A mail problem must never fail an order, so
   * this resolves rather than throws - but unlike the code it replaces, every
   * outcome is logged, including the case where nothing is configured at all.
   */
  async function deliver(message) {
    if (!message?.to) {
      console.error('[mail] refused: no recipient for', JSON.stringify(message?.subject ?? ''));
      return false;
    }

    const attempts = [];
    for (const attempt of [viaResend, viaSmtp]) {
      const result = await attempt(message);
      attempts.push(result);
      if (result.status === 'sent') {
        console.log(`[mail] sent via ${result.provider}: "${message.subject}" to ${message.to}`);
        return true;
      }
    }

    const tried = attempts.filter((a) => a.status === 'failed');
    if (tried.length === 0) {
      console.error(
        `[mail] NOT SENT "${message.subject}" to ${message.to} - no email provider is configured. ` +
          'Set RESEND_API_KEY (SMTP to the cPanel host cannot reach it from this VPS).',
      );
    } else {
      console.error(
        `[mail] FAILED "${message.subject}" to ${message.to} - ` +
          tried.map((a) => `${a.provider}: ${a.reason}`).join(' | '),
      );
    }
    return false;
  }

  /** One line at boot so the state is visible without sending anything. */
  function describe() {
    const on = [];
    if (resendApiKey) on.push('resend(https)');
    if (smtpTransport) on.push('smtp');
    return on.length ? on.join(' -> ') : 'NOTHING CONFIGURED';
  }

  return { deliver, describe };
}
