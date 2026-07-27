import { Booking } from '../types';
import { escapeHtml, openPrintWindow } from './printWindow';

const INVOICE_CSS = `
  * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, sans-serif; }
  body { margin: 0; padding: 32px; color: #101B33; background: #fff; }
  .card { max-width: 620px; margin: 0 auto; border: 1px solid #E8ECF4; border-radius: 20px; padding: 28px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1F2E4E; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: 900; color: #1F2E4E; }
  .brand small { display:block; font-size: 12px; font-weight: 700; color: #5B6B8C; }
  .meta { text-align: left; font-size: 12px; color: #5B6B8C; }
  .meta b { color: #101B33; }
  h1 { font-size: 15px; margin: 0 0 14px; color: #1F2E4E; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 9px 4px; font-size: 13px; border-bottom: 1px dashed #E8ECF4; }
  .lbl { color: #5B6B8C; font-weight: 700; }
  .val { text-align: left; font-weight: 800; }
  .val.strong { font-size: 16px; color: #1F2E4E; }
  .total { background: #1F2E4E; color: #fff; border-radius: 14px; padding: 14px 16px; display:flex; justify-content: space-between; align-items:center; margin-top: 16px; font-weight: 900; }
  .total .amt { font-size: 20px; }
  .note { margin-top: 16px; font-size: 11px; color: #5B6B8C; line-height: 1.7; }
  .foot { margin-top: 22px; text-align:center; font-size: 11px; color: #5B6B8C; }
  @media print { body { padding: 0; } .card { border: none; } }
`;

const STATEMENT_CSS = `
  * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, sans-serif; }
  body { margin: 0; padding: 32px; color: #101B33; }
  .card { max-width: 640px; margin: 0 auto; border: 1px solid #E8ECF4; border-radius: 20px; padding: 28px; }
  .head { display:flex; justify-content: space-between; align-items:flex-start; border-bottom: 2px solid #1F2E4E; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: 900; color: #1F2E4E; }
  .brand small { display:block; font-size: 12px; font-weight:700; color:#5B6B8C; }
  .meta { text-align:left; font-size:12px; color:#5B6B8C; } .meta b { color:#101B33; }
  h1 { font-size:15px; margin: 0 0 12px; color:#1F2E4E; }
  table { width:100%; border-collapse: collapse; margin-bottom: 8px; }
  td, th { padding: 8px 4px; font-size: 13px; border-bottom: 1px dashed #E8ECF4; text-align: right; }
  th { color:#5B6B8C; font-weight:800; border-bottom: 1px solid #E8ECF4; }
  .num, .val { text-align: left; font-weight: 800; }
  .lbl { color:#5B6B8C; font-weight:700; }
  tr.net td { border-top: 2px solid #1F2E4E; border-bottom: none; font-size: 15px; color: #1F2E4E; font-weight: 900; padding-top: 12px; }
  tr.neg .val { color: #EF4444; }
  .foot { margin-top:18px; text-align:center; font-size:11px; color:#5B6B8C; }
  @media print { body { padding:0; } .card { border:none; } }
`;

