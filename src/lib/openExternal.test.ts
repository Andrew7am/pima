import { describe, it, expect } from 'vitest';
import { whatsAppShareUrl, SITE_URL } from './openExternal';

describe('whatsAppShareUrl', () => {
  it('builds a chooser link when no recipient is given', () => {
    expect(whatsAppShareUrl('hi')).toBe('https://wa.me/?text=hi');
  });

  it('strips everything that is not a digit from the number', () => {
    // wa.me's own rule: country code first, digits only, no + and no spaces.
    // A number pasted from a contact card arrives full of both.
    expect(whatsAppShareUrl('hi', '+20 100 123 4567')).toBe('https://wa.me/201001234567?text=hi');
  });

  it('encodes a message that would otherwise break the query string', () => {
    const url = whatsAppShareUrl('كود الغرفة: AB12\nتعالى نلعب & نتحدى');
    expect(url).toContain('%0A');   // the newline
    expect(url).toContain('%26');   // the ampersand
    expect(url).not.toContain('\n');
  });

  it('keeps Arabic intact through encoding', () => {
    const text = 'تعالى نلعب';
    expect(decodeURIComponent(whatsAppShareUrl(text).split('text=')[1])).toBe(text);
  });
});

describe('SITE_URL', () => {
  it('is the real domain, not a placeholder', () => {
    // The room-share message shipped with `https://yourapp.com/download` in
    // it, so anyone who received a code got a dead link.
    expect(SITE_URL).toBe('https://pimastay.com');
    expect(SITE_URL).not.toContain('yourapp');
    expect(SITE_URL).not.toContain('example');
  });
});
