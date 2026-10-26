# Conversion motion

Shipped on the storefront without a 3D library. There is no hoodie GLB in the repo, so the pages use the photographs that already exist. React Three Fiber and `<model-viewer>` were not added: either one would download a renderer for a file the owner has not supplied, and the home hero has to stay a plain image so it can be the LCP element.

## What is on the site

**Home, under the ticker.** `WeightCut` stacks the Onyx hoodie front and back photographs in a CSS perspective. On a fine pointer, with motion allowed, moving the pointer tilts the stack a few degrees. Otherwise the stack sits still, including `prefers-reduced-motion: reduce` and touch screens. Both images are `loading="lazy"`. The campaign hero above them is unchanged and remains the LCP image.

**Home, after the construction photos.** `QualityStrip` reuses the journal diagrams for 450 GSM, garment dye order, and the boxy block. Each one links to the hoodie, the Warm Cream hoodie, or the size guide. A stroke draw runs only when motion is allowed. Reduced motion shows the lines immediately.

**Product gallery.** The angle control still steps through the existing frames (hoodie: front, back, worn, worn back; sweatpant: front, worn). A mouse drag now keeps a little speed after release and coasts to a stop. Touch keeps native scroll-snap momentum. Changing colour fades the previous frame out over about half a second. Reduced motion swaps the frame with no fade and no coast. The caption still says these are photographs, not a 3D model.

**Add to cart.** Choosing a size shows that size’s flat measurements from the product data. The selected size shifts up by 1px when motion is allowed. The button label changes to “Added” for about 1.4 seconds. The cart drawer still opens, which is the existing confirmation. Desktop shows a bottom bar once the in-page button has left the viewport, or once the gallery has been dragged and then scrolled up. The bar does not animate in. It is not shown on `/cart` or `/order/success`. The lead popup stays off those routes and off the cart drawer.

**Lookbook.** On viewports at least 768px wide, with motion allowed, each look shifts up to 16px against the scroll. Phones and reduced motion leave the pictures still. The existing scroll-snap and the cover “Scroll” line are unchanged. The line does not animate when motion is reduced.

## Performance

No new runtime dependency. Nothing in this pass is dynamically imported, because the added code is small CSS and React and is cheaper than a separate chunk that still has to be requested. The home hero image is not the weight-and-cut stack. Product and lookbook photographs were already on those routes.

## Dropping in a GLB later

Put the file at `site/public/models/hoodie.glb`. Do not point a viewer at it until the file is actually there.

When it is:

1. Load `@google/model-viewer` with a dynamic `import()` from the product page only, and only when `document.querySelector` is unnecessary — check `fetch('/models/hoodie.glb', { method: 'HEAD' })` or, simpler, ship the tag only after the file is committed.
2. Keep the photograph scrub as the fallback when the HEAD request fails, when WebGL is missing, and when `prefers-reduced-motion: reduce` matches.
3. Do not put the model on the home hero. If the home page uses it, render it below the hero and lazy-load the script.
4. Poster image: `/products/hoodie-onyx-front.jpg`. Alt text stays a description of the garment, not “3D model” unless that is what is showing.

`site/public/models/` is empty on purpose. No GLB was generated.
