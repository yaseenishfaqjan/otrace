/**
 * OTRACE transactional emails.
 *
 * Table-based with inline styles — Outlook has no flexbox or grid, and a
 * <style> block is stripped by several clients. Every message ships a
 * plain-text part too, because a text-only fallback is what a spam filter
 * looks for and what a watch renders.
 *
 * No REMOTE images: most clients block them by default, and a receipt full of
 * grey placeholder boxes reads as a phishing attempt. The logo is the one
 * exception, and it travels INSIDE the message as a cid: attachment (see
 * LOGO_ATTACHMENT in server.js), which clients display without fetching
 * anything. Its alt text is styled as the old type wordmark, so a client that
 * still hides it shows "OTRACE" rather than a broken box.
 */

export const LOGO_CID = 'otrace-logo';

const ONYX = '#0D0C0B';
const CREAM = '#F0EBE0';
const DIM = '#B9B3A8';
const MUTED = '#8A8681';
const LINE = '#2A2A2A';

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

const shellOpen = (preheader) => `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>OTRACE</title>
</head>
<body style="margin:0;padding:0;background-color:${ONYX};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${ONYX};">
  <tr><td align="center" style="padding:0;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
      <tr>
        <td align="center" style="padding:40px 32px 32px;">
          <img src="cid:${LOGO_CID}" width="150" height="106" alt="OTRACE" style="display:block;width:150px;height:106px;border:0;outline:none;text-decoration:none;font-family:${FONT};font-size:26px;font-weight:bold;letter-spacing:6px;color:${CREAM};" />
        </td>
      </tr>`;

