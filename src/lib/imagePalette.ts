// Pull a small palette out of the banner artwork so the studio can suggest
// colours that actually belong to the picture, instead of leaving the admin to
// guess. Runs entirely in the browser on a downscaled copy — no upload, no
// service, and it fails quietly to an empty list if the image can't be read
// (a cross-origin photo without CORS headers taints the canvas).

export interface Palette {
  /** Most common colours, darkest-to-lightest sorted by prominence. */
  colors: string[];
  /** A readable text colour for the artwork overall. */
  suggestedText: string;
  /** A button fill that stands out against it. */
  suggestedAccent: string;
}

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

// Perceived brightness (ITU-R BT.601) — decides black-on-light vs white-on-dark.
const luma = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;

export async function extractPalette(src: string): Promise<Palette | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loaded = new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); });
    img.src = src;
    await loaded;

    const W = 48, H = 48; // plenty for counting dominant colours, and fast
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    // Bucket into a coarse grid so near-identical pixels count together.
    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
    let sum = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue; // skip transparent
      const r = data[i], g = data[i + 1], b = data[i + 2];
      sum += luma(r, g, b); count++;
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      cur.n++; cur.r += r; cur.g += g; cur.b += b;
      buckets.set(key, cur);
    }
    if (count === 0) return null;

    const colors = [...buckets.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, 6)
      .map((c) => hex(Math.round(c.r / c.n), Math.round(c.g / c.n), Math.round(c.b / c.n)));

    const avg = sum / count;
    const suggestedText = avg < 0.5 ? '#FFFFFF' : '#111111';
    // The accent is the most saturated of the top colours, so the button reads
    // as a deliberate choice rather than a muddy average.
    const accent = colors
      .map((h) => {
        const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
        return { h, sat: Math.max(r, g, b) - Math.min(r, g, b) };
      })
      .sort((a, b) => b.sat - a.sat)[0];

    return { colors, suggestedText, suggestedAccent: accent?.h ?? '#C5A059' };
  } catch {
    return null; // tainted canvas / unreachable image — the studio just hides the suggestions
  }
}
