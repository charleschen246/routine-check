# Skincare Routine Compatibility Extension — Project Brief

> **Hand-off context:** You are picking up an indie side-project. The owner is a US-based analytics engineer with strong programming skills, ~5 hours/week of ongoing time after launch, and a 2–3 month target for first revenue. They have a budget of up to ~$1,000 for tooling/infra. This brief contains every decision that has already been made. Execute against it. Where it says "deferred," do not build it in v1.

---

## 1. Mission

Build a Chrome extension that helps skincare shoppers answer one question on any product page: **"Should I actually buy this?"**

The extension knows what's already in the user's routine, and analyzes any product they're viewing in *context*:

- Is it **redundant** with something they already own?
- Does it **conflict** with active ingredients in their current routine?
- Does it **fill a gap** in their routine (e.g., no SPF, no occlusive)?
- Is there a **cheaper or better-formulated alternative** with similar actives?

Existing competitors (SkincareMate, Clearify, Clara) all analyze products *in isolation* — they give a "match score" based on the user's skin type and flag concerning ingredients. **None of them know what's already in the user's bathroom.** That gap is the entire product thesis.

---

## 2. Differentiator (read before scoping anything)

| Capability | SkincareMate | Clearify | Clara | **This product** |
|---|---|---|---|---|
| Ingredient flagging on shop pages | ✅ | ✅ | ✅ | ✅ |
| Skin-type match score | ✅ | ✅ | ✅ | ✅ (v2) |
| **Routine vault (knows current products)** | ❌ | ❌ | ❌ | **✅** |
| **Conflict-with-current-routine detection** | ❌ | ❌ | ❌ | **✅** |
| **Redundancy detection** | ❌ | ❌ | ❌ | **✅** |
| **Gap detection** | ❌ | ❌ | ❌ | **✅** |

The **routine vault** is also the moat — once a user has 8+ products saved, switching cost is real.

If at any point the build starts looking like "another ingredient flagger," stop. The routine awareness is the entire reason this exists.

---

## 3. v1 Scope

### In scope

1. **Sephora only.** sephora.com product pages. No Ulta, no Amazon, no international Sephora domains in v1.
2. **Manual routine entry.** User pastes 5–15 product names into a popup, optionally assigns each to AM / PM / both. No in-page "add to routine" button yet.
3. **Ingredient extraction** from Sephora product pages via DOM scraping.
4. **Three analysis outputs** rendered as an inline banner near the "Add to Bag" button:
   - **Redundancy check** — "You already use [Product] which contains the same primary active ([ingredient])."
   - **Conflict check** — "This contains [X]. Your routine includes [Y]. Many derms recommend separating these (link)."
   - **Gap fill** — "This would add [function] to your routine, which currently has no [SPF / occlusive / antioxidant]." Only fires when a real gap exists.
5. **Seeded ingredient database** (~50 actives, see §8) bundled as JSON in the extension package. No backend.
6. **Local storage only** via `chrome.storage.local`. No accounts, no auth, no sync.
7. **Free tier only** at launch. No paywall, no Stripe, no license keys in v1.
8. **Privacy Policy and Terms of Service** published before Chrome Web Store submission. Required for compliance (see §16). Hosted as a public GitHub Pages or Notion page; linked from the popup and the store listing.
9. **Compliance review** of all user-facing copy against §16.2 forbidden/allowed phrasings before submission.

### Explicitly out of scope (do not build)

- Other retailers (Ulta, Amazon, Target, brand DTC sites)
- Barcode scanning, photo-of-product OCR
- Backend / sync / accounts
- Subscription gating, payments, Stripe
- Affiliate link insertion
- Skin-type quiz / personalized match score (saved for v2)
- Routine sharing, social features
- Reviews, community
- AI chatbot / Q&A
- Multi-language

Aggressively defer anything not on the "in scope" list. Scope creep is the most likely failure mode here.

---

## 4. Success Criteria (definition of done for v1)

A user can install the extension, paste 5 of their current skincare products into the popup, then:

1. Browse 10 random Sephora skincare product pages.
2. See the analysis banner load within 1 second on every one.
3. Get a **correct** redundancy warning on at least one obviously-overlapping product (e.g., they have The Ordinary Niacinamide 10% in vault, they view another niacinamide serum).
4. Get a **correct** conflict warning on at least one (e.g., they have a retinol in PM, they view an AHA toner).
5. Get a **correct** gap-fill suggestion if their routine is missing SPF.
6. See no false positives on neutral products (a basic moisturizer with no actives should not trigger any warning).
7. The disclaimer is visible.
8. The banner does not visually break Sephora's UI on any of the 10 test products.

If all 8 are true on the 10-product manual test, v1 ships.

---

## 5. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Manifest | **V3** | V2 is being phased out by Chrome; new submissions must be V3 |
| Bundler | **Vite + `@crxjs/vite-plugin`** | Fast HMR, clean MV3 support |
| Popup / options UI | **React 18 + Tailwind** | Fast to build, small bundle |
| Content scripts | **Vanilla JS/TS** | Avoids shipping React into Sephora's page; lower break-risk |
| Language | **TypeScript** throughout | The ingredient/rule types are real and TS catches a lot |
| Storage | **`chrome.storage.local`** | Simple, sufficient for v1 |
| Ingredient DB | **Bundled JSON** | Zero cost, zero latency, easy to update via extension release |
| LLM calls | **NONE in v1** | Costs money, adds latency, not needed for rule-based analysis |
| Testing | **Vitest** | Unit tests on the analyzer module |
| Payment infra | None in v1 | Add ExtensionPay or LemonSqueezy in v2 |

**LLM note:** v1 uses pure rule-based logic. The analysis is deterministic ("AHA + retinol same slot → warn"). LLMs may be introduced in v2 for natural-language explanations, but only after rule-based v1 ships.

---

