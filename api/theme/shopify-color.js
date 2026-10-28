/**
 * Shopify color and font drops.
 *
 * css-variables.liquid prints `settings.color_scheme_body.settings.text.rgb`
 * and runs color_lighten / color_mix. A bare "#222222" string has no `.rgb`,
 * so every custom property came out empty and the stylesheet fallback had to
 * paint the page. These objects are what the theme already asks for.
 */

export function shopifyColor(input) {
  if (input && typeof input === 'object' && typeof input.rgb === 'string' && input.red != null) {
    return input;
  }
  let hex = null;
  if (typeof input === 'string') {
    const raw = input.trim();
    const short = /^#([0-9a-f]{3})$/i.exec(raw);
    const long = /^#?([0-9a-f]{6})$/i.exec(short
      ? `#${short[1].split('').map((c) => c + c).join('')}`
      : raw);
    if (long) hex = long[1].toLowerCase();
  } else if (input && typeof input === 'object' && input.r != null) {
    const channel = (n) => Math.max(0, Math.min(255, Math.round(Number(n) || 0)));
    hex = [input.r, input.g, input.b].map((n) => channel(n).toString(16).padStart(2, '0')).join('');
  }
  if (!hex) return input;
  const n = Number.parseInt(hex, 16);
  const red = (n >> 16) & 255;
  const green = (n >> 8) & 255;
  const blue = n & 255;
  const color = {
    hex: `#${hex}`,
    red,
    green,
    blue,
    rgb: `${red} ${green} ${blue}`,
    toString() { return this.hex; },
    valueOf() { return this.hex; },
  };
  return color;
}

export function colorBrightness(input) {
  const color = shopifyColor(input);
  if (!color || color.red == null) return 0;
  return Math.round((color.red * 299 + color.green * 587 + color.blue * 114) / 1000);
}

function shift(input, toward, amount) {
  const color = shopifyColor(input);
  if (!color || color.red == null) return input;
  const t = Math.max(0, Math.min(100, Number(amount) || 0)) / 100;
  const channel = (n) => Math.round(n + (toward - n) * t);
  return shopifyColor({ r: channel(color.red), g: channel(color.green), b: channel(color.blue) });
}

export const colorLighten = (input, amount) => shift(input, 255, amount);
export const colorDarken = (input, amount) => shift(input, 0, amount);

/** Blend `amount` percent of `other` into `input`. */
export function colorMix(input, other, amount) {
  const a = shopifyColor(input);
  const b = shopifyColor(other);
  if (!a || a.red == null || !b || b.red == null) return input;
  const t = Math.max(0, Math.min(100, Number(amount) || 0)) / 100;
  const channel = (from, to) => Math.round(from + (to - from) * t);
  return shopifyColor({
    r: channel(a.red, b.red),
    g: channel(a.green, b.green),
    b: channel(a.blue, b.blue),
  });
}

const FONTS = {
  poppins_n4: { family: 'Poppins', fallback_families: 'sans-serif', weight: 400, style: 'normal' },
  libre_baskerville_n4: { family: 'Libre Baskerville', fallback_families: 'serif', weight: 400, style: 'normal' },
};

export function shopifyFont(handle) {
  const spec = FONTS[handle];
  if (!spec) return handle;
  const variant = {
    family: spec.family,
    fallback_families: spec.fallback_families,
    weight: spec.weight,
    style: spec.style,
  };
  return {
    family: spec.family,
    fallback_families: spec.fallback_families,
    weight: spec.weight,
    style: spec.style,
    variants: [variant],
    toString() { return spec.family; },
  };
}

export function fontFaceCss(variant) {
  const family = variant?.family || 'Poppins';
  const weight = variant?.weight || 400;
  const style = variant?.style || 'normal';
  return `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:local("${family}");}`;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function colorizeValue(value) {
  return typeof value === 'string' && HEX.test(value.trim()) ? shopifyColor(value) : value;
}

/**
 * A color scheme the theme both reads and prints.
 *
 * css-variables walks `.settings`. Drawers, modals and menus print the same
 * drop into `color-scheme="{{ settings.color_scheme_dialog }}"`. LiquidJS
 * stringifies a plain object with String(), which is the text `[object Object]`.
 * Shopify prints the scheme id, and the stylesheet keys off that id.
 */
function colorScheme(id, settings) {
  const scheme = { id, settings };
  Object.defineProperty(scheme, 'toString', { value: () => id });
  Object.defineProperty(scheme, 'valueOf', { value: () => id });
  return scheme;
}

/**
 * Turn the theme's saved schemes and font handles into the drops Liquid reads.
 * `color_schemes` stays an array so `{% for scheme in settings.color_schemes %}`
 * yields `{ id, settings }`.
 */
export function applyThemeColorAndFont(settings) {
  if (!settings || typeof settings !== 'object') return settings;
  for (const key of Object.keys(settings)) {
    if (key === 'color_schemes') continue;
    settings[key] = colorizeValue(settings[key]);
  }
  const raw = settings.color_schemes;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const list = Object.entries(raw).map(([id, scheme]) => {
      const source = scheme?.settings || scheme || {};
      const colored = {};
      for (const [key, value] of Object.entries(source)) colored[key] = colorizeValue(value);
      return colorScheme(id, colored);
    });
    settings.color_schemes = list;
    const byId = Object.fromEntries(list.map((scheme) => [scheme.id, scheme]));
    for (const key of ['color_scheme_body', 'color_scheme_dialog', 'color_scheme_search']) {
      if (typeof settings[key] === 'string' && byId[settings[key]]) settings[key] = byId[settings[key]];
    }
  }
  for (const key of ['font_family_shopify_1', 'font_family_shopify_2', 'font_family_shopify_3']) {
    if (typeof settings[key] === 'string') settings[key] = shopifyFont(settings[key]);
  }
  return settings;
}

/** Colour swatches the variant picker and the card colour list both read. */
export const SWATCH_HEX = {
  'onyx black': '#161513',
  'warm cream': '#efe6d2',
};

export function swatchFor(label) {
  const hex = SWATCH_HEX[String(label ?? '').trim().toLowerCase()];
  if (!hex) return null;
  return { color: hex, image: null };
}
