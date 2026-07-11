import { supabase } from './supabase';
import type { RetreatHouse, Booking, Review, Payment, User, AppNotification, Attendee, RoomAllocation, PointsTransaction, Room, Announcement, WaitlistEntry, PlatformAnnouncement, PlatformSettings, AuditLogEntry } from '../types';
import { DEFAULT_PLATFORM_SETTINGS } from '../types';

// ─── Row → Type mappers ────────────────────────────────────────────────────

export function mapUser(r: Record<string, unknown>): User {
  return {
    id: r.id as string,
    email: r.email as string,
    name: r.name as string,
    role: r.role as User['role'],
    phone: r.phone as string,
    organizationName: r.organization_name as string ?? undefined,
    approvalStatus: r.approval_status as User['approvalStatus'] ?? undefined,
    points: r.points as number ?? 0,
    favorites: (r.favorites as string[]) ?? [],
    referralCode: r.referral_code as string ?? undefined,
    dateOfBirth: r.date_of_birth as string ?? undefined,
    address: r.address as string ?? undefined,
    governorate: r.governorate as string ?? undefined,
    churchName: r.church_name as string ?? undefined,
    priestName: r.priest_name as string ?? undefined,
    isBanned: (r.is_banned as boolean) ?? false,
    createdAt: r.created_at as string,
  };
}

export function mapHouse(r: Record<string, unknown>): RetreatHouse {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    ownerId: r.owner_id as string,
    ownerName: r.owner_name as string,
    governorate: r.governorate as string,
    address: r.address as string,
    lat: r.lat as number,
    lng: r.lng as number,
    roomsCount: r.rooms_count as number,
    bedsCount: r.beds_count as number,
    roomsDescription: r.rooms_description as string,
    pricePerNightPerPerson: r.price_per_night_per_person as number,
    services: (r.services as string[]) ?? [],
    suitability: (r.suitability as RetreatHouse['suitability']) ?? [],
    activities: (r.activities as string[]) ?? [],
    images: (r.images as string[]) ?? [],
    conferenceHalls: (r.conference_halls as RetreatHouse['conferenceHalls']) ?? [],
    restaurants: (r.restaurants as RetreatHouse['restaurants']) ?? [],
    status: r.status as RetreatHouse['status'],
    rating: r.rating as number,
    reviewsCount: r.reviews_count as number,
    createdAt: r.created_at as string,
    propertyType: r.property_type as RetreatHouse['propertyType'] ?? undefined,
    blockedDates: (r.blocked_dates as string[]) ?? undefined,
    seaProximity: r.sea_proximity as RetreatHouse['seaProximity'] ?? undefined,
    studentHousingGender: r.student_housing_gender as RetreatHouse['studentHousingGender'] ?? undefined,
    distanceFromUniversity: r.distance_from_university as string ?? undefined,
    monthlyRent: r.monthly_rent as number ?? undefined,
    roomCapacity: r.room_capacity as number ?? undefined,
    housingRules: (r.housing_rules as string[]) ?? undefined,
    contractTerms: r.contract_terms as string ?? undefined,
    menu: r.menu as RetreatHouse['menu'] ?? undefined,
    imageDescriptions: r.image_descriptions as Record<string, string> ?? undefined,
    pendingEdit: r.pending_edit as Partial<RetreatHouse> ?? undefined,
  };
}

export function mapBooking(r: Record<string, unknown>): Booking {
  return {
    id: r.id as string,
    houseId: r.house_id as string,
    houseName: r.house_name as string,
    userId: r.user_id as string,
    userName: r.user_name as string,
    userPhone: r.user_phone as string,
    userEmail: r.user_email as string,
    userRole: r.user_role as Booking['userRole'],
    organizationName: r.organization_name as string ?? undefined,
    checkIn: r.check_in as string,
    checkOut: r.check_out as string,
    guestsCount: r.guests_count as number,
    totalPrice: r.total_price as number,
    depositPaid: r.deposit_paid as boolean,
    depositAmount: r.deposit_amount as number,
    status: r.status as Booking['status'],
    isLargeConferenceQuote: r.is_large_conference_quote as boolean,
    paymentStatus: r.payment_status as Booking['paymentStatus'] ?? undefined,
    conferenceDetails: r.conference_details as Booking['conferenceDetails'] ?? undefined,
    checkedInAt: r.checked_in_at as string ?? undefined,
    checkedOutAt: r.checked_out_at as string ?? undefined,
    createdAt: r.created_at as string,
  };
}

