import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, ConsoleMessage } from '@playwright/test';
import { test, expect } from './fixtures/extension.js';

// End-to-end tests for Day 6: prove the real Chrome runtime wires up.
//
// jsdom unit tests (tests/extract.test.ts) already cover the pure parsing
// logic. These tests cover what jsdom can't:
//   - the content script actually being injected against the host pattern
//   - the MV3 service-worker round-trip via chrome.runtime.sendMessage
//   - chrome.storage.local persistence flowing through to the analyzer
//
// Chrome content scripts run in an isolated world: their `window` is
// separate from the page's `window`. The DOM is shared but JS globals are
// not — so we read the analyzer result from JSON-stringified console
// output rather than from a `window.*` hook.

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, 'fixtures', 'sephora-product.html');

async function loadFixture(): Promise<string> {
  return fs.readFile(fixturePath, 'utf8');
}

async function serveSephoraFixture(page: Page, html: string): Promise<void> {
  await page.route('https://www.sephora.com/product/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: html,
    }),
  );
}

// Collect every console message and expose a helper that waits for one
// matching the given prefix, then parses the JSON tail of the matching line.
function captureLogs(page: Page) {
  const messages: string[] = [];
  page.on('console', (msg: ConsoleMessage) => messages.push(msg.text()));

  return async function waitForJsonLog<T>(prefix: string): Promise<T> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const hit = messages.find((m) => m.startsWith(prefix));
      if (hit) {
        const tail = hit.slice(prefix.length).trim();
        return JSON.parse(tail) as T;
      }
      await page.waitForTimeout(100);
    }
    throw new Error(
      `Timed out waiting for console log starting with "${prefix}". ` +
        `Captured ${messages.length} messages: ${messages
          .slice(-10)
          .map((m) => m.slice(0, 120))
          .join(' | ')}`,
    );
  };
}

interface AnalysisShape {
  product: { name: string; brand: string; sku: string };
  detected_actives: { inci: string }[];
  warnings: { rule_id: string; type: string; with_product?: string }[];
  gap_fills: unknown[];
  neutral: boolean;
}

test('extracts product, messages the service worker, and gets an AnalysisResult back', async ({
  context,
}) => {
  const html = await loadFixture();
  const page = await context.newPage();
  const waitForJsonLog = captureLogs(page);
  await serveSephoraFixture(page, html);

  await page.goto(
    'https://www.sephora.com/product/the-ordinary-niacinamide-P427418',
  );

  const product = await waitForJsonLog<{
    name: string;
    brand: string;
    sku: string;
    ingredients_inci: string[];
  }>('[Routine Check] extracted product:');
  expect(product.name).toContain('Niacinamide');
  expect(product.brand).toBe('The Ordinary');
  expect(product.sku).toBe('P427418');
  expect(product.ingredients_inci).toContain('Niacinamide');

  const analysis = await waitForJsonLog<AnalysisShape>(
    '[Routine Check] analysis:',
  );
  expect(analysis.product.sku).toBe('P427418');
  expect(
    analysis.detected_actives.some((a) => /niacinamide/i.test(a.inci)),
  ).toBe(true);
  // Empty routine — analyzer's gap-fill floor (≥3 routine products) and no
  // conflicts mean we expect a neutral result on a fresh install.
  expect(analysis.warnings).toEqual([]);
  expect(analysis.gap_fills).toEqual([]);
  expect(analysis.neutral).toBe(true);

  await page.close();
});

test('produces a niacinamide redundancy warning when the routine already has one', async ({
  context,
  extensionId,
}) => {
  const html = await loadFixture();
  const page = await context.newPage();

  // Seed chrome.storage.local from the extension's own popup page, where
  // the chrome.* APIs are available. Then navigate the same page to the
  // Sephora fixture — the service worker reads from the shared storage.
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await page.evaluate(
    (routine) =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ routine }, () => resolve());
      }),
    [
      {
        id: 'r-e2e-1',
        name: 'The Ordinary Niacinamide 10% + Zinc 1%',
        slot: 'PM',
        ingredients_inci: ['Niacinamide', 'Zinc PCA', 'Glycerin'],
        added_at: Date.now(),
      },
    ],
  );

  const waitForJsonLog = captureLogs(page);
  await serveSephoraFixture(page, html);
  await page.goto(
    'https://www.sephora.com/product/the-ordinary-niacinamide-P427418',
  );

  const analysis = await waitForJsonLog<AnalysisShape>(
    '[Routine Check] analysis:',
  );
  const redundancy = analysis.warnings.find(
    (w) => w.rule_id === 'multiple_niacinamide',
  );
  expect(redundancy).toBeDefined();
  expect(redundancy?.type).toBe('redundancy');
  expect(redundancy?.with_product).toContain('Niacinamide');

  await page.close();
});
