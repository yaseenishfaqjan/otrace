import { Fragment, type CSSProperties } from 'react';

type Props = {
  /** One entry per line; each line breaks onto its own row. */
  lines: string[];
  className?: string;
  /** Milliseconds before the first letter moves. */
  delay?: number;
  /** Milliseconds between consecutive letters. */
  stagger?: number;
};

/**
 * A headline whose letters rise one after another out of a clipped line, the
 * way a title card is set in. Screen readers get the plain sentence from
 * aria-label; the per-letter spans are hidden from them so "W o r n" is never
 * spelled out. Reduced motion shows the finished headline (see index.css).
 */
export function SplitHeadline({ lines, className = '', delay = 120, stagger = 42 }: Props) {
  let n = 0;
  return (
    <h1 className={className} aria-label={lines.join(' ')}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {/* A plain space between lines: invisible between block spans, but it
              keeps the headline's text "Worn loose" rather than "Wornloose". */}
          {li > 0 && ' '}
          {/* The clip lives on the line, padded a hair so accents and the curve
              of letters are not shaved by the tight display leading. */}
          <span className="split-line block overflow-hidden" aria-hidden="true">
          {Array.from(line).map((ch, ci) => {
            const style = { animationDelay: `${delay + n++ * stagger}ms` } as CSSProperties;
            return (
              <span key={ci} className="split-char inline-block" style={style}>
                {ch === ' ' ? ' ' : ch}
              </span>
            );
          })}
          </span>
        </Fragment>
      ))}
    </h1>
  );
}

/** When the last letter of a headline has landed, for sequencing what follows. */
export function splitHeadlineEnd(lines: string[], delay = 120, stagger = 42, duration = 900) {
  const letters = lines.reduce((sum, l) => sum + Array.from(l).length, 0);
  return delay + (letters - 1) * stagger + duration;
}
