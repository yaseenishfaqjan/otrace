import { Instagram, MessageCircle } from 'lucide-react';
import { CONTACT_EMAIL, SOCIAL, WHATSAPP_URL, hasSocial } from '@/lib/brand';
import { Link } from 'wouter';
import { CATEGORIES } from '@/lib/products';
import { Wordmark } from '@/components/wordmark';
import { LeadForm } from '@/components/lead-form';

const SOCIAL_ICON = {
  Instagram,
} as const;

export function Footer() {
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

          <LeadForm formId="footer" source="footer" submitLabel="Join" pendingLabel="Joining" variant="underline" />
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
            {(hasSocial || WHATSAPP_URL) && (
              <div className="flex flex-wrap gap-4 mt-4">
                {SOCIAL.map((s) => {
                  const Icon = SOCIAL_ICON[s.name as keyof typeof SOCIAL_ICON];
                  return (
                    <a
                      key={s.name}
                      href={s.href}
                      target="_blank"
                      rel="noreferrer me"
                      className="inline-flex items-center gap-2 eyebrow text-muted hover:text-cream transition-colors"
                    >
                      {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden />}
                      {s.name}
                    </a>
                  );
                })}
                {WHATSAPP_URL && (
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 eyebrow text-muted hover:text-cream transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} aria-hidden />
                    WhatsApp
                  </a>
                )}
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
            <Link href="/blog" className="text-cream-dim hover:text-cream text-sm transition-colors">Journal</Link>
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
