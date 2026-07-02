// Ulta adapter. Unlike Sephora's selectors (verified live), these are
// best-effort: Ulta blocks automated fetching, so the selectors below are
// the commonly documented ones and have NOT been confirmed against a live
// page from this environment. That is deliberate and mostly fine — Ulta
// ships schema.org Product JSON-LD (layer 1) and renders the INCI list as
// text (layer 3 heuristic), so extraction works even if every selector
// here misses. Verify on a real page when possible and tighten.

import type { SiteAdapter } from './types';

export const ulta: SiteAdapter = {
  id: 'ulta',
  label: 'Ulta',
  hostnames: ['www.ulta.com'],

  // e.g. https://www.ulta.com/p/hydro-boost-water-gel-xlsImpprod10921615?sku=2266814
  isProductPage: (url) => /^\/p(\/|$)/i.test(url.pathname),

  // Prefer the sku query param (exact variant); fall back to the product id
  // slug Ulta embeds at the end of the path (pimprod / xlsImpprod).
  parseSku: (url) => {
    const skuParam = url.searchParams.get('sku');
    if (skuParam) return skuParam;
    const match = url.pathname.match(/(?:pimprod|xlsimpprod)\d+/i);
    return match ? match[0] : '';
  },

  nameSelectors: ['h1 [data-test="product-name"]', 'h1'],
  brandSelectors: [
    '[data-test="product-brand"]',
    'h1 a[href*="/brand/"]',
    'a[href^="/brand/"]',
  ],

  // Ulta keeps ingredients inside a "Details" / "Ingredients" accordion.
  // No stable documented id — lean on the generic heuristic.
  ingredientSelectors: ['[data-test="ingredients"]', '#Ingredients', '#ingredients'],
  // No stable trigger selector; the runtime's generic "closed accordion
  // labeled Ingredients" expansion (main.ts) covers Ulta.
  expandTriggerSelectors: [],

  anchorSelectors: [
    '[data-test="add-to-bag-button"]',
    'button[data-test="add-to-bag"]',
    // Generic add-to-bag text fallback in banner.ts covers the rest.
  ],
};
