import { $4, $$4, $id4, debounce } from '@theme/utilities';
import { getterAdd, getterGet, getterRunFn, btnTooltip, DrawerComponent, VariantChangeBase } from "@theme/global";
import { ThemeEvents } from '@theme/events';
const {dialogClose, dialogOpen} = ThemeEvents;

// WISHLIST
var $wishlist_list = $id4('hdt_wishlist_list'),
  $compare_list = $id4('hdt_compare_list'),
  nameCachedWishlist = 'theme4:wishlist:id',
  nameCachedCompare = 'theme4:compare:id';
// if exit $wishlist_list is use app wishlist the4
if ($wishlist_list) {
  var arr_wishlist_list = $wishlist_list.textContent ? $wishlist_list.textContent.split(' ') : [];
}
else {
  var arr_wishlist_list = (!localStorage.getItem(nameCachedWishlist)) ? [] : localStorage.getItem(nameCachedWishlist).split(',');  // remove id: and conver array
}
if ($compare_list){
  var arr_compare_list = $compare_list.textContent ? $compare_list.textContent.split(' ') : [];
}
else {
  var arr_compare_list = (!localStorage.getItem(nameCachedCompare)) ? [] : localStorage.getItem(nameCachedCompare).split(',');  // remove id: and conver array
}
// arr_wishlist_list = [1234, 5678, 9011]
// arr_compare_list = [1234, 5678, 9011]

var linkWishlistApp = '/apps/ecomrise/wishlist',
  linkCompareApp = '/apps/ecomrise/compare',
  actionAfterWishlistAdded = themeHDN.extras.AddedWishlistRemove ? 'remove' : 'added',
  actionAfterCompareAdded = themeHDN.extras.AddedCompareRemove ? 'remove' : 'added',
  limitWishlist = $wishlist_list ? 100 : 50,
  limitCompare = 5,
  conver_to_link_fn = function (prefix = this.textFn, array = this.array) {
    const x = themeHDN.routes.search_url + `/?view=${prefix}`,
      y = x + '&type=product&options[unavailable_products]=last&q=';
    return (array.length) ? y + encodeURI(`id:${array.join(' OR id:')}`) : x;
  };
// Reset if limit change
if (arr_wishlist_list.length > limitWishlist) {
  arr_wishlist_list.splice(limitWishlist - 1, arr_wishlist_list.length - 1);
  localStorage.setItem(nameCachedWishlist, arr_wishlist_list.toString());
}
// Check is page has item but not show reload page
if (window.isPageWishlist) {
  if (arr_wishlist_list.length && !window.isWishlistPerformed) {
    window.location.href = conver_to_link_fn('wishlist', arr_wishlist_list)
  } else {
    window.history.replaceState({}, document.title, conver_to_link_fn('wishlist', []));
  }
  themeHDN.wisHref = conver_to_link_fn('wishlist', arr_wishlist_list);
}

// Reset if limit change
if (arr_compare_list.length > limitCompare) {
  arr_compare_list.splice(limitCompare - 1, arr_compare_list.length - 1);
  localStorage.setItem(nameCachedCompare, arr_compare_list.toString());
}
// Check is page has item but not show reload page
if (window.isPageCompare) {
  if (arr_compare_list.length && !window.isComparePerformed) {
    window.location.href = conver_to_link_fn('compare', arr_compare_list)
  } else {
    window.history.replaceState({}, document.title, conver_to_link_fn('compare', []));
  }
}
var _wishlist_id, _wishlist_handle,
  _update_wis_text, update_wis_text_fn,
  _update_wis_btns, update_wis_btns_fn,
  _click_wis, click_wis_fn,
  _add_wis, add_wis_fn,
  _remove_wis, remove_wis_fn,
  _action_after_remove_add, action_after_remove_add_fn,
  _show_popup_compare, show_popup_compare_fn,
  _conver_to_link;
