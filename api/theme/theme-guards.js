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
    else if (name === 'hdt-modal') guardInfoModals(Ctor);
    return define(name, Ctor, options);
  };

  /**
   * Size guide and Delivery & returns.
   *
   * Kalles fades the dialog with translateX. On iOS that composite is a
   * black rectangle the size of the screen, and overflow:hidden on <html>
   * does not stop the document scrolling, so the gallery badge rides over
   * the dialog. These two modals open on <body>, lock the page, and close
   * without that transform.
   */
  var modalLocks = 0;
  var modalScrollY = 0;

  function blockModalTouch(event) {
    var node = event.target;
    if (node && node.closest) {
      var inner = node.closest('.hdt-dialog-modal__inner');
      if (inner) return;
    }
    event.preventDefault();
  }

  function lockModalPage() {
    modalLocks += 1;
    if (modalLocks > 1) return;
    modalScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.classList.add('otrace-modal-lock');
    document.documentElement.setAttribute('scroll-lock', '');
    var body = document.body;
    body.style.position = 'fixed';
    body.style.top = (-modalScrollY) + 'px';
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    document.addEventListener('touchmove', blockModalTouch, { passive: false });
  }

  function unlockModalPage() {
    modalLocks = Math.max(0, modalLocks - 1);
    if (modalLocks > 0) return;
    document.documentElement.classList.remove('otrace-modal-lock');
    var body = document.body;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    document.removeEventListener('touchmove', blockModalTouch);
    window.scrollTo(0, modalScrollY);
  }

  function isInfoModal(host) {
    return !!(host && host.classList && (
      host.classList.contains('hdt-modal__size-chart') ||
      host.classList.contains('hdt-modal__delivery')
    ));
  }

  function instantDialogAnim() {
    return { finished: Promise.resolve(), finish: function () {} };
  }

  function guardInfoModals(Ctor) {
    var open = Ctor.prototype.open;
    var close = Ctor.prototype.close;
    var animOpen = Ctor.prototype.animateDialogOpen;
    var animClose = Ctor.prototype.animateDialogClose;
    var parentShow = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Ctor.prototype), 'show');

    // showModal() promotes the dialog to the top layer. Closing that layer
    // while Kalles is translating it is the black flash. A non-modal show()
    // keeps the dialog inside the fixed host, which is the overlay.
    Object.defineProperty(Ctor.prototype, 'show', {
      configurable: true,
      get: function () {
        if (isInfoModal(this)) {
          this._openedAsModal = true;
          if (this.dialog && !this.dialog.open) this.dialog.show();
          return this.dialog;
        }
        return parentShow.get.call(this);
      },
    });

    if (!guardInfoModals.escape) {
      guardInfoModals.escape = true;
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        var dialog = document.querySelector(
          'hdt-modal.hdt-modal__size-chart dialog[open], hdt-modal.hdt-modal__delivery dialog[open]',
        );
        if (!dialog || !dialog.parentElement || typeof dialog.parentElement.close !== 'function') return;
        event.preventDefault();
        dialog.parentElement.close();
      });
    }

    Ctor.prototype.animateDialogOpen = function () {
      if (isInfoModal(this)) return instantDialogAnim();
      return animOpen.apply(this, arguments);
    };
    Ctor.prototype.animateDialogClose = function () {
      if (isInfoModal(this)) return instantDialogAnim();
      return animClose.apply(this, arguments);
    };
    Ctor.prototype.open = function () {
      if (isInfoModal(this)) {
        if (!this._otraceShade) {
          this._otraceShade = true;
          this.addEventListener('click', function (event) {
            if (event.target === this) this.close();
          });
        }
        if (this.parentNode !== document.body) document.body.appendChild(this);
        if (!this.dialog || !this.dialog.open) lockModalPage();
      }
      return open.apply(this, arguments);
    };
    Ctor.prototype.close = function () {
      var tracked = isInfoModal(this) && this.dialog && this.dialog.open;
      var result;
      try {
        result = close.apply(this, arguments);
      } catch (err) {
        if (tracked) unlockModalPage();
        throw err;
      }
      if (tracked) Promise.resolve(result).then(unlockModalPage, unlockModalPage);
      return result;
    };
  }

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
