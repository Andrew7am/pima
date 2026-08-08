import type { RetreatHouse, PlatformSettings, User } from '../types';
import { computeStayPrice, computeMealPlan, activeDiscountFor, applyDiscount, isDayUse } from './pricing';
import { openPrintWindow, escapeHtml } from './printWindow';

/**
 * The sheet the servant carries to his priest.
 *
 * Every booking on this platform is decided by someone who will never open
 * it. A church servant does not choose the retreat house — he proposes it, in
 * a meeting after the liturgy, to a priest who asks two questions: what does
 * it cost per head, and what happens if we cancel. Pima has always optimised
 * the person tapping the buttons and had nothing at all for the person who
 * says yes.
 *
 * Two things here are not just a re-print of the booking screen:
 *
 *  - The cancellation terms are written as DATES AND AMOUNTS, not
 *    percentages. «قبل ١٢ أغسطس: يرجع كامل ٤٬٥٠٠ ج.م» is a sentence a priest
 *    can act on; «استرجاع ١٠٠٪ قبل ١٤ يوم» is one he has to do arithmetic on
 *    in a meeting.
 *
 *  - The adjacent weekends are priced too. Seasonal rates and house discounts
 *    make the same trip cost materially different one week either side, and
 *    the servant cannot work that out — but it is exactly what he will be
 *    asked. Computed from the same pricing functions the booking uses, so the
 *    number on the paper is the number he gets.
 *
 * Nothing here is stored. It is a projection of what the booking WOULD cost,
 * built from live house data at the moment it is printed.
 */

export interface QuoteLine {
  label: string;
  amount: number;
  /** A quiet second line under the label — «٣ ليالي × ٤٠ فرد» and the like. */
  hint?: string;
}

export interface CancellationStep {
  /** The boundary date itself. */
  when: string;
  /**
   * «لغاية» or «بعد».
   *
   * getRefundTier bands INCLUSIVELY — full refund while daysLeft >=
   * freeCancelDays — so the boundary day is still inside the better tier.
   * Writing «قبل ٢٧ أغسطس» excluded the 27th and understated the window by a
   * day on every rung. «لغاية ٢٧ أغسطس» is what the policy actually says.
   */
  edge: 'until' | 'after';
  /** What comes back, in pounds — not a percentage. */
  refund: number;
  label: string;
  /** False once the date has passed — printed struck through, not as an offer. */
  stillAvailable: boolean;
}

export interface AlternativeWeek {
  checkIn: string;
  checkOut: string;
  total: number;
  /** Negative = cheaper than the chosen dates. */
  delta: number;
}

export interface PriestQuote {
  houseName: string;
  governorate: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestsCount: number;
  lines: QuoteLine[];
  total: number;
  perHead: number;
  depositDue: number;
  balanceAtArrival: number;
  discountPct: number;
  cancellation: CancellationStep[];
  alternatives: AlternativeWeek[];
  priestName?: string;
  churchName?: string;
  servantName: string;
}

const DAY = 86400000;

const isoOf = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * Move a calendar date, by the calendar.
 *
 * The first version added days × 86,400,000 ms. A day in Africa/Cairo is not
 * always that long — DST starts 24 April and ends 30 October — so a shift
 * across a transition landed at 23:00 the previous day and reported that day
 * instead. Because check-in and check-out were shifted independently, an
 * alternative week could silently gain or lose a NIGHT and then be priced at
 * that wrong length: a trip on 29–31 October advertised the following week as
 * «أكتر بـ ٤٬٠٠٠ ج.م» when it costs exactly the same.
 *
 * setDate re-resolves local midnight, which is what pricing.ts has always
 * done. The tests missed it by pinning every case to September.
 */
function shiftDate(iso: string, days: number): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  d.setDate(d.getDate() + days);
  return isoOf(d);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const m1 = checkIn.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const m2 = checkOut.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m1 || !m2) return 0;
  const a = new Date(+m1[1], +m1[2] - 1, +m1[3]).getTime();
  const b = new Date(+m2[1], +m2[2] - 1, +m2[3]).getTime();
  return Math.max(0, Math.round((b - a) / DAY));
}

/**
 * What the stay costs, by the same path the booking takes.
 *
 * Accommodation is discounted; meals are not — which is what
 * validate_booking_price does on the server, so the sheet cannot quote a
 * price the database would refuse.
 */
function priceFor(
  house: RetreatHouse,
  checkIn: string,
  checkOut: string,
  guestsCount: number,
  withMeals: boolean,
): { accommodation: number; discounted: number; meals: number; total: number; discountPct: number } {
  const stay = computeStayPrice(house, checkIn, checkOut, guestsCount);
  const discountPct = activeDiscountFor(house, checkIn);
  const discounted = applyDiscount(stay.total, discountPct);
  const plan = computeMealPlan(house, checkIn, checkOut, guestsCount);
  const meals = withMeals && plan.state === 'priced' ? plan.total : 0;
  return { accommodation: stay.total, discounted, meals, total: discounted + meals, discountPct };
}

