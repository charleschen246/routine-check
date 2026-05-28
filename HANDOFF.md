# Handoff — skincare extension

**Last updated:** 2026-05-27
**Project days completed:** §19 Days 1–8 (scaffold + seed data + analyzer + popup UI + Sephora content script + banner + privacy/terms docs)
**Project days remaining:** Days 9–10 + launch prep

---

## What is built

### Seed data — `src/data/`

- `ingredients.json` — 45 entries, every source URL verified (built in a prior session; moved from `data/` into `src/data/` so Vite can import it).
- `conflict-rules.json` — 14 rules (13 from §8b + 1 synergy override for adapalene + benzoyl peroxide).
- `gap-rules.json` — 5 rules (all from §8d), with a `condition` field added to the schema for the two qualifier-based rules.

The encoding choices from the previous session still hold:
- `MULTI_ACTIVE` sentinel used for the "3+ actives same slot" rule
- `AHA` / `BHA` / `PHA` sub-class labels appear alongside category names and exact INCI names in the rule selectors
- `adapalene_benzoyl_peroxide_synergy` (type `synergy`) is the override; the analyzer evaluates synergy rules first and uses them to suppress otherwise-firing conflict rules
- `missing_cleanser` uses `required_function: "cleanser"`, which has been added to the `IngredientFunction` union

### Build pipeline — Vite + @crxjs/vite-plugin

`package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `manifest.json` (MV3, `storage` + `https://www.sephora.com/*` only — no other permissions).

`npm run build` produces a working `dist/` that loads in Chrome via `chrome://extensions` → Load unpacked. Verified: dist contains the manifest with bundled service worker, popup HTML, options HTML, and content script.

`npm test` runs the full Vitest suite — 15 analyzer tests + 20 popup component tests + 23 extract tests + 20 banner tests + 2 options tests = **80/80 passing**. Component tests use `@testing-library/react` + `jsdom`; chrome APIs are stubbed via `tests/setup.ts`. Setup file uses `vi.stubGlobal('chrome', …)` and exposes test helpers on `globalThis.__testHelpers` to avoid a Windows-only module-duplication bug where importing `./setup` directly yielded a second module instance with separate mocks.

`npm run test:e2e` runs the Playwright suite (5 tests) against the built `dist/` extension in a real Chromium. **Run `npm run build` first** — Playwright loads `dist/` directly.

`npm run dev` will start Vite's dev server with HMR for the popup; the extension itself still needs `npm run build` and an unpacked load when iterating on the manifest or content script.

### Source code — `src/`

