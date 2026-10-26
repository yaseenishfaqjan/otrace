/** A photographed turntable, once the owner adds the frames. Empty until then. */

export type TurntableSequence = {
  urls: string[];
  width: number;
  height: number;
};

const SLUG = /^[a-z0-9-]+$/;

/** How visible frame `index` is while the scrub sits at `position`. */
export function blendOpacity(position: number, index: number, reduced: boolean) {
  if (reduced) return index === Math.round(position) ? 1 : 0;
  const distance = Math.abs(position - index);
  return distance >= 1 ? 0 : 1 - distance;
}

/**
 * Reads `public/turntable/manifest.json`.
 * A colourway is included only when `frames` is between 2 and 36 and the
 * folder names are plain slugs. Anything else is ignored so a bad file
 * cannot point the gallery at an unexpected path.
 */
export function sequenceFromManifest(
  manifest: unknown,
  slug: string,
  colour: string,
): TurntableSequence | null {
  if (!manifest || typeof manifest !== 'object') return null;
  const sequences = (manifest as { sequences?: unknown }).sequences;
  if (!sequences || typeof sequences !== 'object') return null;
  const colourKey = colour.toLowerCase().replace(/\s+/g, '-');
  if (!SLUG.test(slug) || !SLUG.test(colourKey)) return null;
  const product = (sequences as Record<string, unknown>)[slug];
  if (!product || typeof product !== 'object') return null;
  const entry = (product as Record<string, unknown>)[colourKey];
  if (!entry || typeof entry !== 'object') return null;
  const { frames, width, height, ext } = entry as {
    frames?: unknown;
    width?: unknown;
    height?: unknown;
    ext?: unknown;
  };
  if (typeof frames !== 'number' || frames < 2 || frames > 36 || !Number.isInteger(frames)) return null;
  if (typeof width !== 'number' || typeof height !== 'number' || width < 1 || height < 1) return null;
  if (ext !== 'jpg' && ext !== 'webp') return null;
  const urls = Array.from({ length: frames }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return `/turntable/${slug}/${colourKey}/${n}.${ext}`;
  });
  return { urls, width, height };
}