class Wishlist extends btnTooltip {
  constructor() {
    super();
    getterAdd(_wishlist_id, this, this.dataset.id);
    getterAdd(_wishlist_handle, this, this.dataset.handle);
    getterAdd(_update_wis_text, this);
    getterAdd(_update_wis_btns, this);
    getterAdd(_click_wis, this);
    getterAdd(_add_wis, this);
    getterAdd(_remove_wis, this);
    getterAdd(_action_after_remove_add, this);
    getterAdd(_show_popup_compare, this);
    getterAdd(_conver_to_link, this);
    this.tabIndex = 0;
    this.addEventListener("click", (event) => getterRunFn(_click_wis, this, click_wis_fn).call(this, event));
    this.addEventListener("keydown", (event) => {
      if (event.key == "Enter") getterRunFn(_click_wis, this, click_wis_fn).call(this, event)
    });
  }
  static get observedAttributes() {
    return ["action"];
  }
  get isFnWishlist() {
    return true;
  }
  get textFn() {
    return 'wishlist';
  }
  get isPageWishlistorCompare() {
    //add code check page
    return this.isFnWishlist ? window.isPageWishlist : window.isPageCompare;
  }
  get limit() {
    return this.isFnWishlist ? limitWishlist : limitCompare;
  }
  get nameCached() {
    return this.isFnWishlist ? nameCachedWishlist : nameCachedCompare;
  }
  get array() {
    return this.isFnWishlist ? arr_wishlist_list : arr_compare_list;
  }
  get actionAfterAdded() {
    return this.isFnWishlist ? actionAfterWishlistAdded : actionAfterCompareAdded;
  }
  get action() {
    return this.getAttribute('action');
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || (oldValue === null && newValue === 'add')) return;
    getterRunFn(_update_wis_text, this, update_wis_text_fn).call(this, newValue);
    super.attributeChangedCallback(name, oldValue, newValue);
  }
  connectedCallback() {
    super.connectedCallback();
    if (this.array.indexOf(getterGet(_wishlist_id, this)) > -1) {
      if (this.hasAttribute('remove-on-page')) {
        return
      }
      this.setAttribute('action', this.actionAfterAdded);
    }
  }
};
_wishlist_id = new WeakMap();
_wishlist_handle = new WeakMap();
_update_wis_text = new WeakSet();
_update_wis_btns = new WeakSet();
_click_wis = new WeakSet();
_add_wis = new WeakSet();
_remove_wis = new WeakSet();
_action_after_remove_add = new WeakSet();
_conver_to_link = new WeakSet();
_show_popup_compare = new WeakSet();
update_wis_text_fn = function (value) {
  if (this.hasAttribute('remove-on-page')) return;
  const text = themeHDN.extras[`text_${this.isFnWishlist ? 'wis' : 'cp'}_${value}`],
    icon = themeHDN.extras[`icon_${this.isFnWishlist ? 'wis' : 'cp'}_${value}`];
  if (icon) this.firstElementChild.replaceWith(document.createRange().createContextualFragment(icon));
  if (text) {
    this.lastElementChild.textContent = text;
    this.setAttribute('data-txt-tt',text)
  }
};
update_wis_btns_fn = function (_action) {
  // Update Button
  $$4(`hdt-${this.textFn}[data-id="${getterGet(_wishlist_id, this)}"]`).forEach(btn => {
    btn.setAttribute('action', _action);
  });
  // Update Count and link
  document.dispatchEvent(new CustomEvent(`theme4:${this.textFn}:update`, {
    bubbles: true,
    detail: 'the4'  // arr_wishlist_list
  }));
  if ((window.isPageWishlist)) themeHDN.wisHref = conver_to_link_fn('wishlist', arr_wishlist_list);
};
click_wis_fn = function (e) {

  if (this.action == 'add') {
    // ADD
    getterRunFn(_add_wis, this, add_wis_fn).call(this);
  } else if (this.action === 'added') {
    // ADDED: go to page wishlist
    if (!this.isFnWishlist && themeHDN.extras.enableComparePopup) {
      getterRunFn(_show_popup_compare, this, show_popup_compare_fn).call(this);
    } else {
      window.location.href = getterRunFn(_conver_to_link, this, conver_to_link_fn).call(this);
    }
  } else {
    // REMOVE
    getterRunFn(_remove_wis, this, remove_wis_fn).call(this, e);
  }
};
add_wis_fn = function (e) {
  if ($wishlist_list && this.isFnWishlist || $compare_list && !this.isFnWishlist) {
    // app wishlist
    this.setAttribute('aria-busy', true);
    fetch(this.isFnWishlist ? linkWishlistApp : linkCompareApp, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: getterGet(_wishlist_id, this),
        product_handle: getterGet(_wishlist_handle, this),
        action: 'add'
      })
    })
    .then((response) => {
      return response.json()
    })
    .then((data) => {
      if (data.status != 'success') {
        console.error(data.message || 'Unknow error');
        return;
      }
      if(this.isFnWishlist) {
        arr_wishlist_list = JSON.parse(data.response.metafield.value).ecomrise_ids;
        if (!Array.isArray(arr_wishlist_list)) {
          arr_wishlist_list = arr_wishlist_list.split(',');
        }
      }
      if (!this.isFnWishlist) {
        arr_compare_list = JSON.parse(data.response.metafield.value).ecomrise_ids;
        if (!Array.isArray(arr_compare_list)) {
          arr_compare_list = arr_compare_list.split(',');
        }
        getterRunFn(_show_popup_compare, this, show_popup_compare_fn).call(this);
      }
      getterRunFn(_action_after_remove_add, this, action_after_remove_add_fn).call(this, this.actionAfterAdded);
    })
    .catch(function (error) {
      console.log('Error: ' + error);
    })
    .finally(() => {
      this.setAttribute('aria-busy', false);
    });
  }
  else {
    // local wishlist
    // adds the specified elements to the beginning of an array
    this.array.unshift(getterGet(_wishlist_id, this));
    //console.log(this.array, getterGet(_wishlist_id, this))
    if (this.array.length > this.limit) {
      // if over limit remove element on last array
      let arraySplice = this.array.splice(this.limit, 1);
      // arraySplice: allway has 1 element
      $$4(`hdt-${this.textFn}[data-id="${arraySplice[0]}"]`).forEach(btn => {
        btn.setAttribute('action', 'add');
      });
    }
    if (!this.isFnWishlist) getterRunFn(_show_popup_compare, this, show_popup_compare_fn).call(this);
    getterRunFn(_action_after_remove_add, this, action_after_remove_add_fn).call(this, this.actionAfterAdded);
    localStorage.setItem(this.nameCached, this.array.toString());
  }
};
remove_wis_fn = function (e) {
  e.preventDefault();
  e.stopPropagation();
  // REMOVE
  if ($wishlist_list && this.isFnWishlist || $compare_list && !this.isFnWishlist) {
    // app wishlist
    this.setAttribute('aria-busy', true);
    fetch(this.isFnWishlist ? linkWishlistApp : linkCompareApp, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: getterGet(_wishlist_id, this),
        product_handle: getterGet(_wishlist_handle, this),
        action: 'add',
        _method: 'DELETE'
      })
    })
    .then((response) => {
      return response.json()
    })
    .then((data) => {
      if (data.status != 'success') {
        console.error(data.message || 'Unknow error');
        return;
      }
      arr_wishlist_list = JSON.parse(data.response.metafield.value).ecomrise_ids;
      if (!Array.isArray(arr_wishlist_list)) {
        arr_wishlist_list = arr_wishlist_list.split(',');
      }
      getterRunFn(_action_after_remove_add, this, action_after_remove_add_fn).call(this, 'add');
    })
    .catch(function (error) {
      console.log('Error: ' + error);
    })
    .finally(() => {
      this.setAttribute('aria-busy', false);
    });
  } else {
    // local wishlist
    this.array.splice(this.array.indexOf(getterGet(_wishlist_id, this)), 1);
    localStorage.setItem(this.nameCached, this.array.toString());

    getterRunFn(_action_after_remove_add, this, action_after_remove_add_fn).call(this, 'add');
  }
};
action_after_remove_add_fn = function (action) {

  if (this.getAttribute('action') == 'remove' && this.hasAttribute('remove-on-page')) {
    if (this.isFnWishlist) {      
      this.setAttribute('aria-busy', true);
      if (this.isPageWishlistorCompare) window.location.href = getterRunFn(_conver_to_link, this, conver_to_link_fn).call(this);
      // this.closest('.hdt-card-product').remove();
    } else {
      $$4(`.hdt-compare-item-${getterGet(_wishlist_id, this)}`).forEach(item => {
        item.remove();
        // console.log("Remove compare item");
      });
    }
    getterRunFn(_update_wis_btns, this, update_wis_btns_fn).call(this, action);
    if (this.array.length == 0) {
      $id4('drawerCompare')?.closest('hdt-drawer')?.close();
      if (this.isPageWishlistorCompare) window.location.href = getterRunFn(_conver_to_link, this, conver_to_link_fn).call(this);
    }
    //this.setAttribute('action', action);
  } else {
    getterRunFn(_update_wis_btns, this, update_wis_btns_fn).call(this, action);
    // is page wishlist or compare reload page
    if (this.isPageWishlistorCompare) window.location.href = getterRunFn(_conver_to_link, this, conver_to_link_fn).call(this);
  }
};
show_popup_compare_fn = function (event) {
  if (!themeHDN.extras.enableComparePopup || this.isPageWishlistorCompare) return;
  // add code if want show popup compare
  $id4('drawerCompare')?.closest('hdt-drawer')?.open();
  fetch(conver_to_link_fn('compare', arr_compare_list) + "&section_id=compare-offcanvas")
    .then((response) => response.text())
    .then((text) => {
      const html = document.createElement('div');
      html.innerHTML = text;
      const prds = html.querySelector('offcanvas-compare');

      if (prds && prds.innerHTML.trim().length) {

        $4("offcanvas-compare").innerHTML = prds.innerHTML;
      }
    })
    .catch((e) => {
      console.error(e);
    });
};
var _clear_all, clear_all_fn;
class ClearAll extends HTMLElement {
  constructor() {
    super();
    getterAdd(_clear_all, this);
    this.tabIndex = 0;
    this.addEventListener("click", getterRunFn(_clear_all, this, clear_all_fn));
    this.addEventListener("keydown", (event) => {
      if (event.key == "Enter") getterRunFn(_clear_all, this, clear_all_fn).call(this)
    });
  }
  get ofFn() {
    return this.getAttribute('of-fn'); //'compare', 'wishlist'
  }
  get nameCached() {
    return this.ofFn == 'compare' ? nameCachedCompare : nameCachedWishlist;
  }
  set array(value) {
    this.ofFn == 'compare' ? arr_compare_list = value : arr_wishlist_list = value;
  }
};
_clear_all = new WeakSet();
clear_all_fn = function () {
  localStorage.removeItem(this.nameCached);
  // Update Buttons
  $$4(`hdt-${this.ofFn}[action="added"]`).forEach(btn => {
    btn.setAttribute('action', 'add');
  });
  // Update Count and link
  document.dispatchEvent(new CustomEvent(`theme4:${this.ofFn}:update`, {
    bubbles: true,
    detail: 'the4'
  }));
  this.array = [];
  $id4(`drawerCompare`)?.closest('hdt-drawer')?.close();
  if ($4(`#drawerCompare offcanvas-compare`)){
    $4(`#drawerCompare offcanvas-compare`).innerHTML = "";
  }
};
customElements.define("hdt-clear-all", ClearAll);
// eg: <hdt-clear-all role="button" of-fn="compare">Clear All </hdt-clear-all>

// Update count
class WishlistCount extends HTMLElement {
  constructor() {
    super();
    this.textContent = this.array.length;
    document.addEventListener(`theme4:${this.prefix}:update`, (e) => {
      //console.log(this.prefix + ' count update.');
      this.textContent = this.array.length;
    });
  }
  get isFnWishlist() {
    return true;
  }
  get array() {
    return this.isFnWishlist ? arr_wishlist_list : arr_compare_list;
  }
  get prefix() {
    return this.isFnWishlist ? 'wishlist' : 'compare';
  }
}
// Update link page
class WishlistLink extends HTMLElement {
  constructor() {
    super();
    $4('a', this).href = conver_to_link_fn(this.prefix, this.array);
    //console.log('WishlistLink', this.href)
    document.addEventListener(`theme4:${this.prefix}:update`, (e) => {
      $4('a', this).href = conver_to_link_fn(this.prefix, this.array);
    });
  }
  get isFnWishlist() {
    return true;
  }
  get array() {
    return this.isFnWishlist ? arr_wishlist_list : arr_compare_list;
  }
  get prefix() {
    return this.isFnWishlist ? 'wishlist' : 'compare';
  }
}
customElements.define("hdt-wishlist", Wishlist);
customElements.define("hdt-wishlist-count", WishlistCount);
customElements.define("hdt-wishlist-a", WishlistLink);

// COMPARE
class Compare extends Wishlist {
  get isFnWishlist() {
    return false;
  }
  get textFn() {
    return 'compare';
  }
}
// Update count
class CompareCount extends WishlistCount {
  get isFnWishlist() {
    return false;
  }
}
// Update link page
class CompareLink extends WishlistLink {
  get isFnWishlist() {
    return false;
  }
}
customElements.define("hdt-compare", Compare);
customElements.define("hdt-compare-count", CompareCount);
customElements.define("hdt-compare-a", CompareLink);

// footer accodion
function handleAccordionClick() {
  let accordion = this.parentElement;
  accordion.classList.toggle('open');
  if (window.innerWidth < 768) {
    let content = accordion.querySelector('.hdt-collapse-content');
    if (accordion.classList.contains('open')) {
      content.style.height = content.scrollHeight + 'px';
    } else {
      content.style.height = '0';
    }
  }
}
function updateMaxHeight() {
  if (window.innerWidth >= 768) {
    document.querySelectorAll('.hdt-footer-section .hdt-collapse-content').forEach(function(content) {
      content.style.height = '';
    });
  }
}
document.querySelectorAll('.hdt-footer-section .hdt-footer-heading').forEach(function(element) {

  element.addEventListener('click', handleAccordionClick);
});
window.addEventListener('resize', function() {
  if (window.innerWidth < 768) {
    document.querySelectorAll('.hdt-footer-section .hdt-footer-heading').forEach(function(element) {
      element.removeEventListener('click',handleAccordionClick);
      element.addEventListener('click',handleAccordionClick);
    });
  } else {
    document.querySelectorAll('.hdt-footer-section .hdt-footer-heading').forEach(function(element) {
      element.removeEventListener('click',handleAccordionClick);
    });
    updateMaxHeight();
  }
});


