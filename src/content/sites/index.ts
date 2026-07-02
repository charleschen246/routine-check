// Site adapter registry. To add a retailer:
//   1. Create src/content/sites/<site>.ts implementing SiteAdapter.
//   2. Add it to SITE_ADAPTERS below.
//   3. Add the host to manifest.json host_permissions and the product-page
//      URL pattern to content_scripts.matches.
//   4. Add a fixture + spec under e2e/ and unit cases in tests/sites.test.ts.

import type { SiteAdapter } from './types';
import { sephora } from './sephora';
import { ulta } from './ulta';
import { amazon } from './amazon';

export type { SiteAdapter } from './types';
export { sephora, ulta, amazon };

export const SITE_ADAPTERS: SiteAdapter[] = [sephora, ulta, amazon];

/** Adapter that owns this URL's hostname, or null for unsupported sites. */
export function siteForUrl(url: string): SiteAdapter | null {
  try {
    const u = new URL(url);
    return SITE_ADAPTERS.find((a) => a.hostnames.includes(u.hostname)) ?? null;
  } catch {
    return null;
  }
}

/** Adapter for this URL only if it is a product page on a supported site. */
export function productAdapterForUrl(url: string): SiteAdapter | null {
  try {
    const u = new URL(url);
    const adapter = SITE_ADAPTERS.find((a) => a.hostnames.includes(u.hostname));
    return adapter && adapter.isProductPage(u) ? adapter : null;
  } catch {
    return null;
  }
}
