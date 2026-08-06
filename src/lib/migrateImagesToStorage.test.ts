import { describe, it, expect, vi, beforeEach } from 'vitest';

const uploadImage = vi.fn();
vi.mock('./storage', () => ({ uploadImage: (...a: unknown[]) => uploadImage(...a) }));

const { isInlineImage, inlineImageStats, dataUrlToFile, migrateImages } =
  await import('./migrateImagesToStorage');

// A 1×1 transparent GIF — small, real, and decodable by atob.
const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

beforeEach(() => {
  uploadImage.mockReset();
  uploadImage.mockResolvedValue('https://cdn.example/img.jpg');
});

describe('isInlineImage', () => {
  it('recognises the base64 photos that predate Storage', () => {
    expect(isInlineImage(PIXEL)).toBe(true);
  });

  // Anything already hosted must be left alone, so a second run is a no-op
  // and a half-migrated house finishes rather than restarts.
  it.each([
    ['https://cdn.example/a.jpg'],
    ['/local/a.jpg'],
    [''],
  ])('leaves %s alone', (src) => {
    expect(isInlineImage(src)).toBe(false);
  });

  it('does not treat a non-image data URL as a photo', () => {
    expect(isInlineImage('data:application/pdf;base64,AAAA')).toBe(false);
  });
});

describe('inlineImageStats', () => {
  it('separates what is still in the database from what is hosted', () => {
    const s = inlineImageStats([PIXEL, 'https://cdn.example/a.jpg', PIXEL]);
    expect(s.inline).toBe(2);
    expect(s.hosted).toBe(1);
  });

  it('estimates the decoded size, not the base64 length', () => {
    const s = inlineImageStats([PIXEL]);
    const encodedLength = PIXEL.length - PIXEL.indexOf(',') - 1;
    expect(s.bytes).toBeLessThan(encodedLength);
    expect(s.bytes).toBeGreaterThan(0);
  });

  it('survives a house with no photos', () => {
    expect(inlineImageStats([])).toEqual({ inline: 0, hosted: 0, bytes: 0 });
  });
});

describe('dataUrlToFile', () => {
  it('recovers the declared mime type', () => {
    expect(dataUrlToFile(PIXEL, 'a.gif').type).toBe('image/gif');
  });

  it('produces a non-empty file', () => {
    expect(dataUrlToFile(PIXEL, 'a.gif').size).toBeGreaterThan(0);
  });
});

describe('migrateImages', () => {
  it('replaces each inline photo with its uploaded URL', async () => {
    const r = await migrateImages([PIXEL, PIXEL]);
    expect(r.images).toEqual(['https://cdn.example/img.jpg', 'https://cdn.example/img.jpg']);
    expect(r.moved).toBe(2);
    expect(r.changed).toBe(true);
  });

  it('preserves order and leaves hosted URLs untouched', async () => {
    const r = await migrateImages(['https://cdn.example/keep.jpg', PIXEL]);
    expect(r.images[0]).toBe('https://cdn.example/keep.jpg');
    expect(r.images[1]).toBe('https://cdn.example/img.jpg');
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });

  // THE important one. Losing an owner's photo to tidy up storage would be a
  // far worse outcome than leaving it inline for another day.
  it('keeps the original when an upload fails, and carries on', async () => {
    uploadImage
      .mockRejectedValueOnce(new Error('bucket missing'))
      .mockResolvedValueOnce('https://cdn.example/second.jpg');
    const r = await migrateImages([PIXEL, PIXEL]);
    expect(r.images[0]).toBe(PIXEL);
    expect(r.images[1]).toBe('https://cdn.example/second.jpg');
    expect(r.failed).toBe(1);
    expect(r.moved).toBe(1);
  });

  it('reports no change when every upload failed, so nothing is written back', async () => {
    uploadImage.mockRejectedValue(new Error('nope'));
    const r = await migrateImages([PIXEL]);
    expect(r.changed).toBe(false);
    expect(r.images).toEqual([PIXEL]);
  });

  it('is a no-op on a house that has already been migrated', async () => {
    const hosted = ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'];
    const r = await migrateImages(hosted);
    expect(uploadImage).not.toHaveBeenCalled();
    expect(r.changed).toBe(false);
    expect(r.images).toEqual(hosted);
  });

  it('counts progress against the inline photos only', async () => {
    const seen: string[] = [];
    await migrateImages(['https://cdn.example/a.jpg', PIXEL, PIXEL], {
      onProgress: (done, total) => seen.push(`${done}/${total}`),
    });
    expect(seen).toEqual(['1/2', '2/2']);
  });
});
