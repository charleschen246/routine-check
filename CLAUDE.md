# Project orientation for the next agent

## What this is

A Chrome extension that tells skincare shoppers whether a product on a Sephora, Ulta, or Amazon page fits their existing routine. **Read `PROJECT_BRIEF.md` first — it is the source of truth for every scope, design, and compliance decision.** This file is just the orientation layer.

## Owner profile — important

The owner is **non-technical in both coding and skincare**. They cannot read code, cannot independently evaluate a skincare claim, and cannot tell whether a source URL is authoritative. Treat this as a permanent constraint:

- Communicate in plain English. No code jargon, no skincare jargon without translation.
- When reporting work, describe the **result and what it means for the project**, not the implementation details.
- Do not ask the owner to make technical judgement calls (schema choices, file structure, library choices). Make the reasonable call and tell them what you did.
- Do not ask the owner to evaluate a skincare claim. Verify with §18 sources yourself.

## Operating principles for this project

1. **The brief is the spec.** When in doubt, do what the brief says. When the brief is ambiguous, default to the smaller-scope / more conservative option and note it in `HANDOFF.md`.
2. **§16 (Legal & Compliance) is the most important section.** Every user-facing string must pass the §16.2 forbidden/allowed phrasings table. Never make drug claims (treats / cures / prevents / heals / eliminates). Never use scare language (toxic / carcinogen / endocrine disruptor). Never diagnose.
3. **Every claim needs a source.** §18 lists the approved domains: PubMed, AAD, DermNet NZ, INCIDecoder, Lab Muffin Beauty Science, The Beauty Brains. Never invent source URLs — fetch and verify before committing.
4. **Test case #9 (niacinamide + vitamin C) is sacred.** Do not flag this as a conflict. It is a debunked myth (§8c). Including it would tank credibility with the target audience.
5. **Supported sites: Sephora, Ulta, Amazon — and no more.** The brief says Sephora-only (§3, §15), but the owner explicitly directed the expansion to Ulta and Amazon on 2026-07-02 (see `HANDOFF.md`). That decision is settled; do not add further retailers without another explicit owner instruction. Scope creep is still the #1 failure mode.
6. **No LLMs in v1.** All analysis is rule-based and deterministic (§5).
7. **Minimal Chrome permissions.** Only `storage` and the three retail hosts (`https://www.sephora.com/*`, `https://www.ulta.com/*`, `https://www.amazon.com/*`), with content scripts injected on product-page URL patterns only. No `<all_urls>`, no `tabs`, no `activeTab` (§13, §15).
8. **No backend in v1.** Everything in `chrome.storage.local` (§5).

## Tone of voice (binding — see §16.2 for full table)

Use:
- "Often used in routines for [skin goal]"
- "Many dermatologists suggest..."
- "Some research suggests..."
- "May interact with..."
- "Supports the skin barrier"
- "Compatible / not compatible with your routine"

Avoid:
- "Treats / cures / prevents / heals / eliminates [condition]"
- "Toxic / carcinogen / endocrine disruptor"
- "Safe / unsafe for you"
- "You should use X" (use "many derms recommend X" instead)
- "Pregnancy safe / unsafe" (medical territory — never)
- Any specific named medical condition as a target ("treats rosacea", "for eczema sufferers")

## Current build state

See `HANDOFF.md` for the running ledger of what's built, what's missing, and what the next step is. Update it whenever you finish a meaningful chunk of work.

## Things that are *not* obvious from the brief

