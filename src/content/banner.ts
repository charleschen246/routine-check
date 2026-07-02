// Day 7 banner. Renders an `AnalysisResult` inside a shadow root attached to
// the retailer's product page so the host site's stylesheet can't bleed in
// and ours can't bleed out. All copy here must pass PROJECT_BRIEF.md §16.2 —
// keep that table open if you touch this file.
//
// Pure DOM (no React) per §5 of the brief: content scripts ship vanilla JS
// to keep the bundle small and to reduce the chance of breaking the host
// site's own page-script.

import type {
  AnalysisGapFill,
  AnalysisResult,
  AnalysisWarning,
  Severity,
} from '@/lib/types';
import { sephora } from './sites';

export const BANNER_HOST_ID = 'routine-check-banner-host';
export const DISMISS_STORAGE_KEY = 'banner_dismissed_skus';

// §16.4 short-form disclaimer, verbatim. Do not paraphrase.
export const SHORT_DISCLAIMER =
  'Informational only. Not medical advice. Patch test new products.';

export interface BannerInput {
  result: AnalysisResult;
  routineSize: number;
}

export interface BannerOptions {
  // Override the routine-editor action — used by unit tests and so the
  // content-script runtime can route through the service worker.
  onEditRoutine?: () => void;
  // Site-specific injection anchors (SiteAdapter.anchorSelectors). Defaults
  // to Sephora's for backward compatibility.
  anchorSelectors?: string[];
}

export interface RenderedBanner {
  host: HTMLElement;
  remove: () => void;
}

// §11 color tokens. High severity is amber border on a neutral background
// (brief is explicit: not red — "worth a second look", not "danger"). Medium
// is soft amber. Low + gap-fills are light blue. Neutral is green.
const STYLES = `
  :host { all: initial; display: block; }
  * { box-sizing: border-box; }
  .banner {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    color: #111827;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-left-width: 4px;
    border-radius: 8px;
    padding: 14px 16px;
    margin: 16px 0;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    max-width: 720px;
  }
  .banner.sev-high { border-left-color: #b45309; }
  .banner.sev-medium { border-left-color: #d97706; background: #fffbeb; }
  .banner.sev-low { border-left-color: #2563eb; background: #eff6ff; }
  .banner.sev-neutral { border-left-color: #16a34a; background: #f0fdf4; }
  .title {
    display: flex; align-items: center; gap: 8px;
    margin: 0 0 6px 0;
    font-weight: 600; font-size: 15px;
  }
  .title .icon { font-size: 16px; line-height: 1; }
  .dismiss {
    margin-left: auto;
    background: transparent; border: none; cursor: pointer;
    font-size: 18px; line-height: 1; color: #6b7280;
    padding: 4px 6px; border-radius: 4px;
  }
  .dismiss:hover { color: #111827; background: rgba(0,0,0,0.04); }
  .cta {
    margin: 8px 0 4px 0;
    padding: 8px 10px;
    background: rgba(0,0,0,0.04);
    border-radius: 6px;
    font-size: 13px;
    color: #1f2937;
  }
  .item { margin: 8px 0; }
  .item-msg { margin: 0; }
  .why { margin-top: 4px; font-size: 13px; color: #374151; }
  .why summary { cursor: pointer; color: #2563eb; }
  .why summary:hover { text-decoration: underline; }
  .why p { margin: 6px 0 0 0; }
  .why ul.sources { margin: 6px 0 0 0; padding: 0; list-style: none; font-size: 12px; }
  .why ul.sources li { margin-top: 2px; }
  .why a { color: #2563eb; text-decoration: underline; word-break: break-all; }
  .footer {
    margin-top: 12px; padding-top: 8px;
    border-top: 1px solid #e5e7eb;
    display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
    font-size: 11px; color: #6b7280;
  }
  .footer .brand { font-weight: 600; color: #374151; }
  .footer .disclaimer { flex: 1; min-width: 200px; }
  .footer button.edit {
    background: transparent; border: 1px solid #d1d5db; border-radius: 4px;
    padding: 4px 10px; font-size: 11px; cursor: pointer; color: #1f2937;
  }
  .footer button.edit:hover { background: #f3f4f6; }
`;