export function mapNotification(r: Record<string, unknown>): AppNotification {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    bookingId: r.booking_id as string,
    title: r.title as string,
    message: r.message as string,
    type: r.type as AppNotification['type'],
    isRead: r.is_read as boolean,
    createdAt: r.created_at as string,
  };
}

export function mapAuditLogEntry(r: Record<string, unknown>): AuditLogEntry {
  return {
    id: r.id as number,
    actorId: r.actor_id as string | null,
    actorName: r.actor_name as string | null,
    actorRole: r.actor_role as string | null,
    action: r.action as string,
    targetType: r.target_type as string,
    targetId: r.target_id as string,
    details: r.details as string | null,
    createdAt: r.created_at as string,
  };
}

export function mapReview(r: Record<string, unknown>): Review {
  return {
    id: r.id as string,
    houseId: r.house_id as string,
    houseName: r.house_name as string ?? undefined,
    userId: r.user_id as string,
    userName: r.user_name as string,
    userRole: r.user_role as Review['userRole'],
    rating: r.rating as number,
    food_rating: r.food_rating as number ?? undefined,
    service_rating: r.service_rating as number ?? undefined,
    cleanliness_rating: r.cleanliness_rating as number ?? undefined,
    organization_rating: r.organization_rating as number ?? undefined,
    value_rating: r.value_rating as number ?? undefined,
    overall_rating: r.overall_rating as number ?? undefined,
    comment: r.comment as string,
    ownerReply: r.owner_reply as string ?? undefined,
    ownerReplyCreatedAt: r.owner_reply_created_at as string ?? undefined,
    createdAt: r.created_at as string,
  };
}

export function mapPayment(r: Record<string, unknown>): Payment {
  return {
    id: r.id as string,
    bookingId: r.booking_id as string,
    userId: r.user_id as string,
    userName: r.user_name as string,
    amount: r.amount as number,
    paymentMethod: r.payment_method as Payment['paymentMethod'],
    paymentStatus: r.payment_status as Payment['paymentStatus'],
    paymentDate: r.payment_date as string,
    proofImage: r.proof_image as string ?? undefined,
    transactionReference: r.transaction_reference as string ?? undefined,
    adminNotes: r.admin_notes as string ?? undefined,
    details: r.details as Payment['details'] ?? undefined,
  };
}

export function mapPointsTransaction(r: Record<string, unknown>): PointsTransaction {
  return {
    id: r.id as string,
    date: r.created_at as string,
    amount: r.amount as number,
    description: r.description as string,
    type: r.type as PointsTransaction['type'],
  };
}

export function mapAttendee(r: Record<string, unknown>): Attendee {
  return {
    id: r.id as string,
    bookingId: r.booking_id as string,
    name: r.name as string,
    gender: r.gender as Attendee['gender'],
    groupType: r.group_type as Attendee['groupType'],
  };
}

export function mapRoomAllocation(r: Record<string, unknown>): RoomAllocation {
  return {
    id: r.id as string,
    bookingId: r.booking_id as string,
    attendeeId: r.attendee_id as string,
    roomId: r.room_id as string,
    bedNumber: r.bed_number as number,
  };
}

export function mapRoom(r: Record<string, unknown>): Room {
  return {
    id: r.id as string,
    houseId: r.house_id as string,
    name: r.name as string,
    bedsCount: r.beds_count as number,
    pricePerNight: r.price_per_night as number ?? undefined,
    images: (r.images as string[]) ?? [],
    status: r.status as Room['status'],
    createdAt: r.created_at as string,
  };
}

export function mapAnnouncement(r: Record<string, unknown>): Announcement {
  return {
    id: r.id as string,
    houseId: r.house_id as string,
    message: r.message as string,
    isActive: r.is_active as boolean,
    createdAt: r.created_at as string,
  };
}

export function mapWaitlistEntry(r: Record<string, unknown>): WaitlistEntry {
  return {
    id: r.id as string,
    houseId: r.house_id as string,
    houseName: r.house_name as string,
    userId: r.user_id as string,
    userName: r.user_name as string,
    userPhone: r.user_phone as string,
    checkIn: r.check_in as string,
    checkOut: r.check_out as string,
    guestsCount: r.guests_count as number,
    status: r.status as WaitlistEntry['status'],
    createdAt: r.created_at as string,
  };
}

export function mapPlatformAnnouncement(r: Record<string, unknown>): PlatformAnnouncement {
  return {
    id: r.id as string,
    message: r.message as string,
    imageUrl: r.image_url as string ?? undefined,
    linkedHouseId: r.linked_house_id as string ?? undefined,
    isActive: r.is_active as boolean,
    createdAt: r.created_at as string,
  };
}

