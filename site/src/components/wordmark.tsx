type Props = {
  className?: string;
  /** Set when a parent (a home link) already carries the accessible name. */
  decorative?: boolean;
};

/**
 * The OTRACE wordmark — the arrow-through-script mark, drawn from the vector in
 * /brand/otrace-wordmark.svg.
 *
 * It is painted as a CSS mask over `currentColor` rather than an <img>, so it
 * takes the text colour of wherever it sits (cream on onyx today, onyx on a
 * light panel later) from a single cached file. Size it with a height class;
 * the width follows from the logo's aspect ratio.
 */
export function Wordmark({ className = '', decorative = false }: Props) {
  return decorative ? (
    <span aria-hidden="true" className={`wordmark-logo ${className}`} />
  ) : (
    <span role="img" aria-label="OTRACE" className={`wordmark-logo ${className}`} />
  );
}
