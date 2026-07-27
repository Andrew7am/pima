// Shared plumbing for the printable documents (invoice, statement, rooming
// list, badges, check-in QR).
//
// These render by writing HTML into a `window.open('', '_blank')` document.
// That window inherits THIS app's origin, so anything interpolated into the
// markup runs with the app's privileges — including access to the Supabase
// session in localStorage. Guest-supplied strings reach these templates
// (booking.userName, organizationName, attendee names) and the person who
// prints is usually the owner, so an unescaped name is a straight path from
// "guest types a name" to "owner's session is stolen".
//
// Every interpolated value must go through escapeHtml.

/** Renders a value as text, never as markup. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface PrintWindowOptions {
  /** Document title. Escaped for you. */
  title: string;
  /** Stylesheet body, without the <style> tags. Author-controlled, not escaped. */
  css: string;
  /** Document body. Must already be escaped by the caller. */
  body: string;
  /** Fire the browser print dialog once rendered. Default true. */
  autoPrint?: boolean;
  /** Delay before printing, so images and fonts settle first. */
  printDelayMs?: number;
  /** Pull the new window to the front on load. */
  focusOnLoad?: boolean;
  /** Shown when the popup blocker gets in the way. */
  blockedMessage?: string;
}

export function openPrintWindow({
  title,
  css,
  body,
  autoPrint = true,
  printDelayMs = 350,
  focusOnLoad = false,
  blockedMessage = 'من فضلك اسمح بالنوافذ المنبثقة للطباعة.',
}: PrintWindowOptions): void {
  const w = window.open('', '_blank');
  if (!w) { alert(blockedMessage); return; }

  const bodyAttrs = focusOnLoad ? ' onload="window.focus()"' : '';
  const printScript = autoPrint
    ? `<script>setTimeout(function(){ window.print(); }, ${printDelayMs});</script>`
    : '';

  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${css}</style></head>
<body${bodyAttrs}>${body}${printScript}</body></html>`;

  w.document.open();
  w.document.write(html);
  w.document.close();
}