## 6. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Sephora product page (sephora.com/product/...)             │
│                                                             │
│  ┌───────────────────────────────┐                          │
│  │ content/sephora.ts            │                          │
│  │  - Detect product page        │                          │
│  │  - Extract product metadata   │                          │
│  │  - Extract ingredient list    │                          │
│  │  - Inject banner DOM          │                          │
│  └─────────────┬─────────────────┘                          │
│                │ chrome.runtime.sendMessage                 │
└────────────────┼────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  background/service-worker.ts                               │
│  - Receives extracted product + ingredients                 │
│  - Loads user routine from chrome.storage.local             │
│  - Calls lib/analyzer.ts with (product, routine, rulebase)  │
│  - Returns AnalysisResult to content script                 │
└─────────────────────────────────────────────────────────────┘
                 ▲
                 │ reads
┌────────────────┴────────────────────────────────────────────┐
│  data/ingredients.json    (~50 actives, functions, etc.)    │
│  data/conflict-rules.json (~15 rules)                       │
│  data/gap-rules.json      (~5 gap definitions)              │
└─────────────────────────────────────────────────────────────┘

popup/ — user manages routine (add/remove/edit slot)
options/ — settings (skin sensitivities, climate, etc.) [stub in v1]
```

**Message flow:**
1. User lands on Sephora product page.
2. Content script detects it's a product page, waits for hydration (Sephora is React), extracts ingredients.
3. Sends `{product, ingredients[]}` to service worker.
4. Service worker loads routine from storage, calls analyzer.
5. Analyzer returns `AnalysisResult` (see §7).
6. Content script renders banner with the result.

---

## 7. Data Models

```ts
// data/ingredients.json — array of these
interface Ingredient {
  inci: string;                 // e.g., "Niacinamide"
  aliases: string[];            // e.g., ["Nicotinamide", "Vitamin B3"]
  function: IngredientFunction[];
  category: 'humectant' | 'occlusive' | 'emollient' | 'exfoliant' | 'retinoid' | 'antioxidant' | 'soothing' | 'antimicrobial' | 'sunscreen' | 'preservative' | 'fragrance' | 'other';
  typical_pct_range?: [number, number];
  comedogenic_rating?: 0 | 1 | 2 | 3 | 4 | 5;  // 0 = non, 5 = highly
  notes?: string;               // short factual note
  sources: string[];            // URLs to authoritative refs
}

type IngredientFunction =
  | 'hydration' | 'barrier_repair' | 'exfoliation_chemical'
  | 'pigmentation' | 'anti_aging' | 'acne_treatment'
  | 'antioxidant' | 'soothing' | 'sun_protection';

// data/conflict-rules.json
interface ConflictRule {
  id: string;
  ingredient_a: string;         // INCI or category
  ingredient_b: string;
  type: 'conflict' | 'redundancy' | 'synergy' | 'caution';
  same_slot_only: boolean;      // true = only if used in same AM or PM
  severity: 'low' | 'medium' | 'high';
  short_message: string;        // ≤120 chars, shown in banner
  long_explanation: string;     // shown on click
  sources: string[];
}

