/**
 * The two halves of the image_descriptions contract, pinned at the source.
 *
 * Migration 0130 deleted every historical entry in houses.image_descriptions,
 * and the argument that this was safe rests entirely on two properties of the
 * owner gallery in OwnerDashboardShell:
 *
 *   1. WRITE — new labels are keyed by the image's CURRENT STORAGE URL. If a
 *      future change ever keys them by the image bytes again, 0130's cleanup
 *      becomes a recurring data-loss bug instead of a one-off tidy-up, and the
 *      452 KB comes straight back into the public browse payload.
 *
 *   2. READ  — a key that matches nothing degrades to «صورة إضافية» rather
 *      than throwing or rendering blank. This is why deleting unmatched keys
 *      changed nothing anyone could see.
 *
 * These are SOURCE assertions, not render assertions: OwnerDashboardShell is a
 * ~2,700-line screen and the caption is one inline expression inside it, so
 * mounting the whole thing to read one string would be slower and no more
 * truthful. They fail the moment either property is edited away, which is the
 * job.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SHELL = join(process.cwd(), 'src', 'components', 'owner', 'OwnerDashboardShell.tsx');
const src = readFileSync(SHELL, 'utf8');
/** Collapse whitespace so a reformat does not fail the test. */
const flat = src.replace(/\s+/g, ' ');

describe('owner photo labels — the write path', () => {
  // extraPhotoUrls holds what was just uploaded to Storage; the label is
  // stored under that URL.
  it('keys a new description by the uploaded URL', () => {
    expect(flat).toContain('extraPhotoUrls.forEach((u) => { added[u] = descStr; })');
  });

  it('builds on the existing map rather than replacing it', () => {
    expect(flat).toContain('const added = { ...(base.imageDescriptions || {}) }');
  });

  it('submits images and imageDescriptions together, through the edit-review flow', () => {
    expect(flat).toContain('requestHouseEdit(house, { images: [...base.images, ...extraPhotoUrls], imageDescriptions: added })');
  });

  // The regression 0130 exists to prevent ever recurring.
  it('never constructs a data: / base64 key for a description', () => {
    const writeRegion = src.slice(
      Math.max(0, src.indexOf('const added = { ...(base.imageDescriptions')) - 600,
      src.indexOf('const added = { ...(base.imageDescriptions') + 600,
    );
    expect(writeRegion).not.toMatch(/added\[[^\]]*\bdata:/);
    expect(writeRegion).not.toMatch(/toDataURL|readAsDataURL/);
  });
});

describe('owner photo labels — the read path', () => {
  // A key that matches nothing must fall back, not blank out. This is exactly
  // what made every orphaned entry invisible, and therefore safe to delete.
  it('looks the caption up by the image URL and falls back when it misses', () => {
    expect(flat).toContain(
      "const desc = base.imageDescriptions?.[img] || (idx === 0 ? 'الصورة الرئيسية' : 'صورة إضافية')",
    );
  });

  it('renders that caption rather than the raw key', () => {
    expect(flat).toContain('>{desc}</div>');
  });
});
