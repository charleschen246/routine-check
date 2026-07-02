// Site-agnostic extraction engine. Pure DOM + string functions so it can be
// unit-tested in jsdom without spinning up the MutationObserver runtime in
// `main.ts`. Everything site-specific lives in a SiteAdapter (see sites/).
//
// Retail sites ship UI updates regularly, so extraction is layered from
// most-stable to most-generic:
//   1. schema.org Product JSON-LD for name/brand/SKU — retailers ship it for
//      SEO and it changes far less often than markup.
//   2. The adapter's selectors — the fast path for the current layout.
//   3. A text-content heuristic that finds the smallest block of
//      comma-separated ingredient-looking text anywhere on the page.
// A redesign typically breaks layer 2 only; layers 1 and 3 keep the
// extension working until the adapter's selectors are refreshed.

import type { ExtractedProduct } from '@/lib/types';
import type { SiteAdapter } from './sites';
import { siteForUrl } from './sites';

export interface ExtractAttempt {
  product: ExtractedProduct | null;
  reason?: 'not_product_page' | 'no_ingredients' | 'empty_ingredient_list';
}

/** True when the URL is a product page on any supported site. */
export function isProductPage(url: string): boolean {
  const adapter = siteForUrl(url);
  if (!adapter) return false;
  try {
    return adapter.isProductPage(new URL(url));
  } catch {
    return false;
  }
}

