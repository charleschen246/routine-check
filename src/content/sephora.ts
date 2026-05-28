// Sephora content script. Detects a product page, waits for React hydration
// to drop the ingredient list into the DOM, sends it to the background
// service worker for analysis, and (Day 7) hands the result to the banner.
//
// Logs are JSON-stringified so e2e tests can parse them from captured
// console output — content scripts run in an isolated world, so anything
// written to `window` here isn't visible to test scripts in the main world.

import type { AnalysisResult, ExtractedProduct } from '@/lib/types';
import { extractProduct, isProductPage } from './extract';
import { showBanner } from './banner';

// Sephora is a React SPA whose ingredient accordion is sometimes lazy-rendered
// after the rest of the page settles. Eight seconds covers slow hydration on
// flaky networks without leaving the observer running forever.
const HYDRATION_TIMEOUT_MS = 8000;

// Sephora keeps the ingredient list collapsed behind an accordion. Click the
// trigger so the panel content renders into the DOM — without this, the
// extractor has nothing to read. Selector is the same data-at attribute the
// trigger button has shipped with for at least the last layout revision; the
// aria-expanded guard makes the click idempotent (a re-click would collapse
// the panel and undo the previous open).
function tryExpandIngredients(doc: Document = document): void {
  const trigger = doc.querySelector(
    '[data-at="ingredients"][aria-expanded="false"]',
  );
  if (trigger instanceof HTMLElement) trigger.click();
}

async function main(): Promise<void> {
  if (!isProductPage(location.href)) return;

  tryExpandIngredients();

  const product = await waitForProduct();
  if (!product) {
    console.log('[Routine Check] no ingredient list found within timeout');
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
      await showBanner({ result, routineSize });
    } else {
      console.warn('[Routine Check] background returned no result', response);
    }
  } catch (err) {
    console.warn('[Routine Check] message to background failed', err);
  }
}

function waitForProduct(): Promise<ExtractedProduct | null> {
  return new Promise((resolve) => {
    const tryNow = extractProduct(document, location.href);
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
      tryExpandIngredients();
      const attempt = extractProduct(document, location.href);
      if (attempt.product) finish(attempt.product);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = setTimeout(() => finish(null), HYDRATION_TIMEOUT_MS);
  });
}

main();