function topSeverity(result: AnalysisResult): Severity | 'neutral' {
  if (result.warnings.some((w) => w.severity === 'high')) return 'high';
  if (result.warnings.some((w) => w.severity === 'medium')) return 'medium';
  if (result.warnings.length > 0 || result.gap_fills.length > 0) return 'low';
  return 'neutral';
}

// Title text and icon are sensitive copy. Every string here is on the
// §16.2 "allowed" side of the table; if you change one, re-check the table.
function bannerTitle(
  result: AnalysisResult,
  routineSize: number,
): { icon: string; text: string } {
  const sev = topSeverity(result);
  if (sev === 'neutral') {
    if (routineSize === 0) {
      return { icon: '✨', text: 'Routine analysis ready' };
    }
    return { icon: '✓', text: 'Compatible with your routine' };
  }
  if (result.warnings.length === 0 && result.gap_fills.length > 0) {
    return { icon: 'ℹ', text: 'Worth noting' };
  }
  return { icon: '!', text: 'Worth a second look' };
}

function renderWarningItem(doc: Document, w: AnalysisWarning): HTMLElement {
  const root = doc.createElement('div');
  root.className = 'item';
  const msg = doc.createElement('p');
  msg.className = 'item-msg';
  msg.textContent = w.short_message;
  root.appendChild(msg);

  if (w.long_explanation || (w.sources && w.sources.length > 0)) {
    const details = doc.createElement('details');
    details.className = 'why';
    const summary = doc.createElement('summary');
    summary.textContent = 'Why?';
    details.appendChild(summary);
    if (w.long_explanation) {
      const p = doc.createElement('p');
      p.textContent = w.long_explanation;
      details.appendChild(p);
    }
    if (w.sources && w.sources.length > 0) {
      const ul = doc.createElement('ul');
      ul.className = 'sources';
      for (const s of w.sources) {
        const li = doc.createElement('li');
        const a = doc.createElement('a');
        a.href = s;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = s;
        li.appendChild(a);
        ul.appendChild(li);
      }
      details.appendChild(ul);
    }
    root.appendChild(details);
  }
  return root;
}

function renderGapItem(doc: Document, g: AnalysisGapFill): HTMLElement {
  const root = doc.createElement('div');
  root.className = 'item';
  const msg = doc.createElement('p');
  msg.className = 'item-msg';
  msg.textContent = g.message;
  root.appendChild(msg);
  return root;
}

export async function isDismissed(sku: string): Promise<boolean> {
  if (!sku) return false;
  try {
    const out = await chrome.storage.local.get(DISMISS_STORAGE_KEY);
    const arr = out[DISMISS_STORAGE_KEY];
    return Array.isArray(arr) && arr.includes(sku);
  } catch {
    return false;
  }
}

export async function setDismissed(sku: string): Promise<void> {
  if (!sku) return;
  try {
    const out = await chrome.storage.local.get(DISMISS_STORAGE_KEY);
    const existing = out[DISMISS_STORAGE_KEY];
    const list = Array.isArray(existing) ? (existing as string[]) : [];
    if (list.includes(sku)) return;
    list.push(sku);
    await chrome.storage.local.set({ [DISMISS_STORAGE_KEY]: list });
  } catch {
    // best-effort; nothing user-facing depends on this succeeding.
  }
}

