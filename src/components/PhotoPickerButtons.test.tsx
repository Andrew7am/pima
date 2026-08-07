import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import PhotoPickerButtons from './PhotoPickerButtons';

// Registering a conference house means uploading its whole album — a hundred
// photos is a normal listing, not an edge case. These pin the two halves of
// that: the bulk path really is bulk, and the single-image callers (avatar,
// promo banner, house cover) were not silently converted along with it.

const uploadImage = vi.fn();
const uploadImages = vi.fn();
vi.mock('../lib/storage', () => ({
  uploadImage: (...a: unknown[]) => uploadImage(...a),
  uploadImages: (...a: unknown[]) => uploadImages(...a),
}));

const fileNamed = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

function fileInput(idPrefix: string): HTMLInputElement {
  return document.getElementById(`${idPrefix}-gallery`) as HTMLInputElement;
}

/** jsdom will not let you assign to input.files, so define it directly. */
function pick(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  act(() => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}

beforeEach(() => {
  uploadImage.mockReset().mockResolvedValue('https://cdn/one.jpg');
  uploadImages.mockReset().mockResolvedValue({ urls: [], failed: [] });
});

describe('PhotoPickerButtons', () => {
  it('does NOT accept multiple files by default — avatars and banners are one image', () => {
    render(<PhotoPickerButtons idPrefix="avatar" onSelect={vi.fn()} />);
    expect(fileInput('avatar').multiple).toBe(false);
    expect(screen.getByText('اختر صورة')).toBeTruthy();
  });

  it('accepts multiple files when asked, and says so on the button', () => {
    render(<PhotoPickerButtons idPrefix="album" multiple onSelect={vi.fn()} />);
    expect(fileInput('album').multiple).toBe(true);
    expect(screen.getByText('اختر صور')).toBeTruthy();
  });

  it('hands a whole selection to onSelectMany in one call', async () => {
    uploadImages.mockResolvedValue({ urls: ['u/1', 'u/2', 'u/3'], failed: [] });
    const onSelectMany = vi.fn();
    render(<PhotoPickerButtons idPrefix="album" multiple onSelect={vi.fn()} onSelectMany={onSelectMany} />);

    pick(fileInput('album'), ['a.jpg', 'b.jpg', 'c.jpg'].map(fileNamed));

    await waitFor(() => expect(onSelectMany).toHaveBeenCalledTimes(1));
    expect(onSelectMany).toHaveBeenCalledWith(['u/1', 'u/2', 'u/3']);
    // The per-photo callback must not ALSO fire, or callers that append would
    // add every photo twice.
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('falls back to calling onSelect per photo when the caller only appends', async () => {
    uploadImages.mockResolvedValue({ urls: ['u/1', 'u/2'], failed: [] });
    const onSelect = vi.fn();
    render(<PhotoPickerButtons idPrefix="wiz" multiple onSelect={onSelect} />);

    pick(fileInput('wiz'), ['a.jpg', 'b.jpg'].map(fileNamed));

    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(2));
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual(['u/1', 'u/2']);
  });

  it('tells the owner how many photos failed instead of dropping them quietly', async () => {
    uploadImages.mockResolvedValue({ urls: ['u/1'], failed: ['b.jpg', 'c.jpg', 'd.jpg'] });
    render(<PhotoPickerButtons idPrefix="album" multiple onSelect={vi.fn()} onSelectMany={vi.fn()} />);

    pick(fileInput('album'), ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'].map(fileNamed));

    // Arabic-indic ٣, matching every other number in the owner UI.
    await waitFor(() => expect(screen.getByText(/٣ من الصور مرفعتش/)).toBeTruthy());
  });

  it('routes a single pick through the single-image path even in multiple mode', async () => {
    const onSelect = vi.fn();
    render(<PhotoPickerButtons idPrefix="album" multiple onSelect={onSelect} />);

    pick(fileInput('album'), [fileNamed('only.jpg')]);

    // One file keeps the base64 fallback that uploadImage provides; the bulk
    // helper deliberately has none.
    await waitFor(() => expect(uploadImage).toHaveBeenCalledTimes(1));
    expect(uploadImages).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith('https://cdn/one.jpg');
  });

  it('shows upload progress as a count, not a bare spinner', async () => {
    let report: ((d: number, t: number) => void) | undefined;
    uploadImages.mockImplementation((_f: File[], _folder: string, onProgress: (d: number, t: number) => void) => {
      report = onProgress;
      return new Promise(() => { /* stay in flight so the label is observable */ });
    });
    render(<PhotoPickerButtons idPrefix="album" multiple onSelect={vi.fn()} />);

    pick(fileInput('album'), ['a.jpg', 'b.jpg', 'c.jpg'].map(fileNamed));

    await waitFor(() => expect(report).toBeTypeOf('function'));
    act(() => report!(2, 3));
    await waitFor(() => expect(screen.getByText('جارٍ الرفع… ٢ من ٣')).toBeTruthy());
  });
});