export function buildPriestQuote(args: {
  house: RetreatHouse;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  withMeals: boolean;
  hallFee?: number;
  /** Points the servant is redeeming — the guest is charged after this. */
  pointsDiscount?: number;
  settings: PlatformSettings;
  servant: Pick<User, 'name' | 'priestName' | 'churchName'>;
  today?: Date;
}): PriestQuote {
  const { house, checkIn, checkOut, guestsCount, withMeals, settings, servant } = args;
  const hallFee = args.hallFee ?? 0;
  const pointsDiscount = args.pointsDiscount ?? 0;
  const today = args.today ?? new Date();

  const p = priceFor(house, checkIn, checkOut, guestsCount, withMeals);
  const total = Math.max(0, p.total + hallFee - pointsDiscount);
  const nights = nightsBetween(checkIn, checkOut);
  // «يوم روحي» — arrive and leave the same day. computeStayPrice charges the
  // house's day rate, but nights is 0, and the sheet was printing «٠ ليالي»
  // and «٠ ليلة × ٤٠ فرد» beside a real charge.
  const dayOnly = isDayUse(checkIn, checkOut);
  const stayHint = dayOnly
    ? `يوم واحد بدون مبيت × ${guestsCount} فرد`
    : `${nights} ليلة × ${guestsCount} فرد`;

  const lines: QuoteLine[] = [];
  if (p.discountPct > 0) {
    lines.push({
      label: 'الإقامة قبل الخصم',
      amount: p.accommodation,
      hint: stayHint,
    });
    lines.push({
      label: `خصم ${Math.round(p.discountPct * 100)}٪`,
      amount: -(p.accommodation - p.discounted),
    });
  } else {
    lines.push({
      label: 'الإقامة',
      amount: p.accommodation,
      hint: stayHint,
    });
  }
  if (p.meals > 0) lines.push({ label: 'الوجبات', amount: p.meals });
  if (hallFee > 0) lines.push({ label: 'القاعة', amount: hallFee });
  // Points the servant is spending on this booking. Without it the sheet
  // quoted the price BEFORE redemption while the guest is charged after it —
  // a priest approving a budget that is too high, and a deposit figure that
  // does not match the one the app then asks for.
  if (pointsDiscount > 0) lines.push({ label: 'خصم النقاط', amount: -pointsDiscount });

  const depositDue = Math.round(total * settings.depositRate);

  // Written as the dates they actually fall on. A priest reading «قبل ١٢
  // أغسطس» does not have to count backwards from a percentage in a meeting.
  const freeUntil = shiftDate(checkIn, -settings.freeCancelDays);
  const partialUntil = shiftDate(checkIn, -settings.partialRefundDays);
  // A rung whose date has passed is not an option any more. Printed as a live
  // promise it invites a priest to approve on terms that no longer exist.
  const todayISO = isoOf(today);
  const cancellation: CancellationStep[] = [
    { when: freeUntil, edge: 'until', refund: depositDue, label: 'يرجع العربون كامل', stillAvailable: todayISO <= freeUntil },
    {
      when: partialUntil, edge: 'until',
      refund: Math.round(depositDue * settings.partialRefundPct),
      label: `يرجع ${Math.round(settings.partialRefundPct * 100)}٪ من العربون`,
      stillAvailable: todayISO <= partialUntil,
    },
    { when: partialUntil, edge: 'after', refund: 0, label: 'مايرجعش عربون', stillAvailable: true },
  ];

  // The question the priest always asks, answered before he asks it. Same
  // pricing path, so these are real prices and not estimates.
  const alternatives: AlternativeWeek[] = [-7, 7]
    .map((offset) => {
      const ci = shiftDate(checkIn, offset);
      const co = shiftDate(checkOut, offset);
      const alt = priceFor(house, ci, co, guestsCount, withMeals).total + hallFee;
      return { checkIn: ci, checkOut: co, total: alt, delta: alt - total };
    })
    // A week that costs the same tells him nothing, so it is not shown.
    .filter((a) => a.delta !== 0);

  return {
    houseName: house.name,
    governorate: house.governorate,
    checkIn, checkOut, nights, guestsCount,
    lines, total,
    perHead: guestsCount > 0 ? Math.round(total / guestsCount) : 0,
    depositDue,
    balanceAtArrival: total - depositDue,
    discountPct: p.discountPct,
    cancellation, alternatives,
    priestName: servant.priestName,
    churchName: servant.churchName,
    servantName: servant.name,
  };
}

// ---------------------------------------------------------------------------
// The sheet itself
// ---------------------------------------------------------------------------

/**
 * Render the quote as one printable page.
 *
 * Everything interpolated below is house-, church- or servant-entered text, so
 * it is escaped, the same way invoice.ts does it — a house named with a stray
 * angle bracket must not become markup on a page the servant hands his priest.
 */
