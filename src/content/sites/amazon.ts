// Amazon adapter. Amazon's core product-page ids (#productTitle, #bylineInfo,
// #add-to-cart-button, #important-information) have been stable for many
// years, which makes them a safer bet than any class-based selector. Two
// Amazon-specific caveats:
//   - Ingredient data is seller-entered and sometimes missing or only in
//     images. When no INCI-shaped text exists the extractor returns nothing
//     and no banner is shown — silence is correct there, never a guess.
//   - The byline reads "Visit the X Store" / "Brand: X"; cleanBrand strips
//     that wrapping.

import type { SiteAdapter } from './types';

const ASIN_RE = /(?:\/dp\/|\/gp\/product\/)([A-Z0-9]{10})(?=[/?]|$)/i;

export const amazon: SiteAdapter = {
  id: 'amazon',
  label: 'Amazon',
  hostnames: ['www.amazon.com', 'amazon.com'],

  // e.g. https://www.amazon.com/CeraVe-Moisturizing-Cream/dp/B00TTD9BRC
  //      https://www.amazon.com/dp/B00TTD9BRC
  //      https://www.amazon.com/gp/product/B00TTD9BRC
  isProductPage: (url) => ASIN_RE.test(url.pathname),

  // The ASIN is Amazon's product id and doubles as our SKU.
  parseSku: (url) => {
    const match = url.pathname.match(ASIN_RE);
    return match ? match[1].toUpperCase() : '';
  },

  nameSelectors: ['#productTitle', 'h1#title', 'h1'],
  brandSelectors: ['#bylineInfo'],
  cleanBrand: (raw) =>
    raw
      .replace(/^\s*visit the\s+/i, '')
      .replace(/\s+store\s*$/i, '')
      .replace(/^\s*brand:\s*/i, '')
      .trim(),

  // Beauty listings put the INCI list under "Important information →
  // Ingredients". The .content children keep the match tighter than the
  // whole #important-information block (which also holds safety warnings).
  ingredientSelectors: [
    '#important-information .content',
    '#important-information',
    '#ingredients-section',
  ],
  expandTriggerSelectors: [],

  anchorSelectors: [
    '#addToCart_feature_div',
    '#add-to-cart-button',
    '#buyNow_feature_div',
    '#productTitle',
  ],
};
