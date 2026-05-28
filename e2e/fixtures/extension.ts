import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Playwright fixture that launches Chromium with the unpacked extension
 * loaded from `dist/`. Tests get two extras on top of the standard fixtures:
 *
 *   - `context`     — a persistent BrowserContext with the extension loaded
 *   - `extensionId` — the extension's runtime ID, resolved from the service
 *                     worker's URL (`chrome-extension://<id>/...`)
 *
 * This file deliberately does NOT use `page` from the default fixtures; with
 * `launchPersistentContext` the first page lives on `context.pages()[0]`.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
// e2e/fixtures/extension.ts  -> repo root is two levels up
const repoRoot = path.resolve(here, '..', '..');
const extensionPath = path.join(repoRoot, 'dist');

type ExtensionFixtures = {
  context: BrowserContext;
  extensionId: string;
};

export const test = base.extend<ExtensionFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    // MV3 extensions only load in Chromium's "new" headless mode (or
    // headed). Old headless silently drops the service worker — symptom is
    // `context.serviceWorkers()` staying empty forever. We use the new
    // headless mode via the `--headless=new` flag.
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--headless=new',
        // Required so other extensions (e.g. dev-installed) don't interfere.
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // For MV3, the extension registers a service worker. We can read its URL
    // (chrome-extension://<id>/...) to discover the ID.
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 10_000 });
    }
    const url = worker.url();
    // url looks like: chrome-extension://abcdefghijklmnop.../service-worker-loader.js
    const match = url.match(/^chrome-extension:\/\/([^/]+)\//);
    if (!match) {
      throw new Error(`Could not parse extension ID from worker URL: ${url}`);
    }
    await use(match[1]);
  },
});

export const expect = test.expect;
