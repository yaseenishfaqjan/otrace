import { Link } from 'wouter';
import { useReveal } from '@/lib/use-reveal';
import { SiteImage } from '@/components/site-image';
import { imageSize } from '@/lib/image-size';

import { usePageMeta } from '@/lib/use-page-meta';
export default function About() {
  usePageMeta(
    'About the Label',
    'OTRACE makes fewer, heavier pieces: a 450 GSM garment-dyed hoodie and a wide-leg sweatpant, built to still look like themselves after a year of wear.',
  );
  useReveal();
  return (
    <div className="pt-16 md:pt-20">
      <div className="shell py-12 md:py-20 max-w-3xl">
        <p className="eyebrow text-muted mb-4">The label</p>
        <h1 className="display text-cream text-[11vw] md:text-[4.5rem]">
          Fewer
          <br />
          pieces
        </h1>
        <div className="text-cream-dim leading-relaxed mt-9 space-y-6 text-base md:text-lg">
          <p>
            OTRACE started from a simple frustration: almost nobody makes a
            hoodie that still looks like itself after a year. Most are thin,
            printed in bulk, and cut to a shape that flatters a hanger.
          </p>
          <p>
            So we made two pieces instead of twenty. A hoodie and a sweatpant,
            both from the same 450 GSM loopback fleece, both{' '}
            <Link href="/garment-dyed" className="text-cream underline underline-offset-4">garment dyed</Link>{' '}
            after they are sewn so the colour settles into the seams and softens
            rather than fades.
          </p>
          <p>
            <span className="text-cream">AW2026 is the first drop.</span> Two
            colorways — Onyx Black and Warm Cream — and nothing else. When it
            is gone, it is gone; we would rather sell out than discount.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2">
        <SiteImage
          src="/detail-fabric.jpg"
          alt="Macro detail of heavyweight loopback fleece"
          width={imageSize('/detail-fabric.jpg').width}
          height={imageSize('/detail-fabric.jpg').height}
          loading="lazy"
          pictureClassName="block w-full"
          className="w-full aspect-[4/3] object-cover reveal"
        />
        <SiteImage
          src="/detail-stitch.jpg"
          alt="Macro detail of a dropped shoulder seam"
          width={imageSize('/detail-stitch.jpg').width}
          height={imageSize('/detail-stitch.jpg').height}
          loading="lazy"
          pictureClassName="block w-full"
          className="w-full aspect-[4/3] object-cover reveal"
        />
      </div>

      <div className="shell py-16 md:py-24 max-w-3xl">
        <h2 className="display text-cream text-[8vw] md:text-[2.5rem]">How we make it</h2>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {[
            ['Knit', '450 GSM loopback cotton fleece, brushed on the inside. Heavy enough to hang properly from the shoulder.'],
            ['Cut', 'Boxy body, dropped shoulder, long enough in the hem to sit where it should rather than ride up.'],
            ['Dye', 'Dyed after sewing. The seams take the colour differently, so no two pieces are identical.'],
            ['Finish', 'White moulded plastic drawcord tips through metal eyelets, self-lined hood, internal branding tag.'],
          ].map(([title, body]) => (
            <div key={title} className="py-6 grid sm:grid-cols-[8rem_1fr] gap-2 sm:gap-8">
              <span className="eyebrow text-cream">{title}</span>
              <p className="text-cream-dim text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
        <Link href="/shop" className="btn mt-10">Shop AW2026</Link>
      </div>
    </div>
  );
}