// --------------------------
// Back to top
// --------------------------
class BackToTop extends HTMLElement {
  constructor() {
    super();
    this.config = JSON.parse(this.getAttribute('config'));
    if (window.innerWidth < 768 && this.config.hiddenMobile) return;
    this.debounce_timer = 0;
    this.debounce_timer2 = 0;
    this.circlechart = this.querySelector('.hdt-circle-css');
    this.addEventListener("click", this.goTop.bind(this));
    window.addEventListener("scroll", this.backToTop.bind(this));
  }
  goTop() {
    document.body.scrollTop = 0; // For Safari
    document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
  }

  backToTop() {
    let self = this;
    if (this.debounce_timer) { clearTimeout(this.debounce_timer); }
    this.debounce_timer = setTimeout(function () {
      if (window.scrollY > self.config.scrollTop) {
        self.classList.add('is--show');
      } else {
        self.classList.remove('is--show');
      }
    }, 40);

    if (!this.circlechart) return;

    if (this.debounce_timer2) { clearTimeout(this.debounce_timer2); }

    this.debounce_timer2 = setTimeout(function () {
      let scrollTop2 = window.scrollY,
        docHeight = document.body.offsetHeight,
        winHeight = window.innerHeight,
        scrollPercent = scrollTop2 / (docHeight - winHeight),
        degrees = scrollPercent * 360;
      self.circlechart.style.setProperty("--cricle-degrees", degrees + 'deg');
    }, 6);
  }
}

customElements.define('back-to-top', BackToTop);

// --------------------------
// Form status
// --------------------------


const contactForm = $$4('form[action^="/contact"]');
contactForm.forEach(function(form) {
  form.addEventListener("submit", function(event){
    sessionStorage.setItem("the4:recentform", this.getAttribute("id"));
  })
});
var recentform = sessionStorage.getItem("the4:recentform") || "";

if (location.href.indexOf('contact_posted=true') > 0 && recentform !== "") {
  document.dispatchEvent( new CustomEvent('the4:recentform', { detail: { recentform: recentform }, bubbles: true, cancelable: true }) );
  $id4(recentform)?.classList.add("on-live");
  if (recentform.indexOf('ContactFormAsk') >= 0 && $id4(recentform).length > 0) {
    let modal_id = document.getElementById(recentform).getAttribute('data-modal');
    document.getElementById(modal_id).closest('hdt-modal').open();
    sessionStorage.removeItem("the4:recentform");
  }
  if ($4('.form-status-mirror-'+ recentform)) {
    $4('.form-status-mirror-'+ recentform).style.cssText = "display: block;";
  }
}

else if (location.href.indexOf('customer_posted=true') > 0 && recentform !== "") {
  document.addEventListener('the4:recentform', (event)=>{
    let modal_id = document.getElementById(event.detail.recentform).getAttribute('data-id');
    document.getElementById(modal_id).closest('hdt-modal').open();
  })
  document.dispatchEvent( new CustomEvent('the4:recentform', { detail: { recentform: recentform }, bubbles: true, cancelable: true }) );
  $id4(recentform)?.classList.add("on-live");
}
else if (location.href.indexOf('contact_posted=true') > 0 && location.href.indexOf('#') > 0 ) {
  var recentform = location.href.split("#")[1];
  if ($id4(recentform).length > 0) {
    sessionStorage.setItem("the4:recentform", recentform);
    $id4(recentform).classList.add("on-live");
    if ($4('.form-status-mirror-'+ recentform)) {
      $4('.form-status-mirror-'+ recentform).style.cssText = "display: block;";
    }
  }
}

// --------------------------
// numberRandom
// --------------------------
class numberRandom extends HTMLElement {
  constructor() {
    super();
    let config = JSON.parse(this.getAttribute("config"));
    this.min = config.min;
    this.max = config.max;
    this.interval = config.interval;
    this.number = Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
    this.ofset = ["1", "2", "4", "3", "6", "10", "-1", "-3", "-2", "-4", "-6"];
    this.prioritize = ["10", "20", "15"];
    this.h = "";
    this.e = "";
    this.M = "";
    this.liveViewInt();
    setInterval(this.liveViewInt.bind(this), this.interval);
  }

  liveViewInt() {
    if (this.h = Math.floor(Math.random() * this.ofset.length), this.e = this.ofset[this.h], this.number = parseInt(this.number) + parseInt(this.e), this.min >= this.number) {
      this.M = Math.floor(Math.random() * this.prioritize.length);
      var a = this.prioritize[this.M];
      this.number += a
    }
    if (this.number < this.min || this.number > this.max) {
      this.number = Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
    }
    this.innerHTML = parseInt(this.number);
  }
}

customElements.define('number-random', numberRandom);

// --------------------------
// Total sold flash
// --------------------------
class flashSold extends VariantChangeBase {
  constructor() {
    super();
    var self = this;
    this.time = this.getAttribute("time");
    this.config = JSON.parse(this.getAttribute("flash-sold"));
    this.mins = this.config.mins;
    this.maxs = this.config.maxs;
    this.mint = this.config.mint;
    this.maxt = this.config.maxt;
    this.dataID = this.config.id;
    this.getS = sessionStorage.getItem("soldS" + this.dataID) || this.getRandomInt(this.mins, this.maxs);
    this.getT = sessionStorage.getItem("soldT" + this.dataID) || this.getRandomInt(this.mint, this.maxt);
    this.numS = parseInt(this.getS);
    this.numT = parseInt(this.getT);
    this.intervalTime = parseInt(this.config.time);
    this.$sold = this.querySelector('[data-sold]');
    this.$hour = this.querySelector('[data-hour]');
    this.limitMinMax();
    this.updateSold(this.numS, this.numT);
    setInterval(function () {
      this.numS = this.numS + self.getRandomInt(1, 4);
      this.numT = this.numT + (Math.random() * (0.8 - 0.1) + 0.1).toFixed(1) * 1;
      self.limitMinMax();
      self.updateSold(self.numS, self.numT);
    }, this.intervalTime);
  }

  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  updateSold(num1, num2) {
    this.$sold.innerHTML = num1;
    this.$hour.innerHTML = Math.floor(this.numT);
    sessionStorage.setItem("soldS" + this.dataID, num1);
    sessionStorage.setItem("soldT" + this.dataID, num2);
  }
  limitMinMax() {
    if (this.numS > this.maxs) this.numS = self.getRandomInt(this.mins, this.maxs)
    if (this.numT > this.maxt) this.numT = self.getRandomInt(this.mins, this.maxt)
  }
  #preVariantId;
  onVariantChanged(event) {
    const variant = event.detail.variant;
    if (variant && this.#preVariantId != variant.id) {
      if(variant.available){
        this.closest(".hdt-product-info__item").style.display = "block"
      }
      else {
        this.closest(".hdt-product-info__item").style.display = "none"
      }
    }
  }
}
customElements.define('flash-sold', flashSold);

// ======================================
//    pages/brands -  filter isotope 
// ======================================
class filterIsotope extends HTMLElement{
  constructor(){
    super();
    this.btns = this.querySelectorAll('button');
    this.id = this.id;
    if(!this.btns){
      return;
    }
    this.handleButtonClick();
  }
  handleButtonClick(){
    this.btns.forEach(btn =>{
      btn.addEventListener('click',()=>{
        this.querySelector('button.active').classList.remove('active');
        btn.classList.add('active');

        let selectedFilter = btn.getAttribute('data-filter');
        let itemsToHide = $$4(`#${this.id} .hdt-brand-item:not(${selectedFilter})`);
        let itemsToShow = $$4(`#${this.id} ${selectedFilter}`);

        if (selectedFilter == '._filter-show-all') {
          itemsToHide = [];
          itemsToShow = $$4(`#${this.id} .hdt-brand-item`);
        }

        itemsToShow.forEach(el => {
          el.classList.remove('animate-filter-hide','hdt-hidden');
          el.classList.add('animate-filter-show'); 
        });
        
        itemsToHide.forEach(el => {
          el.classList.add('animate-filter-hide','hdt-hidden');
          el.classList.remove('animate-filter-show');
        });
      })
    })
  }
}
customElements.define('hdt-brands',filterIsotope);

// ======================================
//   countryFilter 
// ======================================
class countryFilter extends HTMLElement {
  constructor() {
    super();
    this.search = $4('[name=country_filter]', this);
    this.reset = $4(".hdt-country_filter__reset", this);
    if (this.search) {
      this.search.addEventListener(
        'input',
        debounce((event) => {
          this.filterCountries();
        }, 200).bind(this)
      );
    }
    this.search.addEventListener('keydown', this.onSearchKeyDown.bind(this));

  }
  filterCountries(){
    const searchValue = this.search.value.toLowerCase();
    const allCountries = this.closest("hdt-popover").querySelectorAll('hdt-richlist button');
    let visibleCountries = allCountries.length;
    allCountries.forEach((item) => {
      const countryName = item.getAttribute('data-name').toLowerCase();
      if (countryName.indexOf(searchValue) > -1) {
        item.classList.remove('hdt-d-none');
        visibleCountries++;
      } else {
        item.classList.add('hdt-d-none');
        visibleCountries--;
      }
    });
    if (window.innerWidth >768) this.closest("hdt-popover").updatePos();
    this.closest("hdt-popover").querySelector('.hdt-current-scrollbar').scrollTop = 0;
  }

  onSearchKeyDown(event) {
    if (event.code.toUpperCase() === 'ENTER') {
      event.preventDefault();
    }
  }
}

customElements.define('country-filter', countryFilter);



