import { Link } from 'wouter';
import { GARMENT_DYE_FAQS } from '@/lib/faqs';
import { breadcrumbLd, faqLd } from '@/lib/structured-data';
import { usePageMeta } from '@/lib/use-page-meta';

const faq = (question: string) => {
  const found = GARMENT_DYE_FAQS.find((item) => item.question === question);
  if (!found) throw new Error(`missing garment-dye FAQ: ${question}`);
  return found;
};

export default function GarmentDyed() {
  const meaning = faq('What does garment dyed mean?');
  const versus = faq('Garment dyed vs piece dyed');
  const fade = faq('Does garment dye fade?');
  usePageMeta(
    'What Does Garment Dyed Mean?',
    'Garment dyed means sewn first and dyed after, so the colour settles into the seams. OTRACE uses it on 450 GSM cotton fleece hoodies and sweatpants.',
    {
      jsonLd: [
        faqLd(GARMENT_DYE_FAQS),
        breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'What does garment dyed mean?', path: '/garment-dyed' },
        ]),
      ],
    },
  );

  return (
    <div className="pt-16 md:pt-20">
      <article className="shell py-12 md:py-16 max-w-3xl">
        <p className="eyebrow text-muted mb-4">Fabric</p>
        <h1 className="display text-cream text-[10vw] md:text-[3.75rem]">{meaning.question}</h1>
        <p className="text-cream-dim leading-relaxed mt-8 text-base md:text-lg">{meaning.answer}</p>
        <p className="text-cream-dim leading-relaxed mt-6">
          The fleece is knit, cut, and sewn, and only then dyed. Seams, rib, and body
          go through the dye together. Two pieces from the same lot match. A later lot
          can sit a step lighter or darker, which is the process.
        </p>
        <p className="text-cream-dim leading-relaxed mt-6">
          AW2026 uses it on two pieces, both 450 GSM cotton fleece: the{' '}
          <Link href="/product/oversized-hoodie" className="text-cream underline underline-offset-4">Oversized Hoodie</Link>
          {' '}(148 USD) and the{' '}
          <Link href="/product/wide-leg-sweatpant" className="text-cream underline underline-offset-4">Wide-Leg Sweatpant</Link>
          {' '}(128 USD), each in Onyx Black and Warm Cream. Both are in stock and ship
          within 3–5 business days inside the United States, with free delivery.
        </p>

        <section className="mt-14">
          <h2 className="text-cream text-xl font-medium">{versus.question}</h2>
          <p className="text-cream-dim leading-relaxed mt-4">{versus.answer}</p>
          <p className="text-cream-dim leading-relaxed mt-4">
            Yarn-dyed cloth is coloured before it is knit. Piece-dyed cloth is coloured
            as fabric, then cut. Garment dyeing is the last of the three, which is why
            the stitch lines on an OTRACE piece take the colour instead of sitting on top of it.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="text-cream text-xl font-medium">{fade.question}</h2>
          <p className="text-cream-dim leading-relaxed mt-4">{fade.answer}</p>
        </section>

        <section className="mt-14 border border-line p-6">
          <h2 className="eyebrow text-cream mb-3">Care</h2>
          <p className="text-cream-dim text-sm leading-relaxed">
            Machine wash cold, inside out. Tumble dry low. Do not iron the embroidery
            on the hoodie. The same care is on each product page.
          </p>
        </section>
      </article>
    </div>
  );
}