// ─── Loaders ───────────────────────────────────────────────────────────────

export async function loadUsers(): Promise<User[]> {
  // RLS: a regular user only ever gets their own row back here; an admin
  // gets everyone's (see users_select_admin policy in migration 008).
  const { data, error } = await supabase.from('users').select('*').order('created_at');
  if (error) { console.error('loadUsers:', error); return []; }
  return (data ?? []).map(mapUser);
}

export async function loadHouses(): Promise<RetreatHouse[]> {
  const { data, error } = await supabase.from('houses').select('*').order('created_at');
  if (error) { console.error('loadHouses:', error); return []; }
  return (data ?? []).map(mapHouse);
}

export async function deleteHouse(houseId: string): Promise<boolean> {
  const { error } = await supabase.from('houses').delete().eq('id', houseId);
  if (error) { console.error('deleteHouse:', error); return false; }
  return true;
}

export async function loadBookings(): Promise<Booking[]> {
  const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadBookings:', error); return []; }
  return (data ?? []).map(mapBooking);
}

export async function loadReviews(): Promise<Review[]> {
  const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadReviews:', error); return []; }
  return (data ?? []).map(mapReview);
}

export async function loadPayments(): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadPayments:', error); return []; }
  return (data ?? []).map(mapPayment);
}

export async function loadNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) { console.error('loadNotifications:', error); return []; }
  return (data ?? []).map(mapNotification);
}

export async function loadPointsHistory(userId: string): Promise<PointsTransaction[]> {
  const { data, error } = await supabase
    .from('points_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) { console.error('loadPointsHistory:', error); return []; }
  return (data ?? []).map(mapPointsTransaction);
}

// Scoped to one booking, not a full-table load: attendees/allocations are
// only ever needed by the RoomDistribution modal for the booking currently
// open, and pulling every row on every page load was a real contributor to
// egress (the whole DB is ~37MB but was being re-fetched wholesale on every
// login/refresh).
export async function loadAttendeesForBooking(bookingId: string): Promise<Attendee[]> {
  const { data, error } = await supabase.from('attendees').select('*').eq('booking_id', bookingId);
  if (error) { console.error('loadAttendeesForBooking:', error); return []; }
  return (data ?? []).map(mapAttendee);
}

export async function loadAllocationsForBooking(bookingId: string): Promise<RoomAllocation[]> {
  const { data, error } = await supabase.from('room_allocations').select('*').eq('booking_id', bookingId);
  if (error) { console.error('loadAllocationsForBooking:', error); return []; }
  return (data ?? []).map(mapRoomAllocation);
}

// head:true skips the row data entirely (just the count), for the admin
// platform-stats tile — avoids pulling every allocation row just to show a number.
export async function loadAllocationsCount(): Promise<number> {
  const { count, error } = await supabase.from('room_allocations').select('*', { count: 'exact', head: true });
  if (error) { console.error('loadAllocationsCount:', error); return 0; }
  return count ?? 0;
}

// rooms/announcements have public SELECT policies (needed so any guest can
// see a house's rooms/announcements on its detail page), so loading the
// whole table on every login pulls every house's rooms/announcements
// platform-wide. Scope to the house(s) actually being viewed instead —
// one house on HouseDetail, all of the owner's houses on OwnerDashboard.
export async function loadRoomsForHouses(houseIds: string[]): Promise<Room[]> {
  if (houseIds.length === 0) return [];
  const { data, error } = await supabase.from('rooms').select('*').in('house_id', houseIds).order('created_at');
  if (error) { console.error('loadRoomsForHouses:', error); return []; }
  return (data ?? []).map(mapRoom);
}

export async function loadAnnouncementsForHouses(houseIds: string[]): Promise<Announcement[]> {
  if (houseIds.length === 0) return [];
  const { data, error } = await supabase.from('announcements').select('*').in('house_id', houseIds).order('created_at', { ascending: false });
  if (error) { console.error('loadAnnouncementsForHouses:', error); return []; }
  return (data ?? []).map(mapAnnouncement);
}

export async function loadWaitlist(): Promise<WaitlistEntry[]> {
  const { data, error } = await supabase.from('waitlist').select('*').order('created_at');
  if (error) { console.error('loadWaitlist:', error); return []; }
  return (data ?? []).map(mapWaitlistEntry);
}

export async function loadPlatformAnnouncements(): Promise<PlatformAnnouncement[]> {
  const { data, error } = await supabase.from('platform_announcements').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadPlatformAnnouncements:', error); return []; }
  return (data ?? []).map(mapPlatformAnnouncement);
}

export async function loadPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase.from('platform_settings').select('*').eq('id', 1).single();
  if (error || !data) { if (error) console.error('loadPlatformSettings:', error); return DEFAULT_PLATFORM_SETTINGS; }
  return {
    commissionRate: Number(data.commission_rate) ?? DEFAULT_PLATFORM_SETTINGS.commissionRate,
    depositRate: Number(data.deposit_rate) ?? DEFAULT_PLATFORM_SETTINGS.depositRate,
    pointsPerEgp: Number(data.points_per_egp) ?? DEFAULT_PLATFORM_SETTINGS.pointsPerEgp,
    maxRedemptionPct: Number(data.max_redemption_pct) ?? DEFAULT_PLATFORM_SETTINGS.maxRedemptionPct,
    referralBonusPoints: Number(data.referral_bonus_points) ?? DEFAULT_PLATFORM_SETTINGS.referralBonusPoints,
  };
}

