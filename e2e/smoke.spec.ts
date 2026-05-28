import { test, expect } from './fixtures/extension.js';

/**
 * Smoke test: proves the Playwright + Chrome extension harness works.
 *
 * We do NOT assert anything about the content script's extraction behavior
 * here — that belongs in the Day 6/7 tests, written after the real content
 * script lands. All this test checks is that:
 *
 *   1. Chromium launches with the unpacked extension from `dist/`.
 *   2. The MV3 service worker registers, so we can resolve a non-empty
 *      extension ID from its URL.
 *   3. The extension's own popup page is reachable (sanity check that the
 *      extension's resources are actually served).
 */
test('extension loads and service worker registers', async ({ context, extensionId }) => {
  // 1 + 2: extensionId is resolved from the service-worker URL by the fixture.
  expect(extensionId).toMatch(/^[a-p]{32}$/);

  // 3: we can open the extension's own popup page over chrome-extension://.
  const page = await context.newPage();
  const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`;
  const response = await page.goto(popupUrl);
  // Some Chromium versions return null for chrome-extension:// navigations
  // (no network response). Either null or an OK response is acceptable —
  // the real signal is that the page actually rendered.
  if (response) {
    expect(response.ok()).toBeTruthy();
  }
  // The popup mounts a React app into <body>; just confirm the document is
  // there and the URL stuck.
  expect(page.url()).toBe(popupUrl);
  await page.close();
});
