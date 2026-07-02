// Content-script runtime, shared by every supported retail site. Resolves
// the site adapter from the URL, waits for the SPA to hydrate the ingredient
// list into the DOM, sends the extracted product to the background service
// worker for analysis, and hands the result to the banner.
//
// Logs are JSON-stringified so e2e tests can parse them from captured
// console output — content scripts run in an isolated world, so anything
// written to `window` here isn't visible to test scripts in the main world.
// The logs double as the field diagnostic: when a site redesign breaks
// extraction, the "[Routine Check]" lines in the page's devtools console
// say which site and which step failed.

import type { AnalysisResult, ExtractedProduct } from '@/lib/types';
import type { SiteAdapter } from './sites';
import { productAdapterForUrl } from './sites';
import { extractProduct } from './extract';
import { showBanner } from './banner';

// Retail sites are React SPAs whose ingredient section is sometimes
// lazy-rendered after the rest of the page settles. Eight seconds covers
// slow hydration on flaky networks without leaving the observer running
// forever.
const HYDRATION_TIMEOUT_MS = 8000;

// Sites keep the ingredient list collapsed behind an accordion; the panel
// content often isn't in the DOM until the trigger is clicked. Two passes:
// the adapter's own trigger selectors (which must be idempotent), then a
// generic sweep for closed disclosure elements labeled exactly
// "Ingredients". The aria-expanded / details.open guards make re-runs from
// the MutationObserver safe — an unguarded click would toggle an open panel
// shut again.
function tryExpandIngredients(adapter: SiteAdapter, doc: Document = document): void {
  for (const sel of adapter.expandTriggerSelectors) {
    const trigger = doc.querySelector(sel);
    if (trigger instanceof HTMLElement) trigger.click();
  }

  const generics = doc.querySelectorAll('button[aria-expanded="false"], summary');
  for (const el of Array.from(generics)) {
    if (!(el instanceof HTMLElement)) continue;
    const label = el.textContent?.trim().toLowerCase() ?? '';
    if (label !== 'ingredients') continue;
    if (el.tagName === 'SUMMARY') {
      const details = el.closest('details');
      if (details && !details.open) el.click();
    } else {
      el.click();
    }
  }
}

async function main(): Promise<void> {
  const adapter = productAdapterForUrl(location.href);
  if (!adapter) return;

  console.log('[Routine Check] site:', adapter.id);
  tryExpandIngredients(adapter);

  const product = await waitForProduct(adapter);
  if (!product) {
    console.log(
      `[Routine Check] no ingredient list found within timeout (site: ${adapter.id})`,
    );
    return;
  }

  console.log('[Routine Check] extracted product:', JSON.stringify(product));

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_PRODUCT',
      product,
    });
    if (response?.ok) {
      const result = response.result as AnalysisResult;
      const routineSize = typeof response.routine_size === 'number'
        ? response.routine_size
        : 0;
      console.log('[Routine Check] analysis:', JSON.stringify(result));
      await showBanner(
        { result, routineSize },
        document,
        { anchorSelectors: adapter.anchorSelectors },
      );
    } else {
      console.warn('[Routine Check] background returned no result', response);
    }
  } catch (err) {
    console.warn('[Routine Check] message to background failed', err);
  }
}

function waitForProduct(adapter: SiteAdapter): Promise<ExtractedProduct | null> {
  return new Promise((resolve) => {
    const tryNow = extractProduct(document, location.href, adapter);
    if (tryNow.product) {
      resolve(tryNow.product);
      return;
    }

    let settled = false;
    const finish = (value: ExtractedProduct | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(value);
    };

    const observer = new MutationObserver(() => {
      tryExpandIngredients(adapter);
      const attempt = extractProduct(document, location.href, adapter);
      if (attempt.product) finish(attempt.product);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => finish(null), HYDRATION_TIMEOUT_MS);
  });
}

main();
