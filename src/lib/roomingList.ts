import { Booking, Attendee, RoomAllocation, Room } from '../types';
import { escapeHtml, openPrintWindow } from './printWindow';

const GROUP_LABEL: Record<string, string> = { youth: 'شباب', family: 'أسرة', child: 'طفل', other: 'أخرى' };
const GENDER_LABEL: Record<string, string> = { male: 'ذكر', female: 'أنثى' };

const ROOMING_CSS = `
  *{font-family:'Segoe UI',Tahoma,sans-serif;box-sizing:border-box}
  body{margin:0;padding:28px;color:#101B33}
  h1{font-size:18px;color:#1F2E4E;margin:0 0 4px}.sub{font-size:12px;color:#5B6B8C;margin-bottom:18px}
  .room{border:1px solid #E8ECF4;border-radius:14px;margin-bottom:12px;overflow:hidden;page-break-inside:avoid}
  .room h2{font-size:14px;margin:0;background:#1F2E4E;color:#fff;padding:8px 12px}
  table{width:100%;border-collapse:collapse}
  td,th{padding:7px 10px;font-size:12px;border-bottom:1px solid #EEF1F7;text-align:right}
  th{color:#5B6B8C;font-weight:800}
  .badges{display:flex;flex-wrap:wrap;gap:10px}
  .badge{width:calc(50% - 5px);border:1.5px solid #1F2E4E;border-radius:14px;padding:14px;text-align:center;page-break-inside:avoid}
  .badge .h{font-size:11px;color:#5B6B8C;font-weight:800}
  .badge .n{font-size:17px;font-weight:900;color:#101B33;margin:6px 0}
  .badge .r{font-size:12px;color:#1F2E4E;font-weight:800}
  .empty{color:#5B6B8C;font-size:12px;padding:10px}
  @media print{body{padding:0}.room,.badge{border-color:#ccc}}
`;

function openPrint(title: string, body: string) {
  openPrintWindow({ title, css: ROOMING_CSS, body, printDelayMs: 400 });
}

// Attendee names are typed by the guest and printed by the owner, so every
// name here is escaped before it reaches the markup.
function header(booking: Booking, title: string) {
  const org = escapeHtml(booking.organizationName || booking.userName);
  return `<h1>${escapeHtml(title)}</h1><div class="sub">${org} — ${escapeHtml(booking.houseName)} · ${escapeHtml(booking.checkIn)} إلى ${escapeHtml(booking.checkOut)} · ${booking.guestsCount} فرد</div>`;
}

// Rooming list: attendees grouped by their allocated room.
export function printRoomingList(booking: Booking, attendees: Attendee[], allocations: RoomAllocation[], rooms: Room[]) {
  const att = attendees.filter((a) => a.bookingId === booking.id);
  const alloc = allocations.filter((a) => a.bookingId === booking.id);
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name || id;
  const byRoom = new Map<string, { name: string; bed: number; group: string; gender: string }[]>();
  alloc.forEach((al) => {
    const a = att.find((x) => x.id === al.attendeeId);
    if (!a) return;
    const list = byRoom.get(al.roomId) || [];
    list.push({ name: a.name, bed: al.bedNumber, group: GROUP_LABEL[a.groupType] || '', gender: GENDER_LABEL[a.gender] || '' });
    byRoom.set(al.roomId, list);
  });

  let body = header(booking, 'كشف توزيع الغرف');
  if (byRoom.size === 0) {
    body += `<div class="empty">لا يوجد توزيع غرف بعد — وزّع الغرف من "توزيع الغرف" داخل الحجز أولًا.</div>`;
  } else {
    [...byRoom.entries()].sort((a, b) => roomName(a[0]).localeCompare(roomName(b[0]), 'ar')).forEach(([roomId, people]) => {
      const rows = people.sort((a, b) => a.bed - b.bed).map((p) => `<tr><td>${p.bed}</td><td>${escapeHtml(p.name)}</td><td>${p.gender}</td><td>${p.group}</td></tr>`).join('');
      body += `<div class="room"><h2>غرفة ${escapeHtml(roomName(roomId))} — ${people.length} فرد</h2>
        <table><thead><tr><th>السرير</th><th>الاسم</th><th>النوع</th><th>الفئة</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    });
  }
  openPrint('كشف توزيع الغرف', body);
}

// Name badges: one card per attendee with their room.
export function printBadges(booking: Booking, attendees: Attendee[], allocations: RoomAllocation[], rooms: Room[]) {
  const att = attendees.filter((a) => a.bookingId === booking.id);
  const roomFor = (attId: string) => {
    const al = allocations.find((x) => x.bookingId === booking.id && x.attendeeId === attId);
    return al ? (rooms.find((r) => r.id === al.roomId)?.name || al.roomId) : '—';
  };
  let body = header(booking, 'بادجات المشاركين');
  if (att.length === 0) {
    body += `<div class="empty">لا يوجد مشاركون مسجّلون بعد — أضف المشاركين من "توزيع الغرف" داخل الحجز.</div>`;
  } else {
    const cardOrg = escapeHtml(booking.organizationName || booking.houseName);
    body += '<div class="badges">' + att.map((a) => `<div class="badge"><div class="h">${cardOrg}</div><div class="n">${escapeHtml(a.name)}</div><div class="r">غرفة ${escapeHtml(roomFor(a.id))}</div></div>`).join('') + '</div>';
  }
  openPrint('بادجات المشاركين', body);
}
