/**
 * Who the shop is, off the page.
 *
 * A store with no address and no accounts reads as a test site — to customers
 * deciding whether to send $148, and to Stripe when they review the account.
 * These are set at build time so they can be filled in the moment the domain
 * and the social handles exist:
 *
 *   VITE_CONTACT_EMAIL=info@otrace.co
 *   VITE_INSTAGRAM=https://instagram.com/otrace
 *   VITE_TIKTOK=https://tiktok.com/@otrace
 *
 * The published mailbox defaults to info@otrace.co. Social links render only
 * when a real URL is set. A link to an account that does not exist is worse
 * than silence, so none are invented here.
 */

import { CONTACT_EMAIL_PUBLIC } from '@/lib/entity';

const clean = (value: string | undefined) => {
  const text = String(value ?? '').trim();
  return text && text !== 'undefined' ? text : null;
};

export const CONTACT_EMAIL = clean(import.meta.env.VITE_CONTACT_EMAIL) ?? CONTACT_EMAIL_PUBLIC;

export type SocialLink = { name: string; href: string };

export const SOCIAL: SocialLink[] = [
  { name: 'Instagram', href: clean(import.meta.env.VITE_INSTAGRAM) ?? '' },
  { name: 'TikTok', href: clean(import.meta.env.VITE_TIKTOK) ?? '' },
  { name: 'Pinterest', href: clean(import.meta.env.VITE_PINTEREST) ?? '' },
].filter((link): link is SocialLink => Boolean(link.href));

export const hasSocial = SOCIAL.length > 0;
