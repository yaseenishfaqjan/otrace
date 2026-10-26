import { useId, useState } from 'react';
import { postJson } from '@/lib/api';
import { ConsentNote } from '@/components/consent-note';

type Props = {
  formId: string;
  source?: string;
  productSlug?: string | null;
  size?: string | null;
  colour?: string | null;
  /** Waitlist posts are useless without a size. */
  requireSize?: boolean;
  submitLabel: string;
  pendingLabel?: string;
  variant?: 'underline' | 'stack';
};

export function LeadForm({
  formId,
  source,
  productSlug,
  size,
  colour,
  requireSize = false,
  submitLabel,
  pendingLabel = 'Sending',
  variant = 'stack',
}: Props) {
  const consentId = useId();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'sending') return;
    if (requireSize && !size) {
      setState('error');
      setMessage('Choose a size first.');
      return;
    }
    setState('sending');
    try {
      const data = await postJson<{ alreadySubscribed?: boolean }>('/api/subscribe', {
        email,
        source: source ?? formId,
        formId,
        path: window.location.pathname,
        productSlug: productSlug ?? undefined,
        size: size ?? undefined,
        colour: colour ?? undefined,
        marketingConsent: true,
        marketingConsentMethod: formId,
      });
      setState('done');
      setMessage(data.alreadySubscribed ? 'You’re already on the list.' : 'You’re on the list.');
      setEmail('');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'That did not work.');
    }
  };

  const underline = variant === 'underline';

  return (
    <form onSubmit={submit} className="w-full min-w-0">
      <div className={underline
        ? 'flex items-end gap-4 border-b border-line focus-within:border-cream transition-colors pb-3'
        : 'flex flex-col gap-3'}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state !== 'sending') setState('idle'); }}
          placeholder="Email address"
          aria-label="Email address"
          aria-describedby={consentId}
          autoComplete="email"
          className={underline
            ? 'flex-1 min-w-0 bg-transparent text-cream placeholder:text-muted text-base md:text-lg outline-none py-2'
            : 'w-full min-w-0 bg-transparent border border-line focus:border-cream text-cream placeholder:text-muted px-4 py-3 outline-none transition-colors'}
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className={underline
            ? 'eyebrow text-cream shrink-0 disabled:opacity-50 -mx-3 -mt-3 -mb-3 px-3 pt-3 pb-4'
            : 'btn w-full'}
        >
          {state === 'sending' ? pendingLabel : submitLabel}
        </button>
      </div>
      <ConsentNote id={consentId} />
      {message && (
        <p className={`text-xs mt-3 ${state === 'error' ? 'text-red-400' : 'text-cream-dim'}`}>{message}</p>
      )}
    </form>
  );
}