export async function updatePlatformSettings(s: PlatformSettings): Promise<boolean> {
  const { error } = await supabase.from('platform_settings').update({
    commission_rate: s.commissionRate,
    deposit_rate: s.depositRate,
    points_per_egp: s.pointsPerEgp,
    max_redemption_pct: s.maxRedemptionPct,
    referral_bonus_points: s.referralBonusPoints,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (error) console.error('updatePlatformSettings:', error);
  return !error;
}

// ─── Type → Row mappers (for inserts/updates) ──────────────────────────────

function bookingToRow(b: Booking): Record<string, unknown> {
  return {
    id: b.id,
    house_id: b.houseId,
    house_name: b.houseName,
    user_id: b.userId,
    user_name: b.userName,
    user_phone: b.userPhone,
    user_email: b.userEmail,
    user_role: b.userRole,
    organization_name: b.organizationName ?? null,
    check_in: b.checkIn,
    check_out: b.checkOut,
    guests_count: b.guestsCount,
    total_price: b.totalPrice,
    deposit_paid: b.depositPaid,
    deposit_amount: b.depositAmount,
    status: b.status,
    is_large_conference_quote: b.isLargeConferenceQuote,
    payment_status: b.paymentStatus ?? 'unpaid',
    conference_details: b.conferenceDetails ?? null,
    checked_in_at: b.checkedInAt ?? null,
    checked_out_at: b.checkedOutAt ?? null,
    created_at: b.createdAt,
  };
}

function reviewToRow(r: Review): Record<string, unknown> {
  return {
    id: r.id,
    house_id: r.houseId,
    house_name: r.houseName ?? null,
    user_id: r.userId,
    user_name: r.userName,
    user_role: r.userRole,
    rating: r.rating,
    food_rating: r.food_rating ?? null,
    service_rating: r.service_rating ?? null,
    cleanliness_rating: r.cleanliness_rating ?? null,
    organization_rating: r.organization_rating ?? null,
    value_rating: r.value_rating ?? null,
    overall_rating: r.overall_rating ?? null,
    comment: r.comment,
    owner_reply: r.ownerReply ?? null,
    owner_reply_created_at: r.ownerReplyCreatedAt ?? null,
    created_at: r.createdAt,
  };
}

function paymentToRow(p: Payment): Record<string, unknown> {
  return {
    id: p.id,
    booking_id: p.bookingId,
    user_id: p.userId,
    user_name: p.userName,
    amount: p.amount,
    payment_method: p.paymentMethod,
    payment_status: p.paymentStatus,
    payment_date: p.paymentDate,
    proof_image: p.proofImage ?? null,
    transaction_reference: p.transactionReference ?? null,
    admin_notes: p.adminNotes ?? null,
    details: p.details ?? null,
  };
}

function roomToRow(r: Room): Record<string, unknown> {
  return {
    id: r.id,
    house_id: r.houseId,
    name: r.name,
    beds_count: r.bedsCount,
    price_per_night: r.pricePerNight ?? null,
    images: r.images,
    status: r.status,
    created_at: r.createdAt,
  };
}

// ─── Mutations ─────────────────────────────────────────────────────────────

/**
 * Insert a new booking. The DB trigger enforces bed-capacity for overlapping
 * dates, and (migration 018/024) recomputes total_price/deposit_amount from
 * the house's live rate and the platform's current deposit/redemption
 * settings — so if the client's numbers were stale (e.g. an admin changed
 * the deposit rate while this form was open), the DB silently corrects them
 * rather than trusting what was submitted. We select the row back so the
 * caller reflects the actual persisted (corrected) values, not its own
 * possibly-stale guess.
 * Returns { ok: false, error: 'INSUFFICIENT_CAPACITY', availableBeds } if the
 * requested guests would exceed remaining capacity for these dates.
 */
export async function createBooking(b: Booking): Promise<{ ok: boolean; error?: string; availableBeds?: number; booking?: Booking }> {
  const { data, error } = await supabase.from('bookings').insert(bookingToRow(b)).select().single();
  if (error) {
    const msg = error.message || '';
    if (msg.includes('INSUFFICIENT_CAPACITY')) {
      const match = msg.match(/Only (\d+) beds/);
      const availableBeds = match ? parseInt(match[1], 10) : 0;
      return { ok: false, error: 'INSUFFICIENT_CAPACITY', availableBeds };
    }
    console.error('createBooking:', error);
    return { ok: false, error: msg };
  }
  return { ok: true, booking: data ? mapBooking(data) : b };
}

export async function updateBookingStatus(id: string, status: Booking['status']): Promise<boolean> {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  if (error) console.error('updateBookingStatus:', error);
  return !error;
}

export async function updateBookingFields(id: string, fields: Partial<Booking>): Promise<boolean> {
  const row: Record<string, unknown> = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.depositPaid !== undefined) row.deposit_paid = fields.depositPaid;
  if (fields.depositAmount !== undefined) row.deposit_amount = fields.depositAmount;
  if (fields.paymentStatus !== undefined) row.payment_status = fields.paymentStatus;
  if (fields.checkedInAt !== undefined) row.checked_in_at = fields.checkedInAt;
  if (fields.checkedOutAt !== undefined) row.checked_out_at = fields.checkedOutAt;
  const { error } = await supabase.from('bookings').update(row).eq('id', id);
  if (error) console.error('updateBookingFields:', error);
  return !error;
}

export async function createReview(r: Review): Promise<boolean> {
  const { error } = await supabase.from('reviews').upsert(reviewToRow(r), { onConflict: 'user_id,house_id' });
  if (error) console.error('createReview:', error);
  return !error;
}

export async function updateReview(r: Review): Promise<boolean> {
  const { error } = await supabase.from('reviews').update(reviewToRow(r)).eq('id', r.id);
  if (error) console.error('updateReview:', error);
  return !error;
}

export async function deleteReview(id: string): Promise<boolean> {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) console.error('deleteReview:', error);
  return !error;
}

