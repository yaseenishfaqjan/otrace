import { useId, useState } from 'react';
import { CONTACT_EMAIL, SOCIAL, hasSocial } from '@/lib/brand';
import { postJson } from '@/lib/api';
import { ReplyConsent } from '@/components/consent-note';
import { whatsappFitHref } from '@/lib/whatsapp';

import { usePageMeta } from '@/lib/use-page-meta';
export default function Contact() {
  usePageMeta('Contact', 'Contact OTRACE about an order, sizing, wholesale or a product. A person replies within one business day.');
  const consentId = useId();
  const [inquiry, setInquiry] = useState('order');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const whatsapp = whatsappFitHref();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    const form = new FormData(e.currentTarget);
    const details = [
      form.get('business'),
      form.get('quantity') ? `Quantity: ${form.get('quantity')}` : '',
      form.get('timeline') ? `Timeline: ${form.get('timeline')}` : '',
    ].map((line) => String(line ?? '').trim()).filter(Boolean);
    const note = String(form.get('message') ?? '').trim();
    try {
      await postJson('/api/contact', {
        name: form.get('name'),
        email: form.get('email'),
        subject: form.get('subject'),
        inquiryType: form.get('inquiryType'),
        message: [...details, note].filter(Boolean).join('\n\n'),
      });
      setState('done');
      setMessage('Message received. We reply within one business day.');
      setInquiry('order');
      e.currentTarget.reset();
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'That did not send.');
    }
  };

  const field = 'w-full bg-transparent border border-line focus:border-cream text-cream placeholder:text-muted px-4 py-3.5 outline-none transition-colors';

  return (
    <div className="pt-16 md:pt-20">
      <div className="shell py-12 md:py-16 grid lg:grid-cols-2 gap-12 lg:gap-20 max-w-5xl">
        <div>
          <p className="eyebrow text-muted mb-4">Contact</p>
          <h1 className="display text-cream text-[10vw] lg:text-[3.5rem]">Talk<br />to us</h1>
          <p className="text-cream-dim leading-relaxed mt-6">
            Fit questions, order changes, wholesale. A person reads every message
            and replies within one business day.
          </p>

          {/* Some people will not use a form. Give them the address and the
              accounts instead — and only when they actually exist. */}
          {CONTACT_EMAIL && (
            <p className="mt-6">
              <span className="eyebrow text-muted block mb-2">Or email us</span>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-cream underline underline-offset-4 break-all"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          )}
          {whatsapp && (
            <p className="mt-6">
              <a href={whatsapp} target="_blank" rel="noreferrer" className="text-cream underline underline-offset-4">
                Ask about fit on WhatsApp
              </a>
            </p>
          )}
          {hasSocial && (
            <p className="mt-6">
              <span className="eyebrow text-muted block mb-2">Or find us</span>
              <span className="flex flex-wrap gap-4">
                {SOCIAL.map((s) => (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer me"
                    className="text-cream-dim hover:text-cream text-sm transition-colors"
                  >
                    {s.name}
                  </a>
                ))}
              </span>
            </p>
          )}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4 min-w-0">
          <input name="name" required placeholder="Name" aria-label="Name" className={field} />
          <label className="block min-w-0">
            <span className="eyebrow text-muted block mb-2">Inquiry</span>
            <select
              name="inquiryType"
              required
              value={inquiry}
              onChange={(e) => setInquiry(e.target.value)}
              aria-label="Inquiry type"
              className={`${field} bg-onyx`}
            >
              <option value="order">Order</option>
              <option value="sizing">Sizing</option>
              <option value="wholesale">Wholesale / custom / collab</option>
              <option value="other">Something else</option>
            </select>
          </label>
          {inquiry === 'wholesale' && (
            <>
              <input name="business" placeholder="Business name" aria-label="Business name" className={field} />
              <input name="quantity" placeholder="Quantity" aria-label="Quantity" className={field} />
              <input name="timeline" placeholder="Timeline" aria-label="Timeline" className={field} />
            </>
          )}
          <div>
            <input
              name="email"
              type="email"
              required
              placeholder="Email"
              aria-label="Email"
              aria-describedby={consentId}
              className={field}
            />
            <ReplyConsent id={consentId} />
          </div>
          <input name="subject" placeholder="Subject" aria-label="Subject" className={field} />
          <textarea name="message" required rows={6} placeholder="Message" aria-label="Message" className={`${field} resize-none`} />
          <button type="submit" disabled={state === 'sending'} className="btn mt-2">
            {state === 'sending' ? 'Sending' : 'Send message'}
          </button>
          {message && (
            <p className={`text-sm ${state === 'error' ? 'text-red-400' : 'text-cream-dim'}`}>{message}</p>
          )}
        </form>
      </div>
    </div>
  );
}
