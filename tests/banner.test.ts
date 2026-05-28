import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BANNER_HOST_ID,
  buildBanner,
  findInjectionAnchor,
  isDismissed,
  setDismissed,
  SHORT_DISCLAIMER,
  showBanner,
} from '@/content/banner';
import type { AnalysisResult } from '@/lib/types';

function baseResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    product: { name: 'Test Product', brand: 'Test Brand', sku: 'P12345' },
    detected_actives: [],
    warnings: [],
    gap_fills: [],
    neutral: true,
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('buildBanner — title + severity styling', () => {
  it('shows the empty-routine CTA when neutral and routine is empty', () => {
    const { host } = buildBanner({ result: baseResult(), routineSize: 0 });
    document.body.appendChild(host);
    const shadow = host.shadowRoot!;
    expect(shadow.textContent).toContain('Add your routine to get personalized analysis');
    expect(shadow.querySelector('.banner.sev-neutral')).not.toBeNull();
  });

  it('shows "Compatible with your routine" when neutral and routine non-empty', () => {
    const { host } = buildBanner({ result: baseResult(), routineSize: 4 });
    document.body.appendChild(host);
    const text = host.shadowRoot!.textContent ?? '';
    expect(text).toContain('Compatible with your routine');
    expect(text).not.toContain('Add your routine to get personalized analysis');
  });

  it('uses the high-severity class when any warning is high', () => {
    const result = baseResult({
      neutral: false,
      warnings: [
        {
          rule_id: 'a',
          type: 'redundancy',
          severity: 'low',
          short_message: 'low item',
          long_explanation: '',
          sources: [],
        },
        {
          rule_id: 'b',
          type: 'conflict',
          severity: 'high',
          short_message: 'high item',
          long_explanation: 'Long explanation for high.',
          sources: ['https://pubmed.ncbi.nlm.nih.gov/12345/'],
        },
      ],
    });
    const { host } = buildBanner({ result, routineSize: 3 });
    document.body.appendChild(host);
    const shadow = host.shadowRoot!;
    expect(shadow.querySelector('.banner.sev-high')).not.toBeNull();
    expect(shadow.textContent).toContain('high item');
    expect(shadow.textContent).toContain('low item');
  });

  it('uses the low-severity class when only gap_fills are present', () => {
    const result = baseResult({
      neutral: false,
      gap_fills: [{ rule_id: 'g1', function: 'sun_protection', message: 'No SPF detected in your AM routine.' }],
    });
    const { host } = buildBanner({ result, routineSize: 3 });
    document.body.appendChild(host);
    const shadow = host.shadowRoot!;
    expect(shadow.querySelector('.banner.sev-low')).not.toBeNull();
    expect(shadow.textContent).toContain('No SPF detected');
  });
});

describe('buildBanner — content + disclaimer', () => {
  it('renders the §16.4 short disclaimer verbatim', () => {
    const { host } = buildBanner({ result: baseResult(), routineSize: 0 });
    document.body.appendChild(host);
    expect(host.shadowRoot!.textContent).toContain(SHORT_DISCLAIMER);
    expect(host.shadowRoot!.textContent).toContain(
      'Informational only. Not medical advice. Patch test new products.',
    );
  });

  it('renders an expandable Why? section with long explanation and source links', () => {
    const result = baseResult({
      neutral: false,
      warnings: [
        {
          rule_id: 'r1',
          type: 'conflict',
          severity: 'medium',
          short_message: 'Pair flagged',
          long_explanation: 'Detailed reasoning here.',
          sources: ['https://www.aad.org/example'],
        },
      ],
    });
    const { host } = buildBanner({ result, routineSize: 3 });
    document.body.appendChild(host);
    const shadow = host.shadowRoot!;
    const details = shadow.querySelector('details.why');
    expect(details).not.toBeNull();
    expect(details!.querySelector('summary')!.textContent).toBe('Why?');
    expect(details!.textContent).toContain('Detailed reasoning here.');
    const link = details!.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://www.aad.org/example');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('omits the Why? section when the warning has no long_explanation or sources', () => {
    const result = baseResult({
      neutral: false,
      warnings: [
        {
          rule_id: 'r1',
          type: 'redundancy',
          severity: 'low',
          short_message: 'Already in your routine',
          long_explanation: '',
          sources: [],
        },
      ],
    });
    const { host } = buildBanner({ result, routineSize: 3 });
    document.body.appendChild(host);
    expect(host.shadowRoot!.querySelector('details.why')).toBeNull();
  });

  it('does not contain any §16.2 forbidden phrasings', () => {
    const result = baseResult({
      neutral: false,
      warnings: [
        {
          rule_id: 'r1',
          type: 'conflict',
          severity: 'medium',
          short_message: 'AHA + retinoid in the same routine slot.',
          long_explanation: 'May cause irritation when stacked.',
          sources: ['https://www.aad.org/'],
        },
      ],
      gap_fills: [{ rule_id: 'g1', function: 'sun_protection', message: 'No SPF detected.' }],
    });
    const { host } = buildBanner({ result, routineSize: 3 });
    document.body.appendChild(host);
    const text = (host.shadowRoot!.textContent ?? '').toLowerCase();
    const banned = [
      'toxic',
      'carcinogen',
      'endocrine disruptor',
      'treats acne',
      'cures',
      'prevents wrinkles',
      'heals skin',
      'eliminates dark spots',
      'pregnancy safe',
      'pregnancy unsafe',
      'safe for you',
      'unsafe for you',
      'will damage',
    ];
    for (const phrase of banned) {
      expect(text.includes(phrase), `forbidden phrase "${phrase}" found in banner`).toBe(false);
    }
  });
});

