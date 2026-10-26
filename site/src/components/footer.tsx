import { useState } from 'react';
import { CONTACT_EMAIL, SOCIAL, hasSocial } from '@/lib/brand';
import { Link } from 'wouter';
import { CATEGORIES } from '@/lib/products';
import { postJson } from '@/lib/api';
import { Wordmark } from '@/components/wordmark';

export function Footer() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    try {
      const data = await postJson<{ alreadySubscribed?: boolean }>('/api/subscribe', {
        email,
        source: 'footer',
      });
      setState('done');
      setMessage(data.alreadySubscribed ? "You're already on the list." : 'You’re on the list.');
      setEmail('');
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'That did not work.');
    }
  };

  return (
    <footer className="rule">
      {/* ------------------------------------------------------- list join */}
      <div className="shell py-16 md:py-24">
        <div className="grid gap-10 md:grid-cols-2 md:gap-20 items-end">
          <div>
            <h2 className="display text-cream text-[10vw] md:text-[3.5rem]">
              First
              <br />
              access
            </h2>
            <p className="text-cream-dim text-sm md:text-base mt-5 max-w-sm leading-relaxed">
              Drops are small and they do not restock. Join the list and you hear
              first — nothing else, no noise.
            </p>
          </div>

          <form onSubmit={subscribe} className="w-full">
            <div className="flex items-end gap-4 border-b border-line focus-within:border-cream transition-colors pb-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setState('idle'); }}
                placeholder="Email address"
                aria-label="Email address"
                className="flex-1 bg-transparent text-cream placeholder:text-muted text-base md:text-lg outline-none py-2"
              />
              <button
                type="submit"
                disabled={state === 'sending'}
                className="eyebrow text-cream shrink-0 disabled:opacity-50 -mx-3 -mt-3 -mb-3 px-3 pt-3 pb-4"
              >
                {state === 'sending' ? 'Joining' : 'Join'}
              </button>
            </div>
            {message && (
              <p className={`text-xs mt-3 ${state === 'error' ? 'text-red-400' : 'text-cream-dim'}`}>
                {message}
              </p>
            )}
          </form>
        </div>
      </div>

      {/* ------------------------------------------------------------ links */}
      <div className="rule">
        <div className="shell py-12 md:py-16 grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">
          <div className="col-span-2 md:col-span-1">
            <Wordmark className="h-24 text-cream -ml-1" />
            <p className="text-muted text-xs mt-4 leading-relaxed max-w-[16rem]">
              Heavyweight fleece, garment dyed, cut oversized. AW2026.
            </p>

            {/* A shop with no way to reach it and no accounts reads as a test
                site. Each of these renders only once it is real — see
                lib/brand.ts — because a bouncing address is worse than none. */}
            {CONTACT_EMAIL && (
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-block text-cream-dim hover:text-cream text-xs mt-4 transition-colors"
              >
                {CONTACT_EMAIL}
              </a>
            )}
            {hasSocial && (
              <div className="flex flex-wrap gap-4 mt-4">
                {SOCIAL.map((s) => (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer me"
                    className="eyebrow text-muted hover:text-cream transition-colors"
                  >
                    {s.name}
                  </a>
                ))}
              </div>
            )}
          </div>

          <nav className="flex flex-col gap-3">
            <span className="eyebrow text-muted mb-1">Shop</span>
            <Link href="/shop" className="text-cream-dim hover:text-cream text-sm transition-colors">All products</Link>
            {CATEGORIES.map((c) => (
              <Link key={c.slug} href={`/shop/${c.slug}`} className="text-cream-dim hover:text-cream text-sm transition-colors">
                {c.name}
              </Link>
            ))}
            <Link href="/lookbook" className="text-cream-dim hover:text-cream text-sm transition-colors">Lookbook</Link>
          </nav>

          <nav className="flex flex-col gap-3">
            <span className="eyebrow text-muted mb-1">Help</span>
            <Link href="/sizing" className="text-cream-dim hover:text-cream text-sm transition-colors">Size guide</Link>
            <Link href="/garment-dyed" className="text-cream-dim hover:text-cream text-sm transition-colors">Garment dyed</Link>
            <Link href="/shipping" className="text-cream-dim hover:text-cream text-sm transition-colors">Shipping &amp; returns</Link>
            <Link href="/contact" className="text-cream-dim hover:text-cream text-sm transition-colors">Contact</Link>
            <Link href="/account" className="text-cream-dim hover:text-cream text-sm transition-colors">Your account</Link>
          </nav>

          <nav className="flex flex-col gap-3">
            <span className="eyebrow text-muted mb-1">Legal</span>
            <Link href="/terms" className="text-cream-dim hover:text-cream text-sm transition-colors">Terms</Link>
            <Link href="/privacy" className="text-cream-dim hover:text-cream text-sm transition-colors">Privacy</Link>
          </nav>
        </div>
      </div>

      <div className="rule">
        <div className="shell py-6 flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
          <p className="text-muted text-[11px]">© {new Date().getFullYear()} OTRACE. All rights reserved.</p>
          <p className="text-muted text-[11px]">Secure payment by Stripe.</p>
        </div>
      </div>
    </footer>
  );
}