// data/gap-rules.json
interface GapRule {
  id: string;
  required_function: IngredientFunction;
  slot: 'AM' | 'PM' | 'either';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

// User routine (chrome.storage.local key: "routine")
interface RoutineEntry {
  id: string;
  name: string;                 // user-entered product name
  brand?: string;
  slot: 'AM' | 'PM' | 'both';
  ingredients_inci: string[];   // parsed at add-time
  added_at: number;
}

interface AnalysisResult {
  product: { name: string; brand: string; sku: string; };
  detected_actives: { inci: string; function: IngredientFunction[]; }[];
  warnings: {
    type: 'conflict' | 'redundancy';
    severity: 'low' | 'medium' | 'high';
    with_product?: string;      // which routine product this conflicts with
    short_message: string;
    long_explanation: string;
    sources: string[];
  }[];
  gap_fills: {
    function: IngredientFunction;
    message: string;
  }[];
  neutral: boolean;             // true if no flags at all
}
```

---

## 8. Seed Data (build the JSON files from this)

### 8a. Seed ingredients (~50)

Build `data/ingredients.json` from these. INCI names are canonical; aliases are how brands list them. Sources column is for the `sources` field — link to one of: INCIDecoder, NIH/PubMed, AAD (American Academy of Dermatology), or DermNet NZ.

**Exfoliants (AHA / BHA / PHA):**
- Glycolic Acid (AHA, 5–10% typical)
- Lactic Acid (AHA, 5–10%)
- Mandelic Acid (AHA, 5–10%, gentler)
- Salicylic Acid (BHA, 0.5–2%)
- Gluconolactone (PHA)
- Lactobionic Acid (PHA)

**Retinoids:**
- Retinol (OTC, 0.1–1%)
- Retinaldehyde / Retinal (OTC, 0.05–0.1%)
- Retinyl Palmitate (weakest, often marketing)
- Adapalene (OTC in US since 2016, 0.1%)
- Tretinoin (Rx only; flag products that contain it as Rx-only)
- Bakuchiol (plant-derived retinol alternative, ~0.5–1%)

**Vitamin C forms:**
- L-Ascorbic Acid (most potent, unstable, 10–20%)
- Sodium Ascorbyl Phosphate / SAP
- Magnesium Ascorbyl Phosphate / MAP
- Ascorbyl Glucoside
- Tetrahexyldecyl Ascorbate / THD Ascorbate

**Hydrators / humectants:**
- Hyaluronic Acid / Sodium Hyaluronate
- Glycerin
- Panthenol (Vitamin B5)
- Urea
- Beta-Glucan

**Barrier / occlusives / emollients:**
- Ceramide NP / AP / EOP (group as "Ceramides")
- Squalane
- Petrolatum
- Dimethicone
- Shea Butter (Butyrospermum Parkii)
- Cholesterol

**Other treatment actives:**
- Niacinamide (Vitamin B3, 2–10%)
- Azelaic Acid (10–20%)
- Tranexamic Acid
- Alpha Arbutin
- Kojic Acid
- Peptides — group as a category (palmitoyl tripeptide-1, copper peptides, etc.)
- Centella Asiatica / Cica
- Allantoin
- Madecassoside

**Antimicrobial / acne:**
- Benzoyl Peroxide (2.5–10%)
- Sulfur (2–10%)

**Sunscreen actives** (basic awareness — full SPF analysis is v2):
- Zinc Oxide
- Titanium Dioxide
- Avobenzone
- Octinoxate
- Tinosorb S / M (EU)

### 8b. Seed conflict rules (~15) — evidence-based only

These are the rules `conflict-rules.json` should contain. **Every rule needs at least one authoritative source** (PubMed, AAD, or DermNet). Do not include any rule you cannot source.

| Rule | Type | Same slot only? | Severity | Notes |
|---|---|---|---|---|
| Retinoid + AHA in same slot | conflict | yes | medium | Cumulative irritation. Suggest alternating nights. |
| Retinoid + BHA in same slot | conflict | yes | medium | Same as above. |
| Tretinoin/Retinol + Benzoyl Peroxide same slot | conflict | yes | medium | BP oxidizes most retinoids. Exception: **adapalene is stable with BP** (Epiduo is a commercial combination). |
| L-Ascorbic Acid + AHA same slot | caution | yes | low | Both low-pH, cumulative irritation. Generally OK but space them. |
| L-Ascorbic Acid + BHA same slot | caution | yes | low | Same. |
| Multiple AHAs (different products) same slot | conflict | yes | medium | Over-exfoliation risk. |
| Multiple BHAs same slot | redundancy | yes | low | Pick one. |
| Multiple niacinamide products | redundancy | no | low | Usually redundant unless intentional. |
| Multiple retinoids in routine | conflict | no | high | Stacked retinoids = irritation. Pick one. |
| Three or more actives in same slot (any combo) | caution | yes | medium | Cumulative irritation. |
| BHA + Retinoid same slot | conflict | yes | medium | Same family of concern as AHA + retinoid. |
| High-% L-Ascorbic Acid (>15%) + Retinoid same slot | conflict | yes | medium | Low pH + retinoid = irritation. |
| Benzoyl Peroxide + AHA same slot | caution | yes | low | Cumulative drying. |
| Vitamin C (LAA) used PM only | caution | no | low | Suboptimal — typically AM for UV protection synergy. Informational only. |
| Multiple hyaluronic acid products | redundancy | no | low | Usually fine but often redundant. |

### 8c. Debunked / wrong rules — DO NOT INCLUDE

These are widely-repeated skincare myths that are **not evidence-based**. Including any of them would tank credibility with informed users and would be the easiest way for this product to lose to competitors.

| Myth | Reality |
|---|---|
| **Niacinamide + Vitamin C "cancel out"** | Debunked. The 1960s study used pure niacin + high heat. Modern formulations are fine together. *Do not include this as a conflict.* |
| Parabens cause cancer | At cosmetic concentrations, no credible evidence. Don't fearmonger. |
| All sulfates damage skin | SLS/SLES at cosmetic levels are fine for non-sensitive skin. Only flag if user has explicit barrier-compromise concern. |
| Silicones cause acne | Dimethicone is non-comedogenic. |
| Mineral oil is dangerous | Cosmetic-grade is safe and non-comedogenic. |
| "Toxic chemicals" / "endocrine disruptors" framing for trace ingredients | Avoid this framing entirely. It's how Clara markets itself; we deliberately differentiate by being evidence-based, not scare-based. |
| Retinol "thins" skin | Reverses the misconception. It thickens dermis; thins stratum corneum temporarily. |

### 8d. Gap rules (~5)

| Function missing | Slot | Severity | Message |
|---|---|---|---|
| `sun_protection` | AM | high | "No SPF detected in your AM routine. SPF is the single highest-impact step for preventing photoaging." |
| `barrier_repair` if 2+ actives in routine | either | medium | "Your routine has multiple actives but no barrier-support product (ceramides, panthenol, etc.). Consider adding one." |
| `hydration` | either | low | "No humectant (HA, glycerin, etc.) detected." |
| `antioxidant` if user has anti-aging concern | AM | low | "No antioxidant in AM routine. Vitamin C is the most common pick." |
| Cleanser | either | low | "No cleanser detected in routine." |

Gap detection only runs if the user has ≥3 products in their routine (avoids spammy warnings on empty vaults).

---

## 9. Sephora Integration Notes

The DOM details below should be **verified by inspection** before relying on them — Sephora ships UI updates regularly. Treat this as a starting point, not gospel.

**Product page detection:**
- URL pattern: `https://www.sephora.com/product/*`
- Wait for hydration: Sephora is a React SPA. Use a `MutationObserver` on `document.body` watching for the ingredients section to appear, with a 5s timeout fallback.

**Product metadata:**
- Product name: usually `h1[data-at="product_name"]` (verify)
- Brand: `a[data-at="brand_name"]` (verify)
- SKU: in URL — last numeric segment

**Ingredients:**
- Sephora hides ingredients in a collapsible section labeled "Ingredients" — usually under a tab/accordion
- The text content is plain INCI list separated by commas
- Sometimes the section is lazy-rendered; may need to programmatically expand or wait

**Parsing the ingredient string:**
- Strip "Ingredients:" prefix
- Split on commas
- Trim whitespace
- Normalize case (Title Case)
- Match against `aliases` and `inci` fields in `ingredients.json`

**Banner injection point:**
- Inject above or below the "Add to Bag" button container
- Use a shadow DOM root to isolate styles from Sephora's CSS
- Banner should be dismissible (X button); store dismissals per-product-SKU so it doesn't re-show on re-visit

---

## 10. Analysis Engine Logic (pseudocode)

```ts
function analyze(
  product: ExtractedProduct,
  routine: RoutineEntry[],
  rules: ConflictRule[],
  gapRules: GapRule[],
  ingredients: Ingredient[]
): AnalysisResult {
  const productActives = identifyActives(product.ingredients_inci, ingredients);
  const routineActives = routine.flatMap(r =>
    identifyActives(r.ingredients_inci, ingredients).map(a => ({...a, slot: r.slot, productName: r.name}))
  );

  const warnings = [];

  // Redundancy: any active in product also in routine?
  for (const active of productActives) {
    const matches = routineActives.filter(r => r.inci === active.inci);
    if (matches.length > 0) {
      warnings.push({
        type: 'redundancy',
        with_product: matches[0].productName,
        short_message: `You already use ${matches[0].productName}, which contains ${active.inci}.`,
        ...
      });
    }
  }

  // Conflicts: check every rule against (product actives × routine actives)
  for (const rule of rules) {
    const productHas = productActives.find(a => matches(a, rule.ingredient_a) || matches(a, rule.ingredient_b));
    const routineHas = routineActives.find(a => matches(a, rule.ingredient_a) || matches(a, rule.ingredient_b));
    if (productHas && routineHas && productHas.inci !== routineHas.inci) {
      if (rule.same_slot_only && productHas.slot !== routineHas.slot && routineHas.slot !== 'both') continue;
      warnings.push({ type: 'conflict', ...rule });
    }
  }

  // Gaps: only if routine has ≥3 products
  const gap_fills = [];
  if (routine.length >= 3) {
    for (const gap of gapRules) {
      const routineHasFunction = routineActives.some(a => a.function.includes(gap.required_function));
      const productHasFunction = productActives.some(a => a.function.includes(gap.required_function));
      if (!routineHasFunction && productHasFunction) {
        gap_fills.push({ function: gap.required_function, message: gap.message });
      }
    }
  }

  return {
    product: { name: product.name, brand: product.brand, sku: product.sku },
    detected_actives: productActives,
    warnings,
    gap_fills,
    neutral: warnings.length === 0 && gap_fills.length === 0,
  };
}
```

**Key matching rules:**
- INCI matching uses normalized lowercase + alias resolution.
- Category matching: a rule like "Retinoid + AHA" matches any ingredient with category `retinoid` against any with category `exfoliant` + function `exfoliation_chemical`.
- Severity is the max of any matching rule's severity.

---

## 11. UI / UX Decisions

### Banner

- Positioned just below "Add to Bag" on the product page.
- Uses shadow DOM to isolate from Sephora's styles.
- Color logic:
  - `high` severity → amber border, neutral background (NOT red — red implies "danger"; the goal is "worth a second look")
  - `medium` → soft amber
  - `low` and gap_fills → light blue / neutral
  - `neutral: true` → either a small green checkmark "✓ No conflicts with your routine" or hide entirely (configurable in options, default = show)
- Each warning is a one-line summary + expandable "Why?" that shows `long_explanation` and source links.
- Always shows: `Powered by [extension name] · This is not medical advice. [Edit your routine]`

### Tone of voice (this matters a lot — and is also a legal constraint)

The tone rules below are summarized; the **full forbidden/allowed phrasings table is in §16.2** and is the binding reference. The rules are not stylistic — they keep the extension on the cosmetic side of the FDA's cosmetic/drug line.

Short version:
- "Worth noting" — yes
- "May interact with" — yes
- "Some research suggests" — yes
- "Many dermatologists recommend" — yes, with a source link
- "Often used for [skin concern]" — yes
- "Many people use X for Y" — yes
- "WARNING" — no
- "Will damage your skin" — never
- "Toxic" / "harmful chemicals" / "endocrine disruptor" / "carcinogen" — never
- "Treats / cures / prevents / heals / eliminates [condition]" — **never** (these are drug claims; see §16.2)
- "You should use X" — no (prescriptive); use "many derms recommend X" instead
- "Safe / unsafe for you" — no; use "compatible / not compatible with your routine"

Sound like a knowledgeable friend who reads the actual literature, not a wellness influencer.

### Required disclaimer (verbatim, in banner footer and popup)

> This extension provides general information about cosmetic ingredients and product compatibility based on published cosmetic science. It is not medical advice and is not a substitute for consultation with a dermatologist or other qualified healthcare professional. We do not diagnose, treat, or prevent any skin condition. Individual reactions vary; always patch test new products.

Banner-footer short version (small text, every banner):

> Informational only. Not medical advice. Patch test new products.

### Popup (routine management)

- List of products in routine, each with: name, slot toggle (AM/PM/Both), remove button
- "Add product" — paste name + ingredient list (or paste from a Sephora page with one click in v2)
- Settings link

### Options page (stub in v1)

- Skin **preferences** (multi-select, optional): acne-prone, pigmentation concerns, anti-aging interest, sensitivity, dryness
- **Frame as preferences, not medical conditions.** Copy: "What are your skin goals?" not "What conditions do you have?" This keeps us on the cosmetic side of the regulatory line (see §16.3).
- These influence severity ranking in v2; in v1 they're stored but unused

---

## 12. File / Folder Structure

```
skincare-extension/
├── manifest.json
├── package.json
├── vite.config.ts
├── tsconfig.json
├── README.md
├── PROJECT_BRIEF.md           # this file
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── content/
│   │   ├── sephora.ts         # detection + extraction + injection
│   │   ├── banner.ts          # banner rendering (shadow DOM)
│   │   └── banner.css
│   ├── popup/
│   │   ├── index.html
│   │   ├── Popup.tsx
│   │   ├── RoutineList.tsx
│   │   ├── AddProductForm.tsx
│   │   └── popup.css
│   ├── options/
│   │   ├── index.html
│   │   └── Options.tsx
│   ├── lib/
│   │   ├── analyzer.ts        # the pure-function analysis engine
│   │   ├── ingredients.ts     # INCI matching, alias resolution
│   │   ├── storage.ts         # chrome.storage wrappers
│   │   └── types.ts           # all shared TS interfaces
│   └── data/
│       ├── ingredients.json
│       ├── conflict-rules.json
│       └── gap-rules.json
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
└── tests/
    ├── analyzer.test.ts       # 15+ test cases for the engine
    └── fixtures/
        └── sample-routines.ts
```

---

## 13. Build & Dev Setup

```bash
npm create vite@latest skincare-extension -- --template react-ts
cd skincare-extension
npm install -D @crxjs/vite-plugin@beta vitest
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

In `vite.config.ts`, configure `@crxjs/vite-plugin` with the manifest. Load the unpacked extension from `dist/` in `chrome://extensions/` with Developer Mode on.

**manifest.json essentials (MV3):**

```json
{
  "manifest_version": 3,
  "name": "Routine Check",
  "version": "0.1.0",
  "description": "Know if a skincare product fits your current routine.",
  "permissions": ["storage"],
  "host_permissions": ["https://www.sephora.com/*"],
  "background": { "service_worker": "src/background/service-worker.ts", "type": "module" },
  "action": { "default_popup": "src/popup/index.html" },
  "options_page": "src/options/index.html",
  "content_scripts": [{
    "matches": ["https://www.sephora.com/product/*"],
    "js": ["src/content/sephora.ts"],
    "run_at": "document_idle"
  }],
  "icons": { "16": "icons/icon-16.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" }
}
```

**Note:** Request only `storage` and the specific Sephora host. Avoid `<all_urls>`, `tabs`, or `activeTab` — minimal permissions = faster Chrome Web Store review and better risk impact score.

---

## 14. Test Cases for Validation

`tests/analyzer.test.ts` — write these before declaring v1 done.

| # | Routine | Viewing product | Expected output |
|---|---|---|---|
| 1 | empty | any product | `neutral: true`, no warnings, no gap fills (gap detection off below 3 products) |
| 2 | The Ordinary Niacinamide 10% (PM) | Glow Recipe Niacinamide Dew Drops | redundancy warning citing niacinamide |
| 3 | Tretinoin (PM) | Paula's Choice 2% BHA Liquid (used PM) | conflict warning: retinoid + BHA same slot |
| 4 | Tretinoin (PM) | Paula's Choice 2% BHA Liquid (user marks AM in vault) | no conflict (different slots) |
| 5 | Adapalene 0.1% (PM) + Benzoyl Peroxide 2.5% (PM) | irrelevant | this is the adapalene+BP exception — flagging as conflict would be wrong; the engine should NOT warn (adapalene is stable with BP) |
| 6 | Routine missing SPF, 3+ products | a sunscreen | gap_fill suggesting it fills SPF gap |
| 7 | Retinol (PM) + Glycolic Acid (PM) | Vitamin C serum (would-be AM) | no conflict between the C and the routine items at the same slot |
| 8 | any | A basic glycerin + ceramide moisturizer with no actives | `neutral: true` |
| 9 | A vitamin C serum (AM) | A niacinamide serum | **must not** flag a conflict (this is the debunked myth — test guards against regression) |
| 10 | Two niacinamide serums already in routine | viewing a third niacinamide product | redundancy with severity escalating to medium |
| 11 | empty routine | product with retinol + AHA in same ingredient list | conflict warning: in-product conflict (single-product over-formulation) |
| 12 | Routine with 4 actives but no ceramides/barrier ingredient | a ceramide moisturizer | gap_fill suggesting barrier support |
| 13 | Routine has cleanser, moisturizer, SPF, niacinamide | viewing a product with parabens | **no warning** (parabens are not in our flag list — credibility test) |
| 14 | Routine has 2 strong AHAs already (PM) | viewing a third AHA | conflict: multiple AHAs same slot, severity medium |
| 15 | Brand-new install, no routine, no settings | any product | banner shows with neutral message + "Add your routine to get personalized analysis" CTA |

Manual smoke test on 10 real Sephora pages after unit tests pass:
- Drunk Elephant C-Firma Fresh
- The Ordinary Niacinamide 10% + Zinc 1%
- Paula's Choice 2% BHA Liquid
- Sunday Riley Good Genes (Lactic Acid)
- La Roche-Posay Toleriane Double Repair Moisturizer
- Supergoop Unseen Sunscreen
- Tatcha The Water Cream
- CeraVe PM Facial Moisturizing Lotion
- Differin Gel (adapalene)
- Tower 28 SOS Spray (functionally neutral)

Visually confirm: banner injects, doesn't break layout, shows correct analysis for each.

---

## 15. What NOT To Do (anti-patterns)

1. **Never make medical / drug claims.** No "treats," "cures," "prevents," "heals," "eliminates [condition]." Tone of voice is in §11; full forbidden phrasings in §16.2. The disclaimer in §11 must appear.
2. **Never include a rule from §8c (debunked myths).** Especially the niacinamide + vitamin C one. Test case #9 guards against this.
3. **Don't use scare-language for trace ingredients.** "Endocrine disruptor," "toxic chemicals," "carcinogen" — these are how Clara markets itself; we deliberately don't. They also create FTC risk (substantiation requirements for health claims).
4. **Don't add more retailers in v1.** Sephora only. Adding Ulta sounds easy but doubles the DOM-maintenance surface for zero new differentiation.
5. **Don't bring in an LLM for v1.** All analysis must be deterministic, rule-based. Faster, cheaper, debuggable, no false statements possible (hallucinations on medical-adjacent content are a real liability risk).
6. **Don't request broad permissions.** No `<all_urls>`, no `tabs`. Chrome Web Store reviewers will flag, and the "High risk impact" badge in extension stats stores hurts conversion.
7. **Don't ship without sources.** Every conflict rule must link to at least one authoritative source. Users in skincare forums will absolutely call out unsourced claims, and credibility is the product.
8. **Don't ship placeholder data.** If the ingredient DB only has 5 entries because seeding is unfinished, v1 isn't done. Target ~50 ingredients minimum.
9. **Don't break Sephora's UI.** Use shadow DOM. Test on 10 real pages. If the banner overlaps or shifts a Sephora element, fix before shipping.
10. **Don't auto-update the routine without user confirmation.** Even if the user views a product they "obviously" own, ask before adding.
11. **Don't ship without a Privacy Policy and ToS.** Both are required by Chrome Web Store policy and by liability-management best practice. See §16.5 and §16.6 for templates.
12. **Don't diagnose anything.** No "you have rosacea, try this product." If a future feature touches conditions, the response is always "consult a dermatologist." See §16.3.
13. **Don't make brand attacks.** Focus warnings on ingredient compatibility, never on "Brand X is bad." Brand-defamation suits are rare but real, and pointless when ingredient-level framing works.
14. **Don't comment on pregnancy / nursing safety.** This is medical territory. If a user asks, the answer is "consult your OB/GYN." Future features must not flag products as "pregnancy-safe" or "unsafe during pregnancy."
15. **Don't target minors.** Privacy policy must state ≥13 minimum. Marketing copy should not target teens specifically (skincare market includes teens but extension-onboarding patterns suggest adult users).

---

## 16. Legal & Compliance

This is the single most important section of this brief. The skincare-extension category is well-trodden (Yuka, SkincareMate, Clearify, Clara, INCIDecoder all operate legally in the US), but only because each one is careful about specific framing. Getting this wrong creates real liability — not the "Chrome will reject the listing" kind, the "FTC enforcement" or "civil lawsuit from injured user" kind. This section codifies the rules.

### 16.1 Regulatory landscape

| Regulator / Framework | What they regulate | How it applies here |
|---|---|---|
| **FDA — cosmetics vs. drugs** | Manufacturer claims about products | We are not a manufacturer. We must not make drug claims about products. |
| **FDA — Clinical Decision Support (CDS) Software** | Software for healthcare professionals diagnosing/treating disease | Does not apply — we're consumer wellness, not clinical. We must not drift into diagnostic territory. |
| **FDA — General Wellness Policy** | Low-risk consumer wellness software | This is our safe harbor. Stay within it. |
| **FTC Endorsement Guides (16 CFR 255)** | Affiliate disclosures, paid recommendations, substantiation of claims | Applies to v2 affiliate revenue. Also applies to v1 to the extent we make any product-related claims. |
| **FTC Consumer Reviews Rule (Aug 2024)** | Fake or manipulated reviews | We don't host reviews in v1. |
| **Chrome Web Store policies** | App distribution, data handling | Privacy policy required. Minimal permissions. |
| **CCPA (California) + similar state laws** | Consumer data rights | Local-only storage in v1 = minimal exposure. Privacy policy must still address. |
| **GDPR (EU residents)** | EU user data | We will have EU users. Privacy policy must address. |
| **MoCRA (Modernization of Cosmetics Regulation Act of 2022)** | Cosmetic manufacturer registration, GMP, safety records | Applies to manufacturers, not analysis tools. No direct obligation. |

### 16.2 Cosmetic / drug line — FULL forbidden vs. allowed phrasings

This is the binding reference. Every user-facing string in the extension must pass this test.

The FDA classifies a product as a drug if it's "intended for use in the diagnosis, cure, mitigation, treatment, or prevention of disease, or to affect the structure or function of the body." If our extension says a cosmetic product *does* these things, we are making drug claims on behalf of the manufacturer, and we move from "third-party informational tool" into FDA-regulated speech.

**Forbidden phrasings — these turn the extension into a maker of drug claims:**

| ❌ Never write | ✅ Use this instead |
|---|---|
| "Treats acne" | "Often used by people with acne-prone skin" |
| "Cures rosacea" | "Some people use for sensitivity" |
| "Prevents wrinkles" | "Associated with anti-aging routines" |
| "Heals skin" / "Repairs skin" | "Supports the skin barrier" |
| "Eliminates dark spots" | "Often used for hyperpigmentation concerns" |
| "Reduces / removes wrinkles" | "May improve the appearance of fine lines" |
| "Will damage your skin" | "May cause irritation in some users" |
| "Toxic" / "carcinogen" / "endocrine disruptor" | (avoid entirely — scientifically contested and FTC-substantiation-risky) |
| "Safe / unsafe for you" | "Compatible / not compatible with your routine" |
| "You should use X" | "Many dermatologists recommend X for [concern]" |
| "Diagnose [condition]" | (never — diagnosis is medical territory) |
| "Pregnancy safe / unsafe" | (never — consult OB/GYN) |
| "Anti-aging" as a verb ("anti-ages your skin") | "Anti-aging routines" (as a category) |
| "Cures sun damage" | "Often used for photo-protection" |

**Allowed phrasings — these stay on the cosmetic-information side:**
- "Many people use X for [skin concern]"
- "Often included in routines for [skin goal]"
- "Some research suggests..."
- "Cosmetic chemists often recommend..."
- "Many dermatologists suggest separating these (link to source)"
- "Worth noting before purchase"
- "Compatible with your routine" / "Not compatible with your routine"
- "May interact with X in your routine"
- "Associated with [function]"
- "Supports [generic function — moisture, barrier, etc.]"
- "May improve the appearance of [feature]"

### 16.3 Clinical Decision Support line — DO NOT CROSS

A useful test: would a reasonable user think we're providing medical or clinical advice? If yes, we've crossed the line.

- ✅ We tell users about cosmetic ingredients in products they're considering
- ✅ We point out routine compatibility based on published cosmetic science
- ❌ We do NOT diagnose skin conditions
- ❌ We do NOT recommend treatments for medical conditions
- ❌ We do NOT assess medical symptoms
- ❌ We do NOT replace dermatologist consultation
- ❌ We do NOT comment on prescription medications (e.g., tretinoin) beyond noting "this is Rx-only — discuss with your dermatologist"

If a user enters "I have eczema" in a future quiz feature, the only acceptable response is "consult a dermatologist" — never a product recommendation.

### 16.4 Required disclaimers

These appear in the locations indicated. Do not shorten or paraphrase them.

**On every analysis banner** (footer line, small text — already in §11):
> Informational only. Not medical advice. Patch test new products.

**In popup, options page, and onboarding** (full version — already in §11):
> This extension provides general information about cosmetic ingredients and product compatibility based on published cosmetic science. It is not medical advice and is not a substitute for consultation with a dermatologist or other qualified healthcare professional. We do not diagnose, treat, or prevent any skin condition. Individual reactions vary; always patch test new products.

**In Chrome Web Store listing description** (first paragraph):
> This extension is an informational tool for cosmetic shopping. It does not provide medical advice or diagnose any condition. Consult a dermatologist for medical concerns.

### 16.5 Privacy Policy — REQUIRED for v1 launch

Chrome Web Store requires a privacy policy for any extension that handles user data. We do (routine + preferences in `chrome.storage.local`). Even with local-only storage, the policy is mandatory.

The policy must:
- Be hosted at a public URL (GitHub Pages or Notion public page is fine for v1; budget zero dollars)
- Be linked from the Chrome Web Store listing
- Be accessible from within the extension (popup → footer link)
- Disclose: what we collect, where it's stored, how it's secured, retention, user rights

**v1 Privacy Policy template** (starting point — have a lawyer review before crossing 1,000 users; for v1 a boilerplate tool like Termly or Iubenda is acceptable):

```markdown
# Privacy Policy for [Extension Name]
Last updated: [date]

## Summary
[Extension name] stores your skincare routine and preferences locally in your
browser. We do not transmit, sell, share, or otherwise transfer your data to
anyone, including the developer.

## What We Store
- **Routine data**: Product names, ingredient lists, and AM/PM assignments you
  add to the extension.
- **Preferences**: Skin preferences (e.g., sensitivity, concerns) you optionally
  provide. These are user preferences for tailoring on-screen analysis — not
  medical conditions or health records.

## Where Data Is Stored
All data is stored locally in your browser via Chrome's `storage.local` API.
Data never leaves your device.

## What We Do Not Collect
We do not collect: your name, email address, location, browsing history, IP
address, payment information, or any data outside what you explicitly enter
into the extension.

## Third Parties
v1 does not use any third-party analytics, advertising, or tracking services.

## Your Rights (CCPA, GDPR, and similar laws)
You can view, edit, or delete all stored data at any time via the extension
popup. Uninstalling the extension removes all stored data. Since data is
local-only and we have no servers, there is no data for us to "access" or
"delete" on your behalf — you are in full control.

## Children
This extension is not intended for users under 13. We do not knowingly collect
information from children. If you are under 13, do not use this extension.

## Contact
Questions: [contact email]

## Changes
Material changes to this policy will be announced via the extension popup
before they take effect.
```

### 16.6 Terms of Service — required at launch

ToS is what protects against liability claims if a user has an adverse reaction. Yuka's ToS is the model — it's explicit, all-caps in the relevant section, and disclaims everything possible.

Minimum sections:

1. **No medical advice** — explicit; all-caps section
2. **As-is, no warranty** — disclaim merchantability, fitness for purpose, accuracy, completeness
3. **User assumes all risk** — user is solely responsible for product purchase and use decisions
4. **Patch test recommendation** — users acknowledge they should patch test new products
5. **Limitation of liability** — cap damages at amount paid (which is $0 in v1 free tier)
6. **Sources are best-effort** — accuracy of ingredient data and conflict rules not guaranteed; product labels may be inaccurate
7. **No diagnosis** — explicit statement that we do not diagnose, treat, or prevent any condition
8. **Indemnification** — user agrees not to hold us liable for skincare decisions
9. **Governing law and venue** — user's home state (start with developer's home state, e.g., New York)
10. **Modification rights** — we may update ToS; continued use after notice = acceptance

