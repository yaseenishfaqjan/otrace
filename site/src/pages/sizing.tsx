import { SIZES, SIZE_CHART } from '@/lib/products';
import { SIZING_FAQS } from '@/lib/faqs';
import { faqLd } from '@/lib/structured-data';

import { usePageMeta } from '@/lib/use-page-meta';

const inches = (cm: number) => (cm / 2.54).toFixed(1);

const faq = (question: string) => {
  const found = SIZING_FAQS.find((item) => item.question === question);
  if (!found) throw new Error(`missing sizing FAQ: ${question}`);
  return found;
};

const rows = (labels: string[]) => SIZE_CHART.filter((row) => labels.includes(row.label));

function MeasureTable({ labels }: { labels: string[] }) {
  return (
    <div className="mt-6 -mx-5 md:mx-0 overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse">
        <thead>
          <tr className="border-b border-line">
            <th className="text-left eyebrow text-muted py-4 pl-5 md:pl-0 pr-4 sticky left-0 bg-onyx">Measure</th>
            {SIZES.map((s) => (
              <th key={s} className="eyebrow text-cream py-4 px-3 text-center">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows(labels).map((row) => (
            <tr key={row.label} className="border-b border-line/60">
              <td className="text-cream-dim text-sm py-4 pl-5 md:pl-0 pr-4 whitespace-nowrap sticky left-0 bg-onyx">
                {row.label}
              </td>
              {row.values.map((v, i) => (
                <td key={i} className="text-center text-sm py-4 px-3 tabular-nums text-cream">
                  {v == null ? (
                    <span className="text-muted" title="Awaiting confirmed measurement">—</span>
                  ) : (
                    <>
                      <span className="block">{v}</span>
                      <span className="block text-muted text-[11px]">{inches(v)} in</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Sizing() {
  const chart = faq('Oversized hoodie size chart');
  const pants = faq('Wide leg sweatpants size chart');
  const fit = faq('How should an oversized hoodie fit?');
  const unisex = faq('Unisex hoodies size chart');
  usePageMeta(
    'Oversized Hoodie Size Chart',
    'Oversized hoodie size chart and wide leg sweatpants measurements for OTRACE. Garment-flat centimetres and inches, XS to 3XL, unisex. Take your usual size for the oversized fit.',
    { jsonLd: faqLd(SIZING_FAQS) },
  );

  return (
    <div className="pt-16 md:pt-20">
      <div className="shell py-12 md:py-16 max-w-4xl">
        <p className="eyebrow text-muted mb-4">Fit</p>
        <h1 className="display text-cream text-[11vw] md:text-[4rem]">{chart.question}</h1>
        <p className="text-cream-dim leading-relaxed mt-6 max-w-xl">{chart.answer}</p>
        <p className="text-cream-dim text-sm leading-relaxed mt-4 max-w-xl">
          Chest is pit to pit, body length is the high point of the shoulder to the hem,
          and shoulder is the neck to the shoulder seam. All three are taken with the
          garment laid flat.
        </p>
        <MeasureTable labels={['Chest', 'Body length', 'Shoulder']} />

        <section className="mt-14">
          <h2 className="text-cream text-xl font-medium">{pants.question}</h2>
          <p className="text-cream-dim leading-relaxed mt-4 max-w-xl">{pants.answer}</p>
          <p className="text-cream-dim text-sm leading-relaxed mt-4 max-w-xl">
            Outseam is the top of the waistband to the hem. Inseam is the crotch to the hem.
            Leg opening is the cuff laid flat.
          </p>
          <MeasureTable labels={['Outseam', 'Inseam', 'Leg opening']} />
        </section>

        <section className="mt-14">
          <h2 className="text-cream text-xl font-medium">{fit.question}</h2>
          <p className="text-cream-dim leading-relaxed mt-4 max-w-xl">{fit.answer}</p>
        </section>

        <section className="mt-14">
          <h2 className="text-cream text-xl font-medium">{unisex.question}</h2>
          <p className="text-cream-dim leading-relaxed mt-4 max-w-xl">{unisex.answer}</p>
        </section>

        <section className="mt-14">
          <h2 className="text-cream text-xl font-medium">All recorded measurements</h2>
          <p className="text-cream-dim text-sm leading-relaxed mt-4 max-w-xl">
            Centimetres, garment laid flat, with inches converted from those centimetres
            (divide by 2.54, round to 0.1). Size L chest, size L body length, and size M
            inseam are not published: on the factory sheet those cells were smaller than
            the size below them, so printing them would be wrong. They stay as a dash
            until the factory confirms them.
          </p>
          <p className="text-cream-dim text-sm leading-relaxed mt-4 max-w-xl">
            One row is labeled Sleeve / waist on the spec sheet. It is shown that way
            below and not split into a sleeve length and a waist, because the sheet does
            not say which of the two it is.
          </p>
          <MeasureTable labels={SIZE_CHART.map((row) => row.label)} />
        </section>
      </div>
    </div>
  );
}
