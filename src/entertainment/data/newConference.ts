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
export function createEmptyConference(host: User): ConferenceRoom {
  return {
    id: `conf_${host.id}`,
    houseName: '',
    title: 'مؤتمر جديد',
    organizationName: host.organizationName || host.churchName || '',
    conferenceCode: makeConferenceCode(host.id),
    qrCodeUrl: makeConferenceCode(host.id),
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
function makeConferenceCode(userId: string): string {
  const tail = userId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
  return `PM${tail || '0000'}`;
}