- `src/lib/types.ts` — every shared TypeScript type from §7. Two documented deviations: `cleanser` added to `IngredientFunction`; optional `condition: string` added to `GapRule`.
- `src/lib/data.ts` — typed imports of the three JSON data files.
- `src/lib/storage.ts` — thin wrappers around `chrome.storage.local` for the routine and preferences.
- `src/lib/links.ts` — single source of truth for `PRIVACY_URL` and `TERMS_URL`. Currently set to `https://charleschen246.github.io/routine-check/{privacy-policy,terms-of-service}.html`, which is the URL pattern GitHub Pages will produce when the `docs/` folder is served from a repo named `routine-check` under the user `charleschen246`. If either the GitHub handle or the repo name turns out to be different when the project is pushed, update both constants in this one file and every surface (popup, options, eventual store listing) follows.
- `src/lib/ingredients.ts` — case-insensitive INCI/alias lookup, the AHA/BHA/PHA sub-class sets, the active-ingredient classifier.
- `src/lib/analyzer.ts` — the rule engine (Day 4 work). Pure function: takes a product, the routine, the rule sets, the ingredient DB, optional prefs; returns an `AnalysisResult`. Synergies evaluated first; pair rules with same-slot guard; multi-active rule special-cased; gap fills gated on routine size ≥ 3 and per-rule conditions; redundancy severity escalates low → medium once two or more routine products already contain the ingredient.
- `src/popup/` — real routine-management UI (Day 5 work). `Popup.tsx` is the shell; `AddProductForm.tsx` collects name + pasted ingredient list + AM/PM/Both slot; `RoutineList.tsx` shows each saved product with a 3-way slot toggle and a remove button. Add form expands by default when the routine is empty, collapses into a `+ Add product` button once at least one product is saved. Footer (Day 8) has a `Preferences` button (calls `chrome.runtime.openOptionsPage()`), `Privacy Policy` and `Terms of Service` links (open in a new tab via `target="_blank" rel="noopener noreferrer"`, hrefs sourced from `src/lib/links.ts`), and the full §16.4 disclaimer verbatim.
- Ingredient paste is parsed by splitting on commas, semicolons, or newlines and trimming — sufficient for the comma-separated format Sephora and most brands use. Case is preserved as-pasted; downstream matching in `src/lib/ingredients.ts` is already case-insensitive.
- `src/options/` — still a settings stub, but Day 8 wired in the §16.4 disclaimer plus a `Privacy Policy` / `Terms of Service` nav row using the same `src/lib/links.ts` constants as the popup. Becomes a real settings page when v1 prefs land (deferred to a later day).
- `src/content/extract.ts` — pure DOM + string functions for Sephora extraction (Day 6 work). Exports `isProductPage`, `parseSku` (prefers `?skuId` query param, falls back to the `P<digits>` segment in the path), `parseIngredientText` (strips "Ingredients:" header, drops the "May Contain"/`+/-` colorant tail, strips parentheticals, splits on `,`/`;`/`\n`, trims trailing `*`/`+`/`†`/`‡`), `findIngredientsText` (tries `[data-at="ingredients"]` / `[data-at="ingredient_list"]` first, then walks the tree and picks the *smallest* matching element so outer containers don't win), and `extractProduct` which composes the lot.
- `src/content/sephora.ts` — Day 6 runtime, extended on Day 7 to render the banner. Gates on `isProductPage(location.href)`, tries an immediate `extractProduct`, falls back to a `MutationObserver` on `document.body` (childList + subtree) with an 8 s hydration timeout. Logs the extracted product as JSON, sends `{ type: 'ANALYZE_PRODUCT', product }` to the service worker, logs the `AnalysisResult` as JSON, then calls `showBanner({ result, routineSize })`. Logs are deliberately JSON-stringified so e2e tests can parse them — Chrome MV3 content scripts run in an *isolated world* (separate `window` from the page), so anything written to `window.*` from a content script is not visible to test scripts in the main world.
- `src/content/banner.ts` — Day 7 banner module. Pure DOM (no React) per §5. Renders an `AnalysisResult` inside a shadow root attached to a host `<div id="routine-check-banner-host">`. Public API: `showBanner({ result, routineSize })` (skips render if the SKU was previously dismissed and clears any prior banner on the page), `buildBanner` (pure factory used by tests), `findInjectionAnchor` (returns the best Sephora anchor to insert after), `isDismissed(sku)` / `setDismissed(sku)`. Dismissals are stored as a string-array under `chrome.storage.local` key `banner_dismissed_skus`. Anchor lookup order: `[data-at="add_to_basket_btn_container"]`, `[data-at="add-to-basket-btn-container"]`, `button[data-at="add-to-basket-btn"]`, `button[data-at="add_to_basket"]`, then `h1[data-at="product_name"]`; falls back to `document.body` when nothing matches. CSS lives inline in the module as a template literal and is injected as a single `<style>` inside the shadow root. Severity → class mapping per §11: high (amber border, neutral bg), medium (soft amber bg), low/gap-only (light blue bg), neutral (green bg). Banner copy is on the §16.2 "allowed" side throughout: "Worth a second look" / "Worth noting" / "Compatible with your routine" / "Routine analysis ready" + the empty-routine CTA "Add your routine to get personalized analysis." Every banner ends with the §16.4 short disclaimer verbatim and an "Edit your routine" button that fires the `OPEN_ROUTINE_EDITOR` message.
- `src/background/service-worker.ts` — Day 6 + Day 7. Handles `PING` (acks), `ANALYZE_PRODUCT` (loads routine + preferences from `chrome.storage.local`, runs `analyze()` with `intended_slot: 'either'`, returns `{ ok: true, result, routine_size }`), and `OPEN_ROUTINE_EDITOR` (tries `chrome.action.openPopup()` first, falls back to `chrome.runtime.openOptionsPage()`). Each async handler returns `true` from the listener so Chrome keeps the message channel open until `sendResponse` fires. The added `routine_size` field is what lets the banner decide between the "Compatible with your routine" message and the empty-routine CTA without leaking the routine itself back to the content script.

### Tests — `tests/`

`tests/analyzer.test.ts` covers all 15 §14 acceptance cases including the credibility guards:
- #5 adapalene + benzoyl peroxide → no warning (synergy suppression)
- #9 vitamin C + niacinamide → no warning (debunked myth)
- #13 parabens → no warning (no fearmongering)

`tests/AddProductForm.test.tsx`, `tests/RoutineList.test.tsx`, `tests/Popup.test.tsx` cover the popup: form validation, ingredient parsing (commas / semicolons / newlines), slot picker, slot-toggle persistence, remove flow, options-page link, full §16.4 disclaimer rendering, and Day 8's Privacy / Terms footer links (correct hrefs, `target="_blank"`, `rel` contains `noopener`). `tests/Options.test.tsx` mirrors the disclaimer + link assertions for the options page. `tests/setup.ts` provides the chrome mock + global test helpers.

`tests/extract.test.ts` (Day 6) covers the pure extraction module — 23 jsdom tests across `isProductPage`, `parseSku`, `parseIngredientText` (header strip, may-contain drop, parenthetical strip, comma/semicolon/newline split, trailing-marker strip, empty-token drop), `findIngredientsText` (data-at hit, text-content fallback, smallest-element preference, no-match), and `extractProduct` (happy path + each null reason).

`tests/banner.test.ts` (Day 7) covers the banner module — 20 jsdom tests across `buildBanner` (severity → class mapping, empty-routine CTA, "Compatible with your routine" wording, expandable "Why?" with sources, §16.4 disclaimer verbatim, §16.2 forbidden-phrasings sweep, dismiss + edit-routine controls), `isDismissed` / `setDismissed` (round-trip, empty SKU rejection, deduplication), `findInjectionAnchor` (anchor priority + null), and `showBanner` (per-SKU dismissal short-circuit, insert-after anchor, replace-on-re-call, body fallback).

All 80 tests pass. Run via `npm test`.

- **Playwright e2e harness** — `@playwright/test` (Chromium only) is installed, with `playwright.config.ts`, a fixture (`e2e/fixtures/extension.ts`) that launches Chromium with the unpacked `dist/` extension loaded, a Sephora-shaped HTML fixture (`e2e/fixtures/sephora-product.html`), a smoke test (`e2e/smoke.spec.ts`) that confirms the extension's service worker registers, a Day 6 extraction test (`e2e/sephora-extract.spec.ts`) with two cases, and a Day 7 banner test (`e2e/banner.spec.ts`) with two cases: (a) intercepts the Sephora URL with the fixture HTML, asserts the shadow-DOM banner host appears, contains the §16.4 disclaimer, and shows the empty-routine CTA; (b) seeds a niacinamide routine via the popup, navigates the same page to the Sephora fixture, asserts the banner surfaces "Niacinamide" via the `multiple_niacinamide` redundancy, then clicks the in-shadow `.dismiss` button and confirms the banner stays gone after a reload (per-SKU dismissal persistence). Playwright's CSS engine pierces shadow DOM by default, so `host.locator('.dismiss')` reaches into the shadow root without extra plumbing. Run `npm run build` first, then `npm run test:e2e`. The fixture launches with `--headless=new` because MV3 service workers do not load in old headless mode.

---

## What is NOT built

In §19 order:

- **Day 8 (published 2026-05-27):** Legal docs are written, the project is pushed to `github.com/charleschen246/routine-check` (public), and GitHub Pages is enabled from `main:/docs`. `docs/privacy-policy.md` and `docs/terms-of-service.md` use the §16.5 / §16.6 templates with `cchen4172@gmail.com` as the contact and New York as the governing-law venue. The popup footer and the options page both link to `https://charleschen246.github.io/routine-check/{privacy-policy,terms-of-service}.html` via constants in `src/lib/links.ts`. The §16.4 in-product disclaimer is verbatim in both popup and options.
- **Day 9:** §16.10 pre-submission checklist walkthrough.
- **Day 10+:** Chrome Web Store submission.

**Day 7 caveats — still pending manual confirmation:**
- The banner's injection anchor (`data-at="add_to_basket_btn_container"`) is the documented §9 selector and is what the e2e fixture mirrors, but the real Sephora DOM has not been verified by inspection — visit two or three live product pages and confirm the banner lands somewhere sensible (below "Add to Bag"). The anchor list in `src/content/banner.ts:findInjectionAnchor` already includes hyphen/underscore variants and the product-name `h1` as fallbacks, but a real-page check is still owed.
- Visual layout / contrast / mobile-resize behavior have not been validated in a real Chrome window. jsdom can verify structure and text, not pixels.
- `chrome.action.openPopup()` from the "Edit your routine" button is best-effort — Chrome only allows it from a user gesture in the active tab and may silently refuse. The service worker falls back to `chrome.runtime.openOptionsPage()`, but the options page is still a §11 stub, so the user lands on a near-empty screen until Day 7+ polish or Day 9.

Extension icons (`public/icons/icon-16.png`, `48`, `128`) are not generated yet; the `icons` block was removed from the manifest so the build wouldn't fail. Add icons before store submission.

---

## What the next agent should do

In priority order:

1. **Read `PROJECT_BRIEF.md` end-to-end** if you haven't — §16 is non-negotiable.
2. **Read `CLAUDE.md`** for owner-communication rules.
3. **Verify Days 6 + 7 against a real Sephora page.** The selectors in `src/content/extract.ts` and `src/content/banner.ts:findInjectionAnchor` are the §9 documented ones (`h1[data-at="product_name"]`, `a[data-at="brand_name"]`, `[data-at="ingredients"]`, `[data-at="add_to_basket_btn_container"]`), but Sephora ships UI updates regularly. Manually visit two or three product pages, open the page's devtools console, and confirm both the "[Routine Check] extracted product:" log and the banner host (`#routine-check-banner-host`) appear in a sensible place (banner just below "Add to Bag"). If it doesn't, update the anchor list + the e2e fixture (`e2e/fixtures/sephora-product.html`) to match.
4. **Day 8 (Privacy Policy + ToS):** use the §16.5 and §16.6 templates; host on GitHub Pages or Notion. Link from the popup footer (already wired with a Preferences link — extend or replace), the options page, and the eventual Chrome Web Store listing.
5. Whenever you touch user-facing strings, walk the §16.2 forbidden / allowed table.

---

## Open decisions the owner has not weighed in on

- **Extension name.** Currently "Routine Check" (the working name from §13). Confirm before Chrome Web Store submission. The name appears in `manifest.json`, in both legal docs (`docs/privacy-policy.md`, `docs/terms-of-service.md`), and in the popup/options page headers.
- **Hosting for Privacy Policy + ToS.** Decision (made 2026-05-27): GitHub Pages from the `docs/` folder of a repo named `routine-check` under handle `charleschen246`. Still needs the owner to actually push the repo and enable Pages — see "Publishing the legal docs" below. If the handle or repo name ends up different, update the two constants in `src/lib/links.ts`.
- **Contact email for Privacy Policy + ToS.** Confirmed by owner (2026-05-27): `cchen4172@gmail.com`. Appears in both `docs/` files and in `docs/index.md`.
- **Governing-law jurisdiction in ToS §9.** Confirmed by owner (2026-05-27): New York.
- **Icons.** Need 16 / 48 / 128 px PNGs before store submission.

---

## Publishing the legal docs (owner action — plain-English steps)

The two legal documents are written and ready to publish. They live in
`docs/privacy-policy.md` and `docs/terms-of-service.md`. The popup and the
settings page already link to the *future* public URLs, so the only remaining
work is making those URLs actually resolve. The free option is GitHub Pages.

If the project is not yet on GitHub:

1. Create an account at https://github.com if needed. The expected handle is
   `charleschen246`. If the chosen handle is different, see the "URL note" at the
   bottom of this section.
2. Create a new repository named exactly `routine-check`. Visibility can be
   public or private — GitHub Pages works either way on paid plans; on the
   free plan, the repo must be public.
3. Push the project to that repo. (If git is not yet initialized: in the
   project folder run `git init`, `git add .`, `git commit -m "initial"`,
   then add the GitHub remote and push.)

To turn on GitHub Pages once the repo exists:

1. On github.com, open the repo and click `Settings` (top-right of the repo
   page, not account settings).
2. In the left sidebar click `Pages`.
3. Under "Build and deployment" → "Source", pick `Deploy from a branch`.
4. Under "Branch", pick `main` and the `/docs` folder. Click `Save`.
5. Wait ~1 minute. The page will refresh and show
   `Your site is live at https://charleschen246.github.io/routine-check/`.
6. Visit `https://charleschen246.github.io/routine-check/privacy-policy.html` and
   `https://charleschen246.github.io/routine-check/terms-of-service.html` and
   confirm both render.

**URL note.** If the GitHub handle or repo name ends up different from
`charleschen246` / `routine-check`, edit `src/lib/links.ts` (the only two
URLs in the file) to match the live URLs, then re-run `npm run build`.
The popup, options page, and store listing will all update.

## Verifying the build locally

For an owner who doesn't code, these are the only commands needed:

1. `npm install` once (installs dependencies; safe to skip if already done).
2. `npm test` — runs the unit tests. Should print "Tests 80 passed".
3. `npm run build` — produces the `dist/` folder.
4. `npm run test:e2e` *(optional)* — runs the Playwright tests against the real built extension in headless Chromium. Requires `npm run build` to have produced `dist/` first. Should print "5 passed".
5. In Chrome: open `chrome://extensions`, turn on "Developer mode" top-right, click "Load unpacked", select the `dist/` folder. The extension icon (currently a generic puzzle piece — icons not added yet) will appear; clicking it shows the popup. Visit any `https://www.sephora.com/product/...` page — the analysis banner should appear near the "Add to Bag" button. Open the page's devtools console and you should also see lines starting with `[Routine Check] extracted product:` and `[Routine Check] analysis:`.

---

## Conversation memory the next agent should be aware of

Persistent memory store lives at `~/.claude/projects/E--claude-projects-skin-care-extension/memory/`. Key item: **owner is non-technical** — every response should be in plain English. See `memory/user_background.md`.