// --------------------------
// Product Recommendations
// --------------------------
class ProductRecommendations extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const handleIntersection = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.unobserve(this);

      fetch(this.dataset.url)
        .then((response) => response.text())
        .then((text) => {
          const html = document.createElement('div');
          html.innerHTML = text;
          const recommendations = html.querySelector('product-recommendations');

          if (recommendations && recommendations.innerHTML.trim().length) {
            this.innerHTML = recommendations.innerHTML;
          }
          document.dispatchEvent(new CustomEvent("currency:update"));
        })
        .catch((e) => {
          console.error(e);
        });
    };

    new IntersectionObserver(handleIntersection.bind(this), { rootMargin: '0px 0px 400px 0px' }).observe(this);
  }
}

customElements.define('product-recommendations', ProductRecommendations);

// --------------------------
// Product Recently
// --------------------------
class ProductRecently extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const handleIntersection = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.unobserve(this);
      let handleProducts = localStorage.getItem("theme4:recently:id");
      let prdId = this.dataset.id;
      if (handleProducts !== null) {
        let products = handleProducts.split(',');
        if(prdId == products[0] && products.length == 1){
          this.closest('.section').style.display = 'none';
          return;
        }
        let url = this.dataset.url.replace('q=', 'q=id:' + products.join("%20OR%20id:"));
        fetch(url)
          .then((response) => response.text())
          .then((text) => {
            const html = document.createElement('div');
            html.innerHTML = text.replace('hdt-slider-wait', 'hdt-slider');
            const recently = html.querySelector('product-recently');

            if (recently && recently.innerHTML.trim().length) {
              this.innerHTML = recently.innerHTML;
              // html.innerHTML = text.replace('hdt-slider-wait', 'hdt-slider');
            }
            document.dispatchEvent(new CustomEvent("currency:update"));
          })
          .catch((e) => {
            console.error(e);
          });

      }
      let arrayProducts = handleProducts !== null ? handleProducts.split(',') : new Array;
      if (!arrayProducts.includes(prdId + '')) {
        if (arrayProducts.length >= 10) {
          arrayProducts.pop();
        }
        function prepend(value, array) {
          var newArray = array.slice();
          newArray.unshift(value);
          return newArray;
        }
        arrayProducts = prepend(prdId, arrayProducts);
        arrayProducts = arrayProducts.toString();
        localStorage.setItem("theme4:recently:id", arrayProducts);
      }
    };

    new IntersectionObserver(handleIntersection.bind(this), { rootMargin: '0px 0px 400px 0px' }).observe(this);
  }
}

customElements.define('product-recently', ProductRecently);


// --------------------------
// Product Ask Question
// --------------------------

const modalAsk = document.getElementById('modal-contactFormAsk');
modalAsk.addEventListener('dialog:opening', function(event) {
  let askBtn = modalAsk.closest('hdt-modal').dialog.btnOpening;
  let product = askBtn.getAttribute('data-product');
  let product_info = askBtn.parentElement.querySelector('.hdt-pr-popup__ask-product');
  if (product_info) {
    const modalHeader = modalAsk.querySelector('.hdt-dialog-modal__header');
    if (modalHeader && product_info) {
      const oldProductInfo = modalHeader.querySelector('.hdt-pr-popup__ask-product');
      if (oldProductInfo) {
        oldProductInfo.remove();
      }
      modalHeader.prepend(product_info.cloneNode(true));
    }
  }
  let productAsk = modalAsk.querySelector('[name="contact[product]"]');
  if (productAsk) {
    let currentValue = productAsk.value || '';
    let newValue = product || '';
    
    if (currentValue !== newValue) {
      let formMessage = modalAsk.querySelector('.hdt-form-message');
      if (formMessage) {
        formMessage.remove();
      }
    }
    if (currentValue !== newValue || currentValue === '') {
      productAsk.value = newValue;
    }
  }
})