Budget: $0 for v1 (use Termly or a similar generator), $500–1,000 for a lawyer review before crossing 1,000 users or adding monetization. Skincare-specific consumer-tech lawyers are findable; ask for a flat fee.

### 16.7 Affiliate revenue (v2) — FTC compliance requirements

When affiliate links are added in v2, every requirement below must be met before launch:

1. **Disclosure adjacent to every link, not in a footer.** Example label that meets FTC standards: "(paid link — we earn a commission if you buy through this link)." "Affiliate link" alone may not be sufficient per recent FTC guidance.
2. **Recommendations cannot be biased by commission rate.** The analysis algorithm must be deterministic and based on ingredient compatibility, not on affiliate payments. This must be both true and **demonstrable** — write it in code as a comment, and document it on the website.
3. **A dedicated page on the website** explaining how affiliate relationships work, what they do not influence, and which retailers participate.
4. **Chrome Web Store listing must disclose** the monetization model in the description.
5. **No fake or paid reviews.** The FTC's August 2024 Consumer Reviews Rule has civil penalties for fake reviews. If we add a review feature later, every review must be from a verified buyer with explicit consent to display.

### 16.8 Things to avoid (not strictly illegal, but create risk)

- **Targeting minors** in marketing copy. Skincare market includes teens, but extension copy should be neutral / adult-coded.
- **Pregnancy / nursing claims** — never frame ingredients as "pregnancy-safe" or "unsafe." Medical territory.
- **Brand attacks** — don't characterize specific brands negatively. Focus on ingredients and compatibility, never on "Brand X is bad."
- **Comparative drug claims** — never say a cosmetic product "works as well as a prescription retinoid" or similar.
- **LLM hallucinations** — relevant when LLMs are added in v2. Every fact-bearing string emitted by an LLM must be cross-checked against the seeded database. Never let an LLM invent an ingredient property.
- **Implying endorsement by professionals** — don't say "dermatologist-approved" or "recommended by [credential]" unless an actual licensed dermatologist has reviewed and endorsed.
- **State-specific regulations** — California Prop 65 applies to physical products, not analysis tools, but if we ever sell merch or partner with a brand, this matters.

