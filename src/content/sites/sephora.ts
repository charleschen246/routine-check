// Sephora adapter. Selectors are the §9 documented `data-at` attributes,
// verified live 2026-05-28 (see HANDOFF.md). Sephora ships UI updates
// regularly — if extraction breaks here, re-verify these on a real product
// page before anything else.

import type { SiteAdapter } from './types';

export const sephora: SiteAdapter = {
  id: 'sephora',
  label: 'Sephora',
  hostnames: ['www.sephora.com'],

  // e.g. https://www.sephora.com/product/foo-bar-P427418?skuId=98765
  isProductPage: (url) => /^\/product(\/|$)/i.test(url.pathname),

  // Prefer the skuId query param (identifies the exact shade/size variant);
  // fall back to the P-prefixed product id embedded in the path.
  parseSku: (url) => {
    const skuParam = url.searchParams.get('skuId');
    if (skuParam) return skuParam;
    const match = url.pathname.match(/P\d+/i);
    return match ? match[0] : '';
  },

  nameSelectors: [
    'h1[data-at="product_name"]',
    '[data-at="product_name"]',
    'h1',
  ],
  brandSelectors: ['a[data-at="brand_name"]', '[data-at="brand_name"]'],

  // Current layout: the accordion trigger has data-at="ingredients" and the
  // panel is <div id="ingredients"> — prefer the panel (the trigger's text
  // is just the literal word "Ingredients"). Older layouts put the list
  // directly inside the data-at element.
  ingredientSelectors: [
    '#ingredients',
    '[data-at="ingredient_list"]',
    '[data-at="ingredients"]',
  ],
  expandTriggerSelectors: ['[data-at="ingredients"][aria-expanded="false"]'],

  anchorSelectors: [
    '[data-at="add_to_basket_btn_container"]',
    '[data-at="add-to-basket-btn-container"]',
    // Current layout: the button itself carries the data-at attribute, with
    // a "_small_view" duplicate for the mobile breakpoint. Inserting after
    // either is fine — only the visible one has a visible parent.
    'button[data-at="add_to_basket_btn"]',
    'button[data-at="add_to_basket_btn_small_view"]',
    'button[data-at="add-to-basket-btn"]',
    'button[data-at="add_to_basket"]',
    'h1[data-at="product_name"]',
  ],
};
