// Multi-site coverage: the adapter registry, the Ulta and Amazon adapters,
// the JSON-LD structured-data layer, and the generic add-to-cart banner
// anchor fallback. The Sephora path is covered by tests/extract.test.ts.

import { describe, expect, it } from 'vitest';
import {
  extractJsonLdProduct,
  extractProduct,
  isProductPage,
  parseSku,
} from '@/content/extract';
import {
  amazon,
  productAdapterForUrl,
  siteForUrl,
  ulta,
} from '@/content/sites';
import { findInjectionAnchor } from '@/content/banner';

function makeDoc(bodyHtml: string, headHtml = ''): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><head>${headHtml}</head><body>${bodyHtml}</body></html>`,
    'text/html',
  );
}

describe('site registry', () => {
  it('resolves each supported host to its adapter', () => {
    expect(siteForUrl('https://www.sephora.com/product/foo-P1')?.id).toBe('sephora');
    expect(siteForUrl('https://www.ulta.com/p/foo-pimprod123')?.id).toBe('ulta');
    expect(siteForUrl('https://www.amazon.com/dp/B00TTD9BRC')?.id).toBe('amazon');
  });

  it('returns null for unsupported hosts and invalid URLs', () => {
    expect(siteForUrl('https://www.target.com/p/foo')).toBeNull();
    expect(siteForUrl('https://www.sephora.ca/product/foo-P1')).toBeNull();
    expect(siteForUrl('not a url')).toBeNull();
  });

  it('productAdapterForUrl requires a product page, not just a supported host', () => {
    expect(productAdapterForUrl('https://www.ulta.com/p/foo-pimprod123')?.id).toBe('ulta');
    expect(productAdapterForUrl('https://www.ulta.com/shop/skincare')).toBeNull();
    expect(productAdapterForUrl('https://www.amazon.com/gp/cart/view.html')).toBeNull();
  });
});

describe('Ulta adapter', () => {
  it('matches /p/ product URLs only', () => {
    expect(isProductPage('https://www.ulta.com/p/hydro-boost-xlsImpprod10921615')).toBe(true);
    expect(isProductPage('https://www.ulta.com/p/foo-pimprod2007161?sku=2566906')).toBe(true);
    expect(isProductPage('https://www.ulta.com/')).toBe(false);
    expect(isProductPage('https://www.ulta.com/shop/skincare')).toBe(false);
  });

  it('prefers the sku query param, then the product id slug', () => {
    expect(parseSku('https://www.ulta.com/p/foo-pimprod2007161?sku=2566906')).toBe('2566906');
    expect(parseSku('https://www.ulta.com/p/foo-pimprod2007161')).toBe('pimprod2007161');
    expect(parseSku('https://www.ulta.com/p/foo-xlsImpprod10921615')).toBe('xlsImpprod10921615');
    expect(parseSku('https://www.ulta.com/p/foo')).toBe('');
  });

  it('extracts an Ulta-shaped page via JSON-LD metadata + heuristic ingredient scan', () => {
    const jsonLd = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Hydro Boost Water Gel',
      brand: { '@type': 'Brand', name: 'Neutrogena' },
      sku: '2266814',
    })}</script>`;
    const doc = makeDoc(
      `
      <h1>Hydro Boost Water Gel</h1>
      <details>
        <summary>Ingredients</summary>
        <div>Water, Dimethicone, Glycerin, Dimethicone/Vinyl Dimethicone Crosspolymer,
        Phenoxyethanol, Sodium Hyaluronate, Cetearyl Olivate, Carbomer, Ethylhexylglycerin</div>
      </details>
      <button>Add to bag</button>
      `,
      jsonLd,
    );
    const out = extractProduct(doc, 'https://www.ulta.com/p/hydro-boost-pimprod123', ulta);
    expect(out.product).not.toBeNull();
    expect(out.product?.name).toBe('Hydro Boost Water Gel');
    expect(out.product?.brand).toBe('Neutrogena');
    expect(out.product?.sku).toBe('pimprod123');
    expect(out.product?.ingredients_inci).toContain('Glycerin');
    expect(out.product?.ingredients_inci).toContain('Sodium Hyaluronate');
  });
});

