/**
 * Browser events for Meta, TikTok, and GA4.
 *
 * Loaded only when at least one of those is configured. The server writes
 * the product and the verified purchase into #otrace-ads. This file does not
 * read prices from the page URL.
 */
(function () {
  if (window.__otraceAds) return;
  window.__otraceAds = 1;
  var node = document.getElementById('otrace-ads');
  if (!node) return;
  var cfg;
  try { cfg = JSON.parse(node.textContent || '{}'); }
  catch (err) { return; }
  var currency = cfg.currency || 'USD';

  function eventId(name) {
    return name + '.' + Date.now().toString(36) + '.' + Math.random().toString(36).slice(2, 10);
  }

  function meta(name, params, id) {
    if (!cfg.meta || typeof window.fbq !== 'function') return;
    window.fbq('track', name, params, { eventID: id });
  }

  function tiktok(name, params, id) {
    if (!cfg.tiktok || !window.ttq || typeof window.ttq.track !== 'function') return;
    var payload = {
      content_type: 'product',
      content_ids: params.content_ids,
      value: params.value,
      currency: params.currency,
      quantity: params.num_items,
      contents: (params.contents || []).map(function (row) {
        return {
          content_id: row.id,
          content_type: 'product',
          quantity: row.quantity,
          price: row.item_price,
        };
      }),
    };
    if (params.content_name) payload.content_name = params.content_name;
    window.ttq.track(name, payload, { event_id: id });
  }

  function ga(name, params) {
    if (!cfg.ga || typeof window.gtag !== 'function') return;
    window.gtag('event', name, params);
  }

  function catalog() {
    return (cfg.catalog && cfg.catalog.products) || {};
  }

  function idsOf(contents) {
    var ids = [];
    for (var i = 0; i < contents.length; i++) {
      if (contents[i].id && ids.indexOf(contents[i].id) === -1) ids.push(contents[i].id);
    }
    return ids;
  }

  function money(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function gaItems(contents) {
    var products = catalog();
    return contents.map(function (row) {
      var named = products[row.id];
      return {
        item_id: row.id,
        item_name: (named && named.name) || row.id,
        price: row.item_price,
        quantity: row.quantity,
      };
    });
  }

  function track(metaName, tiktokName, gaName, contents, value, id, extraGa) {
    var params = {
      content_ids: idsOf(contents),
      content_type: 'product',
      value: value,
      currency: currency,
      num_items: contents.reduce(function (sum, row) { return sum + row.quantity; }, 0),
      contents: contents,
    };
    if (contents.length === 1) {
      var named = catalog()[contents[0].id];
      if (named && named.name) params.content_name = named.name;
    }
    meta(metaName, params, id);
    tiktok(tiktokName, params, id);
    var gaParams = { currency: currency, value: value, items: gaItems(contents) };
    if (extraGa) {
      for (var key in extraGa) {
        if (Object.prototype.hasOwnProperty.call(extraGa, key)) gaParams[key] = extraGa[key];
      }
    }
    ga(gaName, gaParams);
  }

  if (cfg.product && cfg.product.content_ids && cfg.product.content_ids.length) {
    var product = cfg.product;
    var viewId = eventId('viewcontent');
    meta('ViewContent', {
      content_ids: product.content_ids,
      content_type: 'product',
      content_name: product.content_name,
      value: product.value,
      currency: product.currency || currency,
      contents: product.contents,
    }, viewId);
    tiktok('ViewContent', {
      content_ids: product.content_ids,
      content_type: 'product',
      content_name: product.content_name,
      value: product.value,
      currency: product.currency || currency,
      contents: product.contents,
    }, viewId);
    ga('view_item', {
      currency: product.currency || currency,
      value: product.value,
      items: product.items || [],
    });
  }

  if (cfg.purchase && cfg.purchase.transaction_id && cfg.purchase.value != null) {
    var purchase = cfg.purchase;
    var storageKey = 'otrace-purchase:' + purchase.transaction_id;
    var already = false;
    try { already = window.sessionStorage.getItem(storageKey) === purchase.event_id; }
    catch (err) { already = false; }
    if (!already) {
      try { window.sessionStorage.setItem(storageKey, purchase.event_id); }
      catch (err) { /* a private window still records this one view */ }
      var purchaseContents = (purchase.items || []).map(function (item) {
        return { id: item.item_id, quantity: item.quantity, item_price: item.price };
      });
      meta('Purchase', {
        content_ids: purchase.content_ids,
        content_type: 'product',
        value: purchase.value,
        currency: purchase.currency || currency,
        num_items: purchase.num_items,
        contents: purchaseContents,
      }, purchase.event_id);
      tiktok('CompletePayment', {
        content_ids: purchase.content_ids,
        content_type: 'product',
        value: purchase.value,
        currency: purchase.currency || currency,
        num_items: purchase.num_items,
        contents: purchaseContents,
      }, purchase.event_id);
      ga('purchase', {
        transaction_id: purchase.transaction_id,
        value: purchase.value,
        currency: purchase.currency || currency,
        items: purchase.items || [],
        event_id: purchase.event_id,
      });
    }
  }

  function skuOf(variantId) {
    var products = catalog();
    var upper = String(variantId || '').toUpperCase();
    var keys = Object.keys(products);
    for (var i = 0; i < keys.length; i++) {
      if (upper.indexOf(keys[i] + '-') === 0) return keys[i];
    }
    if (products[upper]) return upper;
    return '';
  }

  function applySet(contents) {
    var book = cfg.catalog || {};
    var products = book.products || {};
    if (book.setUnit == null) return contents;
    var hood = 0;
    var pant = 0;
    for (var i = 0; i < contents.length; i++) {
      if (contents[i].id === 'OT-HOOD') hood += contents[i].quantity;
      if (contents[i].id === 'OT-PANT') pant += contents[i].quantity;
    }
    var sets = Math.min(hood, pant);
    if (!sets) return contents;
    var singleHood = products['OT-HOOD'] && products['OT-HOOD'].price;
    var singlePant = products['OT-PANT'] && products['OT-PANT'].price;
    var stillSingle = contents.every(function (row) {
      if (row.id === 'OT-HOOD') return row.item_price === singleHood;
      if (row.id === 'OT-PANT') return row.item_price === singlePant;
      return true;
    });
    if (!stillSingle) return contents;
    var next = [
      { id: 'OT-HOOD', quantity: sets, item_price: book.setUnit },
      { id: 'OT-PANT', quantity: sets, item_price: book.setUnit },
    ];
    if (hood - sets > 0) next.push({ id: 'OT-HOOD', quantity: hood - sets, item_price: singleHood });
    if (pant - sets > 0) next.push({ id: 'OT-PANT', quantity: pant - sets, item_price: singlePant });
    return next;
  }

  function matchLine(items, line, sku) {
    var bySku = null;
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      if (!item) continue;
      if (line.id && (item.variant_id === line.id || item.id === line.id)) return item;
      if (!bySku && sku && (item.sku === sku || item.product_id === sku)) bySku = item;
    }
    return bySku;
  }

  function contentsFromLines(lines, cart) {
    var contents = [];
    var items = cart && Array.isArray(cart.items) ? cart.items : [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var sku = skuOf(line.id) || String(line.sku || '').toUpperCase();
      var qty = Math.max(1, Number(line.quantity) || 1);
      var unit = null;
      var item = matchLine(items, line, sku);
      if (item) {
        sku = item.sku || item.product_id || sku;
        var cents = item.final_price != null ? item.final_price : item.price;
        if (cents != null && isFinite(Number(cents))) unit = Number(cents) / 100;
      }
      if (unit == null && sku && catalog()[sku]) unit = catalog()[sku].price;
      if (!sku || unit == null || !isFinite(unit)) continue;
      contents.push({ id: sku, quantity: qty, item_price: unit });
    }
    return applySet(contents);
  }

  function linesFromObject(json) {
    if (!json || typeof json !== 'object') return [];
    if (Array.isArray(json.items)) {
      return json.items.map(function (item) {
        return {
          id: item && (item.id || item.variant_id),
          sku: item && item.sku,
          quantity: item && item.quantity || 1,
        };
      }).filter(function (item) { return item.id || item.sku; });
    }
    if (json.id || json.variant_id || json.sku) {
      return [{ id: json.id || json.variant_id, sku: json.sku, quantity: json.quantity || 1 }];
    }
    return [];
  }

  function linesFromParams(params) {
    if (!params || typeof params.get !== 'function') return [];
    var indexed = [];
    if (typeof params.forEach === 'function') {
      params.forEach(function (value, key) {
        var match = /^items\[(\d+)\]\[(id|quantity|sku)\]$/.exec(String(key));
        if (!match) return;
        var index = Number(match[1]);
        indexed[index] = indexed[index] || { id: '', sku: '', quantity: 1 };
        if (match[2] === 'quantity') indexed[index].quantity = Number(value || 1);
        else indexed[index][match[2] === 'sku' ? 'sku' : 'id'] = String(value);
      });
    }
    var found = indexed.filter(function (line) { return line && (line.id || line.sku); });
    if (found.length) return found;
    var direct = params.get('id') || params.get('variant_id');
    if (!direct && !params.get('sku')) return [];
    return [{
      id: direct ? String(direct) : '',
      sku: params.get('sku') ? String(params.get('sku')) : '',
      quantity: Number(params.get('quantity') || 1),
    }];
  }

  function parseBody(body) {
    if (!body) return [];
    if (typeof body === 'string') {
      try { return linesFromObject(JSON.parse(body)); }
      catch (err) {
        try { return linesFromParams(new URLSearchParams(body)); }
        catch (again) { return []; }
      }
    }
    if (typeof FormData !== 'undefined' && typeof FormData === 'function' && body instanceof FormData) {
      return linesFromParams(body);
    }
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return linesFromParams(body);
    return [];
  }

  function checkoutLines(body) {
    var parsed = [];
    if (typeof body === 'string') {
      try { parsed = JSON.parse(body).items || []; }
      catch (err) { parsed = []; }
    }
    return parsed.map(function (item) {
      return { sku: item && item.sku, quantity: item && item.quantity || 1 };
    }).filter(function (item) { return item.sku; });
  }

  function priceCheckout(lines) {
    var book = cfg.catalog || {};
    var products = book.products || {};
    var qty = {};
    for (var i = 0; i < lines.length; i++) {
      var sku = String(lines[i].sku || '').toUpperCase();
      if (!products[sku]) continue;
      qty[sku] = (qty[sku] || 0) + (Number(lines[i].quantity) || 1);
    }
    var hood = qty['OT-HOOD'] || 0;
    var pant = qty['OT-PANT'] || 0;
    var sets = Math.min(hood, pant);
    var contents = [];
    if (sets && products['OT-HOOD']) contents.push({ id: 'OT-HOOD', quantity: sets, item_price: book.setUnit });
    if (sets && products['OT-PANT']) contents.push({ id: 'OT-PANT', quantity: sets, item_price: book.setUnit });
    if (hood - sets > 0) contents.push({ id: 'OT-HOOD', quantity: hood - sets, item_price: products['OT-HOOD'].price });
    if (pant - sets > 0) contents.push({ id: 'OT-PANT', quantity: pant - sets, item_price: products['OT-PANT'].price });
    return contents;
  }

  function sum(contents) {
    return contents.reduce(function (total, row) { return total + row.item_price * row.quantity; }, 0);
  }

  var lastAddKey = '';
  var lastAddAt = 0;
  function fireAdd(lines, cart) {
    var contents = contentsFromLines(lines, cart);
    if (!contents.length) return;
    var key = contents.map(function (row) { return row.id + ':' + row.quantity + ':' + row.item_price; }).join(',');
    var now = Date.now();
    if (key === lastAddKey && now - lastAddAt < 1200) return;
    lastAddKey = key;
    lastAddAt = now;
    track('AddToCart', 'AddToCart', 'add_to_cart', contents, money(sum(contents)), eventId('addtocart'));
  }

  var lastCheckoutAt = 0;
  function fireCheckout(contents) {
    if (!contents || !contents.length) return;
    var now = Date.now();
    if (now - lastCheckoutAt < 2000) return;
    lastCheckoutAt = now;
    track('InitiateCheckout', 'InitiateCheckout', 'begin_checkout', contents, money(sum(contents)), eventId('checkout'));
  }

  function cartContents(cart) {
    var items = cart && Array.isArray(cart.items) ? cart.items : [];
    return items.map(function (item) {
      var sku = item.sku || item.product_id || skuOf(item.variant_id || item.id);
      var cents = item.final_price != null ? item.final_price : item.price;
      return { id: sku, quantity: item.quantity || 1, item_price: Number(cents) / 100 };
    }).filter(function (row) { return row.id && isFinite(row.item_price); });
  }

  function isAddUrl(url) {
    return /\/cart\/add(\.js)?(\?|$)/.test(String(url || ''));
  }

  function isCheckoutUrl(url) {
    return /\/api\/checkout(\?|$)/.test(String(url || ''));
  }

  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = (init && init.method) || (input && input.method) || 'GET';
      var upper = String(method).toUpperCase();
      var body = init && init.body;
      var pending = origFetch.apply(this, arguments);
      if (isAddUrl(url) && upper !== 'GET') {
        var lines = parseBody(body);
        return pending.then(function (res) {
          if (res && res.ok) {
            res.clone().json().then(function (cart) { fireAdd(lines, cart); }).catch(function () { fireAdd(lines, null); });
          }
          return res;
        });
      }
      if (isCheckoutUrl(url) && upper === 'POST') fireCheckout(priceCheckout(checkoutLines(body)));
      return pending;
    };
  }

  if (window.XMLHttpRequest && XMLHttpRequest.prototype) {
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__otraceMethod = method;
      this.__otraceUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      var xhr = this;
      var upper = String(xhr.__otraceMethod || '').toUpperCase();
      if (isAddUrl(xhr.__otraceUrl) && upper !== 'GET') {
        var lines = parseBody(body);
        xhr.addEventListener('load', function () {
          if (xhr.status >= 200 && xhr.status < 300) {
            var cart = null;
            try { cart = JSON.parse(xhr.responseText); } catch (err) { cart = null; }
            fireAdd(lines, cart);
          }
        });
      }
      if (isCheckoutUrl(xhr.__otraceUrl) && upper === 'POST') fireCheckout(priceCheckout(checkoutLines(body)));
      return origSend.apply(this, arguments);
    };
  }

  var cartSnapshot = null;
  var cartPromise = null;
  function refreshCart() {
    if (typeof origFetch !== 'function') return Promise.resolve(null);
    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    cartPromise = origFetch.call(window, root + 'cart.js', { credentials: 'same-origin' })
      .then(function (res) { return res && res.ok ? res.json() : null; })
      .then(function (cart) {
        if (cart && Array.isArray(cart.items)) cartSnapshot = cart;
        return cartSnapshot;
      })
      .catch(function () { return cartSnapshot; });
    return cartPromise;
  }
  refreshCart();

  document.addEventListener('pointerdown', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('[name="checkout"]') : null;
    if (target) refreshCart();
  }, true);

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || !form.getAttribute) return;
    var action = form.getAttribute('action') || form.action || '';
    if (isAddUrl(action)) {
      var lines = linesFromParams(new FormData(form));
      window.setTimeout(function () { fireAdd(lines, cartSnapshot); }, 500);
      return;
    }
    var submitter = event.submitter || document.activeElement;
    if (!submitter || submitter.name !== 'checkout') return;
    var contents = cartContents(cartSnapshot);
    if (contents.length) {
      fireCheckout(contents);
      return;
    }
    Promise.resolve(cartPromise || refreshCart()).then(function (cart) {
      fireCheckout(cartContents(cart));
    });
  }, true);

  function trackLead() {
    var id = eventId('lead');
    meta('Lead', { content_name: 'Email signup', currency: currency }, id);
    if (cfg.tiktok && window.ttq && typeof window.ttq.track === 'function') {
      window.ttq.track('SubmitForm', {
        content_name: 'Email signup',
        currency: currency,
      }, { event_id: id });
    }
    ga('generate_lead', { currency: currency });
  }

  document.addEventListener('otrace:lead', trackLead);
})();
