import { SIZES, SIZE_CHART } from '@/lib/products';
import { FitHelp } from '@/components/fit-help';
import { SIZING_FAQS } from '@/lib/faqs';
import { faqLd } from '@/lib/structured-data';

import { usePageMeta } from '@/lib/use-page-meta';

const inches = (cm: number) => (Math.round((cm / 2.54) * 10) / 10).toFixed(1);

/** A blank cell is the midpoint of the sizes on either side, or stays blank. */
function estimateCell(values: (number | null)[], index: number) {
  const value = values[index];
  if (value != null) return { cm: value, estimated: false };
  const prev = values[index - 1];
  const next = values[index + 1];
  if (prev == null || next == null) return { cm: null, estimated: false };
  return { cm: Math.round((prev + next) / 2), estimated: true };
}

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
            <tr key={row.label} className="border-b border-line/60 group hover:bg-white/5">
              <td className="text-cream-dim text-sm py-4 pl-5 md:pl-0 pr-4 whitespace-nowrap sticky left-0 bg-onyx">
                {row.label}
              </td>
              {row.values.map((_, i) => {
                const cell = estimateCell(row.values, i);
                return (
                  <td key={i} className="text-center text-sm py-4 px-3 tabular-nums text-cream group-hover:bg-white/5">
                    {cell.cm == null ? (
                      <span className="text-muted" title="Not confirmed, and a neighbor is missing">—</span>
                    ) : (
                      <>
                        <span className="block">{cell.cm}</span>
                        <span className="block text-muted text-[11px]">{inches(cell.cm)} in</span>
                        {cell.estimated && (
                          <span className="block text-muted text-[11px]" title="estimated from neighboring sizes">est.</span>
                        )}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Sizing() {
  const fit = faq('How should an oversized hoodie fit?');
  usePageMeta(
    'Oversized Hoodie Size Chart',
    'Oversized hoodie size chart and wide leg sweatpants measurements for OTRACE. Garment-flat centimetres and inches, XS to 3XL, unisex. Take your usual size for the oversized fit.',
    { jsonLd: faqLd(SIZING_FAQS) },
  );

  return (
    <div className="pt-16 md:pt-20">
      <div className="shell py-12 md:py-16 max-w-4xl">
        <p className="eyebrow text-muted mb-4">Fit</p>
        <h1 className="display text-cream text-[11vw] md:text-[4rem]">Sizing</h1>
        <p className="text-cream-dim leading-relaxed mt-6 max-w-xl">
          Measurements are in centimetres, taken garment-flat. Inches are that figure
          divided by 2.54. A cell marked est. is the midpoint of the confirmed sizes on
          either side. It is not a factory measurement.
        </p>

        <section className="mt-12">
          <h2 className="text-cream text-xl font-medium">Oversized hoodie</h2>
          <p className="text-cream-dim text-sm leading-relaxed mt-4 max-w-xl">
            Chest, body length, shoulder, and the sleeve/waist row from the spec sheet.
            The sheet does not say whether that last row is a sleeve or a waist, so the
            label stays as written.
          </p>
          <MeasureTable labels={['Chest', 'Body length', 'Shoulder', 'Sleeve / waist']} />
        </section>

        <section className="mt-14">
          <h2 className="text-cream text-xl font-medium">Wide-leg sweatpant</h2>
          <p className="text-cream-dim text-sm leading-relaxed mt-4 max-w-xl">
            Outseam is the top of the waistband to the hem. Inseam is the crotch to the hem.
            Leg opening is the cuff laid flat.
          </p>
          <MeasureTable labels={['Outseam', 'Inseam', 'Leg opening']} />
        </section>

        <section className="mt-14">
          <h2 className="text-cream text-xl font-medium">Fit</h2>
          <p className="text-cream-dim leading-relaxed mt-4 max-w-xl">{fit.answer}</p>
          <p className="text-cream-dim leading-relaxed mt-4 max-w-xl">
            Both pieces are unisex, XS to 3XL. The chart is the same garment-flat
            measurement for every body.
          </p>
        </section>
        <FitHelp />
      </div>
    </div>
  );
}
