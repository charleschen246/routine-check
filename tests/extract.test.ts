import { describe, expect, it } from 'vitest';
import {
  extractProduct,
  findIngredientsText,
  isProductPage,
  parseIngredientText,
  parseSku,
} from '@/content/extract';

function makeDoc(bodyHtml: string): Document {
  return new DOMParser().parseFromString(
    `<!doctype html><html><body>${bodyHtml}</body></html>`,
    'text/html',
  );
}

describe('isProductPage', () => {
  it('matches www.sephora.com/product/* URLs', () => {
    expect(
      isProductPage('https://www.sephora.com/product/foo-bar-P427418'),
    ).toBe(true);
    expect(
      isProductPage(
        'https://www.sephora.com/product/foo-P12345?skuId=98765',
      ),
    ).toBe(true);
  });

  it('rejects non-product sephora URLs', () => {
    expect(isProductPage('https://www.sephora.com/')).toBe(false);
    expect(isProductPage('https://www.sephora.com/shop/cleanser')).toBe(false);
  });

  it('rejects other hostnames (no international Sephora in v1)', () => {
    expect(isProductPage('https://www.sephora.ca/product/foo-P1')).toBe(false);
    expect(isProductPage('https://www.ulta.com/product/foo')).toBe(false);
  });

  it('returns false for invalid URLs', () => {
    expect(isProductPage('not a url')).toBe(false);
  });
});

describe('parseSku', () => {
  it('prefers skuId query param when present (variant pages)', () => {
    expect(
      parseSku('https://www.sephora.com/product/foo-P12345?skuId=98765'),
    ).toBe('98765');
  });

  it('falls back to the P-prefixed product id in the path', () => {
    expect(parseSku('https://www.sephora.com/product/foo-P427418')).toBe(
      'P427418',
    );
  });

  it('returns empty string when nothing matches', () => {
    expect(parseSku('https://www.sephora.com/product/foo')).toBe('');
    expect(parseSku('garbage')).toBe('');
  });
});

describe('parseIngredientText', () => {
  it('strips a leading "Ingredients:" header', () => {
    expect(parseIngredientText('Ingredients: Water, Glycerin, Niacinamide')).toEqual(
      ['Water', 'Glycerin', 'Niacinamide'],
    );
  });

  it('strips a leading "Ingredients —" header (em-dash)', () => {
    expect(parseIngredientText('Ingredients — Water, Glycerin')).toEqual([
      'Water',
      'Glycerin',
    ]);
  });

  it('drops the "May Contain" colorant section', () => {
    const raw =
      'Ingredients: Water, Glycerin, Niacinamide. May Contain: CI 12345, CI 67890.';
    expect(parseIngredientText(raw)).toEqual([
      'Water',
      'Glycerin',
      'Niacinamide.',
    ]);
  });

  it('drops the "+/-" colorant section', () => {
    const raw = 'Water, Glycerin (+/-): CI 12345, CI 67890';
    expect(parseIngredientText(raw)).toEqual(['Water', 'Glycerin']);
  });

  it('strips parenthetical annotations', () => {
    expect(parseIngredientText('Niacinamide (1%), Glycerin (humectant)')).toEqual(
      ['Niacinamide', 'Glycerin'],
    );
  });

  it('splits on commas, semicolons, and newlines', () => {
    expect(parseIngredientText('Water, Glycerin; Niacinamide\nPanthenol')).toEqual(
      ['Water', 'Glycerin', 'Niacinamide', 'Panthenol'],
    );
  });

  it('strips trailing markers like * and +', () => {
    expect(parseIngredientText('Shea Butter*, Glycerin†, Niacinamide')).toEqual(
      ['Shea Butter', 'Glycerin', 'Niacinamide'],
    );
  });

  it('drops empty tokens', () => {
    expect(parseIngredientText('Water, , Glycerin,,')).toEqual([
      'Water',
      'Glycerin',
    ]);
  });
});

