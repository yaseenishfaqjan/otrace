import { Link } from 'wouter';
import { EMAIL_CONSENT } from '@/lib/capture';

/** Marketing line under an email field. Not a checkbox, and nothing is pre-ticked. */
export function ConsentNote({ id }: { id?: string }) {
  return (
    <p id={id} className="text-muted text-[11px] leading-relaxed mt-3">
      {EMAIL_CONSENT}{' '}
      <Link href="/privacy" className="text-cream-dim underline underline-offset-4 hover:text-cream">
        Privacy
      </Link>
      .
    </p>
  );
}

/** Contact-form line. Joining the list is a different form. */
export function ReplyConsent({ id }: { id?: string }) {
  return (
    <p id={id} className="text-muted text-[11px] leading-relaxed mt-3">
      We use this email to reply to your message.{' '}
      <Link href="/privacy" className="text-cream-dim underline underline-offset-4 hover:text-cream">
        Privacy
      </Link>
      .
    </p>
  );
}
