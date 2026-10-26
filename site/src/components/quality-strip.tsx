import { Link } from 'wouter';
import { DyeDiagram, FitDiagram, GsmDiagram } from '@/components/blog-diagrams';

const STORIES = [
  {
    title: '450 GSM',
    body: 'The weight is grams in a square metre. Same cloth on the hoodie and the sweatpant.',
    href: '/product/oversized-hoodie',
    cta: 'Shop the hoodie',
    diagram: <GsmDiagram />,
  },
  {
    title: 'Garment dyed',
    body: 'Cut, sewn, then dyed. The colour sits in the seams instead of stopping at them.',
    href: '/product/oversized-hoodie?color=warm-cream',
    cta: 'See Warm Cream',
    diagram: <DyeDiagram />,
  },
  {
    title: 'Boxy cut',
    body: 'The side seam stays straight. The shoulder drops. Flat measurements are on the size guide.',
    href: '/sizing',
    cta: 'Size guide',
    diagram: <FitDiagram />,
  },
];

/** Diagrams already used on the journal, with a product or size-guide link under each. */
export function QualityStrip() {
  return (
    <section className="rule">
      <div className="shell py-16 md:py-24">
        <div className="max-w-2xl mb-10 md:mb-14">
          <p className="eyebrow text-muted mb-4">The cloth</p>
          <h2 className="display text-cream text-[9vw] md:text-[3.5rem]">Why it holds</h2>
        </div>
        <div className="grid gap-12 lg:grid-cols-3 lg:gap-8">
          {STORIES.map((story) => (
            <article key={story.title} className="quality-draw">
              <h3 className="eyebrow text-cream">{story.title}</h3>
              <p className="text-cream-dim text-sm leading-relaxed mt-3">{story.body}</p>
              {story.diagram}
              <Link href={story.href} className="eyebrow text-cream-dim hover:text-cream transition-colors inline-block mt-4">
                {story.cta}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
