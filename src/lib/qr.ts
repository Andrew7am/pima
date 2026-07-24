import QRCode from 'qrcode';

// A booking's QR encodes a namespaced token so the scanner can tell Pima
// check-in codes apart from any other QR the camera happens to see.
export const QR_PREFIX = 'pima:checkin:';

export function bookingQrToken(bookingId: string): string {
  return QR_PREFIX + bookingId;
}

export function parseBookingQr(text: string): string | null {
  return text.startsWith(QR_PREFIX) ? text.slice(QR_PREFIX.length) : null;
}

export async function bookingQrDataUrl(bookingId: string): Promise<string> {
  return QRCode.toDataURL(bookingQrToken(bookingId), { margin: 1, width: 240, color: { dark: '#101B33', light: '#ffffff' } });
}

// Opens a window showing a booking's check-in QR for the guest to present
// at arrival (the owner scans it to check them in).
export async function openBookingQrWindow(bookingId: string, guest: string, houseName: string, ref: string) {
  const dataUrl = await bookingQrDataUrl(bookingId);
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>رمز الوصول ${ref}</title>
<style>*{font-family:'Segoe UI',Tahoma,sans-serif;box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F8F9FB}
.c{text-align:center;background:#fff;border:1px solid #E8ECF4;border-radius:24px;padding:32px 40px}
.h{font-size:20px;font-weight:900;color:#1F2E4E}.s{font-size:13px;color:#5B6B8C;font-weight:700;margin-top:4px}
img{width:240px;height:240px;margin:20px 0}.g{font-size:15px;font-weight:800;color:#101B33}.r{font-family:monospace;color:#5B6B8C;font-size:13px;margin-top:4px}
.n{font-size:11px;color:#5B6B8C;margin-top:16px}</style></head>
<body><div class="c"><div class="h">${houseName}</div><div class="s">رمز الوصول — بيما</div>
<img src="${dataUrl}" alt="QR"/><div class="g">${guest}</div><div class="r">#${ref}</div>
<div class="n">اعرض هذا الرمز عند الوصول لتسجيل دخولك فورًا.</div></div></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('من فضلك اسمح بالنوافذ المنبثقة لعرض الرمز.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
