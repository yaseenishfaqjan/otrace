/**
 * Klaviyo is the list. This module creates or updates a profile and subscribes
 * that profile to one list. It does not send the three-email welcome sequence —
 * that sequence is a Klaviyo Flow the owner pastes in (see seo/LEAD-CAPTURE.md).
 *
 * If the private key or list id is missing, sync is skipped and the caller
 * keeps the MySQL row. A Klaviyo error must not fail the HTTP request.
 */

const REVISION = '2024-10-15';
const API = 'https://a.klaviyo.com/api';

export function klaviyoConfig() {
  const key = String(process.env.KLAVIYO_PRIVATE_API_KEY ?? '').trim();
  const listId = String(process.env.KLAVIYO_LIST_ID ?? '').trim();
  return {
    key,
    listId,
    configured: Boolean(key && listId),
  };
}

/** E.164 with a leading +. No country code is guessed. */
export function toE164(phone) {
  if (!phone) return null;
  const compact = String(phone).replace(/[\s().-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

function propertiesOf(lead) {
  const properties = {
    form_id: lead.formId,
    source: lead.source,
    sms_consent: Boolean(lead.smsConsent),
    whatsapp_consent: Boolean(lead.whatsappConsent),
  };
  if (lead.path) properties.page = lead.path;
  if (lead.productSlug) properties.product_slug = lead.productSlug;
  if (lead.size) properties.size = lead.size;
  if (lead.colour) properties.colour = lead.colour;
  const e164 = toE164(lead.phone);
  if (lead.whatsappConsent && lead.phone) properties.whatsapp_phone = e164 || lead.phone;
  return properties;
}

async function klaviyoPost(key, path, payload) {
  const response = await fetch(`${API}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${key}`,
      revision: REVISION,
      'content-type': 'application/vnd.api+json',
      accept: 'application/vnd.api+json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`${path} ${response.status} ${detail}`);
  }
}

/**
 * @returns {{ status: 'skipped' | 'synced' | 'failed', reason?: string }}
 */
export async function syncSubscriber(lead) {
  const { key, listId, configured } = klaviyoConfig();
  if (!configured) {
    console.warn(
      '[klaviyo] ESP sync skipped — KLAVIYO_PRIVATE_API_KEY or KLAVIYO_LIST_ID unset. Lead stored in MySQL only.',
    );
    return { status: 'skipped', reason: 'unset' };
  }

  const e164 = toE164(lead.phone);
  const profile = {
    type: 'profile',
    attributes: {
      email: lead.email,
      properties: propertiesOf(lead),
    },
  };
  // phone_number on the profile is what Klaviyo uses for SMS. Set it only
  // with SMS consent and a real E.164 value, so a WhatsApp number is not
  // enrolled in texts by accident.
  if (lead.smsConsent && e164) profile.attributes.phone_number = e164;
  if (lead.smsConsent && lead.phone && !e164) {
    console.warn('[klaviyo] SMS consent stored in MySQL; phone is not E.164 so the Klaviyo SMS subscribe was skipped.');
  }

  const subscriptions = {
    email: { marketing: { consent: 'SUBSCRIBED' } },
  };
  const listProfile = {
    type: 'profile',
    attributes: {
      email: lead.email,
      subscriptions,
    },
  };
  if (lead.smsConsent && e164) {
    listProfile.attributes.phone_number = e164;
    subscriptions.sms = { marketing: { consent: 'SUBSCRIBED' } };
  }

  try {
    await klaviyoPost(key, 'profile-import/', { data: profile });
    await klaviyoPost(key, 'profile-subscription-bulk-create-jobs/', {
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          custom_source: lead.formId || lead.source || 'web-form',
          profiles: { data: [listProfile] },
        },
        relationships: {
          list: { data: { type: 'list', id: listId } },
        },
      },
    });
    console.log(`[klaviyo] synced ${lead.formId || lead.source} for ${lead.email}`);
    return { status: 'synced' };
  } catch (err) {
    console.error('[klaviyo] ESP sync failed; lead kept in MySQL:', err.message);
    return { status: 'failed', reason: err.message };
  }
}
