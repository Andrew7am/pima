import { ConferenceRoom, User } from '../../types';

/**
 * A blank conference owned by whoever opened the hub.
 *
 * Tapping «مؤتمر» used to hand every user a clone of INITIAL_CONFERENCE_ROOMS[0]
 * — «خلوة الشباب الروحية ٢٠٢٦», hosted by a church they have no connection to,
 * already carrying a full schedule, a live lecture with 150 viewers, chat
 * messages from people who do not exist, and a pinned announcement marked
 * isUrgent telling them to arrive 30 minutes before the buses leave with their
 * national ID and booking code.
 *
 * None of it referred to anything real, and the urgent one was actionable: it
 * gave a date-less instruction to show up for transport that was never
 * arranged. The hub is a planning tool, so it now starts empty and the host
 * fills it in.
 */
export function createEmptyConference(host: User, bookingId?: string): ConferenceRoom {
  const code = makeConferenceCode(host.id, bookingId);
  return {
    // Keyed on the booking when there is one. conf_${host.id} gave a host with
    // two bookings one id for both, and conferences.booking_id is UNIQUE — the
    // second would have overwritten the first.
    id: bookingId ? `conf_${bookingId}` : `conf_${host.id}`,
    bookingId,
    houseName: '',
    title: 'مؤتمر جديد',
    organizationName: host.organizationName || host.churchName || '',
    conferenceCode: code,
    qrCodeUrl: code,
    joiningRequirements: 'open',
    hostUserId: host.id,

    schedule: [],
    events: [],
    announcements: [],
    checklist: [],

    liveMode: {
      eventName: '',
      speaker: '',
      location: '',
      minutesLeft: 0,
      viewersCount: 0,
      isLive: false,
      chatMessages: [],
    },

    notificationsLog: [],
    joinedUserIds: [host.id],
    presentationSlides: [],
    activeSlideId: null,
  };
}

/**
 * Short, readable, and derived from the host id so re-opening the hub in the
 * same session does not produce a different code each time. The host can
 * change it from inside the hub.
 */
/**
 * The code a servant reads out so their group can join.
 *
 * Derived from the host alone it returned the same string for every conference
 * that host would ever run, and conferences.conference_code is UNIQUE — so
 * their second booking could not be saved at all. The booking is what makes one
 * conference different from another, so it belongs in the code.
 *
 * Still short enough to read down a phone, and still deterministic: deriving it
 * again for the same booking gives the same code rather than locking out a
 * group who already have it.
 */
function makeConferenceCode(userId: string, bookingId?: string): string {
  const clean = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const host = clean(userId).slice(-3) || '000';
  const book = clean(bookingId ?? '').slice(-4);
  return book ? `PM${host}${book}` : `PM${host}`;
}