describe('Amazon adapter', () => {
  it('matches /dp/, /<slug>/dp/, and /gp/product/ URLs only', () => {
    expect(isProductPage('https://www.amazon.com/dp/B00TTD9BRC')).toBe(true);
    expect(isProductPage('https://www.amazon.com/CeraVe-Moisturizing-Cream/dp/B00TTD9BRC')).toBe(true);
    expect(isProductPage('https://www.amazon.com/gp/product/B00TTD9BRC')).toBe(true);
    expect(isProductPage('https://www.amazon.com/s?k=moisturizer')).toBe(false);
    expect(isProductPage('https://www.amazon.com/gp/cart/view.html')).toBe(false);
  });

  it('uses the ASIN as the SKU', () => {
    expect(parseSku('https://www.amazon.com/CeraVe-Cream/dp/B00TTD9BRC?th=1')).toBe('B00TTD9BRC');
    expect(parseSku('https://www.amazon.com/gp/product/b00ttd9brc')).toBe('B00TTD9BRC');
    expect(parseSku('https://www.amazon.com/s?k=moisturizer')).toBe('');
  });

  it('extracts an Amazon-shaped page and cleans the byline brand', () => {
    const doc = makeDoc(`
      <span id="productTitle"> CeraVe Moisturizing Cream </span>
      <a id="bylineInfo">Visit the CeraVe Store</a>
      <div id="important-information">
        <div class="content"><h4>Safety Information</h4><p>For external use only.</p></div>
        <div class="content">
          <h4>Ingredients</h4>
          <p>Aqua (Water), Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride,
          Cetyl Alcohol, Ceramide NP, Phenoxyethanol, Carbomer, Xanthan Gum</p>
        </div>
      </div>
      <input id="add-to-cart-button" type="submit" value="Add to Cart" />
    `);
    const out = extractProduct(
      doc,
      'https://www.amazon.com/CeraVe-Moisturizing-Cream/dp/B00TTD9BRC',
      amazon,
    );
    expect(out.product).not.toBeNull();
    expect(out.product?.name).toBe('CeraVe Moisturizing Cream');
    expect(out.product?.brand).toBe('CeraVe');
    expect(out.product?.sku).toBe('B00TTD9BRC');
    expect(out.product?.ingredients_inci).toContain('Glycerin');
    expect(out.product?.ingredients_inci).toContain('Ceramide NP');
    // The safety-information prose must not leak into the ingredient list.
    expect(
      out.product?.ingredients_inci.some((t) => /external use/i.test(t)),
    ).toBe(false);
  });

  it('strips the "Brand:" byline variant too', () => {
    expect(amazon.cleanBrand?.('Brand: The Ordinary')).toBe('The Ordinary');
    expect(amazon.cleanBrand?.('Visit the CeraVe Store')).toBe('CeraVe');
    expect(amazon.cleanBrand?.('Neutrogena')).toBe('Neutrogena');
  });
});

describe('extractJsonLdProduct', () => {
  it('reads name, brand object, and sku from a Product node', () => {
    const doc = makeDoc('', `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Product',
      name: 'Test Serum',
      brand: { '@type': 'Brand', name: 'Test Brand' },
      sku: 'SKU-1',
    })}</script>`);
    expect(extractJsonLdProduct(doc)).toEqual({
      name: 'Test Serum',
      brand: 'Test Brand',
      sku: 'SKU-1',
    });
  });

  it('accepts a string brand and a Product nested in @graph', () => {
    const doc = makeDoc('', `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'BreadcrumbList' },
        { '@type': 'Product', name: 'Graph Serum', brand: 'Graph Brand' },
      ],
    })}</script>`);
    const out = extractJsonLdProduct(doc);
    expect(out?.name).toBe('Graph Serum');
    expect(out?.brand).toBe('Graph Brand');
  });

  it('skips malformed JSON blocks and non-Product nodes', () => {
    const doc = makeDoc('', `
      <script type="application/ld+json">{not valid json</script>
      <script type="application/ld+json">{"@type":"Organization","name":"Shop"}</script>
      <script type="application/ld+json">{"@type":"Product","name":"Later Product"}</script>
    `);
    expect(extractJsonLdProduct(doc)?.name).toBe('Later Product');
  });

  it('returns null when no Product JSON-LD exists', () => {
    expect(extractJsonLdProduct(makeDoc('<h1>Nothing</h1>'))).toBeNull();
  });
});

describe('findInjectionAnchor fallback', () => {
  it('uses the adapter anchor selectors when they match', () => {
    const doc = makeDoc(`
      <span id="productTitle">Thing</span>
      <div id="addToCart_feature_div"><input type="submit" value="Add to Cart" /></div>
    `);
    const el = findInjectionAnchor(doc, amazon.anchorSelectors);
    expect(el?.id).toBe('addToCart_feature_div');
  });

  it('falls back to a button labeled "Add to bag/cart" when no selector matches', () => {
    const doc = makeDoc('<h2>Some product</h2><button>Add to bag</button>');
    const el = findInjectionAnchor(doc, ulta.anchorSelectors);
    expect(el?.tagName).toBe('BUTTON');
    expect(el?.textContent).toBe('Add to bag');
  });

  it('matches an <input type="submit"> add-to-cart by its value attribute', () => {
    const doc = makeDoc('<input type="submit" value="Add to Cart" />');
    const el = findInjectionAnchor(doc, []);
    expect(el?.getAttribute('value')).toBe('Add to Cart');
  });

  it('still returns null when nothing looks like an add-to-cart control', () => {
    const doc = makeDoc('<p>nothing</p><button>Subscribe</button>');
    expect(findInjectionAnchor(doc, ulta.anchorSelectors)).toBeNull();
  });
});
