/**
 * Who the shop is, off the page.
 *
 * A store with no address and no accounts reads as a test site — to customers
 * deciding whether to send $148, and to Stripe when they review the account.
 * These are set at build time so they can be filled in the moment the domain
 * and the social handles exist:
 *
 *   VITE_CONTACT_EMAIL=info@otrace.co
 *   VITE_INSTAGRAM=https://instagram.com/your-real-account
 *   VITE_INSTAGRAM_URL=   (alias of VITE_INSTAGRAM)
 *   VITE_TIKTOK=
 *   VITE_PINTEREST=
 *   VITE_WHATSAPP_NUMBER=              (E.164 digits, no plus)
 *   PUBLIC_WHATSAPP_NUMBER=            (alias, inlined because vite envPrefix includes PUBLIC_)
 *
 * The published mailbox defaults to info@otrace.co. Social links and the
 * WhatsApp button render only when a real URL or number is set. A link to an
 * account that does not exist is worse than silence, so none are invented here.
 * The example values above are placeholders, not live profiles.
 */

import { CONTACT_EMAIL_PUBLIC } from '@/lib/entity';

const clean = (value: string | undefined) => {
  const text = String(value ?? '').trim();
  return text && text !== 'undefined' ? text : null;
};

export const CONTACT_EMAIL = clean(import.meta.env.VITE_CONTACT_EMAIL) ?? CONTACT_EMAIL_PUBLIC;

export type SocialLink = { name: string; href: string };

const instagram = clean(import.meta.env.VITE_INSTAGRAM) ?? clean(import.meta.env.VITE_INSTAGRAM_URL);

export const SOCIAL: SocialLink[] = [
  { name: 'Instagram', href: instagram ?? '' },
  { name: 'TikTok', href: clean(import.meta.env.VITE_TIKTOK) ?? '' },
  { name: 'Pinterest', href: clean(import.meta.env.VITE_PINTEREST) ?? '' },
].filter((link): link is SocialLink => Boolean(link.href));

export const hasSocial = SOCIAL.length > 0;

/** E.164 digits without a plus. Empty when unset or not a plausible length. */
function whatsappDigits(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export const WHATSAPP_NUMBER = whatsappDigits(
  clean(import.meta.env.VITE_WHATSAPP_NUMBER) ?? clean(import.meta.env.PUBLIC_WHATSAPP_NUMBER),
);

export const WHATSAPP_URL = WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}` : null;
