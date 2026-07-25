import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Unmount anything a test rendered so component state never leaks between tests.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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