// --------------------------
// Predictive Search
// --------------------------
class PredictiveSearch extends DrawerComponent {
  constructor() {
    super();
    // console.log(!this.hasAttribute('enabled'))
    if (!this.hasAttribute('enabled')) return;
    // this.action = themeHDN.routes.predictive_search_url;
    // if (!this.hasAttribute('enabled')) {
    //   this.action = themeHDN.routes.search_url;
    // };
    this.cachedResults = {};
    this.predictiveSearchResults = $4('[data-results-search]', this);
    this.select = $4('[data-cat-search]>select', this);
    this.input = $4('input[type="search"]', this);
    this.sectionIdResults = this.getAttribute('data-section-id-results') || 'hdt_predictive-search';
    this.allPredictiveSearchInstances = $$4('predictive-search');
    this.skeleton = $4('[data-skeleton-search]', this);
    this.noResults = $4('.hdt-cart-no-results', this);
    this.hideWrapper = $4('.hdt-cart-hide-has-results', this);
    this.showWrapper = $4('.hdt-cart-show-has-results', this);
    this.btn_viewall = $4('.hdt-view_all', this);
    this.href = this.btn_viewall?.getAttribute("href");
    this.btn_viewall_replace_text = $4('[data-replace-text]',this);
    this.isOpen = false;
    this.abortController2 = new AbortController();
    this.searchTerm = '';

    if (this.input) {
      this.input.addEventListener(
        'input',
        debounce((event) => {
          this.onChange(event);
        }, 300).bind(this)
      );
    }
    if (this.select) {
      this.select.addEventListener(
        'change',
        debounce((event) => {
          this.onChange(event);
        }, 300).bind(this)
      );
    }

    const formData = new FormData(this.input.form);
    this.params = "";
    for (const [key, value] of formData) {
      if (key === 'q') break;
      this.params += `${key}=${value}&`;
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.input.form.addEventListener('submit', this.onFormSubmit.bind(this));

    this.input.addEventListener('focus', this.onFocus.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.addEventListener('keyup', this.onKeyup.bind(this));
    //this.addEventListener('keydown', this.onKeydown.bind(this));
  }

  getQuery() {
    var currentValue = this.input.value.trim();
    if (this.select) {
      this.selectVal = this.select.value || '*';
      var valSelected = this.selectVal.trim();
      //console.log(valSelected)
      if (valSelected != '*') {
        if(currentValue !== '') {
          currentValue = `product_type:${valSelected} AND ${currentValue}`;
        } else {
          currentValue = `product_type:${valSelected}`;
        }
      }
    }

    return currentValue;
  }

  onChange() {
    const newSearchTerm = this.getQuery();
    // console.log(newSearchTerm)
    if (!this.searchTerm || !newSearchTerm.startsWith(this.searchTerm)) {
      // Remove the results when they are no longer relevant for the new search term
      // so they don't show up when the dropdown opens again
      // this.querySelector('#predictive-search-results-groups-wrapper')?.remove();
    }

    // Update the term asap, don't wait for the predictive search query to finish loading
    this.updateSearchForTerm(this.searchTerm, newSearchTerm);

    this.searchTerm = newSearchTerm;
    this.btn_viewall?.setAttribute("href", this.href.replace(/\/search\?q=.*/g, "/search?q=" + this.searchTerm));
    this.btn_viewall_replace_text ? this.btn_viewall_replace_text.innerText = themeHDN.extras.search.view_all + ` ${this.searchTerm}` : null;

    if (!this.searchTerm.length) {
      this.close(true);
      return;
    }
    this.getSearchResults(this.searchTerm);
  }

  onFormSubmit(event) {
    if (!this.getQuery().length || this.querySelector('[aria-selected="true"] a')) event.preventDefault();
  }

  onFocus() {
    const currentSearchTerm = this.getQuery();
    if (!currentSearchTerm.length) return;
    if (this.searchTerm !== currentSearchTerm) {
      // Search term was changed from other search input, treat it as a user change
      this.onChange();
    } else if (this.getAttribute('results') === 'true') {
      this.openSearch();
    } else {
      this.getSearchResults(this.searchTerm);
    }
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onKeyup(event) {
    if (!this.getQuery().length) this.close(true);
    event.preventDefault();

    // switch (event.code) {
    //   case 'ArrowUp':
    //     this.switchOption('up');
    //     break;
    //   case 'ArrowDown':
    //     this.switchOption('down');
    //     break;
    //   case 'Enter':
    //     this.selectOption();
    //     break;
    // }
  }

  // onKeydown(event) {
  //   // Prevent the cursor from moving in the input when using the up and down arrow keys
  //   if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
  //     event.preventDefault();
  //   }
  // }
  updateSearchForTerm(previousTerm, newTerm) {
    const searchForTextElement = this.querySelector('[data-predictive-search-search-for-text]');
    const currentButtonText = searchForTextElement?.innerText;
    if (currentButtonText) {
      if (currentButtonText.match(new RegExp(previousTerm, 'g')).length > 1) {
        // The new term matches part of the button text and not just the search term, do not replace to avoid mistakes
        return;
      }
      const newButtonText = currentButtonText.replace(previousTerm, newTerm);
      searchForTextElement.innerText = newButtonText;
    }
  }

  getSearchResults(searchTerm) {
    const queryKey = searchTerm.replace(' ', '-').toLowerCase();
    this.setLiveRegionLoadingState();

    if (this.cachedResults[queryKey]) {
      this.renderSearchResults(this.cachedResults[queryKey]);
      return;
    }

    fetch(`${themeHDN.routes.predictive_search_url}?q=${encodeURIComponent(searchTerm)}&${this.params}section_id=${this.sectionIdResults}`, {
      signal: this.abortController2.signal,
    })
      .then((response) => {
        if (!response.ok) {
          var error = new Error(response.status);
          this.close();
          throw error;
        }

        return response.text();
      })
      .then((text) => {
        const resultsMarkup = new DOMParser()
          .parseFromString(text, 'text/html')
          .querySelector('#shopify-section-' + this.sectionIdResults).innerHTML;
        // Save bandwidth keeping the cache in all instances synced
        this.allPredictiveSearchInstances.forEach((predictiveSearchInstance) => {
          this.cachedResults[queryKey] = resultsMarkup;
        });
        this.renderSearchResults(resultsMarkup);
      })
      .catch((error) => {
        if (error?.code === 20) {
          // Code 20 means the call was aborted
          return;
        }
        this.close();
        throw error;
      });
  }

  setLiveRegionLoadingState() {
    this.hideWrapper.style.cssText = "display: none;";
    this.showWrapper.style.cssText = "display: block;";
    this.skeleton.classList.remove("hdt-hidden");

    this.setAttribute('loading', true);
  }

  renderSearchResults(resultsMarkup) {
    this.predictiveSearchResults.innerHTML = resultsMarkup;
    this.setAttribute('results', true);

    this.setLiveRegionResults();
    this.openSearch();
    document.dispatchEvent(new CustomEvent("currency:update"));
  }

  setLiveRegionResults() {
    this.removeAttribute('loading');
  }

  openSearch() {
    //this.setAttribute('open', true);
    this.input.setAttribute('aria-expanded', true);
    this.skeleton.classList.add("hdt-hidden");
    this.isOpen = true;
  }

  close(clearSearchTerm = false) {
    this.closeResults(clearSearchTerm);
    this.isOpen = false;
  }

  closeResults(clearSearchTerm = false) {
    if (clearSearchTerm) {
      this.input.value = '';
      this.removeAttribute('results');
      this.hideWrapper.style.cssText = "display: block;";
      this.showWrapper.style.cssText = "display: none;";
      this.predictiveSearchResults.innerHTML = "";
    }
    const selected = this.querySelector('[aria-selected="true"]');

    if (selected) selected.setAttribute('aria-selected', false);

    this.input.setAttribute('aria-activedescendant', '');
    this.removeAttribute('loading');
    //this.removeAttribute('open');
    this.input.setAttribute('aria-expanded', false);
    this.resultsMaxHeight = false;
    this.predictiveSearchResults.removeAttribute('style');
  }
}

customElements.define('hdt-predictive-search', PredictiveSearch);

// --------------------------
// Delivery Time
// --------------------------
// https://unpkg.com/dayjs@1.11.10/dayjs.min.js
import dayjs from "@theme/dayjs";
dayjs.locale('en'); // use locale globally
class orderDelivery extends VariantChangeBase {
  constructor() {
    super();
    this.config = JSON.parse(this.getAttribute('config'));
    this.offDays          = this.config.off_day.replace(/ /g,'').split(",");
    this.nowDay           = dayjs();
    var format_day       = this.config.format_day,
        time             = this.config.time.replace("24:00:00", "23:59:59"),
        arrDayWeek       = ["SUN","MON","TUE","WED","THU","FRI","SAT"],
        dateStart        = this.config.estimateStartDate || 0,
        dateEnd          = this.config.estimateEndDate || 0,
        excludeDays      = this.config.cut_day.replace(/ /g,'').split(","),
        startDay         = dayjs(),
        i                = 0,
        endDay           = dayjs(),
        j                = 0,
        nowTime          = this.nowDay.format('HHmmss'),
        timeint          = time.replace(/ /g,'').replace(/:/g,''),

        arrDay           = themeHDN.extras.order.dayNames.replace(/ /g,'').split(","),
        arrMth           = themeHDN.extras.order.monthNames.replace(/ /g,'').split(",");
    /**
     * Check Time, if nowTime >=  timeint +1 day
     */
    if (parseInt(nowTime) >= parseInt(timeint)) {
      this.nowDay   = this.nowDay.add(1, 'day');
      startDay = startDay.add(1, 'day');
      endDay   = endDay.add(1, 'day');
    }

    /**
     * Mode: 2 - Shipping + delivery
     * Mode: 1 - Only delivery
     */

    if ( this.config.mode == '2' ) {

      // START DATE
      // if ngay khach mua trung voi ngay loai tru tang 1 ngay
      while (excludeDays.indexOf( arrDayWeek[startDay.format('d')] ) > -1 || this.offDays.indexOf( startDay.format('DD/MM/****') ) > -1 || this.offDays.indexOf( startDay.format('DD/MM/YYYY') ) > -1) {
        startDay = startDay.add(1, 'day');
      }
      while (i < dateStart) {
        i++;
        startDay = startDay.add(1, 'day');
        if (excludeDays.indexOf( arrDayWeek[startDay.format('d')] ) > -1 || this.offDays.indexOf( startDay.format('DD/MM/****') ) > -1 || this.offDays.indexOf( startDay.format('DD/MM/YYYY') ) > -1) {
          i--;
        }
      }

      // END DATE
      // if ngay khach mua trung voi ngay loai tru tang 1 ngay
      while (excludeDays.indexOf( arrDayWeek[endDay.format('d')] ) > -1 || this.offDays.indexOf( endDay.format('DD/MM/****') ) > -1 || this.offDays.indexOf( endDay.format('DD/MM/YYYY') ) > -1) {
        endDay = endDay.add(1, 'day');
      }

      while (j < dateEnd) {
        j++;
        endDay = endDay.add(1, 'day');
        if (excludeDays.indexOf( arrDayWeek[endDay.format('d')] ) > -1 || this.offDays.indexOf( endDay.format('DD/MM/****') ) > -1 || this.offDays.indexOf( endDay.format('DD/MM/YYYY') ) > -1) {
          j--;
        }
      }

    }
    else {

      // START DATE
      startDay = startDay.add(dateStart, 'day');
      while (excludeDays.indexOf( arrDayWeek[startDay.format('d')] ) > -1 || this.offDays.indexOf( startDay.format('DD/MM/****') ) > -1 || this.offDays.indexOf( startDay.format('DD/MM/YYYY') ) > -1) {
        startDay = startDay.add(1, 'day');
      }

      // END DATE
      endDay = endDay.add(dateEnd, 'day');
      while (excludeDays.indexOf( arrDayWeek[endDay.format('d')] ) > -1 || this.offDays.indexOf( endDay.format('DD/MM/****') ) > -1 || this.offDays.indexOf( endDay.format('DD/MM/YYYY') ) > -1) {
        endDay = endDay.add(1, 'day');
      }
      // endDay = endDay.add(this.offDaysf(endDay), 'day');

    }

    /**
     * Translate day, month
     * https://day.js.org/docs/en/display/format
     */
    arrDay = this.ArrUnique(arrDay);
    arrMth = this.ArrUnique(arrMth);

    var startDayDInt = parseInt(startDay.format('D')),
    daystStart       = startDayDInt + this.nth(startDayDInt),
    MntStart         = arrMth[ parseInt(startDay.format('M')) -1 ],
    dayStart         = arrDay[ parseInt(startDay.format('d')) ],

    EndDayDInt       = parseInt(endDay.format('D')),
    daystEnd         = EndDayDInt + this.nth( EndDayDInt ),
    MntEnd           = arrMth[ parseInt(endDay.format('M')) -1 ],
    dayEnd           = arrDay[ parseInt(endDay.format('d')) ];

    //console.log( startDayDInt, EndDayDInt )
    if($4('[data-start-delivery]', this)) $4('[data-start-delivery]', this).innerHTML = startDay.format(format_day).replace('t44',dayStart).replace('t45',daystStart).replace('t46',MntStart);
    if($4('[data-end-delivery]', this)) $4('[data-end-delivery]', this).innerHTML = endDay.format(format_day).replace('t44',dayEnd).replace('t45',daystEnd).replace('t46',MntEnd);
  }

  ArrUnique(arr) {
    var onlyUnique = function (value, index, self) {
      return self.indexOf(value) === index;
    };
    return arr.filter( onlyUnique );
  }

  nth(d) {
    if (d > 3 && d < 21) return 'th';
    switch (d % 10) {
      case 1:  return "st";
      case 2:  return "nd";
      case 3:  return "rd";
      default: return "th";
    }
  }
  #preVariantId;
  onVariantChanged(event) {
    const variant = event.detail.variant;
    if (variant && this.#preVariantId != variant.id) {
      if(variant.available){
        this.closest(".hdt-product-info__item").style.display = "";
        if( variant.variant_state.pre_order ) {
          this.closest(".hdt-product-info__item").style.display = "none"
        }
      }
      else {
        this.closest(".hdt-product-info__item").style.display = "none"
      }
    }
  }
}
customElements.define('order-delivery', orderDelivery);
class countdownSimple extends HTMLElement {
  x = 0;
  constructor() {
    super();

    /** Countdown
     * [days] [hours] [mins] [secs]
     */

    this.config = JSON.parse(this.getAttribute('config'));
    const time = this.config.time.replace("24:00:00", "23:59:59")

    if (time == '19041994') return;
    this.textTemp = $4("template", this).innerHTML;
    this.notHasDay  = !this.textTemp.includes('[days]');
    let today        = dayjs();

    const nowTime      = today.format('HHmmss'),
          configTime   = time.replace(/ /g,'').replace(/:/g,'')

    if (parseInt(nowTime) >= parseInt(configTime)) {
      today = today.add(1, 'day');
    }
    // Set the date we're counting down to
    // "2030-01-05 15:37:25"
    this.countDownDate = new Date(`${today.format('YYYY-MM-DD')} ${time}`).getTime();

    // Update the count down every 1 second
    this.#update();
    this.x = setInterval( this.#update.bind(this), this.textTemp.includes('[secs]') ? 1000 : 60000);
  }
  #update() {
    // Get today's date and time
    const now = new Date().getTime();

    // Find the distance between now and the count down date
    const distance = this.countDownDate - now;

    // Time calculations for days, hours, minutes and seconds
    const days    = Math.floor(distance / (1000 * 60 * 60 * 24));
    let   hours   = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    if (this.notHasDay) hours = days*24 + hours;

    // Display the result in the element
    this.innerHTML = this.textTemp.replace('[days]', String(days).padStart(2, '0')).replace('[hours]', String(hours).padStart(2, '0')).replace('[mins]', String(minutes).padStart(2, '0')).replace('[secs]', String(seconds).padStart(2, '0'));

    // If the count down is finished, write some text
    if (distance < 0) {
      clearInterval(this.x);
      // EXPIRED
      this.hidden = true
    }
  }
  disconnectedCallback() {
    clearInterval(this.x);
  }
}
customElements.define('hdt-countdown-simple', countdownSimple);


// Begin instagram feed api
const dataInstagramCache = {};
class instagramFeedAPI extends HTMLElement {
  constructor() {
    super();
    this.config = JSON.parse(this.getAttribute('config'));
    if (Shopify.designMode) {
      document.addEventListener('shopify:section:select', (event) => {
        this.refresh_ins();
      })
      document.addEventListener('shopify:section:deselect', (event) => {
        const {acc,id} = this.config;
        var data = sessionStorage.getItem('hdt_ins'+acc+id);
        if (data != null && data != '') {
          sessionStorage.removeItem('hdt_ins'+acc+id);
        }
      })
    }
  }
  connectedCallback() {
    this.refresh_ins();
  }
  refresh_ins(){
    const {acc,id} = this.config;

    if (acc == '') return;

    var data = sessionStorage.getItem('hdt_ins'+acc+id);

    if (data != null && data != '') {
      // calculate expiration time for content,
      // to force periodic refresh after 30 minutes
      var now = new Date(),
      expiration = new Date(JSON.parse(data).timestamp);

      expiration.setMinutes(expiration.getMinutes() + 30);

      // ditch the content if too old
      if (now.getTime() > expiration.getTime()) {
        data = null;
        sessionStorage.removeItem('hdt_ins'+acc+id);
      }
    }
    if ( data != null && data != '' ) {
      this.instagramHTML(JSON.parse(data).content,false);
    }
    else{
      if (dataInstagramCache[acc]) {
        $4('.hdt-slider__container', this).innerHTML = dataInstagramCache[acc];
        $4('.hdt-ins-loading', this)?.remove();
        const lazySlider = $4('hdt-slider-lazy', this);
        if (lazySlider) {
          lazySlider.hidden = false;
          lazySlider.InitLazy();
        }
        return;
      }

      fetch('https://graph.instagram.com/me/media?fields=id,media_type,media_url,permalink,thumbnail_url,caption,children&access_token='+atob(acc))
      .then((response) => {
        if(!response.ok) {
          throw new Error("not ok"); 
        }
        return response.json()
      })
      //.then(function(res)
      .then((res) => {
        //console.log('Success:', res);
         this.instagramHTML(res.data,true);
      })
      .catch((err) => {
        $4('.hdt-ins-loading', this)?.remove();
        console.error("Instagram Feed:error fetch");
        console.error(err);
      });
    }
  }
  instagramHTML(data,saveSessionStorageIns) {
    const arrIcons = ($4('.hdt-icons-ins-svg', this).innerHTML || '').split('[hdtplit]'),
    icons = {
       image : arrIcons[0],
       video : arrIcons[1],
       carousel_album: arrIcons[2]
    },
    {id, acc, target, limit} = this.config;
    let html = '';

    data.forEach( (el, index) => {
      if (index >= limit) return 0;
      const media_type = el.media_type.toLowerCase();
      html += `<div class="hdt-slider__slide hdt-ins-type-${media_type}"><a calc-nav data-no-instant rel="nofollow" class="hdt-ins-inner hdt-block hdt-relative hdt-oh hdt-radius" href="${el.permalink}" target="${target}"><div class="hdt-ratio"><img src="${el.thumbnail_url || el.media_url}" class="hdt-ins-img" loading="lazy"></div><div class="hdt-ins-icon">${icons[media_type]}</div></a></div>`
    });
    dataInstagramCache[acc] = html;
    $4('.hdt-slider__container', this).innerHTML = html;
    $4('.hdt-ins-loading', this)?.remove();
    const lazySlider = $4('hdt-slider-lazy', this);
    if (lazySlider) {
      lazySlider.hidden = false;
      lazySlider.InitLazy();
    }

    if(saveSessionStorageIns){
      sessionStorage.setItem('hdt_ins'+acc+id, JSON.stringify({
        timestamp: new Date(),
        content: data
      }));
    }
  }
}
customElements.define('ins-feed-api', instagramFeedAPI);


// product description - readmore
class ProductDescription extends HTMLElement{
  constructor(){
    super();
    this.lm_btn = this.querySelector('.hdt-pr-des-rm');
    if(!this.lm_btn) return;
    
    this.lm_btn.addEventListener('click',()=>{
      this.classList.toggle('is--less');
    })
  }
}
customElements.define('product-description',ProductDescription);



// check purchase code
if(Shopify.designMode){

  /**
  * If it's a global variable then window[variableName] or in your case window["onlyVideo"] should do the trick.
  * https://stackoverflow.com/questions/5613834/convert-string-to-variable-name-in-javascript
  */
  function isStorageSupported(type) {
    // Return false if we are in an iframe without access to sessionStorage
    // window.self !== window.top

    var storage = (type === 'session') ? window.sessionStorage : window.localStorage;

    try {
      storage.setItem('t4s', 'test');
      storage.removeItem('t4s');
      return true;
    } catch (error) {
      return false;
    }
  };

  var ThemeCode    = atob(window[atob('Y0hWeVkyaGg=')]),
      ThemeName_base64 = window[atob('VkdobGJXVk9ZVzFsVkRR')],
      ThemeName            = atob(ThemeName_base64),
      CookieName           = 'SXNBY3RpdmVUaGVtZQ=='+ThemeName_base64,
      ShopEmail            = atob(window[atob('VTJodmNFMWxiMVEw')]),
      isTrueSet            = (sessionStorage.getItem(CookieName) === 'true' ),
      str_temp_active      = atob('I3Q0cy10ZW1wLWtleS1hY3RpdmU='), // #t4s-temp-key-active
      str_purchase         = atob('cHVyY2hhc2VfY29kZXQ0'); // purchase_codet4;

      // console.log(ThemeCode,ThemeName,ShopEmail,CookieName,str_temp_active,str_purchase)
  function alert_active_html() {
    return `<section id="${str_purchase}" style="display: flex !important">${ $4(str_temp_active).innerHTML }</section>`;
  };

  // console.log('ThemeCode', ThemeCode, isTrueSet)

  if (ThemeCode == '') {
    let dom1 = (new DOMParser).parseFromString(alert_active_html(), "text/html");
    document.body.append(dom1.body.firstElementChild);
    let dom2 = (new DOMParser).parseFromString('<div id="luffyabc194"><style>body>*:not(#purchase_codet4) {opacity: 0;pointer-events: none;</style></div>', "text/html");
    document.body.prepend(dom2.body.firstElementChild);
    sessionStorage.removeItem(CookieName);
    localStorage.removeItem(CookieName);
  }
  else if ( !isTrueSet ) {

    //console.log(ShopEmail, ThemeName, ThemeCode);

    var domain     = window.location.hostname,
    mix        = ['4','t','h','e','p','l','i','c','o','/','.',':','n','s'],
    mix_domain = mix[2]+mix[1]+mix[1]+mix[4]+mix[13]+mix[11]+mix[9]+mix[9]+mix[5]+mix[6]+mix[7]+mix[10]+mix[1]+mix[2]+mix[3]+mix[0]+mix[10]+mix[7]+mix[8]+mix[9]+mix[5]+mix[6]+mix[7]+mix[3]+mix[12]+mix[13]+mix[3]+mix[9]+mix[7]+mix[2]+mix[3]+mix[7]+'k',
    data       = {
      "shopify_domain": domain,
      "email"         : ShopEmail,
      "theme"         : ThemeName,
      "purchase_code" : ThemeCode
    };

    fetch(mix_domain, {
      "headers": {
        "accept": "*/*",
        "cache-control": "no-cache",
        "x-requested-with": "XMLHttpRequest"
      },
      "body": btoa (encodeURIComponent(JSON.stringify(data))) ,
      "method": "POST",
      "mode": "cors"
    })
    .then(function(response) {
      if(response.ok){
        return response.json()
      } throw ""
    })
    .then(function(response) {
      let dom = (new DOMParser).parseFromString(alert_active_html(), "text/html");

      if ( response.status == 1) {

        dom.body.firstElementChild.innerHTML = "<p>ACTIVATED SUCCESSFULLY. Thanks for buying my theme!</p>";
        document.body.append(dom.body.firstElementChild);

        // Set a cookie to expire in 1 hour in Javascript
        var isActived = localStorage.getItem(CookieName);
        sessionStorage.setItem(CookieName, 'true')

        if (isActived === 'true') {
          $4(atob('I3B1cmNoYXNlX2NvZGV0NA==')).remove(); // #purchase_codet4
          // $4(atob('I2x1ZmZ5YWJjMTk0'))?.remove(); //#luffyabc194
        }
        else {
          localStorage.setItem(CookieName, "true");
          setTimeout(function(){
            $4(atob('I3B1cmNoYXNlX2NvZGV0NA==')).remove(); // #purchase_codet4
            // $4(atob('I2x1ZmZ5YWJjMTk0'))?.remove(); //#luffyabc194
          }, 1000);
        }

      }
      else {

        var mess = response.message;
        if (mess == "No sale belonging to the current user found with that code") {

          dom.body.firstElementChild.innerHTML = "<p>Purchase code error. It is a sales reversal or a refund. :(((</p>";

        }
        else if (mess.length == 58 || mess.length == 101) {
          dom.body.firstElementChild.innerHTML = "<p>That license key doesn't appear to be valid. Please check your purchase code again!<br>Please open a ticket at <a href='https://support.the4.co' target='_blank'><span>support.the4.co</span></a> if you have any question.</p>";

        }
        else if (mess.length == 104) {
          dom.body.firstElementChild.innerHTML = "<p>The license not match with current theme.!<br>Please open a ticket at <a href='https://support.the4.co' target='_blank'><span>support.the4.co</span></a> if you have any question.</p>";
        }
        else {
          try {
            var mess = mess.split('active domain `')[1].split('`. ')[0];
          }
          catch(err) {
            //var mess = mess;
          }
          dom.body.firstElementChild.innerHTML = "<p>Your purchase code is invalided since it is being activated at another store "+mess+".<br> Please open a ticket at <a class='cg' href='https://support.the4.co' target='_blank'><span>support.the4.co</span></a> to get quick assistance.</p>";
        }
        document.body.append(dom.body.firstElementChild);

      }

    }).catch(function(e) {
    //}).catch((e)=>{
      console.error(e)
    });

  }
}
// end check purchase code

// Masonry layout + filter sorting
// Masonry Layout Component
class MasonryLayout extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.style.position = 'relative';
    // Đọc config từ thuộc tính nếu có
    const configAttr = this.getAttribute('config');
    if (configAttr) {
      try {
        const userConfig = JSON.parse(configAttr);
        this.config = { ...userConfig };
      } catch (e) {
        this.config = {
          col_dk: 5,
          col_tb: 4,
          col_mb: 2,
          gap: 30,
          selector: '.hdt-masonry-item'
        };
      }
    }
    // console.log(this.config)
    this.waitForImages().then(() => {
      this.layoutMasonry();
      this.animateItems();
      // Set transition cho resize sau khi animation ban đầu hoàn thành
      setTimeout(() => {
        items.forEach(item => {
          item.style.transition = 'left 0.3s ease, top 0.3s ease, width 0.3s ease';
        });
      }, items.length * 100 + 500); // Đợi tất cả animation ban đầu hoàn thành
    });
    window.addEventListener('resize', () => {
      this.layoutMasonry();
      // this.animateItems();
    });
  }


  waitForImages() {
    const images = Array.from(this.querySelectorAll('img'));
    // console.log(images)
    if (images.length === 0) return Promise.resolve();
    let loaded = 0;
    return new Promise(resolve => {
      images.forEach(img => {
        const item = img.closest(this.config.selector);
        function hideLoading() {
          const loading = item?.querySelector('.item-loading');
          if (loading) loading.style.display = 'none';
          img.style.display = 'block';
        }
        if (img.complete) {
          hideLoading();
          loaded++;
          if (loaded === images.length) resolve();
        } else {
          // console.log(img)
          img.style.display = 'none';
          img.addEventListener('load', () => {
            hideLoading();
            loaded++;
            if (loaded === images.length) resolve();
          }, { once: true });
          img.addEventListener('error', () => {
            hideLoading();
            loaded++;
            if (loaded === images.length) resolve();
          }, { once: true });
        }
      });
    });
  }

  layoutMasonry() {
    const items = Array.from(this.querySelectorAll(this.config.selector)).filter(item => item.style.display !== 'none');
    // console.log(items)
    const containerWidth = this.clientWidth;
    let columnCount = this.config.col_dk;
    let gap = this.config.gap;
    if (containerWidth < 768) columnCount = this.config.col_mb, gap = this.config.gap_mb;
    else if (containerWidth < 1149) columnCount = this.config.col_tb;

    const columnHeights = Array(columnCount).fill(0);
    const columnWidth = (containerWidth - gap * (columnCount - 1)) / columnCount;
    // Bước 1: set width cho tất cả item
    items.forEach(item => {
      item.style.display = 'block';
      item.style.position = 'absolute';
      item.style.width = `${columnWidth}px`;
    });
    // Bước 2: ép reflow
    items.forEach(item => void item.offsetHeight);
    // Bước 3: tính toán vị trí
    items.forEach(item => {
      const minCol = columnHeights.indexOf(Math.min(...columnHeights));
      const x = minCol * (columnWidth + gap);
      const y = columnHeights[minCol];
      item.style.left = `${x}px`;
      item.style.top = `${y}px`;
      columnHeights[minCol] += item.offsetHeight + gap;
    });
    this.style.height = Math.max(...columnHeights) + 'px';
  }

  animateItems() {
    const items = Array.from(this.querySelectorAll(this.config.selector));
    items.forEach((item, index) => {
      setTimeout(() => {
        item.style.visibility = 'visible';
        item.style.opacity = '0';
        item.style.transform = 'translateY(30px)';
        item.style.transition = 'opacity 0.5s, transform 0.5s';
        setTimeout(() => {
          item.style.opacity = '1';
          item.style.transform = 'translateY(0)';
        }, 10);
      }, index * 100);
    });
  }
}

// Filter Sorting Component
class FilterSorting extends HTMLElement {
  constructor() {
    super();
    this.selector = this.getAttribute('config') ? JSON.parse(this.getAttribute('config')).selector : '.hdt-masonry-item';
  }

