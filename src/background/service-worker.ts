// Service worker entry. Receives the extracted product from the content
// script (any supported retail site), loads the user's routine + preferences
// from chrome.storage.local, runs the analyzer, and ships the result back.

import { analyze } from '@/lib/analyzer';
import { conflictRules, gapRules, ingredients } from '@/lib/data';
import { getPreferences, getRoutine } from '@/lib/storage';
import type { ExtractedProduct } from '@/lib/types';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Routine Check] service worker installed');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PING') {
    sendResponse({ ok: true, from: 'service-worker' });
    return false;
  }

  if (message?.type === 'OPEN_ROUTINE_EDITOR') {
    // Best-effort: open the toolbar popup if Chrome will let us (requires a
    // user gesture in the active tab — when that fails we drop back to the
    // options page so the click never feels broken).
    (async () => {
      try {
        if (chrome.action && typeof chrome.action.openPopup === 'function') {
          try {
            await chrome.action.openPopup();
            sendResponse({ ok: true });
            return;
          } catch {
            // fall through
          }
        }
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  if (message?.type === 'ANALYZE_PRODUCT') {
    const product = message.product as ExtractedProduct;
    // `return true` below keeps the message channel open while this runs.
    (async () => {
      try {
        const [routine, prefs] = await Promise.all([
          getRoutine(),
          getPreferences(),
        ]);
        const result = analyze(
          { ...product, intended_slot: 'either' },
          routine,
          conflictRules,
          gapRules,
          ingredients,
          prefs,
        );
        sendResponse({ ok: true, result, routine_size: routine.length });
      } catch (err) {
        console.error('[Routine Check] analysis failed', err);
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }

  return false;
});