- **Multi-site support (2026-07-02) is owner-directed and overrides §3 of the brief.** Everything site-specific lives in `src/content/sites/` — one adapter file per retailer plus a registry. Extraction is layered (JSON-LD structured data → adapter selectors → generic INCI-text heuristic) so a retailer redesign degrades gracefully instead of breaking. When extraction breaks on one site, fix only that site's adapter file — the runbook is in `HANDOFF.md`. Sephora's selectors were verified live (2026-05-28); **Ulta's and Amazon's were not** (both sites block automated fetching) — they lean on the JSON-LD and heuristic layers and still need a live spot-check.
- **e2e in sandboxed environments:** if Playwright reports its browser is missing, point `ROUTINE_CHECK_CHROMIUM` at a Chromium binary (in Claude's cloud sandbox: `/opt/pw-browsers/chromium`). Leave it unset locally.
- **Schema gaps.** The data-file schemas in §7 cannot cleanly express every rule in §8b and §8d. Two known cases: the "vitamin C used PM only" timing rule (no schema slot for it) and the gap rules with conditions ("missing barrier when 2+ actives", "missing antioxidant when user opts into anti-aging"). The conditional rules were extended with a `condition` field that isn't in §7. The cleanser gap rule uses `required_function: "cleanser"` which isn't in the `IngredientFunction` union. These deviations are documented in `HANDOFF.md`.
- **`MULTI_ACTIVE` sentinel.** `conflict-rules.json` uses this string in `ingredient_a` / `ingredient_b` for the "3+ actives in same slot" rule. The analyzer needs special-case logic for it.
- **Adapalene + benzoyl peroxide.** This is the documented exception in §8b. A separate rule of `type: "synergy"` (`adapalene_benzoyl_peroxide_synergy`) is included for this exception. The analyzer must check synergy rules *first* and use them to suppress matching conflict rules — without that, an adapalene + benzoyl peroxide user would be wrongly warned (test case #5 in §14 guards against this).
- **DermNet URL slugs are inconsistent.** Many guesses 404 (verified examples: `alpha-hydroxy-acid-peels`, `vitamin-c-and-the-skin`, `ceramides`, `kojic-acid`, `sulfur`, `adapalene`, `sunscreen` all returned 404). Always fetch a DermNet URL before committing it. Working examples currently in use: `topical-retinoids`, `salicylic-acid`, `benzoyl-peroxide`, `azelaic-acid`, `chemical-peels`, `sun-protection`, `urea`.
- **Lab Muffin article slugs are not reliable.** Two guesses (`/the-science-of-niacinamide-in-skincare/`, `/peptides-in-skincare/`) both 404 and redirect to the homepage. Prefer PubMed for evidence sourcing unless you can verify a specific Lab Muffin article exists.
- **AHA / BHA / PHA sub-classes are hardcoded in `src/lib/ingredients.ts`.** The ingredient JSON doesn't have a sub-class field, so the matcher uses a fixed set (`SUB_CLASS_INCI`) mapping the labels to INCI names. Adding a new AHA/BHA/PHA to `ingredients.json` therefore *also* requires updating that set, or the rule-matching engine will silently miss it.
- **What counts as an "active" lives in `src/lib/ingredients.ts:isActive`, not in the data.** A short list: anything in category `exfoliant`, `retinoid`, `antioxidant`, or `antimicrobial`, plus anything whose `function` array contains `exfoliation_chemical`, `acne_treatment`, `anti_aging`, `antioxidant`, or `pigmentation`. Plain humectants, ceramides, and emollients are intentionally *not* actives. This drives the "3+ actives in slot" rule and the "2+ actives in routine" gap condition. If you change this definition, re-run `npm test` — several §14 cases hinge on it.
- **Viewed product has no slot; the analyzer treats it as `either`.** The Sephora content script can't know whether a user plans to use a product AM or PM, so the `intended_slot` parameter defaults to `either`, which overlaps any routine slot. This makes same-slot rules fire conservatively (preferring a false positive over a missed warning). Tests can pass an explicit `intended_slot` when the routine fixture implies one.
- **Redundancy severity auto-escalates low → medium when 2+ routine products already contain the ingredient.** This is in `analyzer.ts` (not in the data or the brief) and is what test case #10 in §14 actually exercises. If you simplify the analyzer in the future, keep this rule or the test will fail.

## File layout (current)

```
skincare-extension/
├── PROJECT_BRIEF.md           # source of truth
├── CLAUDE.md                  # this file
├── HANDOFF.md                 # running state ledger
├── package.json               # npm scripts: dev / build / test
├── manifest.json              # MV3, storage + sephora/ulta/amazon product pages
├── vite.config.ts, tsconfig.json, tailwind/postcss configs
├── src/
│   ├── background/service-worker.ts   # analysis round-trip + routine-editor open
│   ├── content/
│   │   ├── main.ts           # shared runtime for all sites (hydration wait, expand, analyze, banner)
│   │   ├── extract.ts        # site-agnostic engine (JSON-LD → selectors → heuristic)
│   │   ├── banner.ts         # shadow-DOM banner (per-site anchors + add-to-cart fallback)
│   │   └── sites/            # ONE FILE PER RETAILER: sephora.ts / ulta.ts / amazon.ts + registry
│   ├── popup/  (index.html + React)   # routine management UI
│   ├── options/ (index.html + React)  # settings stub + disclaimer/links
│   ├── lib/
│   │   ├── types.ts          # all shared TS types (with the two §7 deviations)
│   │   ├── data.ts           # typed imports of the three JSON files
│   │   ├── storage.ts        # chrome.storage.local wrappers
│   │   ├── ingredients.ts    # INCI / alias / sub-class matching + isActive
│   │   └── analyzer.ts       # the rule engine (Day 4)
│   └── data/
│       ├── ingredients.json
│       ├── conflict-rules.json
│       └── gap-rules.json
├── tests/                    # Vitest: analyzer, popup, extract, banner, sites
│   ├── analyzer.test.ts      # 15 §14 acceptance cases (all passing)
│   ├── sites.test.ts         # adapter registry + Ulta/Amazon/JSON-LD coverage
│   └── fixtures/sample-routines.ts
├── e2e/                      # Playwright specs + per-site HTML fixtures
└── dist/                     # produced by `npm run build`
```

## Verifying changes — always test, always confirm

The owner is non-technical and cannot reliably click through every change to verify it works. **You are responsible for confirming everything works before you say a task is done.** Self-verification is the default, not an extra step.

### The non-negotiables

Before reporting any code change as done, run both:

- `npm test` — the full Vitest suite must be green. The current count is **101 tests passing** (analyzer, popup, extraction, banner, options, multi-site adapters); the number will grow as more features land. If a test fails after a change, do not ship — diagnose and fix the root cause rather than skipping/relaxing the test. There is also a 7-test Playwright e2e suite: `npm run build` then `npm run test:e2e`.
- `npm run build` — runs the TypeScript type-check and produces `dist/`. If types break, fix them rather than loosening them with `any` or `// @ts-ignore`.

### Add new tests as you add new features

Every new feature, new component, or new module must come with automated tests in the same change. Writing a feature without tests is incomplete work, not "done — tests later." Specifically:

- React UI work (popup, options, banner) → component tests with `@testing-library/react` + `jsdom`. Simulate the real user flow (type, click, toggle) and assert outcomes.
- Pure logic (rule engine, parsers, ingredient matching) → unit tests with concrete fixtures, including edge cases and the §14 acceptance cases when relevant.
- Anything touching `chrome.*` APIs → use the mock in `tests/setup.ts` (extend it if a new API is needed). Test helpers live on `globalThis.__testHelpers` to avoid the Windows module-duplication issue — see `HANDOFF.md` for the why.
- New tests must be runnable via the existing `npm test`. Don't add separate test runners.

### What automated tests cannot catch

Be honest in the end-of-task summary about what you did and did not verify:

- Visual layout, spacing, contrast, font rendering in the real Chrome popup
- Real `chrome.storage.local` behavior (the mock is faithful but not identical)
- The on-page banner against *live* retailer pages (the Playwright e2e suite uses local HTML fixtures shaped like each site, not the real sites — live layouts can drift from the fixtures)
- Keyboard focus and accessibility edge cases not covered by the test

For changes in those areas, either ask the owner to spot-check with clear plain-English instructions ("open `chrome://extensions`, turn on Developer mode, click Load unpacked, pick the `dist` folder, then click the puzzle-piece icon and pin Routine Check"), or note explicitly in the summary that visual verification is still pending. Never claim a UI feature works visually when you only verified it with jsdom.