describe('findIngredientsText', () => {
  it('finds the documented data-at="ingredients" block', () => {
    const doc = makeDoc(`
      <div data-at="ingredients">
        Ingredients: Water, Glycerin, Niacinamide, Sodium Hyaluronate, Phenoxyethanol
      </div>
    `);
    expect(findIngredientsText(doc)).toMatch(/Ingredients:/);
  });

  it('falls back to text-content heuristic when no data-at attribute', () => {
    const doc = makeDoc(`
      <section>
        <h2>About</h2>
        <p>A lightweight serum.</p>
      </section>
      <section>
        <h2>Ingredients</h2>
        <p>Water, Glycerin, Niacinamide, Sodium Hyaluronate, Panthenol, Phenoxyethanol</p>
      </section>
    `);
    const text = findIngredientsText(doc);
    expect(text).toContain('Niacinamide');
    expect(text).toContain('Sodium Hyaluronate');
  });

  it('prefers the smallest matching element when text is nested in containers', () => {
    // The outer <main> textContent also "looks like ingredients" because it
    // transitively contains the leaf <p>. The leaf is the right answer.
    const doc = makeDoc(`
      <main>
        <article>
          <p>Water, Glycerin, Niacinamide, Sodium Hyaluronate, Panthenol</p>
        </article>
      </main>
    `);
    const text = findIngredientsText(doc);
    expect(text?.startsWith('Water')).toBe(true);
    expect(text).not.toMatch(/<|>/);
  });

  it('returns null when the page has no ingredient-shaped block', () => {
    const doc = makeDoc(`
      <h1>Some product</h1>
      <p>A short description with no comma-separated ingredient list.</p>
    `);
    expect(findIngredientsText(doc)).toBeNull();
  });
});

describe('extractProduct', () => {
  const URL = 'https://www.sephora.com/product/foo-bar-P427418';

  it('returns not_product_page reason when URL does not match', () => {
    const doc = makeDoc('<h1>Anything</h1>');
    const out = extractProduct(doc, 'https://www.sephora.com/shop/cleanser');
    expect(out.product).toBeNull();
    expect(out.reason).toBe('not_product_page');
  });

  it('extracts name, brand, SKU, and ingredients from a sephora-like DOM', () => {
    const doc = makeDoc(`
      <div>
        <a data-at="brand_name" href="/brand/the-ordinary">The Ordinary</a>
        <h1 data-at="product_name">Niacinamide 10% + Zinc 1%</h1>
        <section data-at="ingredients">
          Ingredients: Water, Niacinamide, Pentylene Glycol, Zinc PCA, Glycerin, Phenoxyethanol
        </section>
      </div>
    `);
    const out = extractProduct(doc, URL);
    expect(out.product).not.toBeNull();
    expect(out.product?.name).toBe('Niacinamide 10% + Zinc 1%');
    expect(out.product?.brand).toBe('The Ordinary');
    expect(out.product?.sku).toBe('P427418');
    expect(out.product?.ingredients_inci).toEqual([
      'Water',
      'Niacinamide',
      'Pentylene Glycol',
      'Zinc PCA',
      'Glycerin',
      'Phenoxyethanol',
    ]);
  });

  it('returns no_ingredients reason when the ingredient block is missing', () => {
    const doc = makeDoc(`
      <h1 data-at="product_name">Mystery Product</h1>
      <a data-at="brand_name">Some Brand</a>
      <p>Reviews and ratings go here.</p>
    `);
    const out = extractProduct(doc, URL);
    expect(out.product).toBeNull();
    expect(out.reason).toBe('no_ingredients');
  });

  it('falls back to a plain h1 when the data-at product_name attr is absent', () => {
    const doc = makeDoc(`
      <h1>Fallback Name</h1>
      <section>Ingredients: Water, Glycerin, Niacinamide, Panthenol, Phenoxyethanol</section>
    `);
    const out = extractProduct(doc, URL);
    expect(out.product?.name).toBe('Fallback Name');
    expect(out.product?.ingredients_inci).toContain('Niacinamide');
  });
});
