/**
 * The campaign still with a slow drift.
 *
 * The drift used to be a pre-rendered MP4 made with ffmpeg's zoompan, which
 * rounds every frame to a whole pixel: the picture jumped 1px every 5-6 frames
 * (measured) and read as a vibration. A CSS transform on the image is animated
 * by the compositor at sub-pixel precision, so it glides, and it removes a
 * ~370KB download. The <img> stays the LCP element; reduced motion gets the
 * still (see .hero-drift in index.css).
 */
export function HeroMedia({ alt }: { alt: string }) {
  return (
    <picture>
      <source media="(max-width: 767px)" srcSet="/hero-mobile.jpg" />
      <img
        src="/hero-desktop.jpg"
        alt={alt}
        className="hero-drift absolute inset-0 w-full h-full object-cover"
        fetchPriority="high"
      />
    </picture>
  );
}