// Opens a clean, print-ready invoice for a booking in a new window and
// triggers the browser print dialog (the guest/owner saves it as PDF).
// Rendering happens in the browser, so Arabic RTL just works — no PDF
// library or font embedding needed.
export function printBookingInvoice(booking: Booking, houseName: string) {
  const nights = Math.max(1, Math.round((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86_400_000));
  const deposit = booking.depositPaid ? booking.depositAmount : 0;
  const remaining = Math.max(0, booking.totalPrice - deposit);
  const ref = `#${booking.id.replace(/^booking_/, '').slice(-6)}`;
  const issued = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  const money = (n: number) => `${n.toLocaleString('ar-EG')} ج.م`;

  // Everything below carries guest- or owner-entered text into markup, so it is
  // escaped once here rather than trusted at each interpolation point.
  const safeHouse = escapeHtml(houseName);
  const guest = escapeHtml(booking.organizationName || booking.userName);
  const checkIn = escapeHtml(booking.checkIn);
  const checkOut = escapeHtml(booking.checkOut);

  const row = (label: string, value: string, strong = false) =>
    `<tr><td class="lbl">${label}</td><td class="val${strong ? ' strong' : ''}">${value}</td></tr>`;

  const body = `
  <div class="card">
    <div class="head">
      <div class="brand">${safeHouse}<small>عبر منصة بيما · pimastay.com</small></div>
      <div class="meta">فاتورة <b>${escapeHtml(ref)}</b><br>تاريخ الإصدار: <b>${escapeHtml(issued)}</b></div>
    </div>
    <h1>تفاصيل الحجز</h1>
    <table>
      ${row('الضيف / الجهة', guest)}
      ${row('تاريخ الوصول', checkIn)}
      ${row('تاريخ المغادرة', checkOut)}
      ${row('عدد الليالي', String(nights))}
      ${row('عدد الأفراد', String(booking.guestsCount))}
      ${row('إجمالي قيمة الحجز', money(booking.totalPrice), true)}
      ${row('العربون المدفوع عبر Pima', money(deposit))}
    </table>
    <div class="total"><span>المبلغ المتبقي عند الوصول</span><span class="amt">${money(remaining)}</span></div>
    <p class="note">يُدفع العربون إلكترونيًا عبر بيما، ويُحصَّل المبلغ المتبقي نقدًا في بيت المؤتمرات عند وصول الضيوف. هذه الفاتورة صادرة إلكترونيًا ولا تحتاج ختمًا.</p>
    <div class="foot">شكرًا لاختياركم ${safeHouse} — نتمنى لكم إقامة طيبة 🌿</div>
  </div>`;

  openPrintWindow({
    title: `فاتورة ${ref}`,
    css: INVOICE_CSS,
    body,
    focusOnLoad: true,
    blockedMessage: 'من فضلك اسمح بالنوافذ المنبثقة لطباعة الفاتورة.',
  });
}

// A printable monthly financial statement (revenue / commission / expenses
// / net) with a per-booking breakdown — for the owner's accounting.
export function printMonthlyStatement(p: {
  houseName: string; monthLabel: string;
  revenue: number; commission: number; deposits: number; remaining: number; expenses: number; net: number;
  bookings: { guest: string; date: string; total: number }[];
}) {
  const money = (n: number) => `${Math.round(n).toLocaleString('ar-EG')} ج.م`;
  const issued = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  const line = (label: string, value: string, cls = '') => `<tr class="${cls}"><td class="lbl">${label}</td><td class="val">${value}</td></tr>`;

  const safeHouse = escapeHtml(p.houseName);
  const monthLabel = escapeHtml(p.monthLabel);
  const bookingRows = p.bookings.length
    ? p.bookings.map((b) => `<tr><td>${escapeHtml(b.guest)}</td><td>${escapeHtml(b.date)}</td><td class="num">${money(b.total)}</td></tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;color:#5B6B8C">لا توجد حجوزات في هذا الشهر</td></tr>`;

  const body = `
  <div class="card">
    <div class="head">
      <div class="brand">${safeHouse}<small>كشف حساب مالي · عبر بيما</small></div>
      <div class="meta">الشهر: <b>${monthLabel}</b><br>تاريخ الإصدار: <b>${escapeHtml(issued)}</b></div>
    </div>

    <h1>الملخص المالي</h1>
    <table>
      ${line('إجمالي قيمة الحجوزات', money(p.revenue))}
      ${line('العربون المحصّل عبر Pima', money(p.deposits))}
      ${line('المتبقي المحصّل نقدًا', money(p.remaining))}
      ${line('عمولة Pima', '− ' + money(p.commission), 'neg')}
      ${line('المصروفات', '− ' + money(p.expenses), 'neg')}
      <tr class="net"><td>صافي الربح</td><td class="val">${money(p.net)}</td></tr>
    </table>

    <h1>تفاصيل الحجوزات (${p.bookings.length})</h1>
    <table>
      <thead><tr><th>الضيف / الجهة</th><th>التاريخ</th><th class="num">القيمة</th></tr></thead>
      <tbody>${bookingRows}</tbody>
    </table>

    <div class="foot">كشف صادر إلكترونيًا من منصة بيما — pimastay.com</div>
  </div>`;

  openPrintWindow({
    title: `كشف حساب ${p.monthLabel}`,
    css: STATEMENT_CSS,
    body,
    blockedMessage: 'من فضلك اسمح بالنوافذ المنبثقة لطباعة الكشف.',
  });
}
