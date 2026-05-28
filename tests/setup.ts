import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const storage: Record<string, unknown> = {};
const openOptionsPage = vi.fn();

const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (key: string | string[]) => {
        const keys = Array.isArray(key) ? key : [key];
        const out: Record<string, unknown> = {};
        for (const k of keys) {
          if (k in storage) out[k] = storage[k];
        }
        return out;
      }),
      set: vi.fn(async (entries: Record<string, unknown>) => {
        Object.assign(storage, entries);
      }),
      clear: vi.fn(async () => {
        for (const k of Object.keys(storage)) delete storage[k];
      }),
    },
  },
  runtime: {
    openOptionsPage,
  },
};

vi.stubGlobal('chrome', chromeMock);

// Expose helpers on globalThis so tests can grab them without re-importing
// this file (which on Windows can yield a second module instance and a
// completely separate set of vi.fn mocks).
declare global {
  // eslint-disable-next-line no-var
  var __testHelpers: {
    getStoredRoutine: () => unknown;
    openOptionsPageMock: ReturnType<typeof vi.fn>;
    resetAll: () => void;
  };
}

globalThis.__testHelpers = {
  getStoredRoutine: () => storage['routine'],
  openOptionsPageMock: openOptionsPage,
  resetAll: () => {
    for (const k of Object.keys(storage)) delete storage[k];
    openOptionsPage.mockReset();
    chromeMock.storage.local.get.mockClear();
    chromeMock.storage.local.set.mockClear();
  },
};

afterEach(() => {
  cleanup();
  globalThis.__testHelpers.resetAll();
});
