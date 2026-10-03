import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PrivacyPolicy from './PrivacyPolicy';
import { supportWhatsAppNumber } from '../lib/support';

// public/privacy.html#delete-account is the page Google Play sends people to
// for deleting an account; the in-app policy is what they read inside the app.
// The two are one text kept in two files, so they drift the moment one is
// edited alone — and the public one is the one nobody looks at in the app.
const html = new DOMParser().parseFromString(
  readFileSync(resolve(__dirname, '../../public/privacy.html'), 'utf8'),
  'text/html',
);
const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

describe('account deletion section', () => {
  it('is reachable at #delete-account on the public page', () => {
    expect(norm(html.getElementById('delete-account')?.textContent)).toBe('٥. حذف الحساب والاحتفاظ بالبيانات');
  });

  it('says the same thing in the app as on the public page', () => {
    const publicItems = [...(html.getElementById('delete-account')?.nextElementSibling?.querySelectorAll('li') ?? [])]
      .map((li) => norm(li.textContent));
    const { container } = render(<PrivacyPolicy />);
    const appItems = [...container.querySelectorAll('#delete-account li')].map((li) => norm(li.textContent?.replace(/^•/, '')));

    expect(publicItems.length).toBeGreaterThan(5);
    expect(appItems).toEqual(publicItems);
  });

  // Nothing in the backend deletes retained records on a timer (no purge job),
  // and the financial records are append-only by design. A fixed-period
  // deletion promise would be false, so the section must not make one.
  it('promises no fixed deletion period for retained records', () => {
    const section = norm(html.getElementById('delete-account')?.nextElementSibling?.textContent);

    expect(section).not.toMatch(/[٦6]\s*(شهور|أشهر|شهر)/);
    expect(section).toContain('مش بتتحذف بعد مدة ثابتة');
    expect(section).toContain('مفيش حالياً عملية تلقائية بتحذفها');
  });

  it('sends deletion requests to the support WhatsApp number the app uses', () => {
    const numbers = [...html.querySelectorAll('a[href^="https://wa.me/"]')]
      .map((a) => new URL(a.getAttribute('href')!).pathname.slice(1));

    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) expect(n).toBe(supportWhatsAppNumber());
  });
});
