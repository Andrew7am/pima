// Every "contact us on WhatsApp" entry point in the app resolves through here.
//
// The number used to be a constant in this file, which meant changing it was a
// code edit and a deploy. It now lives in platform_settings and the admin panel
// edits it — App.tsx calls setSupportWhatsApp() as soon as settings load.
//
// The value below is only the fallback for the window before that call lands,
// and for the paths that can render before any settings fetch finishes: the
// banned-user screen and the owner-pending-approval screen. Those are shown to
// exactly the people with no other way to reach anyone, so the fallback has to
// be a number that actually answers — not a placeholder.
//
// Format: country code + number, digits only, no '+' or spaces (wa.me's rule).
// The DB enforces the same shape (migration 103).
const FALLBACK_WHATSAPP = '201096126259';

let supportWhatsApp = FALLBACK_WHATSAPP;

/**
 * Point every support link at the number the admin configured. Called once from
 * App.tsx when platform settings arrive. Anything that is not a bare wa.me
 * number is ignored, so a bad value saved in settings can never turn the
 * support link into a dead one.
 */
export function setSupportWhatsApp(value: string | null | undefined): void {
  const digits = (value ?? '').replace(/\D/g, '');
  supportWhatsApp = /^\d{8,15}$/.test(digits) ? digits : FALLBACK_WHATSAPP;
}

/** The number currently in use — for screens that show it as text. */
export function supportWhatsAppNumber(): string {
  return supportWhatsApp;
}

const DEFAULT_MESSAGE = 'سلام ونعمة أريد الاستفسار عن بيوت المؤتمرات';

/**
 * wa.me link to support. Pass a message to pre-fill the chat, or '' for a bare
 * link with no draft (the footer's "تواصل معنا" uses that form).
 */
export function supportWhatsAppUrl(message: string = DEFAULT_MESSAGE): string {
  const base = `https://wa.me/${supportWhatsApp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