### 16.9 If a backend is added in v2+

Local-only storage in v1 dramatically simplifies compliance. When v2 adds sync, accounts, or any server-side processing:

- **CCPA and state privacy laws**: required to honor delete/access requests; need a data-subject-request flow with documented response within 45 days
- **GDPR (for EU users)**: required: lawful basis for processing (consent is cleanest), data minimization, right to delete, right to portability, breach notification within 72 hours
- **Skin-preference data**: arguably "special category" data under GDPR if it's interpreted as health-related. Best practice: treat as health data, require explicit consent, encrypt at rest
- **Data Processing Agreements**: required with any vendor processing user data (e.g., AWS, Supabase, analytics provider)
- **A formal Privacy Policy v2** — must be drafted by a lawyer if revenue is meaningful, not a Termly boilerplate

Default position: defer adding a backend until v2 has paying users and budget for proper privacy review. Cloud-first is the wrong choice here.

### 16.10 Compliance checklist before Chrome Web Store submission

Walk this list before clicking "Submit for review." All items must be checked.

- [ ] All user-facing copy reviewed against §16.2 forbidden phrasings (including banner text, popup, options, store listing, landing page)
- [ ] Disclaimers from §16.4 present in: every banner, popup, options page, onboarding flow, store listing
- [ ] Privacy Policy hosted publicly and linked from: store listing, popup footer, options page
- [ ] Terms of Service hosted publicly and linked from: store listing, popup footer, options page
- [ ] manifest.json requests only `storage` permission and `https://www.sephora.com/*` host permission — nothing more
- [ ] No `<all_urls>`, no `tabs`, no `activeTab`, no `cookies`, no `webRequest`
- [ ] Test case #9 (niacinamide + vitamin C) passes — debunked myths are not flagged
- [ ] Test case #13 (parabens) passes — no fearmongering on commodity ingredients
- [ ] No mention of pregnancy, nursing, or specific medical conditions anywhere in the codebase or UI strings
- [ ] No brand-specific negative claims in any rule, message, or copy
- [ ] Skin preferences are framed as "preferences" / "goals", not "conditions" or "diagnoses"
- [ ] Every conflict rule in `conflict-rules.json` has a `sources` array with at least one entry pointing to an authoritative source (§17)
- [ ] Chrome Web Store listing description includes the disclaimer from §16.4
- [ ] If any logo, icon, or screenshot uses a stock asset, the license is verified and noted in `LICENSES.md`

