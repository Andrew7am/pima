import { uploadImage } from './storage';

/**
 * Moving the photos that predate Storage out of the database.
 *
 * Photos used to be written into houses.images as base64 data URLs. Migration
 * 066 added a Storage bucket and PhotoPickerButtons has uploaded there ever
 * since — compressed to 1600px JPEG — so anything added lately is already an
 * https URL. What is left is the backlog: the rows written before that, still
 * sitting in Postgres as multi-megabyte strings and still being shipped to
 * anyone who opens the house.
 *
 * Migration 106 stopped the LIST paying for them. This clears them properly.
 *
 * Two things this deliberately does not do:
 *
 *   - It does not touch a URL it did not recognise. An https link, a relative
 *     path, an empty string: left exactly as found. Only `data:image/…` is
 *     converted, so running it twice is safe and running it on a half-migrated
 *     house finishes the job rather than starting over.
 *
 *   - It does not delete anything. The old string is replaced in the array
 *     only after the upload returned a URL; if the upload throws, that photo
 *     keeps its data URL and the rest still move.
 */

/** True for the base64 data URLs that predate Storage. */
export function isInlineImage(src: string): boolean {
  return typeof src === 'string' && src.startsWith('data:image/');
}

/** How much of this house still lives in the database. */
export function inlineImageStats(images: string[]): { inline: number; hosted: number; bytes: number } {
  let inline = 0, hosted = 0, bytes = 0;
  for (const src of images ?? []) {
    if (isInlineImage(src)) {
      inline++;
      // A data URL is ~4/3 the size of the bytes it encodes, plus the header.
      bytes += Math.round((src.length - src.indexOf(',') - 1) * 0.75);
    } else if (src) {
      hosted++;
    }
  }
  return { inline, hosted, bytes };
}

/** Turn one data URL back into a File the uploader can compress. */
export function dataUrlToFile(dataUrl: string, name: string): File {
  const [header, encoded] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'image/jpeg';
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

export interface MigrateResult {
  images: string[];
  moved: number;
  failed: number;
  /** True when at least one photo moved, i.e. the row is worth writing back. */
  changed: boolean;
}

/**
 * Upload every inline photo in one house and return the rewritten array.
 *
 * `folder` keeps the Storage layout the same as fresh uploads, so nothing
 * downstream has to tell a migrated photo from a new one.
 */
export async function migrateImages(
  images: string[],
  opts: { folder?: string; onProgress?: (done: number, total: number) => void } = {},
): Promise<MigrateResult> {
  const folder = opts.folder ?? 'listings';
  const list = images ?? [];
  const total = list.filter(isInlineImage).length;
  const out: string[] = [];
  let moved = 0, failed = 0;

  for (const src of list) {
    if (!isInlineImage(src)) { out.push(src); continue; }
    try {
      const url = await uploadImage(dataUrlToFile(src, `migrated-${moved + failed}.jpg`), folder);
      out.push(url);
      moved++;
    } catch (err) {
      // Keep the original. A photo that fails to move is still a photo the
      // owner uploaded, and losing it to tidy up would be the worse trade.
      console.error('migrateImages: keeping inline copy after upload failure', err);
      out.push(src);
      failed++;
    }
    opts.onProgress?.(moved + failed, total);
  }

  return { images: out, moved, failed, changed: moved > 0 };
}
