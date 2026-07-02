// A SiteAdapter is the single place where one retail site's page structure
// is described. Adding a retailer = one new adapter file + a registry entry
// + a manifest match pattern. Everything else (extraction engine, banner,
// service worker, analyzer) is site-agnostic and never needs to change.
//
// Extraction is layered so a site redesign degrades gracefully instead of
// breaking outright (see extract.ts):
//   1. JSON-LD structured data (schema.org Product) — retailers ship this
//      for Google SEO and change it far less often than their CSS/markup.
//   2. The adapter's selectors below — the fast path; update these when a
//      redesign is noticed.
//   3. A generic "looks like an INCI list" text heuristic that scans the
//      whole page — survives arbitrary markup changes as long as the
//      ingredient list is rendered as text anywhere on the page.

export interface SiteAdapter {
  /** Stable machine id, also used in diagnostic console logs. */
  id: 'sephora' | 'ulta' | 'amazon';
  /** Human-readable site name. */
  label: string;
  /** Exact hostnames this adapter owns. */
  hostnames: string[];
  /** Is this URL a product page? Called only when the hostname matched. */
  isProductPage(url: URL): boolean;
  /** Site-specific product/SKU id from the URL; '' when absent. */
  parseSku(url: URL): string;
  /** Product-name elements, most specific first. */
  nameSelectors: string[];
  /** Brand-name elements, most specific first. */
  brandSelectors: string[];
  /** Fast-path containers likely to hold the INCI list. */
  ingredientSelectors: string[];
  /**
   * Collapsed accordions to click open before extraction. Selectors must be
   * idempotent — e.g. include [aria-expanded="false"] so a second pass does
   * not re-click (and close) an already-open panel.
   */
  expandTriggerSelectors: string[];
  /** Banner injection anchors, most preferred first. */
  anchorSelectors: string[];
  /** Optional brand-string cleanup (e.g. Amazon's "Visit the X Store"). */
  cleanBrand?(raw: string): string;
}
