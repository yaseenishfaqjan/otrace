import { SIZES, SIZE_CHART } from '@/lib/products';

import { usePageMeta } from '@/lib/use-page-meta';
export default function Sizing() {
  usePageMeta(
    'Size Guide',
    'OTRACE size guide for the oversized hoodie and wide-leg sweatpant: flat garment measurements in centimetres, XS to 3XL, with fit advice for the oversized cut.',
  );
  return (
    <div className="pt-16 md:pt-20">
      <div className="shell py-12 md:py-16 max-w-4xl">
        <p className="eyebrow text-muted mb-4">Fit</p>
        <h1 className="display text-cream text-[11vw] md:text-[4rem]">Size guide</h1>
        <p className="text-cream-dim leading-relaxed mt-6 max-w-xl">
          Everything is cut oversized. Take your usual size for the intended
          fit, or size down if you want a cleaner line. Measurements are the
          garment laid flat, in centimetres.
        </p>

        {/* A wide table must scroll inside its own box — the page itself should
            never scroll sideways on a phone. */}
        <div className="mt-10 -mx-5 md:mx-0 overflow-x-auto">
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
              {SIZE_CHART.map((row) => (
                <tr key={row.label} className="border-b border-line/60">
                  <td className="text-cream-dim text-sm py-4 pl-5 md:pl-0 pr-4 whitespace-nowrap sticky left-0 bg-onyx">
                    {row.label}
                  </td>
                  {row.values.map((v, i) => (
                    <td key={i} className="text-center text-sm py-4 px-3 tabular-nums text-cream">
                      {v ?? <span className="text-muted" title="Awaiting confirmed measurement">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 border border-line p-6">
          <h2 className="eyebrow text-cream mb-3">Between sizes?</h2>
          <p className="text-cream-dim text-sm leading-relaxed">
            The hoodie runs a full size large by design. If you are between
            sizes and want the oversized look, take the larger. Email us and we
            will tell you exactly what we would take — same day.
          </p>
        </div>
      </div>
    </div>
  );
}
