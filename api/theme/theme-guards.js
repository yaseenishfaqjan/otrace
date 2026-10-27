/**
 * Quiet unused Kalles paths that throw on this storefront.
 *
 * Injected as a classic script from content_for_header, which runs while the
 * document is still parsing. Theme modules are deferred, so this wraps
 * customElements.define before global.min.js registers its elements. The
 * vendor bundles stay as shipped.
 *
 * Each guard leaves the feature alone when its markup is complete, and skips
 * only the call that would throw when a selector the theme assumes is missing.
 */
(function () {
  var define = customElements.define.bind(customElements);
  customElements.define = function (name, Ctor, options) {
    if (name === 'hdt-sticky-header') guardSticky(Ctor);
    else if (name === 'hdt-country-province-selector') guardCountry(Ctor);
    else if (name === 'hdt-slider-thumb') guardThumbs(Ctor);
    return define(name, Ctor, options);
  };

  /**
   * StickyHeader observes .hdt-section-header. Our section wrapper does not
   * carry that class, so the observer is handed null and then the scroll
   * handler throws on every scroll. Keep the height measurement and the
   * transparent-header check; skip the observer.
   */
  function guardSticky(Ctor) {
    var orig = Ctor.prototype.connectedCallback;
    Ctor.prototype.connectedCallback = function () {
      var sticky = this.getAttribute('sticky-type');
      if (sticky && sticky !== 'none' && !this.closest('.hdt-section-header')) {
        if (typeof this.checkTransparent === 'function') this.checkTransparent();
        var parent = Object.getPrototypeOf(Ctor.prototype);
        if (parent && typeof parent.connectedCallback === 'function') parent.connectedCallback.call(this);
        return;
      }
      return orig.call(this);
    };
  }

  /**
   * The shipping estimator's country list is Shopify's country_option_tags.
   * That list is empty here, so the change handler reads getAttribute on a
   * missing option the moment the cart (and the cart drawer) connects.
   */
  function guardCountry(Ctor) {
    var orig = Ctor.prototype.connectedCallback;
    Ctor.prototype.connectedCallback = function () {
      var country = this.querySelector('[name="address[country]"]');
      var province = this.querySelector('[name="address[province]"]');
      if (!country || !province || country.selectedIndex < 0 || !country.options[country.selectedIndex]) return;
      var opt = country.options[country.selectedIndex];
      if (!opt.getAttribute('data-provinces')) opt.setAttribute('data-provinces', '[]');
      return orig.call(this);
    };
  }

  /**
   * Product thumbnails carry stagger with no [reval] children. The entrance
   * animation then calls Motion's animate() on an empty set, which throws
   * "No valid element provided" as the gallery connects. Nothing to animate
   * means the attribute can come off; the thumbs themselves are untouched.
   */
  function guardThumbs(Ctor) {
    var orig = Ctor.prototype.connectedCallback;
    Ctor.prototype.connectedCallback = function () {
      if (this.hasAttribute('stagger') && !this.querySelector('[reval]')) this.removeAttribute('stagger');
      return orig.call(this);
    };
  }
})();
