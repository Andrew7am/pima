import { describe, it, expect, beforeEach } from 'vitest';
import { supportWhatsAppUrl, setSupportWhatsApp, supportWhatsAppNumber } from './support';

const FALLBACK = '201096126259';

describe('support number', () => {
  beforeEach(() => setSupportWhatsApp(FALLBACK));

  it('uses the number the admin configured', () => {
    setSupportWhatsApp('201234567890');
    expect(supportWhatsAppNumber()).toBe('201234567890');
    expect(supportWhatsAppUrl('')).toBe('https://wa.me/201234567890');
  });

  it('strips the punctuation people actually type', () => {
    setSupportWhatsApp('+20 109 612 6259');
    expect(supportWhatsAppNumber()).toBe('201096126259');
  });

  // The value comes from a settings row an admin edits. A bad one must not be
  // able to turn every "contact us" link in the app into a dead one — least of
  // all on the banned and pending-approval screens, whose whole purpose is to
  // give someone a way to reach a human.
  it.each([
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
    ['letters only', 'call-us'],
    ['too short', '12345'],
    ['too long', '1234567890123456'],
  ])('falls back when the configured value is %s', (_label, value) => {
    setSupportWhatsApp(value as string);
    expect(supportWhatsAppNumber()).toBe(FALLBACK);
    expect(supportWhatsAppUrl('')).toBe(`https://wa.me/${FALLBACK}`);
  });

  it('pre-fills a message when given one, and omits ?text when not', () => {
    expect(supportWhatsAppUrl('سلام')).toBe(`https://wa.me/${FALLBACK}?text=${encodeURIComponent('سلام')}`);
    expect(supportWhatsAppUrl('')).not.toContain('?text=');
  });

  it('never emits a link with a + or a space in the number', () => {
    setSupportWhatsApp('+20 109 612 6259');
    const url = supportWhatsAppUrl('');
    expect(url).not.toMatch(/[+\s]/);
  });
});
