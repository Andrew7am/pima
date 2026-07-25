import { Booking } from '../types';

// Build and download an .ics calendar event for a booking so the guest can add
// the retreat to their phone/Google calendar in one tap. All-day span from
// check-in to (check-out + 1) — iCal DTEND is exclusive for all-day events.
function toICSDate(iso: string): string {
  return iso.replace(/-/g, ''); // YYYY-MM-DD -> YYYYMMDD
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function downloadBookingIcs(booking: Booking, address?: string): void {
  const uid = `${booking.id}@pimastay.com`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const summary = escapeICS(`خلوة/مؤتمر — ${booking.houseName}`);
  const description = escapeICS(
    `حجز عبر بيما (رقم ${booking.id.toUpperCase()})\nعدد الأفراد: ${booking.guestsCount}\nمن ${booking.checkIn} إلى ${booking.checkOut}`,
  );
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pima//Retreats//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${toICSDate(booking.checkIn)}`,
    `DTEND;VALUE=DATE:${toICSDate(addDays(booking.checkOut, 1))}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    ...(address ? [`LOCATION:${escapeICS(address)}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:تذكير: خلوتك غداً',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pima-${booking.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
