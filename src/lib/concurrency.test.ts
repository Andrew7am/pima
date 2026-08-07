import { describe, it, expect, vi } from 'vitest';
import { mapWithConcurrency, isOk } from './concurrency';
import { uploadImages, UPLOAD_CONCURRENCY } from './storage';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('mapWithConcurrency', () => {
  it('never runs more than `limit` tasks at once', async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 30 }, (_, i) => i), 4, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await tick(1);
      active--;
      return n;
    });
    expect(peak).toBeLessThanOrEqual(4);
    // ...but does use the parallelism it was given, rather than going serial.
    expect(peak).toBe(4);
  });

  it('returns results in INPUT order even when they finish out of order', async () => {
    // The first item is the slowest — exactly the case that reorders a naive
    // implementation, and the case that matters because photo 1 is the cover.
    const delays = [40, 1, 1, 1, 1];
    const out = await mapWithConcurrency(delays, 4, async (ms, i) => {
      await tick(ms);
      return i;
    });
    expect(out.map((r) => (isOk(r) ? r.value : null))).toEqual([0, 1, 2, 3, 4]);
  });

  it('lets the rest of the batch finish when some items reject', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      if (n % 2 === 0) throw new Error(`boom ${n}`);
      return n * 10;
    });
    expect(out.filter(isOk).map((r) => r.value)).toEqual([10, 30, 50]);
    expect(out.filter((r) => !isOk(r))).toHaveLength(2);
  });

  it('reports progress once per settled item, successes and failures alike', async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => {
      if (n === 3) throw new Error('nope');
      return n;
    }, (done, total) => {
      expect(total).toBe(4);
      seen.push(done);
    });
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('handles an empty list without hanging', async () => {
    expect(await mapWithConcurrency([], 4, async (x) => x)).toEqual([]);
  });

  it('clamps a nonsense limit instead of spawning zero workers and hanging', async () => {
    // A zero or negative limit would leave the queue undrained forever.
    for (const limit of [0, -3, NaN]) {
      const out = await mapWithConcurrency([1, 2, 3], limit, async (n) => n);
      expect(out.filter(isOk).map((r) => r.value)).toEqual([1, 2, 3]);
    }
  });
});

describe('uploadImages', () => {
  const fakeFile = (name: string) => ({ name }) as File;

  it('keeps picked order and reports which files failed by name', async () => {
    const files = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'].map(fakeFile);
    const uploader = vi.fn(async (f: File) => {
      if (f.name === 'b.jpg') throw new Error('storage down');
      // Make 'a' the slowest so completion order differs from input order.
      await tick(f.name === 'a.jpg' ? 20 : 1);
      return `https://cdn/${f.name}`;
    });

    const { urls, failed } = await uploadImages(files, 'listings', undefined, uploader);

    expect(urls).toEqual(['https://cdn/a.jpg', 'https://cdn/c.jpg', 'https://cdn/d.jpg']);
    expect(failed).toEqual(['b.jpg']);
  });

  it('surfaces progress for every file so a 100-photo batch is not a frozen spinner', async () => {
    const files = Array.from({ length: 12 }, (_, i) => fakeFile(`p${i}.jpg`));
    const progress: string[] = [];
    await uploadImages(files, 'listings', (done, total) => progress.push(`${done}/${total}`), async (f) => `u/${f.name}`);
    expect(progress).toHaveLength(12);
    expect(progress[progress.length - 1]).toBe('12/12');
  });

  it('does not fall back to inlining base64 when uploads fail', async () => {
    // The single-image picker falls back to a data URL. Doing that here would
    // push megabytes back into Postgres, so a failed bulk upload must yield
    // nothing at all rather than a data: URI.
    const files = [fakeFile('x.jpg'), fakeFile('y.jpg')];
    const { urls, failed } = await uploadImages(files, 'listings', undefined, async () => {
      throw new Error('bucket missing');
    });
    expect(urls).toEqual([]);
    expect(failed).toEqual(['x.jpg', 'y.jpg']);
  });

  it('uploads a big batch a few at a time', async () => {
    let active = 0;
    let peak = 0;
    const files = Array.from({ length: 100 }, (_, i) => fakeFile(`${i}.jpg`));
    const { urls, failed } = await uploadImages(files, 'listings', undefined, async (f) => {
      active++; peak = Math.max(peak, active);
      await tick(1);
      active--;
      return `u/${f.name}`;
    });
    expect(peak).toBe(UPLOAD_CONCURRENCY);
    expect(urls).toHaveLength(100);
    expect(failed).toEqual([]);
  });
});
