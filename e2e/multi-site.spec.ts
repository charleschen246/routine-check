import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page, ConsoleMessage } from '@playwright/test';
import { test, expect } from './fixtures/extension.js';

// Multi-site e2e: proves the shared content script + adapter registry works
// end-to-end on Ulta- and Amazon-shaped pages in a real Chromium — content
// script injected against the new manifest match patterns, extraction
// through the layered engine, service-worker round trip, banner injection.
// The Sephora path is covered by sephora-extract.spec.ts / banner.spec.ts.

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadFixture(name: string): Promise<string> {
  return fs.readFile(path.join(here, 'fixtures', name), 'utf8');
}

async function serveFixture(page: Page, pattern: string, html: string): Promise<void> {
  await page.route(pattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: html,
    }),
  );
}

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

interface ProductShape {
  name: string;
  brand: string;
  sku: string;
  ingredients_inci: string[];
}

test('Ulta: extracts via JSON-LD + heuristic and injects the banner after the Add to bag button', async ({
  context,
}) => {
  const html = await loadFixture('ulta-product.html');
  const page = await context.newPage();
  const waitForJsonLog = captureLogs(page);
  await serveFixture(page, 'https://www.ulta.com/p/**', html);

  await page.goto(
    'https://www.ulta.com/p/hydro-boost-water-gel-moisturizer-pimprod2007161?sku=2266814',
  );

  const product = await waitForJsonLog<ProductShape>(
    '[Routine Check] extracted product:',
  );
  expect(product.name).toContain('Hydro Boost');
  expect(product.brand).toBe('Neutrogena');
  expect(product.sku).toBe('2266814'); // ?sku= param wins over the path slug
  expect(product.ingredients_inci).toContain('Glycerin');
  expect(product.ingredients_inci).toContain('Sodium Hyaluronate');

  const host = page.locator('#routine-check-banner-host');
  await expect(host).toHaveCount(1);
  await expect(host).toContainText(
    'Informational only. Not medical advice. Patch test new products.',
  );
  // The fixture has no Sephora-style anchors — the banner must have landed
  // via the generic "Add to bag" text fallback, next to the buy box.
  const anchoredAfterBuyBox = await page.evaluate(() => {
    const hostEl = document.getElementById('routine-check-banner-host');
    return hostEl?.previousElementSibling?.textContent?.trim() ?? '';
  });
  expect(anchoredAfterBuyBox).toBe('Add to bag');

  await page.close();
});

test('Amazon: extracts from stable ids, cleans the byline brand, uses the ASIN as SKU', async ({
  context,
}) => {
  const html = await loadFixture('amazon-product.html');
  const page = await context.newPage();
  const waitForJsonLog = captureLogs(page);
  await serveFixture(page, 'https://www.amazon.com/**', html);

  await page.goto(
    'https://www.amazon.com/CeraVe-Moisturizing-Cream/dp/B00TTD9BRC',
  );

  const product = await waitForJsonLog<ProductShape>(
    '[Routine Check] extracted product:',
  );
  expect(product.name).toContain('CeraVe Moisturizing Cream');
  expect(product.brand).toBe('CeraVe');
  expect(product.sku).toBe('B00TTD9BRC');
  expect(product.ingredients_inci).toContain('Ceramide NP');
  expect(product.ingredients_inci).toContain('Glycerin');
  // Safety-information prose must not leak into the ingredient list.
  expect(
    product.ingredients_inci.some((t) => /external use/i.test(t)),
  ).toBe(false);

  const host = page.locator('#routine-check-banner-host');
  await expect(host).toHaveCount(1);
  await expect(host).toContainText(
    'Informational only. Not medical advice. Patch test new products.',
  );

  await page.close();
});
