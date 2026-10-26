/** Geometric diagrams. No people, no generated photographs. */

const frame = 'w-full border border-line bg-onyx text-cream';

export function GsmDiagram() {
  return (
    <figure className="mt-10">
      <svg className={frame} viewBox="0 0 640 220" width="640" height="220" role="img" aria-labelledby="gsm-title gsm-desc">
        <title id="gsm-title">One square metre weighs 450 grams</title>
        <desc id="gsm-desc">A square marked 1 metre by 1 metre, labelled 450 grams. This is the definition of 450 GSM, not an industry grade.</desc>
        <rect x="36" y="36" width="148" height="148" fill="none" stroke="#F0EBE0" strokeWidth="1.5" />
        <text x="110" y="118" textAnchor="middle" fill="#F0EBE0" fontSize="28" fontFamily="sans-serif">450 g</text>
        <text x="210" y="78" fill="#A39E96" fontSize="16" fontFamily="sans-serif">1 metre</text>
        <text x="210" y="104" fill="#A39E96" fontSize="16" fontFamily="sans-serif">1 metre</text>
        <text x="210" y="150" fill="#F0EBE0" fontSize="16" fontFamily="sans-serif">450 GSM = 450 grams</text>
        <text x="210" y="174" fill="#F0EBE0" fontSize="16" fontFamily="sans-serif">in that square metre</text>
      </svg>
      <figcaption className="text-muted text-xs mt-3">The definition of the number. Not a graded industry standard.</figcaption>
    </figure>
  );
}

export function DyeDiagram() {
  return (
    <figure className="mt-10">
      <svg className={frame} viewBox="0 0 640 250" width="640" height="250" role="img" aria-labelledby="dye-title dye-desc">
        <title id="dye-title">Piece dyed compared with garment dyed</title>
        <desc id="dye-desc">Piece dyed is dye, then cut, then sew. Garment dyed is cut, then sew, then dye.</desc>
        <text x="40" y="36" fill="#A39E96" fontSize="13" fontFamily="sans-serif" letterSpacing="1.5">PIECE DYED</text>
        <text x="340" y="36" fill="#A39E96" fontSize="13" fontFamily="sans-serif" letterSpacing="1.5">GARMENT DYED</text>
        {['Dye the cloth', 'Cut', 'Sew'].map((label, i) => (
          <g key={label}>
            <rect x="40" y={56 + i * 58} width="220" height="42" fill="none" stroke="#F0EBE0" />
            <text x="150" y={82 + i * 58} textAnchor="middle" fill="#F0EBE0" fontSize="16" fontFamily="sans-serif">{label}</text>
          </g>
        ))}
        {['Cut', 'Sew', 'Dye the piece'].map((label, i) => (
          <g key={label}>
            <rect x="340" y={56 + i * 58} width="220" height="42" fill="none" stroke="#F0EBE0" />
            <text x="450" y={82 + i * 58} textAnchor="middle" fill="#F0EBE0" fontSize="16" fontFamily="sans-serif">{label}</text>
          </g>
        ))}
      </svg>
      <figcaption className="text-muted text-xs mt-3">Same steps, different order. OTRACE dyes after sewing.</figcaption>
    </figure>
  );
}

export function FitDiagram() {
  return (
    <figure className="mt-10">
      <svg className={frame} viewBox="0 0 640 280" width="640" height="280" role="img" aria-labelledby="fit-title fit-desc">
        <title id="fit-title">A tapered body compared with a boxy body</title>
        <desc id="fit-desc">A narrow torso shape beside a square torso with a dropped shoulder mark. A diagram, not a person.</desc>
        <text x="90" y="36" fill="#A39E96" fontSize="13" fontFamily="sans-serif" letterSpacing="1.5">TAPERED</text>
        <text x="400" y="36" fill="#A39E96" fontSize="13" fontFamily="sans-serif" letterSpacing="1.5">BOXY</text>
        <path d="M70 70 H190 L160 230 H100 Z" fill="none" stroke="#F0EBE0" strokeWidth="1.5" />
        <path d="M360 70 H560 V230 H360 Z" fill="none" stroke="#F0EBE0" strokeWidth="1.5" />
        <line x1="400" y1="70" x2="400" y2="110" stroke="#A39E96" strokeWidth="1" />
        <text x="408" y="100" fill="#A39E96" fontSize="13" fontFamily="sans-serif">dropped shoulder</text>
        <text x="130" y="258" textAnchor="middle" fill="#A39E96" fontSize="13" fontFamily="sans-serif">waist comes in</text>
        <text x="460" y="258" textAnchor="middle" fill="#A39E96" fontSize="13" fontFamily="sans-serif">side seam stays straight</text>
      </svg>
      <figcaption className="text-muted text-xs mt-3">A diagram of the cut, not a body and not a photograph.</figcaption>
    </figure>
  );
}
