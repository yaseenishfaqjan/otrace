import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { CATEGORIES } from '@/lib/products';
import { Wordmark } from '@/components/wordmark';

const LINKS = [
  { href: '/shop', label: 'Shop' },
  // Category links need the width of xl; from lg the bar keeps the three that fit.
  { href: '/shop/hoodies', label: 'Hoodies', wide: true },
  { href: '/shop/bottoms', label: 'Bottoms', wide: true },
  { href: '/lookbook', label: 'Lookbook' },
  { href: '/about', label: 'The Label' },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const { itemCount, openCart } = useCart();

  // Transparent over the hero, solid once you leave it — a bar that is always
  // solid puts a black box across the campaign image on every page.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = open ? 'hidden' : previous;
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => setOpen(false), [location]);

  // Pages that open on a full-bleed image keep the bar clear until scrolled.
  const overImage = location === '/' || location === '/lookbook';
  const solid = scrolled || !overImage;

  return (
    <>
      <header
        className={`vt-header fixed top-0 left-0 right-0 z-50 transition-colors duration-500 ${
          solid ? 'bg-onyx/92 backdrop-blur-xl border-b border-line' : 'bg-transparent'
        }`}
      >
        <div className="shell flex items-center justify-between h-16 md:h-20">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="lg:hidden -ml-2 p-2 text-cream"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>

          {/* Three links clear the centred logo from lg, all five from xl; below lg
              the menu button takes over (tested at 768/900/1024/1280/1440). */}
          <nav className="hidden lg:flex items-center gap-7 xl:gap-9">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`eyebrow transition-colors ${'wide' in l && l.wide ? 'hidden xl:inline' : ''} ${
                  location === l.href ? 'text-cream' : 'text-cream-dim hover:text-cream'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Optically centred on mobile, left-anchored on desktop would fight
              the nav — so it stays centred at every size. */}
          <Link
            href="/"
            aria-label="OTRACE — home"
            className="absolute left-1/2 -translate-x-1/2 text-cream hover:text-cream-dim transition-colors flex"
          >
            <Wordmark decorative className="h-12 md:h-[3.75rem]" />
          </Link>

          <div className="flex items-center gap-5">
            <Link href="/account" className="hidden md:block eyebrow text-cream-dim hover:text-cream transition-colors">
              Account
            </Link>
            <button
              onClick={openCart}
              className="eyebrow text-cream hover:text-cream-dim transition-colors -mr-1 p-2 md:p-0"
              aria-label={`Cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`}
            >
              Cart<span className="tabular-nums"> ({itemCount})</span>
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------ mobile menu */}
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-onyx" />
          <div className="relative h-full flex flex-col fade">
            <div className="shell flex items-center justify-between h-16">
              <Wordmark className="h-12 text-cream" />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="-mr-2 p-2 text-cream">
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
            </div>

            <nav className="shell flex-1 flex flex-col justify-center gap-1 pb-24">
              <Link href="/shop" className="display text-cream text-[13vw] md:text-[5.5rem] py-2">
                Shop All
              </Link>
              {CATEGORIES.map((c) => (
                <Link key={c.slug} href={`/shop/${c.slug}`} className="display text-cream text-[13vw] md:text-[5.5rem] py-2">
                  {c.name}
                </Link>
              ))}
              <Link href="/lookbook" className="display text-cream text-[13vw] md:text-[5.5rem] py-2">
                Lookbook
              </Link>
              <Link href="/about" className="display text-cream text-[13vw] md:text-[5.5rem] py-2">
                The Label
              </Link>

              <div className="rule mt-10 pt-8 flex flex-col gap-5">
                <Link href="/account" className="eyebrow text-cream-dim">Account</Link>
                <Link href="/sizing" className="eyebrow text-cream-dim">Size Guide</Link>
                <Link href="/shipping" className="eyebrow text-cream-dim">Shipping &amp; Returns</Link>
                <Link href="/contact" className="eyebrow text-cream-dim">Contact</Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