export async function createPayment(p: Payment): Promise<boolean> {
  const { error } = await supabase.from('payments').insert(paymentToRow(p));
  if (error) console.error('createPayment:', error);
  return !error;
}

export async function updatePaymentStatus(id: string, status: Payment['paymentStatus'], adminNotes?: string): Promise<boolean> {
  const { error } = await supabase.from('payments').update({ payment_status: status, admin_notes: adminNotes ?? null }).eq('id', id);
  if (error) console.error('updatePaymentStatus:', error);
  return !error;
}

// Attendees/allocations arrive from RoomDistribution as the full replacement
// list for one booking (not deltas), so each save upserts by id (preserves
// unchanged rows — an UPDATE, not a DELETE/INSERT, so it doesn't cascade-wipe
// room_allocations tied to an untouched attendee) then deletes rows that
// dropped out of the new list.
export async function saveAttendeesForBooking(bookingId: string, attendees: Attendee[]): Promise<boolean> {
  if (attendees.length > 0) {
    const rows = attendees.map((a) => ({
      id: a.id, booking_id: bookingId, name: a.name, gender: a.gender, group_type: a.groupType,
    }));
    const { error } = await supabase.from('attendees').upsert(rows);
    if (error) { console.error('saveAttendeesForBooking upsert:', error); return false; }
  }
  let query = supabase.from('attendees').delete().eq('booking_id', bookingId);
  if (attendees.length > 0) query = query.not('id', 'in', `(${attendees.map((a) => a.id).join(',')})`);
  const { error } = await query;
  if (error) { console.error('saveAttendeesForBooking delete:', error); return false; }
  return true;
}

