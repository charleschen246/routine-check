import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures/extension.js';

// Day 7 banner e2e. Sephora's real page is React-rendered and lives behind
// a network we don't want to depend on, so this test routes the documented
// Sephora URL to a local HTML fixture (the same one used by the Day 6
// extraction test), drives the extension end-to-end, and asserts:
//
//   1. The shadow-DOM banner appears on the page after analysis.
//   2. The banner shows the §16.4 short disclaimer verbatim.
//   3. With a seeded routine the banner surfaces the niacinamide redundancy.
//   4. Dismissing the banner persists per-SKU — it does not return on reload.

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

test('renders the analysis banner in shadow DOM with the disclaimer (empty routine)', async ({
  context,
}) => {
  const html = await loadFixture();
  const page = await context.newPage();
  await serveSephoraFixture(page, html);
  await page.goto(
    'https://www.sephora.com/product/the-ordinary-niacinamide-P427418',
  );

  const host = page.locator('#routine-check-banner-host');
  await expect(host).toHaveCount(1);
  // Playwright's CSS engine pierces shadow DOM by default, so descendant
  // queries reach into the shadow root.
  await expect(host.locator('.banner')).toBeVisible();
  await expect(host).toContainText(
    'Informational only. Not medical advice. Patch test new products.',
  );
  // Empty-routine CTA from PROJECT_BRIEF.md §14 test case #15.
  await expect(host).toContainText('Add your routine to get personalized analysis');

  await page.close();
});

test('surfaces the niacinamide redundancy when the routine already has one, and per-SKU dismissal persists', async ({
  context,
  extensionId,
}) => {
  const html = await loadFixture();
  const page = await context.newPage();

  // Seed chrome.storage.local via the extension's own popup page (where the
  // chrome.* APIs are available).
  await page.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
  await page.evaluate(
    (routine) =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ routine }, () => resolve());
      }),
    [
      {
        id: 'r-banner-1',
        name: 'The Ordinary Niacinamide 10% + Zinc 1%',
        slot: 'PM',
        ingredients_inci: ['Niacinamide', 'Zinc PCA', 'Glycerin'],
        added_at: Date.now(),
      },
    ],
  );

  await serveSephoraFixture(page, html);
  await page.goto(
    'https://www.sephora.com/product/the-ordinary-niacinamide-P427418',
  );

  const host = page.locator('#routine-check-banner-host');
  await expect(host).toHaveCount(1);
  // The analyzer's `multiple_niacinamide` rule names the routine product.
  await expect(host).toContainText('Niacinamide');

  // Click the dismiss button (shadow-DOM-piercing CSS selector).
  await host.locator('.dismiss').click();
  await expect(host).toHaveCount(0);

  // Reload — content script runs again; per-SKU dismissal should suppress.
  await page.reload();
  // Give the content script time to attempt rendering before asserting absence.
  await page.waitForTimeout(2000);
  await expect(host).toHaveCount(0);

  await page.close();
});
