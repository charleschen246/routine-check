import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the Routine Check Chrome extension.
 *
 * Notes:
 * - We do NOT configure a `webServer` here. Chrome extension tests rely on a
 *   custom persistent context launched in `e2e/fixtures/extension.ts`, not on
 *   Playwright's default `page` fixture.
 * - Only one Chromium project — Firefox / WebKit cannot load Chrome extensions.
 * - The smoke test loads the built extension from `dist/`. Run `npm run build`
 *   before `npm run test:e2e`.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium-extension',
    },
  ],
});