  connectedCallback() {
    // Không render vào shadowRoot nữa, chỉ cần giữ nguyên DOM
    this.initializeFilter();
  }

  initializeFilter() {
    // Lấy các filter-item trong DOM thường
    const filterItems = this.querySelectorAll('[data-category]');
    // Lấy masonry-layout bên trong
    const masonry = this.querySelector('hdt-masonry-layout');
    if (!masonry) return;
    const items = masonry.querySelectorAll(this.selector);
    // console.log(items)

    filterItems.forEach(filter => {
      filter.addEventListener('click', () => {
        // Remove active class from all filters
        filterItems.forEach(f => f.classList.remove('hdt-active'));
        // Add active class to clicked filter
        filter.classList.add('hdt-active');

        const category = filter.getAttribute('data-category');
        items.forEach(item => {
          if (category === 'all' || item.classList.contains(category)) {
            item.style.display = 'block';
            setTimeout(() => {
              item.style.opacity = '1';
              item.style.transform = 'translateY(0)';
            }, 100);
          } else {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            setTimeout(() => {
              item.style.display = 'none';
            }, 300);
          }
        });
        // Gọi lại layoutMasonry sau khi filter
        setTimeout(() => {
          if (typeof masonry.layoutMasonry === 'function') {
            masonry.layoutMasonry();
          }
        }, 350); // Đợi animation ẩn/hiện xong
      });
    });
  }
}

// Đăng ký custom elements
customElements.define('hdt-masonry-layout', MasonryLayout);
customElements.define('hdt-filter-sorting', FilterSorting);


/**
  * Cookies
  * https://help.shopify.com/en/manual/your-account/privacy/cookies
  * https://shopify.dev/themes/trust-security/cookie-banner#create-a-snippet-to-host-the-banner
  * https://help.shopify.com/en/manual/your-account/privacy/privacy-preferences-manager?shpxid=965d0d2a-08E2-4654-4A13-D3F38646AC5D
  * https://shopify.dev/api/consent-tracking
*/

function convertNameCookies(name) {
  return name.replace(/=/g,'_');
}
function setCookie(name,value,days,hours) {
  var expires = "";
  if (days || hours) {
    var date = new Date();
    date.setTime(date.getTime() + (days ? days*24*60*60*1000 : hours*60*60*1000));
    expires = "; expires=" + date.toString();
  }
  document.cookie = convertNameCookies(name) + "=" + (value || "")  + expires + "; path=/";
}
function getCookie(name) {
  var nameEQ = convertNameCookies(name) + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
    var c = ca[i];
    while (c.charAt(0)==' ') c = c.substring(1,c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}
function eraseCookie(name) {
  document.cookie = convertNameCookies(name)+'=; Max-Age=-99999999;';
}

class cookiesBar extends HTMLElement {
  constructor() {
    super();
    this.cookies = JSON.parse(this.getAttribute("configs"));
    this.cookies.cookiesName = "theme4:cookies";
    this.cookiesDrawer = this.querySelector(".hdt-drawer-cookie");
    this.isShowCookiesAll = (this.cookies.show == '1');
    this.acceptBtn = this.cookiesDrawer.querySelector(".hdt-pp_cookies__accept-btn");
    this.declineBtn = this.cookiesDrawer.querySelector(".hdt-pp_cookies__decline-btn");
    this.loadCookieBanner(this);
    let self = this;
    this.acceptBtn?.addEventListener("click", this.handleAccept.bind(this));
    this.declineBtn?.addEventListener("click", this.handleDecline.bind(this));
    if (Shopify.designMode) {
      document.addEventListener('shopify:section:select', (event) => {
        const cookiesSelect = event.target.classList.contains('sys-cookies');
        if (!cookiesSelect) return;
        self.showCookiesBanner();
      })
      document.addEventListener('shopify:section:deselect', (event) => {
        const cookiesSelect = event.target.classList.contains('sys-cookies');
        if (!cookiesSelect) return;
        self.hideCookiesBanner();
      })
    }
  }
  handleAccept() {
    if (this.isShowCookiesAll) {
      setCookie(this.cookies.cookiesName, 'accepted', parseInt(this.cookies.day_next));
    }
    window.Shopify.customerPrivacy.setTrackingConsent(true, this.hideCookiesBanner.bind(this));
  }

  handleDecline() {
    if (this.isShowCookiesAll) {
      setCookie(this.cookies.cookiesName, 'accepted', parseInt(this.cookies.day_next));
    }
    window.Shopify.customerPrivacy.setTrackingConsent(false, this.hideCookiesBanner.bind(this));
  }

  showCookiesBanner() {
    this.cookiesDrawer.classList.add('cookies-show');
  }

  hideCookiesBanner() {
    this.cookiesDrawer.classList.remove('cookies-show');
  }

  initCookieBanner() {
    const userCanBeTracked = window.Shopify.customerPrivacy.userCanBeTracked();
    const userTrackingConsent = window.Shopify.customerPrivacy.getTrackingConsent();
    if ((!userCanBeTracked && userTrackingConsent === 'no_interaction') || this.isShowCookiesAll) {
      if (!Shopify.designMode) {
        this.showCookiesBanner();
      }
    }
  }

  loadCookieBanner() {

    let self = this;
    if (this.cookiesDrawer.length == 0) return;
    this.cookies.day_next = this.cookies.day_next || 60;
    this.isShowCookiesAll = (this.cookies.show == '1');
    if (getCookie(this.cookies.cookiesName) == 'accepted' || this.cookiesDrawer.hasAttribute("open")) return;
    window.Shopify.loadFeatures([
      {
        name: 'consent-tracking-api',
        version: '0.1',
      }
    ],
      function (error) {
        if (error) {
          throw error;
        }
        self.initCookieBanner();
      });
  }
}

customElements.define('sys-cookies', cookiesBar);

// --------------------------
// Newsletter
// --------------------------

class newsletterModal extends HTMLElement {
  constructor() {
    super();
    this.configs = JSON.parse(this.getAttribute('configs'));
    this.modal = this.querySelector("hdt-modal");
    if ( !Shopify.designMode && getCookie("theme4:newsletter:"+this.configs.id) == 'shown' ){
      this.modal.setAttribute('closed','');
      return;
    }
    this.dialog = this.querySelector("dialog");
    this.action_close = this.querySelectorAll('[action-close]');
    this.time_delay     = this.configs.time_delay;
    this.day_next       = this.configs.day_next;
    if (Shopify.designMode) {
      this._shopifySection = this._shopifySection || this.closest(".shopify-section");
      this._shopifySection.addEventListener('shopify:section:load', () => this.modal.open());
      this._shopifySection.addEventListener('shopify:section:select', () => this.modal.open());
      this._shopifySection.addEventListener('shopify:section:deselect', () => this.modal.close());
    }
  }

  connectedCallback() {
    if (!Shopify.designMode) {
      if ( getCookie("theme4:newsletter:"+this.configs.id) == 'shown' ){
        this.modal.setAttribute('closed','');
        return;
      }
      const fnShow = this.showModal.bind(this);
      const fnShowScroll = this.showModalScroll.bind(this);
      if(this.configs.after === 'time'){
        let tm = setTimeout(fnShow,this.configs.time_delay * 1000);
        this.dialog.addEventListener(`${dialogClose}`, () => {
          clearTimeout(tm);
          this.hideModal(false, true);
        });
      }
      else {
        window.addEventListener("scroll",fnShowScroll);
        this.dialog.addEventListener(`${dialogClose}`, () => {
          window.removeEventListener("scroll", fnShowScroll);
          this.hideModal(false, true);
        });
      }
      this.actionClose();
    }
  }

  disconnectedCallback() {
  }

  showModal() {
    this.modal.open();
  }
  showModalScroll(){
    if (window.scrollY > this.configs.scroll_delay) {
      this.modal.open();
    }
  }
  hideModal(pause, off) {
    if (pause) {

    }
    if (off) {

      setCookie("theme4:newsletter:"+this.configs.id, "shown", this.day_next);
    }
  }
  actionClose(){
    let self= this;
    if(self.action_close){
      self.action_close.forEach(btn => {
        btn.addEventListener('click',function(){
          self.modal.close();
          self.hideModal(false, true);
          setTimeout(() => {
            self.remove();
          }, 500);
        })
      });
    }
  }

}
customElements.define('sys-newsletter', newsletterModal);

// --------------------------
// Exit
// --------------------------

class exitModal extends HTMLElement {
  constructor() {
    super();
    this.configs = JSON.parse(this.getAttribute('configs'));
    if ( !Shopify.designMode && getCookie("theme4:exit:"+this.configs.id) == 'shown' ) return;
    this.modal = this.querySelector("hdt-modal");
    this.dialog = this.querySelector("dialog");
    this.day_next     = this.configs.day_next;
    this.btn_copy = this.querySelector('button[is="discount_copy"]');
    this.discount = this.querySelector('[is="discount"]');
    if (Shopify.designMode) {
      this._shopifySection = this._shopifySection || this.closest(".shopify-section");
      this._shopifySection.addEventListener('shopify:section:load', () => this.showModal());
      this._shopifySection.addEventListener('shopify:section:select', () => this.showModal());
      this._shopifySection.addEventListener('shopify:section:deselect', () => this.modal.close());
    }
  }
  connectedCallback() {
    if (!Shopify.designMode) {
      if ( getCookie("theme4:exit:"+this.configs.id) == 'shown' ) return;
      if(this.configs.after === 'move_cursor') {
        if(window.innerWidth > 1150){
          this.moveCursor();
        }else{
          this.scrollPage();;
        }
      }
      else if(this.configs.after === 'scroll') {
        this.scrollPage();
      }
      else {
        this.amountTime();
      }
    }
  }
  // Move cursor out screen
  moveCursor(){
    const fnShow = this.showModal.bind(this);
    document.querySelector("body").addEventListener("mouseleave", fnShow);
    this.dialog.addEventListener(`${dialogClose}`, () => {
      document.querySelector("body").removeEventListener("mouseleave", fnShow);
      this.hideModal(false, true);
    });
  }
  //  scroll page
  scrollPage(){
    const fnShow = this.showModal.bind(this);
    let docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight - 500;
    let scroll= ()=>{
      if (window.scrollY >= docHeight) {
        fnShow();
      }
    }
    window.addEventListener("scroll",scroll);
    this.dialog.addEventListener(`${dialogClose}`, () => {
      window.removeEventListener("scroll",scroll);
      this.hideModal(false, true);
    });
  }
  // countdown time to show exit popup
  amountTime(){
    const fnShow = this.showModal.bind(this);
    let tm = setTimeout(fnShow,this.configs.time_delay * 1000);
    this.dialog.addEventListener(`${dialogClose}`, () => {
      clearTimeout(tm);
      this.hideModal(false, true);
    });
  }
  showModal() {
    let self = this;
    this.modal.open();
    if(self.btn_copy && self.discount){
      self.btn_copy.addEventListener('click',function(){
        self.discount.select();
        self.discount.setSelectionRange(0, 99999);
        document.execCommand("copy");
        self.btn_copy.querySelector('.hdt-tooltip-text').innerText = `${themeHDN.extras.exit_popup.copied}: ${self.discount.value}`
      })
      self.btn_copy.addEventListener('mouseleave',function(){
        self.btn_copy.querySelector('.hdt-tooltip-text').innerText = themeHDN.extras.exit_popup.copy
      })
    }
  }
  hideModal(pause, off) {
    if (pause) {

    }
    if (off) {
      setCookie("theme4:exit:"+this.configs.id, "shown", this.day_next);
    }
  }
}
customElements.define('sys-exit', exitModal);

// ================================
// Add to cart animation
// ================================

class atcAnimation extends HTMLElement {
  constructor() {
    super();
    this.config = JSON.parse(this.getAttribute('config'));
    this.atc_btn = this.querySelector('[data-animation]:not([disabled])');
    if(!this.config || !this.atc_btn){
      return;
    }
  }
  init(){
    let class_list = this.config.ani.split(' ');
    this.interval = setInterval(() => {
      this.atc_btn.classList.add(...class_list);
      this.timer = setTimeout(() => {
        this.atc_btn.classList.remove(...class_list);
      }, 1000);
    }, parseInt(this.config.time) * 1000);
  }
  connectedCallback(){
    this.init();
  }
  disconnectedCallback(){
    clearInterval(this.interval);
    clearTimeout(this.timer);
  }
}

customElements.define('hdt-atc-animation', atcAnimation);