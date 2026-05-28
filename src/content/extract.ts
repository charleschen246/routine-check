// Pure DOM + string functions for extracting product info from a Sephora
// product page. Lives in its own module so it can be unit-tested in jsdom
// without spinning up the MutationObserver runtime in `sephora.ts`.
//
// Sephora's DOM ships UI updates regularly (PROJECT_BRIEF.md §9), so the
// extraction is defensive: try the documented `data-at` selectors first,
// then fall back to a text-content heuristic that finds the smallest block
// of comma-separated ingredient-looking text.

import type { ExtractedProduct } from '@/lib/types';

export interface ExtractAttempt {
  product: ExtractedProduct | null;
  reason?: 'not_product_page' | 'no_ingredients' | 'empty_ingredient_list';
}

export function isProductPage(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname !== 'www.sephora.com') return false;
    return /^\/product(\/|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}

// Sephora's product URL embeds a "P"-prefixed product id (e.g. ".../foo-P427418").
// Variants add a `skuId` query param; prefer that when present because it
// uniquely identifies the exact shade/size the shopper is looking at.
export function parseSku(url: string): string {
  try {
    const u = new URL(url);
    const skuParam = u.searchParams.get('skuId');
    if (skuParam) return skuParam;
    const match = u.pathname.match(/P\d+/i);
    if (match) return match[0];
    return '';
  } catch {
    return '';
  }
}

export function parseIngredientText(raw: string): string[] {
  let text = raw;

  // Drop a leading "Ingredients:" / "Ingredients —" header.
  text = text.replace(/^\s*ingredients\b[\s:—\-–]*/i, '');

  // Drop the "May Contain" / "+/-" colorant section — these are CI dyes that
  // shouldn't be treated as actives even if a future rule were added.
  text = text.replace(/\s*(?:\(\s*\+\/\-\s*\)\s*:?|\+\/\-:?|may contain[:\s])[\s\S]*$/i, '');

  // Strip parenthetical annotations ("Glycerin (humectant)", "Niacinamide (1%)").
  text = text.replace(/\([^)]*\)/g, '');

  const tokens = text.split(/[,;\n]/);
  return tokens
    .map((t) => t.trim().replace(/[*+†‡]+$/g, '').trim())
    .filter((t) => t.length > 0);
}

// "Looks like an INCI list" heuristic: long enough, comma-separated, and
// either explicitly headed by "Ingredients" or starts with a water alias.
function looksLikeIngredients(text: string): boolean {
  const t = text.trim();
  if (t.length < 30) return false;
  const commaCount = (t.match(/,/g) ?? []).length;
  if (commaCount < 2) return false;
  if (/^ingredients\b/i.test(t)) return true;
  if (/^(aqua|water|eau)\b/i.test(t)) return true;
  return false;
}

export function findIngredientsText(doc: Document): string | null {
  // Strategy 1: documented data-at attribute. Sephora has used variations
  // like data-at="ingredients" / "ingredient_list" in the past; try both.
  for (const sel of ['[data-at="ingredients"]', '[data-at="ingredient_list"]']) {
    const explicit = doc.querySelector(sel);
    const text = explicit?.textContent?.trim();
    if (text && looksLikeIngredients(text)) return text;
  }

  // Strategy 2: walk the tree and collect every element whose text content
  // looks like an ingredient list. Then pick the *smallest* — outer containers
  // also "look like" a list because their textContent transitively includes
  // the leaf node we actually want.
  const root = doc.body ?? doc.documentElement;
  if (!root) return null;

  const candidates: { el: Element; len: number }[] = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode as Element | null;
  while (node) {
    const text = node.textContent ?? '';
    if (looksLikeIngredients(text)) {
      candidates.push({ el: node, len: text.length });
    }
    node = walker.nextNode() as Element | null;
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.len - b.len);
  return candidates[0].el.textContent?.trim() ?? null;
}

function readText(doc: Document, selectors: string[]): string {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return '';
}

export function extractProduct(doc: Document, url: string): ExtractAttempt {
  if (!isProductPage(url)) {
    return { product: null, reason: 'not_product_page' };
  }

  const name = readText(doc, [
    'h1[data-at="product_name"]',
    '[data-at="product_name"]',
    'h1',
  ]);
  const brand = readText(doc, [
    'a[data-at="brand_name"]',
    '[data-at="brand_name"]',
  ]);

  const ingredientsText = findIngredientsText(doc);
  if (!ingredientsText) {
    return { product: null, reason: 'no_ingredients' };
  }

  const ingredients_inci = parseIngredientText(ingredientsText);
  if (ingredients_inci.length === 0) {
    return { product: null, reason: 'empty_ingredient_list' };
  }

  return {
    product: {
      name: name || 'Unknown product',
      brand,
      sku: parseSku(url),
      ingredients_inci,
    },
  };
}
