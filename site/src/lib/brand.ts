/**
 * Who the shop is, off the page.
 *
 * A store with no address and no accounts reads as a test site — to customers
 * deciding whether to send $148, and to Stripe when they review the account.
 * These are set at build time so they can be filled in the moment the domain
 * and the social handles exist:
 *
 *   VITE_CONTACT_EMAIL=hello@otrace.co
 *   VITE_INSTAGRAM=https://instagram.com/otrace
 *   VITE_TIKTOK=https://tiktok.com/@otrace
 *
 * Anything not set renders nothing at all. An address that bounces or a link to
 * an account that does not exist is worse than silence.
 */

const clean = (value: string | undefined) => {
  const text = String(value ?? '').trim();
  return text && text !== 'undefined' ? text : null;
};

export const CONTACT_EMAIL = clean(import.meta.env.VITE_CONTACT_EMAIL);

export type SocialLink = { name: string; href: string };

export const SOCIAL: SocialLink[] = [
  { name: 'Instagram', href: clean(import.meta.env.VITE_INSTAGRAM) ?? '' },
  { name: 'TikTok', href: clean(import.meta.env.VITE_TIKTOK) ?? '' },
  { name: 'Pinterest', href: clean(import.meta.env.VITE_PINTEREST) ?? '' },
].filter((link): link is SocialLink => Boolean(link.href));

export const hasSocial = SOCIAL.length > 0;