---

## 17. Deferred Decisions (v2 and beyond)

Track these but do not act on them in v1:

- **Monetization:** ExtensionPay or LemonSqueezy license-key model. Likely $5–7/mo for routine vault + advanced analysis; free tier keeps basic ingredient overlay.
- **Affiliate revenue:** Sephora and Ulta affiliate programs. Insert "cheaper alternative" links when a redundancy is detected. **Must satisfy all §16.7 FTC compliance requirements before launch** — disclosure adjacent to every link, algorithm bias-free and documented as such, dedicated transparency page.
- **More retailers:** Ulta, Amazon, Target. Each is a separate content script + parser.
- **Skin-type quiz** and per-user concern weighting. **Frame as preferences (§16.3); never as diagnosis.**
- **LLM-powered "Why?" explanations** for warnings — pulled from the rule's `long_explanation` plus user-routine context. **Every LLM output must be cross-checked against the seeded database (§16.8); never let it invent properties.**
- **Backend / sync** — only when there's actual demand. Local-first beats cloud-first for v1. **If added: CCPA + GDPR compliance per §16.9 required before launch.**
- **In-page "Add to routine" button** — one-click capture from any product page.
- **Mobile** — not a Chrome extension target; possibly a separate iOS Safari extension later.

---

## 18. Sources / References