export function printPriestQuote(q: PriestQuote): void {
  const money = (n: number) => `${Math.abs(n).toLocaleString('ar-EG')} ج.م`;
  const day = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
  const issued = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });

  const to = q.priestName
    ? `${escapeHtml(q.priestName)}${q.churchName ? ` — ${escapeHtml(q.churchName)}` : ''}`
    : escapeHtml(q.churchName || 'حضرة الأب الكاهن');

  const lines = q.lines.map((l) => `
    <tr>
      <td class="lbl">${escapeHtml(l.label)}${l.hint ? `<small>${escapeHtml(l.hint)}</small>` : ''}</td>
      <td class="val${l.amount < 0 ? ' minus' : ''}">${l.amount < 0 ? '− ' : ''}${money(l.amount)}</td>
    </tr>`).join('');

  const ladder = q.cancellation.map((c) => `
    <tr${c.stillAvailable ? '' : ' class="gone"'}>
      <td class="lbl">${c.edge === 'until' ? 'لغاية' : 'بعد'} ${escapeHtml(day(c.when))}${c.stillAvailable ? '' : '<small>الموعد ده عدّى</small>'}</td>
      <td class="val">${escapeHtml(c.label)} — <b>${money(c.refund)}</b></td>
    </tr>`).join('');

  // Only shown when it says something. A row reading «نفس السعر» is noise.
  const alts = q.alternatives.length === 0 ? '' : `
    <h2>لو غيّرنا الأسبوع</h2>
    <table>${q.alternatives.map((a) => `
      <tr>
        <td class="lbl">${escapeHtml(day(a.checkIn))} — ${escapeHtml(day(a.checkOut))}</td>
        <td class="val">${a.delta < 0 ? 'أقل بـ' : 'أكتر بـ'} <b>${money(a.delta)}</b></td>
      </tr>`).join('')}</table>`;

  const body = `
  <div class="card">
    <div class="head">
      <div class="brand">${escapeHtml(q.houseName)}<small>${escapeHtml(q.governorate)} · عبر منصة بيما</small></div>
      <div class="meta">إلى: <b>${to}</b><br>مُقدَّم من: <b>${escapeHtml(q.servantName)}</b><br>${escapeHtml(issued)}</div>
    </div>

    <h1>عرض تكلفة الرحلة</h1>
    <table>
      <tr><td class="lbl">التواريخ</td><td class="val">${q.nights === 0 ? escapeHtml(day(q.checkIn)) + ' — يوم واحد' : escapeHtml(day(q.checkIn)) + ' — ' + escapeHtml(day(q.checkOut)) + ' (' + q.nights + ' ليالي)'}</td></tr>
      <tr><td class="lbl">العدد</td><td class="val">${q.guestsCount} فرد</td></tr>
      ${lines}
      <tr class="total"><td class="lbl">الإجمالي</td><td class="val">${money(q.total)}</td></tr>
      <tr class="perhead"><td class="lbl">للفرد الواحد</td><td class="val">${money(q.perHead)}</td></tr>
    </table>

    <h2>الدفع</h2>
    <table>
      <tr><td class="lbl">عربون دلوقتي</td><td class="val"><b>${money(q.depositDue)}</b></td></tr>
      <tr><td class="lbl">الباقي عند الوصول</td><td class="val">${money(q.balanceAtArrival)}</td></tr>
    </table>

    <h2>لو اضطرينا نلغي</h2>
    <table>${ladder}</table>

    ${alts}

    <p class="foot">الأسعار محسوبة النهاردة من أسعار البيت المسجّلة على بيما، وبتتأكد وقت الحجز.</p>
  </div>`;

  openPrintWindow({
    title: `عرض رحلة — ${q.houseName}`,
    css: `
      *{box-sizing:border-box} body{margin:0;padding:24px;background:#F4F2EC;color:#2D2D24;
        font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      .card{max-width:720px;margin:0 auto;background:#fff;border:1px solid #E7E5DB;border-radius:18px;padding:28px}
      .head{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0A2342;padding-bottom:14px;margin-bottom:20px}
      .brand{font-size:19px;font-weight:800;color:#0A2342;line-height:1.4}
      .brand small,.lbl small{display:block;font-size:11px;font-weight:600;color:#8A8A70;margin-top:3px}
      .meta{font-size:12px;color:#4A4A3A;text-align:left;line-height:1.9}
      h1{font-size:16px;margin:0 0 12px;color:#0A2342}
      h2{font-size:13px;margin:22px 0 8px;color:#5A5A40}
      table{width:100%;border-collapse:collapse}
      td{padding:9px 0;border-bottom:1px solid #EFEDE4;font-size:13px;vertical-align:top}
      .lbl{color:#4A4A3A;font-weight:600}
      .val{text-align:left;font-weight:700;white-space:nowrap}
      .minus{color:#B8944E}
      .gone td{color:#B5AF98;text-decoration:line-through}
      .gone small{text-decoration:none;color:#B5AF98}
      .total td{border-top:2px solid #0A2342;border-bottom:none;font-size:16px;font-weight:900;color:#0A2342;padding-top:12px}
      .perhead td{border-bottom:none;color:#5A5A40;padding-top:0}
      .foot{margin-top:22px;font-size:11px;color:#8A8A70;line-height:1.8}
      @media print{body{background:#fff;padding:0}.card{border:none;border-radius:0}}
    `,
    body,
  });
}
