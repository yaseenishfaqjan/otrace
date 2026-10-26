const ROWS = [
  { label: 'Typical tee', gsm: '~180', width: '40%' },
  { label: 'Typical hoodie', gsm: '~300', width: '67%' },
  { label: 'OTRACE fleece', gsm: '450', width: '100%' },
];

/**
 * A scale for the number, not a lab report. 180 and 300 are typical cloth
 * weights. OTRACE does not sell a tee, and these are not measurements of
 * another brand. 450 is this fleece.
 */
export function WeightScale() {
  return (
    <figure className="mt-8 max-w-md">
      <ul className="space-y-4">
        {ROWS.map((row) => (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <span className="text-cream-dim text-sm">{row.label}</span>
              <span className="text-cream text-sm tabular-nums">{row.gsm} GSM</span>
            </div>
            <div className="h-px bg-line">
              <div className="gsm-bar h-px bg-cream" style={{ width: row.width }} />
            </div>
          </li>
        ))}
      </ul>
      <figcaption className="text-muted text-xs leading-relaxed mt-4">
        Typical grams per square metre for a jersey tee and a midweight hoodie.
        Those two are not OTRACE cloth and not a test of another brand. This
        fleece is 450 grams in a square metre.
      </figcaption>
    </figure>
  );
}
