import { supabase } from './supabase';
import type { RetreatHouse, Booking, Review, Payment, User, AppNotification, Attendee, RoomAllocation } from '../types';

// ─── Row → Type mappers ────────────────────────────────────────────────────

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

// ─── Loaders ───────────────────────────────────────────────────────────────

export async function loadHouses(): Promise<RetreatHouse[]> {
  const { data, error } = await supabase.from('houses').select('*').order('created_at');
  if (error) { console.error('loadHouses:', error); return []; }
  return (data ?? []).map(mapHouse);
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

// ─── Mutations ─────────────────────────────────────────────────────────────

/**
 * Insert a new booking. The DB trigger enforces bed-capacity for overlapping dates.
 * Returns { ok: false, error: 'INSUFFICIENT_CAPACITY', availableBeds } if the
 * requested guests would exceed remaining capacity for these dates.
 */
export async function createBooking(b: Booking): Promise<{ ok: boolean; error?: string; availableBeds?: number }> {
  const { error } = await supabase.from('bookings').insert(bookingToRow(b));
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
  return { ok: true };
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
  const { error } = await supabase.from('reviews').insert(reviewToRow(r));
  if (error) console.error('createReview:', error);
  return !error;
}

export async function updateReview(r: Review): Promise<boolean> {
  const { error } = await supabase.from('reviews').update(reviewToRow(r)).eq('id', r.id);
  if (error) console.error('updateReview:', error);
  return !error;
}

export async function createPayment(p: Payment): Promise<boolean> {
  const { error } = await supabase.from('payments').insert(paymentToRow(p));
  if (error) console.error('createPayment:', error);
  return !error;
}

export async function createNotification(n: AppNotification): Promise<boolean> {
  const { error } = await supabase.from('notifications').insert({
    id: n.id, user_id: n.userId, booking_id: n.bookingId,
    title: n.title, message: n.message, type: n.type,
    is_read: n.isRead, created_at: n.createdAt,
  });
  if (error) console.error('createNotification:', error);
  return !error;
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) console.error('markNotificationRead:', error);
  return !error;
}