export async function saveAllocationsForBooking(bookingId: string, allocations: RoomAllocation[]): Promise<boolean> {
  if (allocations.length > 0) {
    const rows = allocations.map((al) => ({
      id: al.id, booking_id: bookingId, attendee_id: al.attendeeId, room_id: al.roomId, bed_number: al.bedNumber,
    }));
    const { error } = await supabase.from('room_allocations').upsert(rows);
    if (error) { console.error('saveAllocationsForBooking upsert:', error); return false; }
  }
  let query = supabase.from('room_allocations').delete().eq('booking_id', bookingId);
  if (allocations.length > 0) query = query.not('id', 'in', `(${allocations.map((al) => al.id).join(',')})`);
  const { error } = await query;
  if (error) { console.error('saveAllocationsForBooking delete:', error); return false; }
  return true;
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) console.error('markNotificationRead:', error);
  return !error;
}

export async function createRoom(r: Room): Promise<boolean> {
  const { error } = await supabase.from('rooms').insert(roomToRow(r));
  if (error) console.error('createRoom:', error);
  return !error;
}

export async function updateRoom(r: Room): Promise<boolean> {
  const { error } = await supabase.from('rooms').update(roomToRow(r)).eq('id', r.id);
  if (error) console.error('updateRoom:', error);
  return !error;
}

export async function deleteRoom(id: string): Promise<boolean> {
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) console.error('deleteRoom:', error);
  return !error;
}

export async function createAnnouncement(a: Announcement): Promise<boolean> {
  const { error } = await supabase.from('announcements').insert({
    id: a.id, house_id: a.houseId, message: a.message, is_active: a.isActive, created_at: a.createdAt,
  });
  if (error) console.error('createAnnouncement:', error);
  return !error;
}

export async function setAnnouncementActive(id: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase.from('announcements').update({ is_active: isActive }).eq('id', id);
  if (error) console.error('setAnnouncementActive:', error);
  return !error;
}

export async function createWaitlistEntry(w: WaitlistEntry): Promise<boolean> {
  const { error } = await supabase.from('waitlist').insert({
    id: w.id, house_id: w.houseId, house_name: w.houseName, user_id: w.userId,
    user_name: w.userName, user_phone: w.userPhone, check_in: w.checkIn, check_out: w.checkOut,
    guests_count: w.guestsCount, status: w.status, created_at: w.createdAt,
  });
  if (error) console.error('createWaitlistEntry:', error);
  return !error;
}

export async function updateWaitlistStatus(id: string, status: WaitlistEntry['status']): Promise<boolean> {
  const { error } = await supabase.from('waitlist').update({ status }).eq('id', id);
  if (error) console.error('updateWaitlistStatus:', error);
  return !error;
}

export async function createPlatformAnnouncement(a: PlatformAnnouncement): Promise<boolean> {
  const { error } = await supabase.from('platform_announcements').insert({
    id: a.id, message: a.message, image_url: a.imageUrl ?? null,
    linked_house_id: a.linkedHouseId ?? null, is_active: a.isActive, created_at: a.createdAt,
  });
  if (error) console.error('createPlatformAnnouncement:', error);
  return !error;
}

export async function setPlatformAnnouncementActive(id: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase.from('platform_announcements').update({ is_active: isActive }).eq('id', id);
  if (error) console.error('setPlatformAnnouncementActive:', error);
  return !error;
}

export async function deletePlatformAnnouncement(id: string): Promise<boolean> {
  const { error } = await supabase.from('platform_announcements').delete().eq('id', id);
  if (error) console.error('deletePlatformAnnouncement:', error);
  return !error;
}

// Self-service account deletion (migration 029). Restricted server-side to
// individual/servant roles — owners cascade-delete their houses (and thus
// other users' bookings/reviews on them), so that path requires support.
export async function deleteOwnAccount(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    console.error('deleteOwnAccount:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// House owner contact reveal (migration 031). Only returns a row once the
// caller's own booking on that house is approved and deposit-paid — see the
// migration for why this can't just be a wider `users` RLS policy.
export async function getHouseOwnerContact(bookingId: string): Promise<{ name: string; phone: string } | null> {
  const { data, error } = await supabase.rpc('get_house_owner_contact', { p_booking_id: bookingId });
  if (error) { console.error('getHouseOwnerContact:', error); return null; }
  return data?.[0] ?? null;
}

// Admin-only audit trail (migration 032) — RLS restricts SELECT to admins,
// so this is a no-op empty result for anyone else. Fetched lazily when the
// admin opens the audit tab, not as part of loadAppData.
export async function loadAuditLog(limit: number = 100): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) { console.error('loadAuditLog:', error); return []; }
  return (data ?? []).map(mapAuditLogEntry);
}
