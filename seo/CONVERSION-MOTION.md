# Conversion motion

The store uses CSS and a small amount of React. React Three Fiber, GSAP, Framer Motion, Spline, and `<model-viewer>` are not installed. A renderer or a scroll-timeline library would be extra weight for four photographs and an empty turntable folder. CSS crossfades cover the photographs. A timeline library is the right add only after a 24–36 frame shoot exists and the scrub needs a pinned scene.

There is no hoodie GLB and no fabric video in the repo. The home hero stays a static image so it can be the LCP element.

## What is on the site

**Product gallery.** Drag, the Angles range, or a horizontal trackpad swipe crossfades between the photographs that already exist (hoodie: front, back, worn, worn back; sweatpant: front, worn). The first photograph is a normal `<img>` with `fetchpriority="high"`. Neighbouring frames load beside it. A vertical swipe still scrolls the page. Reduced motion shows one frame at a time and does not coast. The caption says these are the photographs we have, not a 3D model.

**Turntable scaffold.** `site/public/turntable/manifest.json` ships with `"sequences": {}`. When a colourway is listed there and its first frame actually loads, those frames replace the photographs for that colour. Paths look like `/turntable/oversized-hoodie/onyx-black/01.jpg`. See below. Until that file is real, the gallery does not request frames.

**Feel the 450 GSM.** On the product page, scrolling the section across the viewport moves through `/detail-fabric.jpg`, `/detail-stitch.jpg`, and `/detail-drawcord.jpg` and eases the crop. The range and a drag take over from the scroll. Reduced motion leaves the first photograph still. There is no loop video because the repo has none.

**Weight scale.** Home (“Made heavy on purpose”) and the product fabric section show three bars: a typical tee at about 180 GSM, a typical hoodie at about 300 GSM, and this fleece at 450 GSM. The caption says the first two are typical cloth weights, not OTRACE products and not a test of another brand. 450 is this fleece.

**Colour and the set.** Changing colour fades the previous frame. “Buy both pieces” toggles the hoodie and the sweatpant at full price ($148 + $128 = $276 from the catalogue, not a discount). Add then puts both lines in the cart, same colour, same size. The set switcher still links to the other product and keeps the colour.

**Add to cart.** The button reads “Added” for about 1.4 seconds. The cart drawer still opens. Desktop shows a bottom bar after the in-page button scrolls away, or after a drag once the gallery has scrolled up. The bar does not animate in. It is not on `/cart` or `/order/success`. The lead popup stays off those routes and off the cart drawer.

**Home weight-and-cut stack, quality diagrams, lookbook shift.** Unchanged from the previous pass: CSS perspective under the ticker, journal diagrams with links, and at most 16px of lookbook shift on desktop. Phones and reduced motion stay still.

## Not shipped

**Pre-order timeline.** Both products are in stock. The copy that is on the site is “ships in 3–5 business days”. The old 6–8 week window is not the current offer. Cut → sew → dye is already explained on the garment-dyed page and in the dye diagram, without dates. A dated production timeline would be invented, so it is not on the page.

**model-viewer and AR.** `site/public/models/` is empty. Do not point a viewer at a GLB until `hoodie.glb` is actually there. Load `@google/model-viewer` with a dynamic import from the product page only, keep the photograph scrub as the fallback, and do not put the model on the home hero. Poster: `/products/hoodie-onyx-front.jpg`.

**Fit visualizer with extra on-model bodies, hardware hotspots, and a pinned 36-frame scroll scene.** Those need photographs or clips that are not in the repo.

## Adding a turntable

Shoot 24–36 frames of one colourway, same crop, in order. Export JPEG or WebP at one pixel size. Put them in:

`site/public/turntable/oversized-hoodie/onyx-black/01.jpg` … `24.jpg`

Then set `site/public/turntable/manifest.json`:

```json
{
  "sequences": {
    "oversized-hoodie": {
      "onyx-black": { "frames": 24, "width": 819, "height": 1024, "ext": "jpg" }
    }
  }
}
```

`frames` must be an integer from 2 to 36. `ext` is `jpg` or `webp`. Slugs are lowercase letters, numbers, and hyphens. The gallery ignores anything else, and it keeps the existing photographs if the first frame 404s. Add the frame size to `site/src/lib/image-size.ts` only if a frame is also used as a normal `<img>` in prerendered HTML outside the gallery. The gallery reads width and height from the manifest.

Repeat per colourway (`warm-cream`, and the sweatpant slugs `wide-leg-sweatpant`). Do not generate the frames. A missing shoot is better than a fake rotation.
