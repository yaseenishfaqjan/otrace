import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useLocation } from 'wouter';
import { useCart } from '@/lib/cart';
import { postJson } from '@/lib/api';
import { ConsentNote } from '@/components/consent-note';
import {
  POPUP_DELAY_MS,
  SMS_CONSENT,
  WHATSAPP_CONSENT,
  captureMode,
  readCapture,
  shouldAutoOpen,
  shouldShowTeaser,
  writeCapture,
  type CaptureRecord,
} from '@/lib/capture';

/**
 * Two-step list popup. The first paint is closed, so prerender snapshots
 * (about 400ms) do not include the dialog. Cart and order success never get
 * the timed open. Exit intent is product pages and the cart page only.
 */
export function CapturePopup() {
  const [location] = useLocation();
  const { isCartOpen } = useCart();
  const consentId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const opened = useRef(false);
  const recordRef = useRef<CaptureRecord>({});
  const dismissRef = useRef(() => {});
  const [record, setRecord] = useState<CaptureRecord>({});
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 'done'>(1);
  const [formId, setFormId] = useState('popup-email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const mode = captureMode(location);
  recordRef.current = record;

  useEffect(() => {
    setRecord(readCapture());
    setHydrated(true);
  }, []);

  const auto = hydrated && shouldAutoOpen(record);
  const timedOn = auto && !isCartOpen && (mode === 'timed' || mode === 'both');
  const exitOn = auto && !isCartOpen && (mode === 'exit' || mode === 'both');

  useEffect(() => {
    if (!timedOn || opened.current) return;
    const timer = window.setTimeout(() => {
      if (opened.current) return;
      opened.current = true;
      setFormId('popup-email');
      setStep(1);
      setOpen(true);
    }, POPUP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [timedOn, location]);

  useEffect(() => {
    if (!exitOn) return;
    const onLeave = (event: MouseEvent) => {
      if (opened.current || event.clientY > 8) return;
      opened.current = true;
      setFormId('exit-intent');
      setStep(1);
      setOpen(true);
    };
    document.documentElement.addEventListener('mouseout', onLeave);
    return () => document.documentElement.removeEventListener('mouseout', onLeave);
  }, [exitOn]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissRef.current();
    };
    window.addEventListener('keydown', onKey);
    emailRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  const showTeaser = hydrated
    && shouldShowTeaser(record)
    && !open
    && !isCartOpen
    && mode !== 'off'
    && mode !== 'exit';

  const timedDialog = formId === 'popup-email' || formId === 'popup-phone';
  const visible = open && !isCartOpen && mode !== 'off' && !(timedDialog && mode === 'exit');

  function dismiss() {
    const next = { ...recordRef.current, dismissedAt: Date.now() };
    writeCapture(next);
    setRecord(next);
    setOpen(false);
  }
  dismissRef.current = dismiss;

  function markSubscribed() {
    const next = { ...record, subscribed: true };
    writeCapture(next);
    setRecord(next);
  }

  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    setMessage('');
    try {
      await postJson('/api/subscribe', {
        email,
        source: formId,
        formId,
        path: window.location.pathname,
        marketingConsent: true,
        marketingConsentMethod: formId,
      });
      markSubscribed();
      setStep(2);
      setState('idle');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  async function submitPhone(event: React.FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;
    if ((smsConsent || whatsappConsent) && !phone.trim()) {
      setState('error');
      setMessage('Add a phone number, or leave the boxes unticked.');
      return;
    }
    if (!phone.trim()) {
      setStep('done');
      return;
    }
    setState('sending');
    setMessage('');
    try {
      await postJson('/api/subscribe', {
        email,
        phone,
        source: formId,
        formId: formId === 'exit-intent' ? 'exit-intent-phone' : 'popup-phone',
        path: window.location.pathname,
        marketingConsent: true,
        marketingConsentMethod: formId,
        smsConsent,
        whatsappConsent,
      });
      setStep('done');
      setState('idle');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  function reopen() {
    opened.current = true;
    setFormId('popup-email');
    setStep(record.subscribed ? 2 : 1);
    setState('idle');
    setMessage('');
    setOpen(true);
  }

  const aboveBuyBar = mode === 'both';

  return (
    <>
      {showTeaser && (
        <button
          type="button"
          onClick={reopen}
          className={`fixed z-[45] left-3 eyebrow bg-cream text-onyx px-3 py-3 ${
            aboveBuyBar ? 'bottom-[5.25rem] sm:bottom-24' : 'bottom-6 sm:bottom-8'
          }`}
        >
          Fit guide
        </button>
      )}

      {visible && (
        <div className="fixed inset-0 z-[75]" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-onyx/80"
            aria-label="Close"
            onClick={dismiss}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-title"
            className="absolute left-4 right-4 bottom-4 max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden bg-onyx border border-line p-6 sm:left-1/2 sm:right-auto sm:w-[26rem] sm:-translate-x-1/2 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="absolute top-4 right-4 text-muted hover:text-cream"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>

            {step === 1 && (
              <form onSubmit={submitEmail}>
                <p className="eyebrow text-muted">First access</p>
                <h2 id="capture-title" className="display text-cream text-3xl mt-3">
                  The fit,
                  <br />
                  before the drop
                </h2>
                <p className="text-cream-dim text-sm leading-relaxed mt-4">
                  The oversized fit guide, and a note before the next drop.
                  The hoodie and the sweatpant are the same fleece — we’ll say when both are in.
                </p>
                <input
                  ref={emailRef}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  aria-label="Email address"
                  aria-describedby={consentId}
                  autoComplete="email"
                  className="mt-6 w-full min-w-0 bg-transparent border border-line focus:border-cream text-cream placeholder:text-muted px-4 py-3 outline-none"
                />
                <ConsentNote id={consentId} />
                <button type="submit" disabled={state === 'sending'} className="btn w-full mt-5">
                  {state === 'sending' ? 'Sending' : 'Send the guide'}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={submitPhone}>
                <p className="eyebrow text-muted">Optional</p>
                <h2 id="capture-title" className="display text-cream text-3xl mt-3">
                  A text,
                  <br />
                  if you want one
                </h2>
                <p className="text-cream-dim text-sm leading-relaxed mt-4">
                  WhatsApp for a fit question, or a text when a drop is close. Skip this if email is enough.
                </p>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone, with + and country code"
                  aria-label="Phone number"
                  autoComplete="tel"
                  className="mt-6 w-full min-w-0 bg-transparent border border-line focus:border-cream text-cream placeholder:text-muted px-4 py-3 outline-none"
                />
                <label className="mt-4 flex items-start gap-3 text-cream-dim text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    checked={smsConsent}
                    onChange={(e) => setSmsConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-cream"
                  />
                  <span>{SMS_CONSENT}</span>
                </label>
                <label className="mt-3 flex items-start gap-3 text-cream-dim text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    checked={whatsappConsent}
                    onChange={(e) => setWhatsappConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-cream"
                  />
                  <span>{WHATSAPP_CONSENT}</span>
                </label>
                <button type="submit" disabled={state === 'sending'} className="btn w-full mt-5">
                  {state === 'sending' ? 'Saving' : 'Save number'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('done')}
                  className="eyebrow text-muted w-full mt-4"
                >
                  No thanks
                </button>
              </form>
            )}

            {step === 'done' && (
              <div>
                <p className="eyebrow text-muted">First access</p>
                <h2 id="capture-title" className="display text-cream text-3xl mt-3">You’re on the list</h2>
                <p className="text-cream-dim text-sm leading-relaxed mt-4">
                  We’ll send the fit note, and a message before the next drop.
                </p>
                <button type="button" onClick={() => setOpen(false)} className="btn w-full mt-6">
                  Close
                </button>
              </div>
            )}

            {message && (
              <p className={`text-xs mt-3 ${state === 'error' ? 'text-red-400' : 'text-cream-dim'}`}>{message}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
