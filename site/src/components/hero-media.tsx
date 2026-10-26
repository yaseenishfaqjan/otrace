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
import { SiteImage } from '@/components/site-image';
import { imageSize } from '@/lib/image-size';

export function HeroMedia({ alt }: { alt: string }) {
  const desktop = imageSize('/hero-desktop.jpg');
  return (
    <SiteImage
      src="/hero-desktop.jpg"
      sources={[{ src: '/hero-mobile.jpg', media: '(max-width: 767px)' }]}
      alt={alt}
      width={desktop.width}
      height={desktop.height}
      pictureClassName="absolute inset-0 block"
      className="hero-drift w-full h-full object-cover"
      fetchPriority="high"
    />
  );
}
