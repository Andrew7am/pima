import { describe, it, expect } from 'vitest';
import { mergeConferenceFrame } from './conferences';
import type { ConferenceRoom } from '../types';

/**
 * A realtime frame is not a conference.
 *
 * schedule, announcements and presentation_slides are large JSONB and get
 * TOASTed. Under the default replica identity Postgres omits unchanged TOASTed
 * columns from an UPDATE payload — the bug that made a found match open for
 * only one player (0154). 0161 sets REPLICA IDENTITY FULL so frames are
 * complete; these keep the hub whole if one is not.
 */

const HELD = {
  id: 'conf_1',
  bookingId: 'book_1',
  houseName: 'بيت العذراء',
  title: 'مؤتمر الشباب',
  organizationName: 'كنيسة العذراء',
  conferenceCode: 'PMAAA1',
  qrCodeUrl: '',
  joiningRequirements: 'open',
  isDisabled: false,
  hostUserId: 'u_host',
  schedule: [{ id: 's1' }, { id: 's2' }],
  events: [{ id: 'e1' }],
  announcements: [{ id: 'a1' }],
  checklist: [{ id: 'c1' }],
  presentationSlides: [{ id: 'sl1' }, { id: 'sl2' }],
  joinedUserIds: ['u_guest'],
  notificationsLog: [{ id: 'n1' }],
  liveMode: {},
} as unknown as ConferenceRoom;

describe('mergeConferenceFrame', () => {
  it('keeps the slides when the frame arrives without them', () => {
    // «the slide advanced» — no presentation_slides in the payload.
    const next = mergeConferenceFrame(HELD, { active_slide_id: 'sl2' } as never);
    expect(next.activeSlideId).toBe('sl2');
    expect(next.presentationSlides).toHaveLength(2);
  });

  it('keeps the schedule, announcements and roster a frame omits', () => {
    const next = mergeConferenceFrame(HELD, { title: 'اسم جديد' } as never);
    expect(next.title).toBe('اسم جديد');
    expect(next.schedule).toHaveLength(2);
    expect(next.announcements).toHaveLength(1);
    expect(next.checklist).toHaveLength(1);
    expect(next.joinedUserIds).toEqual(['u_guest']);
    expect(next.notificationsLog).toHaveLength(1);
  });

  it('takes a list from the frame when it does carry one', () => {
    const next = mergeConferenceFrame(HELD, {
      announcements: [{ id: 'a1' }, { id: 'a2' }],
    } as never);
    expect(next.announcements).toHaveLength(2);
  });

  it('applies an emergency alert arriving on its own', () => {
    const next = mergeConferenceFrame(HELD, {
      instant_alert: { id: 'al1', message: 'الأتوبيس هيتحرك', sentAt: 1, senderName: 'مينا' },
    } as never);
    expect(next.instantAlert?.message).toBe('الأتوبيس هيتحرك');
    expect(next.presentationSlides).toHaveLength(2);
  });

  it('lets an empty list through when the frame really sends one', () => {
    // Cleared, not absent — the distinction the merge turns on.
    const next = mergeConferenceFrame(HELD, { announcements: [] } as never);
    expect(next.announcements).toEqual([]);
  });
});