/** Site-specific product/SKU id from the URL; '' when unsupported/absent. */
export function parseSku(url: string): string {
  const adapter = siteForUrl(url);
  if (!adapter) return '';
  try {
    return adapter.parseSku(new URL(url));
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Layer 1: schema.org Product JSON-LD.

export interface JsonLdProduct {
  name?: string;
  brand?: string;
  sku?: string;
}

function collectJsonLdNodes(data: unknown, out: Record<string, unknown>[]): void {
  if (Array.isArray(data)) {
    for (const item of data) collectJsonLdNodes(item, out);
    return;
  }
  if (data && typeof data === 'object') {
    const node = data as Record<string, unknown>;
    out.push(node);
    if (node['@graph']) collectJsonLdNodes(node['@graph'], out);
  }
}

export function extractJsonLdProduct(doc: Document): JsonLdProduct | null {
  const scripts = Array.from(
    doc.querySelectorAll('script[type="application/ld+json"]'),
  );
  for (const script of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }
    const nodes: Record<string, unknown>[] = [];
    collectJsonLdNodes(parsed, nodes);
    for (const node of nodes) {
      const type = node['@type'];
      const types = Array.isArray(type) ? type : [type];
      if (!types.includes('Product')) continue;

      const rawBrand = node.brand as unknown;
      const brand =
        typeof rawBrand === 'string'
          ? rawBrand
          : rawBrand && typeof rawBrand === 'object'
            ? (rawBrand as Record<string, unknown>).name
            : undefined;

      return {
        name: typeof node.name === 'string' ? node.name : undefined,
        brand: typeof brand === 'string' ? brand : undefined,
        sku:
          typeof node.sku === 'string'
            ? node.sku
            : typeof node.productID === 'string'
              ? node.productID
              : undefined,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Layer 3 helpers: ingredient-list detection and parsing.

// Find the INCI list within a text blob that may include a "Key Ingredient"
// marketing prefix. Brands prefix the panel with varied formats:
// "-Niacinamide: ... promotes visible skin radiance. Aqua (Water), ...",
// "- Propolis Extract: hydrates...- BHA: gently exfoliates...Propolis
// Extract, Dipropylene Glycol, ...", etc. The reliable signal is that the
// INCI list is by far the comma-densest part of the text. Split on sentence
// boundaries (period + space/uppercase/hyphen) and keep the densest segment.
function extractInciSegment(text: string): string {
  const parts = text.split(/\.(?:\s+|(?=[A-Z\-]))/);
  if (parts.length <= 1) return text;

  let best = parts[0];
  let bestCommas = (parts[0].match(/,/g) ?? []).length;
  for (const p of parts.slice(1)) {
    const c = (p.match(/,/g) ?? []).length;
    if (c > bestCommas) {
      best = p;
      bestCommas = c;
    }
  }
  // Only slice if the densest segment is clearly an INCI list, otherwise
  // return the original so short ingredient lists (3–4 items) still parse.
  return bestCommas >= 5 ? best.trim() : text;
}

export function parseIngredientText(raw: string): string[] {
  let text = raw;

  // Drop a leading "Ingredients:" / "Ingredients —" header.
  text = text.replace(/^\s*ingredients\b[\s:—\-–]*/i, '');

  text = extractInciSegment(text);

  // Drop the "May Contain" / "+/-" colorant section — these are CI dyes that
  // shouldn't be treated as actives even if a future rule were added.
  text = text.replace(/\s*(?:\(\s*\+\/\-\s*\)\s*:?|\+\/\-:?|may contain[:\s])[\s\S]*$/i, '');

  // Strip parenthetical annotations ("Glycerin (humectant)", "Niacinamide (1%)").
  text = text.replace(/\([^)]*\)/g, '');

  const tokens = text.split(/[,;\n]/);
  return tokens
    .map((t) => t.trim().replace(/[*+†‡.]+$/g, '').trim())
    .filter((t) => t.length > 0);
}

// "Looks like an INCI list" detector. Per-brand prefixes vary too much for
// prefix matching to be reliable (some lists start with Aqua, some with
// Propolis Extract, some with a brand's hero active), so the strategy is
// signal-based: count INCI-shaped tokens, parenthesized water aliases, and
// overall comma density, and accept anything with strong signals.
const INCI_KEYWORDS = /\b(?:aqua|glycerin|niacinamide|tocopherol|phenoxyethanol|propanediol|butylene\s+glycol|dipropylene\s+glycol|cetearyl|hyaluronate|xanthan\s+gum|sodium\s+hydroxide|disodium\s+edta|ethylhexylglycerin|caprylic|behenyl|stearyl|cetyl\s+alcohol|panthenol|allantoin|hexanediol|polysorbate|carbomer|tromethamine)\b/gi;

function looksLikeIngredients(text: string): boolean {
  const t = text.trim();
  if (t.length < 30) return false;
  const commaCount = (t.match(/,/g) ?? []).length;
  if (commaCount < 2) return false;

  // Strong, low-cost signals first.
  if (/^ingredients\b/i.test(t)) return true;
  if (/^(aqua|water|eau)\b/i.test(t)) return true;

  // Parenthesized water alias appears in most cosmetic lists.
  const hasWaterParen = /\(\s*(?:water|aqua|eau)\s*\)/i.test(t);
  if (hasWaterParen && commaCount >= 3) return true;

  // Multi-signal scoring: count common INCI keywords. Three or more hits
  // alongside the comma signal is reliable across brand layouts.
  const keywordHits = (t.match(INCI_KEYWORDS) ?? []).length;
  if (keywordHits >= 3 && commaCount >= 5) return true;

  // Last resort: very dense comma-separated text with INCI-shaped tokens.
  // "INCI-shaped" = capitalized words 2–60 chars, no sentence end inside.
  const commaDensity = (commaCount / t.length) * 100;
  if (commaDensity >= 3 && commaCount >= 10) return true;

  return false;
}

export function findIngredientsText(
  doc: Document,
  selectors: string[] = [],
): string | null {
  // Layer 2: the adapter's fast-path selectors for the current site layout.
  for (const sel of selectors) {
    let el: Element | null = null;
    try {
      el = doc.querySelector(sel);
    } catch {
      continue; // a bad selector in one adapter must not kill extraction
    }
    const text = el?.textContent?.trim();
    if (text && looksLikeIngredients(text)) return text;
  }

  // Layer 3: walk the tree and collect every element whose text content
  // looks like an ingredient list. Then pick the *smallest* — outer
  // containers also "look like" a list because their textContent
  // transitively includes the leaf node we actually want.
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
    let el: Element | null = null;
    try {
      el = doc.querySelector(sel);
    } catch {
      continue;
    }
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return '';
}

export function extractProduct(
  doc: Document,
  url: string,
  adapter: SiteAdapter | null = siteForUrl(url),
): ExtractAttempt {
  if (!adapter || !isProductPage(url)) {
    return { product: null, reason: 'not_product_page' };
  }

  const jsonLd = extractJsonLdProduct(doc);

  const name = readText(doc, adapter.nameSelectors) || jsonLd?.name || '';
  const rawBrand = readText(doc, adapter.brandSelectors) || jsonLd?.brand || '';
  const brand = adapter.cleanBrand ? adapter.cleanBrand(rawBrand) : rawBrand;

  const ingredientsText = findIngredientsText(doc, adapter.ingredientSelectors);
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
      sku: parseSku(url) || jsonLd?.sku || '',
      ingredients_inci,
    },
  };
}