describe('buildBanner — dismiss + edit-routine controls', () => {
  it('removes the host and records the SKU when dismiss is clicked', async () => {
    const { host } = buildBanner({
      result: baseResult({ product: { name: 'X', brand: 'Y', sku: 'P-DISMISS-1' } }),
      routineSize: 0,
    });
    document.body.appendChild(host);
    const dismiss = host.shadowRoot!.querySelector('.dismiss') as HTMLButtonElement;
    dismiss.click();
    expect(document.getElementById(BANNER_HOST_ID)).toBeNull();
    // setDismissed is async; flush a few microtasks.
    await Promise.resolve();
    await Promise.resolve();
    expect(await isDismissed('P-DISMISS-1')).toBe(true);
  });

  it('calls onEditRoutine when the edit button is clicked', () => {
    const onEdit = vi.fn();
    const { host } = buildBanner(
      { result: baseResult(), routineSize: 0 },
      document,
      { onEditRoutine: onEdit },
    );
    document.body.appendChild(host);
    const buttons = Array.from(host.shadowRoot!.querySelectorAll('button'));
    const editBtn = buttons.find((b) => /edit your routine/i.test(b.textContent ?? ''));
    expect(editBtn).toBeDefined();
    editBtn!.click();
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe('isDismissed / setDismissed', () => {
  it('round-trips a SKU through chrome.storage.local', async () => {
    expect(await isDismissed('P-NEW')).toBe(false);
    await setDismissed('P-NEW');
    expect(await isDismissed('P-NEW')).toBe(true);
  });

  it('does not store empty SKUs', async () => {
    await setDismissed('');
    expect(await isDismissed('')).toBe(false);
  });

  it('does not duplicate a SKU on repeated dismissal', async () => {
    await setDismissed('P-DUP');
    await setDismissed('P-DUP');
    const stored = await chrome.storage.local.get('banner_dismissed_skus');
    const list = stored.banner_dismissed_skus as string[];
    expect(list.filter((s) => s === 'P-DUP')).toHaveLength(1);
  });
});

describe('findInjectionAnchor', () => {
  it('prefers the add-to-basket container', () => {
    document.body.innerHTML =
      '<h1 data-at="product_name">Foo</h1>' +
      '<div data-at="add_to_basket_btn_container"><button>Add</button></div>';
    const el = findInjectionAnchor(document) as HTMLElement;
    expect(el.getAttribute('data-at')).toBe('add_to_basket_btn_container');
  });

  it('falls back to the product name heading', () => {
    document.body.innerHTML = '<h1 data-at="product_name">Foo</h1>';
    const el = findInjectionAnchor(document) as HTMLElement;
    expect(el.tagName).toBe('H1');
  });

  it('returns null when no anchor exists', () => {
    document.body.innerHTML = '<p>nothing matched</p>';
    expect(findInjectionAnchor(document)).toBeNull();
  });
});

describe('showBanner', () => {
  it('returns null and renders nothing when SKU has already been dismissed', async () => {
    await setDismissed('P-SHOW-1');
    document.body.innerHTML = '<h1 data-at="product_name">Foo</h1>';
    const rendered = await showBanner({
      result: baseResult({ product: { name: 'X', brand: 'Y', sku: 'P-SHOW-1' } }),
      routineSize: 0,
    });
    expect(rendered).toBeNull();
    expect(document.getElementById(BANNER_HOST_ID)).toBeNull();
  });

  it('inserts after the anchor element', async () => {
    document.body.innerHTML =
      '<h1 data-at="product_name">Foo</h1>' +
      '<div data-at="add_to_basket_btn_container" id="basket"><button>Add</button></div>' +
      '<div id="after">trailing</div>';
    const rendered = await showBanner({ result: baseResult(), routineSize: 0 });
    expect(rendered).not.toBeNull();
    const basket = document.getElementById('basket')!;
    expect(basket.nextElementSibling?.id).toBe(BANNER_HOST_ID);
  });

  it('replaces any prior banner on repeated calls', async () => {
    document.body.innerHTML = '<h1 data-at="product_name">Foo</h1>';
    await showBanner({ result: baseResult(), routineSize: 0 });
    await showBanner({ result: baseResult(), routineSize: 0 });
    expect(document.querySelectorAll(`#${BANNER_HOST_ID}`)).toHaveLength(1);
  });

  it('falls back to body when no anchor is present', async () => {
    document.body.innerHTML = '<p>nothing matched</p>';
    const rendered = await showBanner({ result: baseResult(), routineSize: 0 });
    expect(rendered).not.toBeNull();
    expect(document.getElementById(BANNER_HOST_ID)).not.toBeNull();
  });
});
