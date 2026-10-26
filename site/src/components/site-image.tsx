import type { CSSProperties, MouseEvent, Ref } from 'react';

/** JPEG path → sibling WebP. Originals stay in place as the <img> fallback. */
export const webpSrc = (src: string) => src.replace(/\.jpe?g$/i, '.webp');

type ExtraSource = { src: string; media: string };

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  /** Classes on the <picture>. Use this when the image used to be positioned itself. */
  pictureClassName?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  decoding?: 'async' | 'sync' | 'auto';
  draggable?: boolean;
  style?: CSSProperties;
  sizes?: string;
  imgRef?: Ref<HTMLImageElement>;
  /** Matched before the default WebP/JPEG of `src` (hero, lookbook wide crop). */
  sources?: ExtraSource[];
  onClick?: (e: MouseEvent<HTMLImageElement>) => void;
};

/**
 * WebP first, JPEG fallback, with the intrinsic width and height on the <img>.
 * The attributes reserve the aspect ratio; CSS still decides the laid-out size.
 */
export function SiteImage({
  src,
  alt,
  width,
  height,
  className,
  pictureClassName = 'block',
  loading,
  fetchPriority,
  decoding,
  draggable,
  style,
  sizes,
  imgRef,
  sources,
  onClick,
}: Props) {
  return (
    <picture className={pictureClassName}>
      {sources?.map((s) => (
        <source key={`${s.media}-webp`} media={s.media} type="image/webp" srcSet={webpSrc(s.src)} />
      ))}
      {sources?.map((s) => (
        <source key={`${s.media}-jpg`} media={s.media} srcSet={s.src} />
      ))}
      <source type="image/webp" srcSet={webpSrc(src)} />
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding={decoding}
        draggable={draggable}
        style={style}
        sizes={sizes}
        onClick={onClick}
      />
    </picture>
  );
}