const shellClose = (siteUrl) => `
      <tr>
        <td style="padding:0 32px;"><div style="height:1px;background-color:${LINE};font-size:0;line-height:0;">&nbsp;</div></td>
      </tr>
      <tr>
        <td align="center" style="padding:28px 32px 48px;">
          <p style="margin:0;font-family:${FONT};font-size:11px;line-height:18px;color:${MUTED};">
            OTRACE &middot; <a href="${siteUrl}" style="color:${MUTED};text-decoration:underline;">${siteUrl.replace(/^https?:\/\//, '')}</a>
          </p>
          <p style="margin:8px 0 0;font-family:${FONT};font-size:11px;line-height:18px;color:${MUTED};">
            Reply to this email and a person will answer.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

/**
 * @param {object} o
 * @param {string} o.siteUrl  absolute origin, no trailing slash
 * @param {object} o.order    { reference, items, shipping, amountTotalCents, shippingCents }
 */
export function orderEmail({ siteUrl, order }) {
  // Every pre-order line in this drop shares a window; if that ever stops being
  // true the longest one is the honest thing to promise.
  const preorderWindow = order.items.find((i) => i.preorder)?.shipsIn ?? null;

  const itemRows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:14px;color:${CREAM};">
          ${i.quantity} &times; ${i.name}<br />
          <span style="color:${MUTED};font-size:12px;">${[i.colour, i.size].filter(Boolean).join(' &middot; ')}</span>
          ${i.preorder ? `<br /><span style="color:${MUTED};font-size:12px;">Pre-order &middot; ships in ${i.shipsIn}</span>` : ''}
        </td>
        <td align="right" style="padding:16px 0;border-bottom:1px solid ${LINE};font-family:${FONT};font-size:14px;color:${CREAM};white-space:nowrap;">
          ${money(i.lineTotalCents)}
        </td>
      </tr>`,
    )
    .join('');

  const ship = order.shipping;
  const address = ship?.address
    ? [
        ship.name,
        ship.address.line1,
        ship.address.line2,
        `${ship.address.city ?? ''} ${ship.address.state ?? ''} ${ship.address.postal_code ?? ''}`.trim(),
        ship.address.country,
      ].filter(Boolean)
    : [];

  const html = `${shellOpen(`Order ${order.reference} confirmed.`)}
      <tr>
        <td style="padding:0 32px;">
          <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${MUTED};">Order confirmed</p>
          <h1 style="margin:0;font-family:${FONT};font-size:38px;line-height:0.95;font-weight:bold;letter-spacing:-1px;text-transform:uppercase;color:${CREAM};">Thank<br />you</h1>
          <p style="margin:20px 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:${DIM};">
            Your order is in. ${preorderWindow
              ? `Your pieces are made to order and ship in ${preorderWindow}`
              : 'We ship within 3&ndash;5 business days'} &mdash; we email tracking the moment they leave us.
          </p>
          <p style="margin:24px 0 0;font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${MUTED};">Order</p>
          <p style="margin:4px 0 0;font-family:${FONT};font-size:20px;font-weight:bold;letter-spacing:2px;color:${CREAM};">${order.reference}</p>
        </td>
      </tr>
      ${
        preorderWindow
          ? `<tr>
        <td style="padding:28px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};">
            <tr>
              <td style="padding:18px 20px;font-family:${FONT};font-size:13px;line-height:21px;color:${DIM};">
                <span style="color:${CREAM};font-weight:bold;letter-spacing:2px;text-transform:uppercase;font-size:11px;">This is a pre-order</span><br />
                Your card has been charged today to reserve your size, and your
                order ships in <span style="color:${CREAM};">${preorderWindow}</span>.
                Reply to this email to change or cancel any time before it ships.
              </td>
            </tr>
          </table>
        </td>
      </tr>`
          : ''
      }
      <tr>
        <td style="padding:32px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${itemRows}
            <tr>
              <td style="padding:16px 0 4px;font-family:${FONT};font-size:13px;color:${MUTED};">Delivery</td>
              <td align="right" style="padding:16px 0 4px;font-family:${FONT};font-size:13px;color:${CREAM};">
                ${order.shippingCents ? money(order.shippingCents) : 'Free'}
              </td>
            </tr>
            <tr>
              <td style="padding:14px 0;border-top:1px solid ${CREAM};font-family:${FONT};font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${CREAM};">Total</td>
              <td align="right" style="padding:14px 0;border-top:1px solid ${CREAM};font-family:${FONT};font-size:18px;font-weight:bold;color:${CREAM};white-space:nowrap;">
                ${money(order.amountTotalCents)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${
        address.length
          ? `<tr>
        <td style="padding:28px 32px 0;">
          <p style="margin:0 0 8px;font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${MUTED};">Delivering to</p>
          <p style="margin:0;font-family:${FONT};font-size:14px;line-height:22px;color:${CREAM};">${address.join('<br />')}</p>
        </td>
      </tr>`
          : ''
      }
      <tr>
        <td style="padding:36px 32px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="${CREAM}">
                <a href="${siteUrl}/shop" style="display:inline-block;padding:16px 36px;font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${ONYX};text-decoration:none;">Keep shopping</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
${shellClose(siteUrl)}`;

  const text = `OTRACE

ORDER CONFIRMED — ${order.reference}

${order.items
  .map((i) => `  ${i.quantity} x ${i.name} (${[i.colour, i.size].filter(Boolean).join(', ')})   ${money(i.lineTotalCents)}`)
  .join('\n')}

Delivery                 ${order.shippingCents ? money(order.shippingCents) : 'Free'}
Total                    ${money(order.amountTotalCents)}

DELIVERING TO
${address.join('\n') || '(not provided)'}

${preorderWindow
  ? `THIS IS A PRE-ORDER. Your card has been charged today to reserve your size,
and your order ships in ${preorderWindow}.`
  : 'We ship within 3-5 business days and email tracking when it leaves us.'}

Reply to this email with any change and we will handle it before it ships.

${siteUrl}
`;

  return { subject: `Order confirmed — ${order.reference} | OTRACE`, html, text };
}

export function welcomeEmail({ siteUrl }) {
  const html = `${shellOpen('You are on the list.')}
      <tr>
        <td style="padding:0 32px;">
          <p style="margin:0 0 10px;font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${MUTED};">You&rsquo;re on the list</p>
          <h1 style="margin:0;font-family:${FONT};font-size:38px;line-height:0.95;font-weight:bold;letter-spacing:-1px;text-transform:uppercase;color:${CREAM};">First<br />access</h1>
          <p style="margin:20px 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:${DIM};">
            Drops are small and they do not restock. You&rsquo;ll hear from us before
            anyone else &mdash; and only when there is something worth saying.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 32px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="${CREAM}">
                <a href="${siteUrl}/shop" style="display:inline-block;padding:16px 36px;font-family:${FONT};font-size:12px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;color:${ONYX};text-decoration:none;">See AW2026</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
${shellClose(siteUrl)}`;

  const text = `OTRACE

YOU'RE ON THE LIST

Drops are small and they do not restock. You'll hear from us before anyone
else - and only when there is something worth saying.

See AW2026: ${siteUrl}/shop
`;

  return { subject: 'You’re on the list | OTRACE', html, text };
}
