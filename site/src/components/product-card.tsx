import { useRef, useState } from 'react';
import { Link } from 'wouter';
import { money, type Product } from '@/lib/products';

/**
 * One tile. Hovering (desktop) or the colorway dots (touch) swap the image, so
 * both colourways are discoverable from the grid without opening the product.
 */
export function ProductCard({
  product,
  priority = false,
  heading: Heading = 'h3',
}: {
  product: Product;
  priority?: boolean;
  /** h2 where the grid sits directly under the page h1, so no level is skipped. */
  heading?: 'h2' | 'h3';
}) {
  const [active, setActive] = useState(0);
  const colorway = product.colorways[active];
  const photo = useRef<HTMLImageElement>(null);

  // Name this card's photo only at the moment it is clicked, so the page
  // transition morphs exactly this image into the product page. Naming every
  // card up front would duplicate names (the same product can appear twice on
  // a page) and a duplicate name silently cancels the whole animation.
  const nameForTransition = () => {
    photo.current?.style.setProperty('view-transition-name', `product-${product.slug}`);
  };

  return (
    <div className="group">
      <Link
        href={`/product/${product.slug}`}
        onClick={nameForTransition}
        className="block relative overflow-hidden bg-charcoal/30 aspect-[4/5]"
      >
        {product.preorder && (
          <span className="absolute top-3 left-3 z-10 eyebrow bg-cream text-onyx px-2.5 py-1.5 leading-none">
            Pre-order
          </span>
        )}
        <img
          ref={photo}
          src={colorway.images[0].src}
          alt={colorway.images[0].alt}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.03]"
        />
        {/* Second image cross-fades in on hover — desktop only, since on touch
            there is no hover state to leave. */}
        {colorway.images[1] && (
          <img
            src={colorway.images[1].src}
            alt=""
            loading="lazy"
            aria-hidden="true"
            className="hidden md:block absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          />
        )}
      </Link>

      <div className="flex items-start justify-between gap-4 mt-4">
        <div className="min-w-0">
          <Link href={`/product/${product.slug}`} onClick={nameForTransition} className="block">
            <Heading className="text-cream text-sm md:text-base font-medium leading-tight">{product.name}</Heading>
          </Link>
          <p className="text-muted text-xs mt-1">
            {colorway.name}
            {product.preorder && <> · Ships in {product.preorder.shipsIn}</>}
          </p>
        </div>
        <span className="text-cream text-sm md:text-base tabular-nums shrink-0">{money(product.price)}</span>
      </div>

      {/* 16px dots inside 26px buttons: padding grows the tap area and a matching
          negative margin keeps the layout. gap-3 keeps neighbouring areas apart.
          (A ::before hit area did not register in Chrome's hit testing.) */}
      <div className="flex items-center gap-3 mt-3">
        {product.colorways.map((c, i) => (
          <button
            key={c.name}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
            aria-label={c.name}
            aria-pressed={active === i}
            title={c.name}
            className="group/dot flex -m-[5px] p-[5px]"
          >
            <span
              aria-hidden="true"
              className={`block w-4 h-4 rounded-full border transition-all ${
                active === i ? 'border-cream scale-110' : 'border-line group-hover/dot:border-cream-dim'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
