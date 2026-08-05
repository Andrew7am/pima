import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Unmount anything a test rendered so component state never leaks between tests.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// localStorage is missing here for a surprising reason: Node 26 ships its own
// experimental `localStorage` global which shadows the one jsdom provides, and
// it throws unless the process was started with --localstorage-file. So the
// app code's `localStorage.getItem(...)` sees `undefined` and every guarded
// read silently returns a default — which hides real behaviour from tests
// rather than exercising it. An in-memory Storage, reset between tests.
const memoryStorage = (): Storage => {
  let map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => { map = new Map(); },
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
  } as Storage;
};

for (const target of [globalThis, window] as unknown as Array<Record<string, unknown>>) {
  Object.defineProperty(target, 'localStorage', {
    value: memoryStorage(), writable: true, configurable: true,
  });
}

afterEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

// jsdom implements neither of these, and several screens call them on mount.
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.matchMedia = window.matchMedia || ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}) as unknown as MediaQueryList);