Use these for sourcing conflict rules and ingredient data. Every rule needs at least one of:

- **PubMed** (https://pubmed.ncbi.nlm.nih.gov/) for primary research
- **American Academy of Dermatology** (https://www.aad.org/)
- **DermNet NZ** (https://dermnetnz.org/) — clear clinical summaries
- **INCIDecoder** (https://incidecoder.com/) for ingredient lookups
- **The Beauty Brains** (archive) — peer-reviewed-flavored takes from cosmetic chemists
- **Lab Muffin Beauty Science** (https://labmuffin.com/) — Michelle Wong, PhD, cosmetic chemistry; excellent for myth-debunking

When in doubt about whether a rule belongs in the engine, defer it. A conservative ruleset with high credibility beats a noisy one with viral-tier claims.

Legal/regulatory references (for the next agent or whoever reviews §16):

- **FDA — Is It a Cosmetic, a Drug, or Both?**: https://www.fda.gov/cosmetics/cosmetics-laws-regulations/it-cosmetic-drug-or-both-or-it-soap
- **FDA — Clinical Decision Support Software Guidance** (Sept 2022, revised Jan 2026)
- **FDA — General Wellness: Policy for Low Risk Devices** (revised Jan 2026)
- **FTC — Endorsement Guides** (16 CFR Part 255): https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking
- **FTC — Consumer Reviews and Testimonials Rule** (Aug 2024)
- **Chrome Web Store Developer Program Policies**: https://developer.chrome.com/docs/webstore/program-policies/
- **MoCRA — Modernization of Cosmetics Regulation Act of 2022**

---

## 19. First-Week Plan

For an agent picking this up cold:

**Day 1:** Set up the repo, get the empty extension loading in Chrome with a "Hello" popup. Verify HMR works. Read §16 in full before writing any user-facing copy.

**Day 2:** Build `data/ingredients.json` from §8a. Skip nothing — get all ~50 entries with sources.

**Day 3:** Build `conflict-rules.json` (§8b) and `gap-rules.json` (§8d). Write unit tests for the matching logic in `lib/ingredients.ts`. Cross-check every rule's user-facing message against §16.2.

**Day 4:** Implement `lib/analyzer.ts`. Run all 15 test cases in §14. Don't move on until they pass.

**Day 5:** Build the popup UI — routine list, add/remove, slot toggle. Wire to `chrome.storage.local`. Include disclaimer per §16.4.

**Day 6:** Build the Sephora content script. Test on 3 real product pages. Iterate on selectors until extraction is reliable.

**Day 7:** Banner UI with shadow DOM. Run the manual smoke test on all 10 products in §14. Fix anything that breaks.

**Day 8:** Draft Privacy Policy (§16.5 template) and Terms of Service (§16.6 minimum sections). Host on GitHub Pages.

**Day 9:** Walk the §16.10 pre-submission checklist. Fix every unchecked item.

**Day 10+:** Polish, then submit to the Chrome Web Store ($5 one-time developer fee). Review usually takes 1–3 days.

While waiting for review: write the landing page, draft Product Hunt + Indie Hackers + r/SkincareAddiction launch posts (the subreddit allows tool launches in their weekly thread — read the rules first).

---

*End of brief. If a decision is needed that isn't covered here, default to the conservative / smaller-scope option and add it to §17 for v2.*
