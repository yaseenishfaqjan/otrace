/** Intrinsic pixel size of every content JPEG. WebP siblings use the same pixels.
 *  Generated from the file headers. seo/verify.mjs fails if a file disagrees.
 */
export const IMAGE_SIZE: Record<string, { width: number; height: number }> = {
  '/campaign.jpg': { width: 928, height: 1152 },
  '/detail-drawcord.jpg': { width: 1184, height: 864 },
  '/detail-fabric.jpg': { width: 1200, height: 896 },
  '/detail-stitch.jpg': { width: 1200, height: 896 },
  '/hero-desktop.jpg': { width: 1376, height: 768 },
  '/hero-mobile.jpg': { width: 768, height: 1376 },
  '/lookbook/look-01-tall.jpg': { width: 1005, height: 1800 },
  '/lookbook/look-01-wide.jpg': { width: 2400, height: 1340 },
  '/lookbook/look-02.jpg': { width: 1344, height: 1800 },
  '/lookbook/look-03.jpg': { width: 1344, height: 1800 },
  '/lookbook/look-04-tall.jpg': { width: 1005, height: 1800 },
  '/lookbook/look-05.jpg': { width: 1344, height: 1800 },
  '/lookbook/look-06.jpg': { width: 1344, height: 1800 },
  '/lookbook/look-07-tall.jpg': { width: 1005, height: 1800 },
  '/lookbook/look-08.jpg': { width: 1344, height: 1800 },
  '/lookbook/look-09.jpg': { width: 1344, height: 1800 },
  '/lookbook/look-10-tall.jpg': { width: 1005, height: 1800 },
  '/products/hoodie-onyx-front.jpg': { width: 819, height: 1024 },
  '/products/hoodie-onyx-back.jpg': { width: 819, height: 1024 },
  '/products/hoodie-cream-front.jpg': { width: 819, height: 1024 },
  '/products/hoodie-cream-back.jpg': { width: 819, height: 1024 },
  '/products/pant-onyx-front.jpg': { width: 819, height: 1024 },
  '/products/pant-onyx-back.jpg': { width: 819, height: 1024 },
  '/products/pant-cream-front.jpg': { width: 819, height: 1024 },
  '/products/pant-cream-back.jpg': { width: 819, height: 1024 },
  '/products/hoodie-cream-worn-back.jpg': { width: 819, height: 1024 },
  '/products/hoodie-cream-worn-front.jpg': { width: 819, height: 1024 },
  '/products/hoodie-onyx-worn-back.jpg': { width: 819, height: 1024 },
  '/products/hoodie-onyx-worn-front.jpg': { width: 819, height: 1024 },
  '/products/pant-cream-worn.jpg': { width: 819, height: 1024 },
  '/products/pant-onyx-worn.jpg': { width: 819, height: 1024 },
};

export function imageSize(src: string): { width: number; height: number } {
  const size = IMAGE_SIZE[src];
  if (!size) throw new Error(`No width/height recorded for ${src}`);
  return size;
}

