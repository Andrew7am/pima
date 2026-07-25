// Admin-entered banner links are rendered as real anchors, so the scheme has to
// be vetted: a `javascript:` (or `data:`) href would execute in the visitor's
// page. Only these navigational schemes are allowed through; anything else
// (including a malformed URL) yields null and the caller renders no link.
const ALLOWED = ['http:', 'https:', 'mailto:', 'tel:'];

export function safeUrl(raw?: string | null): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;
  // Bare domains typed without a scheme ("instagram.com/pima") are common —
  // treat them as https rather than rejecting them.
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return ALLOWED.includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