export function buildBanner(
  input: BannerInput,
  doc: Document = document,
  options: BannerOptions = {},
): RenderedBanner {
  const { result, routineSize } = input;

  const host = doc.createElement('div');
  host.id = BANNER_HOST_ID;
  // Inline reset so the host site's cascading styles can't shrink/hide the host.
  host.style.cssText = 'all: initial; display: block; contain: layout style;';

  const shadow = host.attachShadow({ mode: 'open' });

  const style = doc.createElement('style');
  style.textContent = STYLES;
  shadow.appendChild(style);

  const sev = topSeverity(result);
  const banner = doc.createElement('div');
  banner.className = `banner sev-${sev}`;
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Routine Check analysis');

  const titleInfo = bannerTitle(result, routineSize);
  const titleRow = doc.createElement('div');
  titleRow.className = 'title';
  const iconSpan = doc.createElement('span');
  iconSpan.className = 'icon';
  iconSpan.setAttribute('aria-hidden', 'true');
  iconSpan.textContent = titleInfo.icon;
  const titleText = doc.createElement('span');
  titleText.textContent = titleInfo.text;
  titleRow.appendChild(iconSpan);
  titleRow.appendChild(titleText);

  const dismissBtn = doc.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'dismiss';
  dismissBtn.textContent = '×';
  dismissBtn.setAttribute('aria-label', 'Dismiss');
  dismissBtn.addEventListener('click', () => {
    void setDismissed(result.product.sku);
    host.remove();
  });
  titleRow.appendChild(dismissBtn);

  banner.appendChild(titleRow);

  // Test case #14 in PROJECT_BRIEF.md §14: empty routine + neutral product
  // shows a CTA that nudges the user to seed the routine.
  if (sev === 'neutral' && routineSize === 0) {
    const cta = doc.createElement('div');
    cta.className = 'cta';
    cta.textContent = 'Add your routine to get personalized analysis.';
    banner.appendChild(cta);
  }

  for (const w of result.warnings) {
    banner.appendChild(renderWarningItem(doc, w));
  }
  for (const g of result.gap_fills) {
    banner.appendChild(renderGapItem(doc, g));
  }

  const footer = doc.createElement('div');
  footer.className = 'footer';
  const brand = doc.createElement('span');
  brand.className = 'brand';
  brand.textContent = 'Routine Check';
  const sep = doc.createElement('span');
  sep.textContent = '·';
  const disclaimer = doc.createElement('span');
  disclaimer.className = 'disclaimer';
  disclaimer.textContent = SHORT_DISCLAIMER;
  const editBtn = doc.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'edit';
  editBtn.textContent = 'Edit your routine';
  editBtn.addEventListener('click', () => {
    if (options.onEditRoutine) {
      options.onEditRoutine();
      return;
    }
    try {
      void chrome.runtime.sendMessage({ type: 'OPEN_ROUTINE_EDITOR' });
    } catch {
      // ignore — surface is purely a navigation aid.
    }
  });
  footer.appendChild(brand);
  footer.appendChild(sep);
  footer.appendChild(disclaimer);
  footer.appendChild(editBtn);

  banner.appendChild(footer);
  shadow.appendChild(banner);

  return {
    host,
    remove: () => host.remove(),
  };
}

// Stable injection anchor for a product page. Try the site adapter's
// selectors first (most preferred first); fall back to any button whose
// visible label is "Add to Bag/Basket/Cart" so the banner still lands
// somewhere sensible when a site reshuffles its markup.
const ADD_TO_CART_TEXT = /^\s*add to (bag|basket|cart)\s*$/i;

export function findInjectionAnchor(
  doc: Document,
  anchorSelectors: string[] = sephora.anchorSelectors,
): Element | null {
  for (const sel of anchorSelectors) {
    let el: Element | null = null;
    try {
      el = doc.querySelector(sel);
    } catch {
      continue; // a bad selector in one adapter must not kill injection
    }
    if (el) return el;
  }

  const buttons = doc.querySelectorAll('button, input[type="submit"]');
  for (const btn of Array.from(buttons)) {
    const label =
      btn.textContent?.trim() ||
      btn.getAttribute('value') ||
      btn.getAttribute('aria-label') ||
      '';
    if (ADD_TO_CART_TEXT.test(label)) return btn;
  }
  return null;
}

export async function showBanner(
  input: BannerInput,
  doc: Document = document,
  options: BannerOptions = {},
): Promise<RenderedBanner | null> {
  if (await isDismissed(input.result.product.sku)) return null;

  // Clear any prior banner so SPA re-navigation doesn't stack hosts.
  doc.getElementById(BANNER_HOST_ID)?.remove();

  const rendered = buildBanner(input, doc, options);
  const anchor = findInjectionAnchor(doc, options.anchorSelectors ?? sephora.anchorSelectors);
  if (anchor) {
    anchor.insertAdjacentElement('afterend', rendered.host);
  } else {
    (doc.body ?? doc.documentElement).appendChild(rendered.host);
  }
  return rendered;
}
