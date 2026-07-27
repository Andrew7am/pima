// Every "contact us on WhatsApp" entry point in the app resolves through here.
//
// ⚠️ SUPPORT_WHATSAPP is still the placeholder that was copy-pasted into six
// screens — including the ones shown to a BANNED user and to an owner stuck
// waiting for approval, i.e. exactly the people with no other way to reach you.
// Nobody is on the other end of it. Replace the digits below with the real
// support line; there is now only this one place to change.
//
// Format: country code + number, digits only, no '+' or spaces (wa.me's rule).
const SUPPORT_WHATSAPP = '201234567890';

const DEFAULT_MESSAGE = 'سلام ونعمة أريد الاستفسار عن بيوت المؤتمرات';

/**
 * wa.me link to support. Pass a message to pre-fill the chat, or '' for a bare
 * link with no draft (the footer's "تواصل معنا" uses that form).
 */
export function supportWhatsAppUrl(message: string = DEFAULT_MESSAGE): string {
  const base = `https://wa.me/${SUPPORT_WHATSAPP}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
