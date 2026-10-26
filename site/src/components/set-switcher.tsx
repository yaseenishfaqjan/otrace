import { Link } from 'wouter';
import { money, PRODUCTS, type Product } from '@/lib/products';
import { SiteImage } from '@/components/site-image';
import { imageSize } from '@/lib/image-size';

const colourSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-');

/**
 * Stay on the selected colour and move between the hoodie and the sweatpant.
 * Both pieces publish both colourways, so the link never invents a third one.
 */
export function SetSwitcher({ product, colour }: { product: Product; colour: string }) {
  return (
    <div className="mt-10 min-w-0">
      <p className="eyebrow text-muted mb-4">Complete the set</p>
      <div className="grid grid-cols-2 gap-2">
        {PRODUCTS.map((item) => {
          const colorway = item.colorways.find((c) => c.name === colour) ?? item.colorways[0];
          const shot = colorway.images[0];
          const active = item.slug === product.slug;
          const className = `flex items-center gap-3 min-w-0 border p-2 text-left ${
            active ? 'border-cream' : 'border-line hover:border-cream-dim'
          }`;
          const body = (
            <>
              <SiteImage
                src={shot.src}
                alt=""
                width={imageSize(shot.src).width}
                height={imageSize(shot.src).height}
                loading="lazy"
                pictureClassName="block w-12 shrink-0"
                className="w-12 h-16 object-cover"
              />
              <span className="min-w-0">
                <span className="block text-cream text-sm leading-tight">{item.name}</span>
                <span className="block text-muted text-xs mt-1 tabular-nums">{money(item.price)}</span>
              </span>
            </>
          );
          if (active) {
            return (
              <div key={item.slug} aria-current="true" className={className}>
                {body}
              </div>
            );
          }
          return (
            <Link
              key={item.slug}
              href={`/product/${item.slug}?color=${colourSlug(colorway.name)}`}
              className={className}
            >
              {body}
            </Link>
          );
        })}
      </div>
      <p className="text-muted text-[11px] leading-relaxed mt-3">
        Same 450 GSM fleece and the same dye lot. The colour you picked comes with you.
      </p>
    </div>
  );
}
