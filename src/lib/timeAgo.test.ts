import { describe, it, expect, vi, afterEach } from 'vitest';
import { timeAgo } from './timeAgo';

const NOW = new Date('2026-07-27T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

const SEC = 1000, MIN = 60 * SEC, HOUR = 60 * MIN, DAY = 24 * HOUR;

function at(now: Date) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
}

afterEach(() => vi.useRealTimers());

describe('timeAgo', () => {
  it('collapses anything under a minute to "الآن"', () => {
    at(NOW);
    expect(timeAgo(ago(0))).toBe('الآن');
    expect(timeAgo(ago(59 * SEC))).toBe('الآن');
  });

  // Arabic agreement runs 1 / 2 / 3-10 / 11+, and the numeral itself is
  // Arabic-Indic — the same digits the rest of the app prints.
  it('uses the singular, dual, and plural forms for minutes', () => {
    at(NOW);
    expect(timeAgo(ago(1 * MIN))).toBe('منذ دقيقة');
    expect(timeAgo(ago(2 * MIN))).toBe('منذ دقيقتين');
    expect(timeAgo(ago(5 * MIN))).toBe('منذ ٥ دقائق');
    expect(timeAgo(ago(20 * MIN))).toBe('منذ ٢٠ دقيقة');
  });

  it('uses the singular, dual, and plural forms for hours', () => {
    at(NOW);
    expect(timeAgo(ago(1 * HOUR))).toBe('منذ ساعة');
    expect(timeAgo(ago(2 * HOUR))).toBe('منذ ساعتين');
    expect(timeAgo(ago(9 * HOUR))).toBe('منذ ٩ ساعات');
  });

  it('rolls over to days, months, and years', () => {
    at(NOW);
    expect(timeAgo(ago(1 * DAY))).toBe('منذ يوم');
    expect(timeAgo(ago(3 * DAY))).toBe('منذ ٣ أيام');
    expect(timeAgo(ago(60 * DAY))).toBe('منذ شهرين');
    expect(timeAgo(ago(400 * DAY))).toBe('منذ سنة');
  });

  // Regression: the string used to be built with a template literal, which
  // printed Latin digits beside Arabic-Indic ones on the same screen.
  it('never emits a Latin digit', () => {
    at(NOW);
    for (const ms of [5 * MIN, 20 * MIN, 9 * HOUR, 3 * DAY, 200 * DAY]) {
      expect(timeAgo(ago(ms))).not.toMatch(/[0-9]/);
    }
  });

  // Clock skew between the DB and the device must not produce "منذ -٣ دقائق".
  it('never reports a negative age for a future timestamp', () => {
    at(NOW);
    expect(timeAgo(ago(-5 * MIN))).toBe('الآن');
  });

  it('returns an empty string for an unparseable timestamp', () => {
    at(NOW);
    expect(timeAgo('not-a-date')).toBe('');
  });
});
