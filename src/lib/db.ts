import { supabase } from './supabase';
import type { RetreatHouse, Booking, Review, Payment, User, AppNotification, Attendee, RoomAllocation, PointsTransaction, Room, RoomType, Announcement, WaitlistEntry, PlatformAnnouncement, PlatformSettings, AuditLogEntry, Expense, Payout, PromoBanner, HouseAgreement, HouseAgreementRequest, AgreementModel, OwnerAgreementModel, HouseCustomerRates, SeasonalRate, OwnerBookingIntent } from '../types';
import { DEFAULT_PLATFORM_SETTINGS } from '../types';
import type { CustomerFinancials, OwnerFinancials, AdminFinancials, FinancialsIndex } from './bookingFinancials';
import { mapCustomerFinancials, mapOwnerFinancials, mapAdminFinancials, indexByBooking } from './bookingFinancials';

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
    xp: r.xp as number ?? 0,
    level: r.level as number ?? 1,
    gameCoins: r.game_coins as number ?? 0,
    rating: r.rating as number ?? 100,
    totalCorrectAnswers: r.total_correct_answers as number ?? 0,
    totalGamesPlayed: r.total_games_played as number ?? 0,
    totalMatchesWon: r.total_matches_won as number ?? 0,
    unlockedAchievements: (r.unlocked_achievements as string[]) ?? [],
    favorites: (r.favorites as string[]) ?? [],
    referralCode: r.referral_code as string ?? undefined,
    dateOfBirth: r.date_of_birth as string ?? undefined,
    address: r.address as string ?? undefined,
    governorate: r.governorate as string ?? undefined,
    churchName: r.church_name as string ?? undefined,
    priestName: r.priest_name as string ?? undefined,
    isBanned: (r.is_banned as boolean) ?? false,
    releasedAt: (r.released_at as string) ?? undefined,
    avatarUrl: r.avatar_url as string ?? undefined,
    // Pre-migration-079 rows have no column → undefined → treated as opted in.
    emailOptOut: (r.email_opt_out as boolean) ?? false,
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
    dayUsePricePerPerson: (r.day_use_price_per_person as number) ?? undefined,
    services: (r.services as string[]) ?? [],
    suitability: (r.suitability as RetreatHouse['suitability']) ?? [],
    activities: (r.activities as string[]) ?? [],
    images: (r.images as string[]) ?? [],
    // images_count only comes from the houses_list view. Reading a row straight
    // from public.houses means the full set is present, so the count is the
    // length and the row is hydrated.
    imagesCount: (r.images_count as number) ?? ((r.images as string[]) ?? []).length,
    imagesHydrated: r.images_count === undefined,
    conferenceHalls: (r.conference_halls as RetreatHouse['conferenceHalls']) ?? [],
    restaurants: (r.restaurants as RetreatHouse['restaurants']) ?? [],
    paymentMethods: (r.payment_methods as RetreatHouse['paymentMethods']) ?? [],
    seasonalRates: (r.seasonal_rates as RetreatHouse['seasonalRates']) ?? [],
    discountPct: r.discount_pct != null ? Number(r.discount_pct) : undefined,
    discountStartsAt: (r.discount_starts_at as string) ?? undefined,
    discountEndsAt: (r.discount_ends_at as string) ?? undefined,
    discountNote: (r.discount_note as string) ?? undefined,
    // Undefined MEANS INHERIT — resolvePolicy applies the platform fallback.
    // Never coerce these to 0; a house with no opinion is not a house that
    // refunds nothing.
    freeCancelDays: r.free_cancel_days != null ? Number(r.free_cancel_days) : undefined,
    partialRefundDays: r.partial_refund_days != null ? Number(r.partial_refund_days) : undefined,
    partialRefundPct: r.partial_refund_pct != null ? Number(r.partial_refund_pct) : undefined,
    childFreeUnderAge: r.child_free_under_age != null ? Number(r.child_free_under_age) : undefined,
    bookingPolicyNotes: (r.booking_policy_notes as string) ?? undefined,
    policyUpdatedAt: (r.policy_updated_at as string) ?? undefined,
    status: r.status as RetreatHouse['status'],
    rating: r.rating as number,
    reviewsCount: r.reviews_count as number,
    createdAt: r.created_at as string,
    propertyType: r.property_type as RetreatHouse['propertyType'] ?? undefined,
    blockedDates: (r.blocked_dates as string[]) ?? undefined,
    seaProximity: r.sea_proximity as RetreatHouse['seaProximity'] ?? undefined,
    studentHousingGender: r.student_housing_gender as RetreatHouse['studentHousingGender'] ?? undefined,
    distanceFromUniversity: r.distance_from_university as string ?? undefined,
    nearbyLandmark: r.nearby_landmark as string ?? undefined,
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
    discountPctApplied: r.discount_pct_applied != null ? Number(r.discount_pct_applied) : undefined,
    priceBeforeDiscount: r.price_before_discount != null ? Number(r.price_before_discount) : undefined,
    adultsCount: r.adults_count != null ? Number(r.adults_count) : undefined,
    childrenCount: r.children_count != null ? Number(r.children_count) : undefined,
    childAges: (r.child_ages as number[]) ?? undefined,
    // The frozen policy. Undefined on pre-0128 bookings — policyForBooking
    // falls back to the platform terms those bookings were actually made under.
    policyFreeCancelDays: r.policy_free_cancel_days != null ? Number(r.policy_free_cancel_days) : undefined,
    policyPartialRefundDays: r.policy_partial_refund_days != null ? Number(r.policy_partial_refund_days) : undefined,
    policyPartialRefundPct: r.policy_partial_refund_pct != null ? Number(r.policy_partial_refund_pct) : undefined,
    policyChildFreeUnderAge: r.policy_child_free_under_age != null ? Number(r.policy_child_free_under_age) : undefined,
    policySnapshotAt: (r.policy_snapshot_at as string) ?? undefined,
    status: r.status as Booking['status'],
    source: r.source as Booking['source'] ?? 'platform',
    isLargeConferenceQuote: r.is_large_conference_quote as boolean,
    paymentStatus: r.payment_status as Booking['paymentStatus'] ?? undefined,
    conferenceDetails: r.conference_details as Booking['conferenceDetails'] ?? undefined,
    checkedInAt: r.checked_in_at as string ?? undefined,
    checkedOutAt: r.checked_out_at as string ?? undefined,
    ownerNotes: r.owner_notes as string ?? undefined,
    ownerSettledAt: r.owner_settled_at as string ?? undefined,
    assignedRoomIds: (r.assigned_room_ids as string[]) ?? undefined,
    createdAt: r.created_at as string,
    // Trigger-maintained (migration 087); read-only on the client.
    approvedAt: r.approved_at as string ?? undefined,
    updatedAt: r.updated_at as string ?? undefined,
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
    bookingId: (r.booking_id as string) ?? undefined,
    stayGroup: (r.stay_group as string) ?? undefined,
    stayBand: (r.stay_band as string) ?? undefined,
    stayNights: r.stay_nights != null ? Number(r.stay_nights) : undefined,
    stayMonth: r.stay_month != null ? Number(r.stay_month) : undefined,
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
    visitPurpose: r.visit_purpose as Review['visitPurpose'] ?? undefined,
    likedTags: (r.liked_tags as string[] | null) ?? undefined,
    problemTags: (r.problem_tags as string[] | null) ?? undefined,
    problemOther: r.problem_other as string ?? undefined,
    displayAnonymous: r.display_anonymous as boolean ?? false,
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
    receivedAccount: (r.received_account as string) ?? undefined,
    refundedAmount: r.refunded_amount != null ? Number(r.refunded_amount) : undefined,
    refundedAt: (r.refunded_at as string) ?? undefined,
    refundMethod: (r.refund_method as string) ?? undefined,
    refundNote: (r.refund_note as string) ?? undefined,
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
    sharePaid: !!r.share_paid,
    // Migration 119 added these four and this mapper was never widened. The
    // participants list has been rendering an arrival chip from a field that
    // could not be truthy at runtime, and falling back to sharePaid for a
    // payment status the row already knew. The answers were in the column.
    phone: (r.phone as string) || undefined,
    arrivalMethod: (r.arrival_method as Attendee['arrivalMethod']) ?? undefined,
    paymentStatus: (r.payment_status as Attendee['paymentStatus']) ?? undefined,
    registeredAt: (r.registered_at as string) || undefined,
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
    floor: r.floor as number ?? 1,
    typeId: (r.type_id as string) ?? undefined,
    createdAt: r.created_at as string,
  };
}

export function mapRoomType(r: Record<string, unknown>): RoomType {
  return {
    id: r.id as string,
    houseId: r.house_id as string,
    name: r.name as string,
    price: Number(r.price),
    bedsCount: r.beds_count as number,
    facilities: (r.facilities as RoomType['facilities']) ?? [],
    description: (r.description as string) ?? undefined,
    icon: (r.icon as string) ?? undefined,
    createdAt: r.created_at as string,
  };
}

export function mapPayout(r: Record<string, unknown>): Payout {
  return {
    id: r.id as string,
    houseId: r.house_id as string,
    ownerId: r.owner_id as string,
    amount: Number(r.amount),
    status: r.status as Payout['status'],
    method: (r.method as string) ?? undefined,
    note: (r.note as string) ?? undefined,
    requestedAt: r.requested_at as string,
    completedAt: (r.completed_at as string) ?? undefined,
    bookingIds: (r.booking_ids as string[]) ?? undefined,
    transactionReference: (r.transaction_reference as string) ?? undefined,
    paidFromAccount: (r.paid_from_account as string) ?? undefined,
  };
}

export function mapExpense(r: Record<string, unknown>): Expense {
  return {
    id: r.id as string,
    houseId: r.house_id as string,
    description: r.description as string,
    amount: r.amount as number,
    expenseDate: r.expense_date as string,
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

export function mapPromoBanner(r: Record<string, unknown>): PromoBanner {
  return {
    id: r.id as string,
    placement: r.placement as PromoBanner['placement'],
    isActive: r.is_active as boolean,
    sort: (r.sort as number) ?? 0,
    badge: (r.badge as string) ?? undefined,
    title: (r.title as string) ?? undefined,
    subtitle: (r.subtitle as string) ?? undefined,
    ctaText: (r.cta_text as string) ?? undefined,
    imageUrl: (r.image_url as string) ?? undefined,
    endsAt: (r.ends_at as string) ?? null,
    createdAt: r.created_at as string,
    // Pre-migration-081 rows have no columns → undefined → sensible defaults.
    linkUrl: (r.link_url as string) ?? undefined,
    links: Array.isArray(r.links) ? (r.links as PromoBanner['links']) : [],
    layout: (r.layout as PromoBanner['layout']) ?? null,
    // Pre-migration-084 rows have no columns → treat them as plain published.
    linkedHouseId: (r.linked_house_id as string) ?? null,
    status: (r.status as PromoBanner['status']) ?? 'published',
    startsAt: (r.starts_at as string) ?? null,
    // Pre-migration-085 rows: no audience → shown to everyone.
    audience: (r.audience as PromoBanner['audience']) ?? {},
    experiment: (r.experiment as string) ?? null,
    variant: (r.variant as string) ?? null,
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

// Every house column EXCEPT payment_methods — that column is REVOKEd from
// anon/authenticated (migration 070) so owner numbers never ship to guests, and
// select('*') would now error on it. Must stay in sync with mapHouse's reads.
const HOUSE_PUBLIC_COLUMNS =
  'id,name,description,owner_id,owner_name,governorate,address,lat,lng,rooms_count,beds_count,' +
  'rooms_description,price_per_night_per_person,services,suitability,activities,images,' +
  'conference_halls,restaurants,seasonal_rates,status,rating,reviews_count,created_at,property_type,' +
  'blocked_dates,sea_proximity,student_housing_gender,distance_from_university,nearby_landmark,monthly_rent,' +
  'day_use_price_per_person,' +
  'room_capacity,housing_rules,contract_terms,menu,image_descriptions,pending_edit,' +
  'discount_pct,discount_starts_at,discount_ends_at,discount_note,' +
  // Per-property booking policy (migration 0128). Guests need these to be told
  // the terms BEFORE they book, so they are part of the public column set.
  'free_cancel_days,partial_refund_days,partial_refund_pct,' +
  'child_free_under_age,booking_policy_notes,policy_updated_at';

/** Columns added since the last release — see the retry in loadHouses. */
const HOUSE_COLUMNS_SINCE_LAST_RELEASE = [
  'nearby_landmark', 'day_use_price_per_person',
  'free_cancel_days', 'partial_refund_days', 'partial_refund_pct',
  'child_free_under_age', 'booking_policy_notes', 'policy_updated_at',
];

/**
 * Every house, with ONE photo each.
 *
 * Reads the houses_list view (migration 106) rather than the table: browsing
 * used to pull the complete base64 photo set of every house, which is what put
 * egress at 2.789 GB on sixteen users. The rest of a house's photos arrive from
 * loadHouseImages() when somebody actually opens it.
 *
 * A house from here carries imagesHydrated: false, and houseUpdatePayload
 * refuses to write images for such a row — otherwise saving a price would
 * delete the owner's photos.
 */
export async function loadHouses(includePaymentMethods = false): Promise<RetreatHouse[]> {
  // Merge note: two independent changes landed on this function. The cover-only
  // view (migration 106) is the egress fix; `.neq(status, archived)` is the
  // archived-house filter. Both are kept — the view exposes `status`, so the
  // filter applies to it exactly as it did to the table, and it has to be
  // repeated on every fallback query below or archived houses reappear the
  // moment a deploy lands ahead of its migration.
  //
  // The view and the table return different row shapes, so both are widened to
  // the same thing the mapper already takes.
  type Row = Record<string, unknown>;
  const first = await supabase.from('houses_list')
    .select(`${HOUSE_PUBLIC_COLUMNS},images_count`).neq('status', 'archived').order('created_at');
  let data = first.data as unknown as Row[] | null;
  let error = first.error;
  if (error) {
    // A deploy can land before its migration; fall back to the table so the
    // site still works — heavy, but correct, and it says so in the console.
    console.error('loadHouses (view missing, falling back to full images):', error);
    const table = await supabase.from('houses').select(HOUSE_PUBLIC_COLUMNS).neq('status', 'archived').order('created_at');
    data = table.data as unknown as Row[] | null;
    error = table.error;
  }
  if (error) {
    // PostgREST rejects the WHOLE select when one column is missing, so a
    // deploy that lands before its migration would empty the entire site
    // rather than just drop a field. Retry without the newest column — same
    // deploy→migrate tolerance the payment_methods path below already has.
    console.error('loadHouses:', error);
    // Every column added since the last release, not just the newest one:
    // stripping one and leaving another still errors, the retry fails too,
    // and loadHouses returns [] — which is the whole site, empty.
    // Handles a stripped column in any position, including last, where there
    // is no trailing comma to match.
    const fallbackColumns = HOUSE_COLUMNS_SINCE_LAST_RELEASE.reduce(
      (cols, c) => cols.replace(`${c},`, '').replace(`,${c}`, ''), HOUSE_PUBLIC_COLUMNS);
    const retry = await supabase.from('houses').select(fallbackColumns).neq('status', 'archived').order('created_at');
    data = retry.data as unknown as Row[] | null;
    error = retry.error;
    if (error) { console.error('loadHouses (fallback):', error); return []; }
  }
  const houses = (data ?? []).map(mapHouse); // paymentMethods defaults to []
  if (includePaymentMethods) {
    // Owner/admin get their own houses' payout numbers merged back in.
    const merge = (rows: { house_id?: string; id?: string; payment_methods: RetreatHouse['paymentMethods'] }[]) => {
      const byId = new Map<string, RetreatHouse['paymentMethods']>();
      for (const row of rows) byId.set((row.house_id ?? row.id) as string, row.payment_methods ?? []);
      for (const h of houses) { const m = byId.get(h.id); if (m) h.paymentMethods = m; }
    };
    // Preferred path: SECURITY DEFINER RPC (bypasses the column revoke, returns
    // only the caller's own houses / all for admin — regular users get none).
    const { data: pm, error: pmErr } = await supabase.rpc('get_owner_payment_methods');
    if (!pmErr && pm) merge(pm as { house_id: string; payment_methods: RetreatHouse['paymentMethods'] }[]);
    else {
      // Migration 070 not applied yet — the column is still directly selectable,
      // so owner/admin editors keep working through the deploy→migrate window.
      const { data: fb } = await supabase.from('houses').select('id,payment_methods');
      if (fb) merge(fb as { id: string; payment_methods: RetreatHouse['paymentMethods'] }[]);
    }
  }
  return houses;
}

// Aggregate free-bed count per approved house for a date range (migration
// 053 RPC) — the only availability signal exposed to guests/regular users,
// since booking rows themselves are RLS-locked.
// Returns null on error (e.g. migration 053 not applied yet) so the caller
// can simply skip the availability filter instead of hiding every house.
export async function loadHousesAvailability(checkIn: string, checkOut: string): Promise<Record<string, number> | null> {
  const { data, error } = await supabase.rpc('get_houses_availability', { p_check_in: checkIn, p_check_out: checkOut });
  if (error) { console.error('loadHousesAvailability:', error); return null; }
  const result: Record<string, number> = {};
  for (const row of (data ?? []) as { house_id: string; free_beds: number }[]) {
    result[row.house_id] = row.free_beds;
  }
  return result;
}

// Aggregate confirmed-booking counts (migration 086) — the only booking
// signal a guest is allowed to see. null = RPC unavailable; callers treat
// that as "no popularity data" and simply show no badge.
export async function loadHouseBookingCounts(): Promise<Record<string, number> | null> {
  const { data, error } = await supabase.rpc('get_houses_booking_counts');
  if (error) { console.error('loadHouseBookingCounts:', error); return null; }
  const result: Record<string, number> = {};
  for (const row of (data ?? []) as { house_id: string; bookings_count: number }[]) {
    result[row.house_id] = row.bookings_count;
  }
  return result;
}

/**
 * Note that someone opened a house's page (migration 106).
 *
 * Fire-and-forget on purpose. The visitor came to read the page, not to
 * generate telemetry, so nothing here is awaited by the caller and no failure
 * is ever shown to them.
 *
 * The session guard is the only dedup anonymous visitors can get: they have
 * no identity server-side, so a refresh would otherwise count again. Signed-in
 * viewers are deduplicated properly, in the RPC, one view per house per hour —
 * which is the check that actually cannot be bypassed.
 */
export async function recordHouseView(houseId: string): Promise<void> {
  const key = `pima_viewed_${houseId}`;
  try {
    if (sessionStorage.getItem(key)) return;
  } catch {
    /* private mode — no guard available, the server dedups what it can */
  }

  const { error } = await supabase.rpc('record_house_view', { p_house_id: houseId });
  if (error) {
    // Deliberately NOT marking it seen. The guard used to be set before the
    // call and never cleared, so a failed call poisoned the house for the
    // rest of the session — which is exactly what happened while migration
    // 106 was still unapplied: every house opened in that window was marked
    // viewed, the RPC failed silently, and applying the migration afterwards
    // changed nothing until the tab was closed. A failure now leaves the
    // house un-marked so the next open tries again.
    console.warn('recordHouseView:', error);
    return;
  }

  try { sessionStorage.setItem(key, '1'); } catch { /* nothing to guard with */ }
}

/** View totals per house (migration 106) — admin, or an owner's own houses. */
export async function loadHouseViewCounts(): Promise<Record<string, { total: number; last30: number }> | null> {
  const { data, error } = await supabase.rpc('house_view_counts');
  if (error) { console.error('loadHouseViewCounts:', error); return null; }
  const result: Record<string, { total: number; last30: number }> = {};
  for (const row of (data ?? []) as { house_id: string; views_total: number; views_30d: number }[]) {
    result[row.house_id] = { total: row.views_total, last30: row.views_30d };
  }
  return result;
}

// Daily rewarded-ad claim (migration 088). True = 25 points were granted just
// now; false = already claimed today (or signed out). The server is the only
// judge — the client cannot self-grant.
export async function claimDailyAdPoints(): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_daily_ad_points');
  if (error) { console.error('claimDailyAdPoints:', error); return false; }
  return data === true;
}
/**
 * Retire a house without destroying the money record attached to it.
 *
 * This was a hard DELETE, and the cascade behind it took the house's
 * bookings, then their payments — including the guest's own transfer
 * screenshot, which is stored as a base64 data URI inside the payment row
 * rather than as a file — plus the payouts recording what Pima sent the
 * owner. Every audit trigger in the schema is AFTER UPDATE, so a delete left
 * no record that any of it had ever existed.
 *
 * Pima holds guests' deposits on their way to house owners. Those rows are
 * evidence of other people's money, not Pima's own bookkeeping, so the button
 * that erased them was the wrong button to have.
 *
 * archive_house (migration 107) sets status = 'archived' and stamps who and
 * when. The DELETE policies are dropped in the same migration, so this is not
 * merely the preferred path — it is the only one left.
 */
/**
 * Put a discount on a house, or clear it.
 *
 * Admin-only in practice without a line of guarding: protect_house_owner_updates
 * (migration 019) reverts every house column for a non-admin caller except
 * pending_edit, blocked_dates and menu — so an owner cannot discount his own
 * house even though he is the one who pays for it. He asks; the admin sets it.
 *
 * pct is a FRACTION (0.25 = 25%), matching commissionRate and depositRate
 * rather than the number typed in the field.
 */
export async function setHouseDiscount(args: {
  houseId: string; pct: number; startsAt: string | null; endsAt: string | null; note: string | null;
}): Promise<boolean> {
  const { error } = await supabase.from('houses').update({
    discount_pct: args.pct,
    discount_starts_at: args.startsAt,
    discount_ends_at: args.endsAt,
    discount_note: args.note,
    discount_set_at: new Date().toISOString(),
  }).eq('id', args.houseId);
  if (error) { console.error('setHouseDiscount:', error); return false; }
  return true;
}

export async function deleteHouse(houseId: string): Promise<boolean> {
  const { error } = await supabase.rpc('archive_house', { p_house_id: houseId });
  if (error) { console.error('archiveHouse:', error); return false; }
  return true;
}

export async function createHouse(h: RetreatHouse): Promise<boolean> {
  const { error } = await supabase.from('houses').insert({
    id: h.id, name: h.name, description: h.description,
    owner_id: h.ownerId, owner_name: h.ownerName,
    governorate: h.governorate, address: h.address,
    lat: h.lat, lng: h.lng,
    rooms_count: h.roomsCount, beds_count: h.bedsCount,
    rooms_description: h.roomsDescription,
    price_per_night_per_person: h.pricePerNightPerPerson,
    day_use_price_per_person: h.dayUsePricePerPerson ?? null,
    services: h.services, suitability: h.suitability,
    activities: h.activities, images: h.images,
    conference_halls: h.conferenceHalls, restaurants: h.restaurants,
    payment_methods: h.paymentMethods,
    seasonal_rates: h.seasonalRates ?? [],
    status: h.status, rating: h.rating, reviews_count: h.reviewsCount,
    property_type: h.propertyType ?? null,
    sea_proximity: h.seaProximity ?? null,
    student_housing_gender: h.studentHousingGender ?? null,
    distance_from_university: h.distanceFromUniversity ?? null,
    nearby_landmark: h.nearbyLandmark ?? null,
    monthly_rent: h.monthlyRent ?? null,
    room_capacity: h.roomCapacity ?? null,
    housing_rules: h.housingRules ?? [],
    contract_terms: h.contractTerms ?? null,
    menu: h.menu ?? null,
    created_at: h.createdAt,
  });
  if (error) { console.error('createHouse:', error); return false; }
  return true;
}

/**
 * The complete photo set for one house.
 *
 * List screens hold only the cover (migration 106). Call this before showing
 * a gallery, and before ANY screen that lets somebody edit the photos — the
 * result is what makes a house safe to write back.
 */
export async function loadHouseImages(houseId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('houses').select('images').eq('id', houseId).single();
  if (error) { console.error('loadHouseImages:', error); return null; }
  return ((data?.images as string[]) ?? []);
}

// Shared column mapping so a full house update (owner form) and an
// approved pending-edit merge (admin) never drift out of sync again.
export function houseUpdatePayload(h: RetreatHouse) {
  // A house that came from the list view holds ONE photo. Writing that back
  // would delete every other photo the owner uploaded — while they were only
  // trying to change a price. So the column is left out entirely unless the
  // caller has fetched the full set. Omitting is right rather than throwing:
  // the rest of the save is still valid and should still happen.
  const imageFields = h.imagesHydrated
    ? { images: h.images, image_descriptions: h.imageDescriptions ?? {} }
    : {};
  return {
    ...imageFields,
    name: h.name, description: h.description,
    governorate: h.governorate,
    address: h.address, lat: h.lat, lng: h.lng,
    rooms_count: h.roomsCount, beds_count: h.bedsCount,
    rooms_description: h.roomsDescription,
    price_per_night_per_person: h.pricePerNightPerPerson,
    day_use_price_per_person: h.dayUsePricePerPerson ?? null,
    blocked_dates: h.blockedDates ?? [],
    services: h.services, activities: h.activities, suitability: h.suitability,
    conference_halls: h.conferenceHalls, restaurants: h.restaurants,
    payment_methods: h.paymentMethods,
    seasonal_rates: h.seasonalRates ?? [],
    property_type: h.propertyType ?? null,
    student_housing_gender: h.studentHousingGender ?? null,
    distance_from_university: h.distanceFromUniversity ?? null,
    nearby_landmark: h.nearbyLandmark ?? null,
    monthly_rent: h.monthlyRent ?? null,
    housing_rules: h.housingRules ?? [],
    contract_terms: h.contractTerms ?? null,
    menu: h.menu ?? null, status: h.status,
  };
}

export async function updateHouse(h: RetreatHouse): Promise<boolean> {
  const { error } = await supabase.from('houses').update(houseUpdatePayload(h)).eq('id', h.id);
  if (error) { console.error('updateHouse:', error); return false; }
  return true;
}

/** A property's booking policy. null clears a field back to "inherit the platform value". */
export interface HousePolicyInput {
  freeCancelDays: number | null;
  partialRefundDays: number | null;
  partialRefundPct: number | null;
  childFreeUnderAge: number | null;
  bookingPolicyNotes: string | null;
}

/**
 * Write ONLY the policy columns (migration 0128).
 *
 * Deliberately not folded into houseUpdatePayload. A house loaded from the
 * cover-only list view carries whatever columns that view exposes, and a
 * whole-row save built from such an object would write NULL over policy the
 * owner had set — the same trap houseUpdatePayload already documents for
 * images. Writing five named columns cannot do that.
 *
 * null is meaningful and is therefore sent, not omitted: it is how an owner
 * says "go back to the platform default". Only policy_updated_at is absent,
 * because the server stamps it.
 *
 * Authorization is the database's: RLS decides whose house this is, and
 * protect_house_owner_updates decides which columns an owner may write. This
 * function is a shape, not a gate.
 */
export async function updateHousePolicy(houseId: string, p: HousePolicyInput): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('houses').update({
    free_cancel_days: p.freeCancelDays,
    partial_refund_days: p.partialRefundDays,
    partial_refund_pct: p.partialRefundPct,
    child_free_under_age: p.childFreeUnderAge,
    booking_policy_notes: p.bookingPolicyNotes,
  }).eq('id', houseId);
  if (error) {
    const msg = error.message || '';
    // Surfaced so the form can say which rule was broken instead of «حاول مرة أخرى».
    if (msg.includes('INVALID_POLICY_WINDOW')) return { ok: false, error: 'INVALID_POLICY_WINDOW' };
    if (msg.includes('houses_partial_refund_pct_range')) return { ok: false, error: 'INVALID_REFUND_PCT' };
    if (msg.includes('houses_child_free_under_age_range')) return { ok: false, error: 'INVALID_CHILD_AGE' };
    console.error('updateHousePolicy:', error);
    return { ok: false, error: msg };
  }
  return { ok: true };
}

export async function loadBookings(): Promise<Booking[]> {
  const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadBookings:', error); return []; }
  return (data ?? []).map(mapBooking);
}

// Full platform-wide reviews — only the admin moderation tab needs this;
// everyone else gets loadReviewsForHouses (scoped) instead.
export async function loadReviews(): Promise<Review[]> {
  const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadReviews:', error); return []; }
  return (data ?? []).map(mapReview);
}

// reviews has a public SELECT policy (needed so any guest can read a
// house's reviews on its detail page), so loading the whole table on every
// login pulls every review platform-wide. Scope to the house(s) actually
// being viewed — one house on HouseDetail, all of the owner's houses on
// OwnerDashboard's reply tab — same pattern as loadRoomsForHouses.
export async function loadReviewsForHouses(houseIds: string[]): Promise<Review[]> {
  if (houseIds.length === 0) return [];
  const { data, error } = await supabase.from('reviews').select('*').in('house_id', houseIds).order('created_at', { ascending: false });
  if (error) { console.error('loadReviewsForHouses:', error); return []; }
  return (data ?? []).map(mapReview);
}

// proof_image holds a base64 data URI of the uploaded screenshot — often
// hundreds of KB per row — and was pulled for every payment on every
// login via loadAppData even though it's only ever displayed when the
// admin actually reviews that specific payment. Exclude it from the
// general load; loadPaymentProofImage fetches it on demand instead.
// `details` (sender bank/wallet info) stays — it's small JSON, already
// shown inline in the admin payments list.
export async function loadPayments(): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments')
    // Explicit column list on purpose — proof_image is a base64 data URI worth
    // hundreds of KB per row and is fetched separately. Which also means a new
    // column is invisible here until it is named.
    .select('id, booking_id, user_id, user_name, amount, payment_method, payment_status, payment_date, transaction_reference, admin_notes, details, created_at, received_account, refunded_amount, refunded_at, refund_method, refund_note')
    .order('created_at', { ascending: false });
  if (error) { console.error('loadPayments:', error); return []; }
  return (data ?? []).map(mapPayment);
}

export async function loadPaymentProofImage(paymentId: string): Promise<string | null> {
  const { data, error } = await supabase.from('payments').select('proof_image').eq('id', paymentId).single();
  if (error) { console.error('loadPaymentProofImage:', error); return null; }
  return (data?.proof_image as string | null) ?? null;
}

export async function loadNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) { console.error('loadNotifications:', error); return []; }
  return (data ?? []).map(mapNotification);
}

// Live delivery — without this, a new notification (booking approved,
// deposit confirmed, new message, etc.) never appears until the user
// reloads the page. Returns an unsubscribe function — caller MUST call it
// on unmount/logout.
export function subscribeToNotifications(userId: string, onNotification: (n: AppNotification) => void): () => void {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => { onNotification(mapNotification(payload.new as Record<string, unknown>)); },
    )
    // Coalesced notifications (e.g. the per-thread "new messages" ping) are
    // refreshed via UPDATE, not re-inserted — deliver those live too.
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => { onNotification(mapNotification(payload.new as Record<string, unknown>)); },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Live delivery for a guest's own bookings — status changes (approved,
// deposit confirmed, checked in/out) and new rows appear without a reload.
export function subscribeToBookingsForUser(userId: string, onChange: (event: 'INSERT' | 'UPDATE', booking: Booking) => void): () => void {
  const channel = supabase
    .channel(`bookings:user:${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings', filter: `user_id=eq.${userId}` },
      (payload) => onChange('INSERT', mapBooking(payload.new as Record<string, unknown>)))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `user_id=eq.${userId}` },
      (payload) => onChange('UPDATE', mapBooking(payload.new as Record<string, unknown>)))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Live delivery for an owner's house — new booking requests and status
// changes appear without a reload.
export function subscribeToBookingsForHouse(houseId: string, onChange: (event: 'INSERT' | 'UPDATE', booking: Booking) => void): () => void {
  const channel = supabase
    .channel(`bookings:house:${houseId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings', filter: `house_id=eq.${houseId}` },
      (payload) => onChange('INSERT', mapBooking(payload.new as Record<string, unknown>)))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `house_id=eq.${houseId}` },
      (payload) => onChange('UPDATE', mapBooking(payload.new as Record<string, unknown>)))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Live room-status delivery — e.g. an owner edits a room's status on one
// device/tab and it updates on another without a reload.
export function subscribeToRoomsForHouse(houseId: string, onUpsert: (room: Room) => void, onDelete: (roomId: string) => void): () => void {
  const channel = supabase
    .channel(`rooms:house:${houseId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rooms', filter: `house_id=eq.${houseId}` },
      (payload) => onUpsert(mapRoom(payload.new as Record<string, unknown>)))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `house_id=eq.${houseId}` },
      (payload) => onUpsert(mapRoom(payload.new as Record<string, unknown>)))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'rooms', filter: `house_id=eq.${houseId}` },
      (payload) => onDelete((payload.old as Record<string, unknown>).id as string))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
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

export async function loadExpensesForHouses(houseIds: string[]): Promise<Expense[]> {
  if (houseIds.length === 0) return [];
  const { data, error } = await supabase.from('owner_expenses').select('*').in('house_id', houseIds).order('expense_date', { ascending: false });
  if (error) { console.error('loadExpensesForHouses:', error); return []; }
  return (data ?? []).map(mapExpense);
}

export async function createExpense(e: Expense): Promise<boolean> {
  const { error } = await supabase.from('owner_expenses').insert({
    id: e.id, house_id: e.houseId, description: e.description, amount: e.amount, expense_date: e.expenseDate, created_at: e.createdAt,
  });
  if (error) console.error('createExpense:', error);
  return !error;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const { error } = await supabase.from('owner_expenses').delete().eq('id', id);
  if (error) console.error('deleteExpense:', error);
  return !error;
}

export async function loadPayoutsForHouses(houseIds: string[]): Promise<Payout[]> {
  if (houseIds.length === 0) return [];
  const { data, error } = await supabase.from('owner_payouts').select('*').in('house_id', houseIds).order('requested_at', { ascending: false });
  // Degrade gracefully if the payouts table hasn't been migrated yet.
  if (error) { console.error('loadPayoutsForHouses:', error); return []; }
  return (data ?? []).map(mapPayout);
}

export async function createPayout(p: Payout): Promise<boolean> {
  const { error } = await supabase.from('owner_payouts').insert({
    id: p.id, house_id: p.houseId, owner_id: p.ownerId, amount: p.amount,
    status: p.status, method: p.method ?? null, note: p.note ?? null, requested_at: p.requestedAt,
  });
  if (error) console.error('createPayout:', error);
  return !error;
}

// Admin: every payout request across all houses (RLS 059 lets admin read all).
export async function loadAllPayouts(): Promise<Payout[]> {
  const { data, error } = await supabase.from('owner_payouts').select('*').order('requested_at', { ascending: false });
  if (error) { console.error('loadAllPayouts:', error); return []; }
  return (data ?? []).map(mapPayout);
}

// Admin advances a request (processing / completed / rejected).
export async function updatePayoutStatus(id: string, status: Payout['status']): Promise<boolean> {
  const { error } = await supabase.from('owner_payouts')
    .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) console.error('updatePayoutStatus:', error);
  return !error;
}

// Admin settles one or more bookings' owner share in a single transfer: records
// one completed payout (the ledger the owner's Financial Center reads, and the
// row whose INSERT trigger — migration 068 — pings the owner in realtime), then
// stamps each booking settled so it drops out of the admin's "to transfer" list.
// bookingIds with one element => a per-booking transfer; many => a batch.
export async function settleBookingsPayout(args: {
  houseId: string; ownerId: string; amount: number; bookingIds: string[]; method?: string; note?: string;
  /** The bank/wallet reference. This is what answers an owner who disputes a
   *  payment six months later — Pima captures one on every payment IN and
   *  used to capture none on the way out. */
  transactionReference?: string;
  /** Which of Pima's accounts it left from, so الخزنة can subtract it. */
  paidFromAccount?: string;
}): Promise<boolean> {
  const now = new Date().toISOString();
  const payoutId = `payout_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const { error: pErr } = await supabase.from('owner_payouts').insert({
    id: payoutId, house_id: args.houseId, owner_id: args.ownerId, amount: args.amount,
    status: 'completed', method: args.method ?? null, note: args.note ?? null,
    transaction_reference: args.transactionReference ?? null,
    paid_from_account: args.paidFromAccount ?? null,
    requested_at: now, completed_at: now,
    // What this transfer actually paid for. The pairing was previously implicit
    // — the same timestamp on the payout and on each booking — which is exact
    // but unreadable: an owner asking "what is this transfer?" could only be
    // answered by an admin reconstructing it by hand.
    booking_ids: args.bookingIds,
  });
  if (pErr) { console.error('settleBookingsPayout(payout):', pErr); return false; }
  const { error: bErr } = await supabase.from('bookings').update({ owner_settled_at: now }).in('id', args.bookingIds);
  if (bErr) { console.error('settleBookingsPayout(bookings):', bErr); return false; }
  return true;
}

export async function loadAnnouncementsForHouses(houseIds: string[]): Promise<Announcement[]> {
  if (houseIds.length === 0) return [];
  const { data, error } = await supabase.from('announcements').select('*').in('house_id', houseIds).order('created_at', { ascending: false });
  if (error) { console.error('loadAnnouncementsForHouses:', error); return []; }
  return (data ?? []).map(mapAnnouncement);
}

// RLS already scopes waitlist rows to the caller's own entries + the
// owner's houses, but it was still fetched on every login for every role,
// including guests who'll never open a waitlist-relevant screen. Scope to
// the house(s) actually in view — one house on HouseDetail (to check
// "am I already on this house's waitlist"), all of the owner's houses on
// OwnerDashboard — same pattern as rooms/announcements/reviews.
export async function loadWaitlistForHouses(houseIds: string[]): Promise<WaitlistEntry[]> {
  if (houseIds.length === 0) return [];
  const { data, error } = await supabase.from('waitlist').select('*').in('house_id', houseIds).order('created_at');
  if (error) { console.error('loadWaitlistForHouses:', error); return []; }
  return (data ?? []).map(mapWaitlistEntry);
}

export async function loadPlatformAnnouncements(): Promise<PlatformAnnouncement[]> {
  const { data, error } = await supabase.from('platform_announcements').select('*').order('created_at', { ascending: false });
  if (error) { console.error('loadPlatformAnnouncements:', error); return []; }
  return (data ?? []).map(mapPlatformAnnouncement);
}

// Admin-managed promo banners (migration 076). Public read; degrades to [] if
// the table isn't migrated yet, so the ported default banners still show.
export async function loadPromoBanners(): Promise<PromoBanner[]> {
  const { data, error } = await supabase.from('promo_banners').select('*').order('placement', { ascending: true }).order('sort', { ascending: true }).order('created_at', { ascending: true });
  if (error) { console.warn('loadPromoBanners:', error.message); return []; }
  return (data ?? []).map(mapPromoBanner);
}

// One mapper for both paths: the initial fetch and the realtime UPDATE feed.
// Two copies would drift, and this one decides the commission and the deposit
// the whole app quotes.
export function mapPlatformSettings(data: Record<string, unknown>): PlatformSettings {
  return {
    commissionRate: Number(data.commission_rate) ?? DEFAULT_PLATFORM_SETTINGS.commissionRate,
    // platform_settings is NOT the financial core. This row still carries the
    // legacy 0.15; loadPlatformSettings overlays the authoritative value and
    // sets the flag. A mapper alone can never establish it.
    depositRateIsAuthoritative: false,
    depositRate: Number(data.deposit_rate) ?? DEFAULT_PLATFORM_SETTINGS.depositRate,
    pointsPerEgp: Number(data.points_per_egp) ?? DEFAULT_PLATFORM_SETTINGS.pointsPerEgp,
    maxRedemptionPct: Number(data.max_redemption_pct) ?? DEFAULT_PLATFORM_SETTINGS.maxRedemptionPct,
    referralBonusPoints: Number(data.referral_bonus_points) ?? DEFAULT_PLATFORM_SETTINGS.referralBonusPoints,
    // ?? inside Number() never fires (NaN is not null) — check the raw
    // column instead so a pre-migration-054 DB falls back to defaults.
    freeCancelDays: data.free_cancel_days != null ? Number(data.free_cancel_days) : DEFAULT_PLATFORM_SETTINGS.freeCancelDays,
    partialRefundDays: data.partial_refund_days != null ? Number(data.partial_refund_days) : DEFAULT_PLATFORM_SETTINGS.partialRefundDays,
    partialRefundPct: data.partial_refund_pct != null ? Number(data.partial_refund_pct) : DEFAULT_PLATFORM_SETTINGS.partialRefundPct,
    // Pre-migration-069 rows have no column → undefined → fall back to [].
    paymentMethods: data.payment_methods != null ? (data.payment_methods as PlatformSettings['paymentMethods']) : [],
    supportWhatsApp: (data.support_whatsapp as string) || DEFAULT_PLATFORM_SETTINGS.supportWhatsApp,
    maxBookingsPerDay: data.max_bookings_per_day != null
      ? Number(data.max_bookings_per_day)
      : DEFAULT_PLATFORM_SETTINGS.maxBookingsPerDay,
  };
}

export async function loadPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase.from('platform_settings').select('*').eq('id', 1).single();
  const base = (error || !data)
    ? (error ? (console.error('loadPlatformSettings:', error), DEFAULT_PLATFORM_SETTINGS) : DEFAULT_PLATFORM_SETTINGS)
    : mapPlatformSettings(data as Record<string, unknown>);

  // financial_settings is authoritative for the money the guest is quoted.
  // platform_settings still holds the legacy 0.15 deposit and is the source
  // for everything non-financial (support number, rate limit, payment
  // methods), so it is read first and then overlaid — never the reverse.
  const fin = await loadClientFinancialSettings();
  // An empty overlay is a FAILURE, not an absence of opinion. Spreading it
  // would leave base.depositRate (0.15) looking like an answer.
  return { ...base, ...fin, depositRateIsAuthoritative: fin.depositRate != null };
}

export async function updatePlatformSettings(s: PlatformSettings): Promise<boolean> {
  const { error } = await supabase.from('platform_settings').update({
    commission_rate: s.commissionRate,
    deposit_rate: s.depositRate,
    points_per_egp: s.pointsPerEgp,
    max_redemption_pct: s.maxRedemptionPct,
    referral_bonus_points: s.referralBonusPoints,
    free_cancel_days: s.freeCancelDays,
    partial_refund_days: s.partialRefundDays,
    partial_refund_pct: s.partialRefundPct,
    payment_methods: s.paymentMethods ?? [],
    support_whatsapp: s.supportWhatsApp,
    max_bookings_per_day: s.maxBookingsPerDay,
    updated_at: new Date().toISOString(),
  }).eq('id', 1);
  if (error) console.error('updatePlatformSettings:', error);
  return !error;
}

// ─── Type → Row mappers (for inserts/updates) ──────────────────────────────
//
// bookingToRow was deleted with createBooking below. It existed to turn a
// client-side Booking — price, deposit and commission included — into an
// INSERT, and every one of those three is now the database to decide.

function reviewToRow(r: Review): Record<string, unknown> {
  return {
    id: r.id,
    house_id: r.houseId,
    house_name: r.houseName ?? null,
    user_id: r.userId,
    user_name: r.userName,
    user_role: r.userRole,
    rating: r.rating,
    booking_id: r.bookingId ?? null,
    stay_group: r.stayGroup ?? null,
    stay_band: r.stayBand ?? null,
    stay_nights: r.stayNights ?? null,
    stay_month: r.stayMonth ?? null,
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
    visit_purpose: r.visitPurpose ?? null,
    liked_tags: r.likedTags ?? [],
    problem_tags: r.problemTags ?? [],
    problem_other: r.problemOther ?? null,
    display_anonymous: r.displayAnonymous ?? false,
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
  const row: Record<string, unknown> = {
    id: r.id,
    house_id: r.houseId,
    name: r.name,
    beds_count: r.bedsCount,
    price_per_night: r.pricePerNight ?? null,
    images: r.images,
    status: r.status,
    floor: r.floor ?? 1,
    created_at: r.createdAt,
  };
  // Only sent once a type is assigned, so pre-migration room writes (no
  // type_id column yet) behave exactly as before — see migration 060.
  if (r.typeId !== undefined) row.type_id = r.typeId;
  return row;
}

// ─── Mutations ─────────────────────────────────────────────────────────────

// createBooking() USED TO LIVE HERE, and it was the last path in the app
// that wrote a booking without the financial core: a plain INSERT carrying
// a price, a deposit and a commission the client had worked out.
//
// Both of its callers are gone. A guest books through
// create_booking_with_financials; an owner records a walk-in through
// create_booking_on_behalf_with_financials. Deleting it rather than leaving
// it unused is the point — an exported helper that inserts a priced booking
// is how this hole would be reopened by the next person in a hurry.

export async function updateBookingStatus(id: string, status: Booking['status']): Promise<boolean> {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  if (error) console.error('updateBookingStatus:', error);
  return !error;
}

// Hard-delete a booking (owner: only manual/temporary or terminal rows — see
// migration 061; admin: any). Related attendees/allocations cascade in the DB.
export async function deleteBooking(id: string): Promise<boolean> {
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) console.error('deleteBooking:', error);
  return !error;
}

export async function updateBookingFields(id: string, fields: Partial<Booking>): Promise<{ ok: boolean; error?: string; availableBeds?: number }> {
  const row: Record<string, unknown> = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.depositPaid !== undefined) row.deposit_paid = fields.depositPaid;
  if (fields.depositAmount !== undefined) row.deposit_amount = fields.depositAmount;
  if (fields.paymentStatus !== undefined) row.payment_status = fields.paymentStatus;
  if (fields.checkedInAt !== undefined) row.checked_in_at = fields.checkedInAt;
  if (fields.checkedOutAt !== undefined) row.checked_out_at = fields.checkedOutAt;
  if (fields.checkIn !== undefined) row.check_in = fields.checkIn;
  if (fields.checkOut !== undefined) row.check_out = fields.checkOut;
  if (fields.guestsCount !== undefined) row.guests_count = fields.guestsCount;
  if (fields.ownerNotes !== undefined) row.owner_notes = fields.ownerNotes;
  if (fields.assignedRoomIds !== undefined) row.assigned_room_ids = fields.assignedRoomIds;
  const { error } = await supabase.from('bookings').update(row).eq('id', id);
  if (error) {
    const msg = error.message || '';
    if (msg.includes('INSUFFICIENT_CAPACITY')) {
      const match = msg.match(/Only (\d+) beds/);
      const availableBeds = match ? parseInt(match[1], 10) : 0;
      return { ok: false, error: 'INSUFFICIENT_CAPACITY', availableBeds };
    }
    console.error('updateBookingFields:', error);
    return { ok: false, error: msg };
  }
  return { ok: true };
}

/**
 * One review per STAY, not one per person per house.
 *
 * This upserted on (user_id, house_id) against the unique index from
 * migration 028 — so a church returning to a house it liked, which is the
 * whole business, silently destroyed what it wrote the year before. Three
 * summers at one house left exactly one review and no trace of the other two.
 *
 * 028's intent — stop one person spamming a house — was right; it picked the
 * wrong unit. The stay is the unit. Migration 114 replaces the index, so this
 * is a plain insert and what now gets refused is a second review of the SAME
 * booking.
 */
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
  // Only write admin_notes when the reviewer actually typed something.
  // Sending null unconditionally erased whatever note was already on the row
  // every time someone approved without adding one — on the exact record you
  // would want to read back if the guest disputes the payment.
  const patch: Record<string, unknown> = { payment_status: status };
  if (adminNotes != null && adminNotes.trim() !== '') patch.admin_notes = adminNotes;
  const { error } = await supabase.from('payments').update(patch).eq('id', id);
  if (error) console.error('updatePaymentStatus:', error);
  return !error;
}

/**
 * Record which of Pima's own accounts a payment landed in.
 *
 * payment_method says instapay / vodafone / bank — the KIND of transfer, not
 * WHICH account, and Pima has several. Without this there is no way to tally
 * the app against each real balance at the end of a week, which is the only
 * way to notice a transfer that never actually arrived.
 *
 * The label is copied rather than referenced: the accounts live in a jsonb
 * column on one settings row, and deleting an account later must not rewrite
 * where money went.
 */
export async function setPaymentAccount(paymentId: string, account: string): Promise<boolean> {
  const { error } = await supabase.from('payments').update({ received_account: account }).eq('id', paymentId);
  if (error) { console.error('setPaymentAccount:', error); return false; }
  return true;
}

/**
 * Give money back, and say so.
 *
 * Refunds had nowhere to live: payment_status is pending|approved|rejected, so
 * a deposit on a cancelled trip stayed counted as collected forever and
 * nothing recorded that it was owed back. cancellationPolicy computes what the
 * guest is due, but only to render a sentence — nothing persisted it.
 *
 * The server refuses a refund larger than the payment, or one against a
 * payment that was never approved; both would invent an outflow.
 */
export async function recordRefund(args: {
  paymentId: string; amount: number; method?: string; note?: string;
}): Promise<boolean> {
  const { error } = await supabase.rpc('record_refund', {
    p_payment_id: args.paymentId,
    p_amount: args.amount,
    p_method: args.method ?? null,
    p_note: args.note ?? null,
  });
  if (error) { console.error('recordRefund:', error); return false; }
  return true;
}

// Marks one member's trip-share as paid/unpaid (migration 080). Deliberately a
// targeted UPDATE of just this column — the flag never rides in the general
// roster upsert below, so roster edits keep working (and don't clobber flags)
// whether or not the column exists yet.
export async function setAttendeeSharePaid(attendeeId: string, paid: boolean): Promise<boolean> {
  const { error } = await supabase.from('attendees').update({ share_paid: paid }).eq('id', attendeeId);
  if (error) { console.error('setAttendeeSharePaid:', error); return false; }
  return true;
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

function roomTypeToRow(t: RoomType): Record<string, unknown> {
  return {
    id: t.id, house_id: t.houseId, name: t.name, price: t.price, beds_count: t.bedsCount,
    facilities: t.facilities, description: t.description ?? null, icon: t.icon ?? null, created_at: t.createdAt,
  };
}

export async function loadRoomTypesForHouses(houseIds: string[]): Promise<RoomType[]> {
  if (houseIds.length === 0) return [];
  const { data, error } = await supabase.from('room_types').select('*').in('house_id', houseIds).order('created_at', { ascending: true });
  // Degrade gracefully if the room_types table hasn't been migrated yet.
  if (error) { console.error('loadRoomTypesForHouses:', error); return []; }
  return (data ?? []).map(mapRoomType);
}

export async function createRoomType(t: RoomType): Promise<boolean> {
  const { error } = await supabase.from('room_types').insert(roomTypeToRow(t));
  if (error) console.error('createRoomType:', error);
  return !error;
}

export async function updateRoomType(t: RoomType): Promise<boolean> {
  const { error } = await supabase.from('room_types').update(roomTypeToRow(t)).eq('id', t.id);
  if (error) console.error('updateRoomType:', error);
  return !error;
}

export async function deleteRoomType(id: string): Promise<boolean> {
  const { error } = await supabase.from('room_types').delete().eq('id', id);
  if (error) console.error('deleteRoomType:', error);
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

// Notify a waiting guest that a spot opened, and mark the entry 'notified'
// (server-side — see migration 070_notify_waitlist).
export async function notifyWaitlist(waitlistId: string): Promise<boolean> {
  const { error } = await supabase.rpc('notify_waitlist', { p_waitlist_id: waitlistId });
  if (error) console.error('notifyWaitlist:', error);
  return !error;
}

// Servant tells the owner they've finished distributing (migration 073).
export async function notifyOwnerDistributionDone(bookingId: string): Promise<boolean> {
  const { error } = await supabase.rpc('notify_owner_distribution_done', { p_booking_id: bookingId });
  if (error) console.error('notifyOwnerDistributionDone:', error);
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

// Promo banners — admin CRUD (RLS restricts writes to admins).
function promoBannerToRow(b: PromoBanner): Record<string, unknown> {
  return {
    id: b.id,
    placement: b.placement,
    is_active: b.isActive,
    sort: b.sort ?? 0,
    badge: b.badge ?? null,
    title: b.title ?? null,
    subtitle: b.subtitle ?? null,
    cta_text: b.ctaText ?? null,
    image_url: b.imageUrl ?? null,
    ends_at: b.endsAt ?? null,
    created_at: b.createdAt,
    link_url: b.linkUrl ?? null,
    links: b.links ?? [],
    layout: b.layout ?? null,
    linked_house_id: b.linkedHouseId ?? null,
    status: b.status ?? 'published',
    starts_at: b.startsAt ?? null,
    audience: b.audience ?? {},
    experiment: b.experiment || null,
    variant: b.variant || null,
  };
}

export async function createPromoBanner(b: PromoBanner): Promise<boolean> {
  const { error } = await supabase.from('promo_banners').insert(promoBannerToRow(b));
  if (error) console.error('createPromoBanner:', error);
  return !error;
}

export async function updatePromoBanner(b: PromoBanner): Promise<boolean> {
  const { error } = await supabase.from('promo_banners').update(promoBannerToRow(b)).eq('id', b.id);
  if (error) console.error('updatePromoBanner:', error);
  return !error;
}

export async function setPromoBannerActive(id: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase.from('promo_banners').update({ is_active: isActive }).eq('id', id);
  if (error) console.error('setPromoBannerActive:', error);
  return !error;
}

export async function deletePromoBanner(id: string): Promise<boolean> {
  const { error } = await supabase.from('promo_banners').delete().eq('id', id);
  if (error) console.error('deletePromoBanner:', error);
  return !error;
}

// ─── Email preferences (migration 079) ─────────────────────────────────────

// Turns transactional email on/off for the signed-in user. Returns the value
// the server settled on, so the UI reflects reality rather than the request.
export async function setEmailOptOut(optOut: boolean): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('set_email_opt_out', { p_opt_out: optOut });
  if (error) { console.error('setEmailOptOut:', error); return null; }
  return data as boolean;
}

// One-click unsubscribe from an emailed link — runs without a session, so the
// recipient never has to sign in to stop receiving mail.
export async function unsubscribeEmail(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('unsubscribe_email', { p_token: token });
  if (error) { console.error('unsubscribeEmail:', error); return false; }
  return data === true;
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
// Owner phone/email are intentionally UNAVAILABLE — all guest↔owner
// communication goes through booking_messages. Do NOT re-add a contact
// reveal without checking migration 056's rationale (anti-disintermediation).
export interface OwnerProfile {
  firstName: string;
  avatarUrl: string | null;
  hostedGroups: number;
  avgResponseHours: number | null;
  verified: boolean;
}

export async function getHouseOwnerProfile(houseId: string): Promise<OwnerProfile | null> {
  const { data, error } = await supabase.rpc('get_house_owner_profile', { p_house_id: houseId });
  if (error) { console.error('getHouseOwnerProfile:', error); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    firstName: (row.first_name as string) || 'المالك',
    avatarUrl: (row.avatar_url as string) || null,
    hostedGroups: (row.hosted_groups as number) || 0,
    avgResponseHours: row.avg_response_hours != null ? Number(row.avg_response_hours) : null,
    verified: Boolean(row.verified),
  };
}

// Admin-only audit trail (migration 032) — RLS restricts SELECT to admins,
// so this is a no-op empty result for anyone else. Fetched lazily when the
// admin opens the audit tab, not as part of loadAppData.
export async function loadAuditLog(limit: number = 100): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) { console.error('loadAuditLog:', error); return []; }
  return (data ?? []).map(mapAuditLogEntry);
}

// Entertainment module (migration 035, extended by 037) — award XP +
// game coins after a game. Level-up is computed server-side; xp/level/
// game_coins are all protected columns so this RPC is the only path
// that can move them. Game coins are a SEPARATE currency from booking
// loyalty points — they spend on entertainment-only perks, never on
// booking discounts. `correctCount` feeds total_correct_answers/
// total_games_played, which achievements are computed from.
export async function awardGameReward(
  xp: number,
  coins: number,
  correctCount: number,
  description: string,
): Promise<{ xp: number; level: number; gameCoins: number } | null> {
  const { data, error } = await supabase.rpc('award_game_reward', {
    p_xp: xp, p_coins: coins, p_correct: correctCount, p_description: description,
  });
  if (error) { console.error('awardGameReward:', error); return null; }
  const row = data?.[0];
  if (!row) return null;
  return { xp: row.new_xp, level: row.new_level, gameCoins: row.new_coins };
}

// Achievements (migration 037) — server checks all thresholds and
// awards any newly-qualified ones atomically, returning just the ids
// that were newly unlocked THIS call (so the UI can show a "new
// achievement" celebration only for what actually just happened).
export async function checkAchievements(): Promise<string[]> {
  const { data, error } = await supabase.rpc('check_achievements');
  if (error) { console.error('checkAchievements:', error); return []; }
  return (data as string[]) ?? [];
}

/**
 * Release an account: hand its email back so the person can register again,
 * anonymise the profile, and keep every booking, payment and review.
 *
 * Not a delete. public.users cascades to twenty-two tables including houses,
 * bookings and payments — removing a house owner would take other guests'
 * bookings and the money trail with them. See migration 107.
 */
export async function releaseUserAccount(userId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('admin_release_user', { target: userId });
  if (error) {
    console.error('releaseUserAccount:', error);
    // The RPC raises Arabic messages for the cases an admin can actually hit
    // (their own account, another admin, a missing row) — show those verbatim
    // rather than a generic failure that hides which rule was broken.
    return { ok: false, error: error.message };
  }
  return { ok: true, error: (data as { freed_email?: string } | null)?.freed_email };
}

/**
 * Write ONLY the images column for one house.
 *
 * Used by the storage migration, which has just fetched the complete set and
 * rewritten it. Deliberately not houseUpdatePayload: that carries thirty other
 * fields, and a maintenance job should touch the one thing it came to change.
 */
export async function saveHouseImages(houseId: string, images: string[]): Promise<boolean> {
  const { error } = await supabase.from('houses').update({ images }).eq('id', houseId);
  if (error) { console.error('saveHouseImages:', error); return false; }
  return true;
}

/**
 * Watch the platform settings for changes.
 *
 * The rates were fetched once at login and never again, so an admin raising
 * the commission left every open session quoting the old number — on the
 * owner's finance screen, in their reports, and on the deposit a new guest was
 * asked for. Migration 108 puts platform_settings in the realtime publication;
 * this is the other half.
 */
export function subscribeToPlatformSettings(onChange: (s: PlatformSettings) => void): () => void {
  const channel = supabase
    .channel('platform-settings')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'platform_settings' },
      (payload) => { onChange(mapPlatformSettings(payload.new as Record<string, unknown>)); },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/**
 * File the cash deposit an owner says he received, and mark the booking.
 *
 * The client used to insert the payment row directly with the GUEST's user_id.
 * payments_insert_user requires auth.uid() = user_id, and protect_payment_write
 * refuses it again unless the booking belongs to the caller — the owner is
 * neither, so the row was never written, silently. The booking flip beside it
 * did persist, so the booking claimed a deposit with no payment behind it and
 * the payout screen went on offering that deposit for transfer.
 *
 * The check "is this the owner of the house this booking is for" cannot be
 * expressed as an RLS policy on payments, so it lives inside the function.
 * Idempotent: a second tap after a dropped connection files nothing extra.
 */
export async function recordCashDeposit(bookingId: string): Promise<boolean> {
  const { error } = await supabase.rpc('record_cash_deposit', { p_booking_id: bookingId });
  if (error) { console.error('recordCashDeposit:', error); return false; }
  return true;
}

// ─── Commercial agreements (0139 schema, 0154 workflow) ────────────────────
//
// Two tables, and the difference between them is the whole design:
//
//   house_agreements          what the financial engine prices against.
//                             Admin-write only, append-only, immutable terms.
//   house_agreement_requests  what an owner would LIKE. A proposal. Read-only
//                             to every client; written only by the RPCs below.
//
// None of these functions is a gate. Authorization is the database's — RLS
// decides what is visible and each RPC decides who may call it — and every one
// of them refuses a NET_RATE request regardless of what the UI sends.

function mapAgreement(r: Record<string, unknown>): HouseAgreement {
  return {
    id: r.id as string,
    houseId: r.house_id as string,
    modelType: r.model_type as AgreementModel,
    netRate: r.net_rate != null ? Number(r.net_rate) : undefined,
    baseRate: r.base_rate != null ? Number(r.base_rate) : undefined,
    markupPct: r.markup_pct != null ? Number(r.markup_pct) : undefined,
    commissionRate: r.commission_rate != null ? Number(r.commission_rate) : undefined,
    currency: (r.currency as string) ?? 'EGP',
    effectiveFrom: r.effective_from as string,
    effectiveTo: (r.effective_to as string) ?? undefined,
    createdBy: (r.created_by as string) ?? undefined,
    closedBy: (r.closed_by as string) ?? undefined,
    note: (r.note as string) ?? undefined,
    createdAt: (r.created_at as string) ?? undefined,
  };
}

function mapAgreementRequest(r: Record<string, unknown>): HouseAgreementRequest {
  return {
    id: r.id as string,
    houseId: r.house_id as string,
    modelType: r.model_type as OwnerAgreementModel,
    markupPct: r.markup_pct != null ? Number(r.markup_pct) : undefined,
    commissionRate: r.commission_rate != null ? Number(r.commission_rate) : undefined,
    currency: (r.currency as string) ?? 'EGP',
    ownerNote: (r.owner_note as string) ?? undefined,
    status: r.status as HouseAgreementRequest['status'],
    submittedBy: (r.submitted_by as string) ?? undefined,
    submittedAt: r.submitted_at as string,
    reviewedBy: (r.reviewed_by as string) ?? undefined,
    reviewedAt: (r.reviewed_at as string) ?? undefined,
    adminNotes: (r.admin_notes as string) ?? undefined,
    agreementId: (r.agreement_id as string) ?? undefined,
  };
}

/** RLS narrows this to the houses the caller owns; an admin sees everything. */
export async function loadHouseAgreements(houseId?: string): Promise<HouseAgreement[]> {
  let q = supabase.from('house_agreements').select('*');
  if (houseId) q = q.eq('house_id', houseId);
  const { data, error } = await q.order('effective_from', { ascending: false });
  if (error) { console.error('loadHouseAgreements:', error); return []; }
  return (data ?? []).map((r) => mapAgreement(r as Record<string, unknown>));
}

export async function loadAgreementRequests(houseId?: string): Promise<HouseAgreementRequest[]> {
  let q = supabase.from('house_agreement_requests').select('*');
  if (houseId) q = q.eq('house_id', houseId);
  const { data, error } = await q.order('submitted_at', { ascending: false });
  if (error) { console.error('loadAgreementRequests:', error); return []; }
  return (data ?? []).map((r) => mapAgreementRequest(r as Record<string, unknown>));
}

/** Arabic for the exceptions these RPCs raise, so a form can say what is wrong. */
function agreementError(msg: string): string {
  if (msg.includes('AGREEMENT_MODEL_NOT_SELECTABLE'))
    return 'النظام ده بيتفق عليه مع إدارة بيما مباشرة، مش من هنا.';
  if (msg.includes('AGREEMENT_REQUEST_PENDING') || msg.includes('har_one_pending_per_house'))
    return 'في طلب مقدّم بالفعل ولسه تحت المراجعة.';
  if (msg.includes('NOT_YOUR_HOUSE')) return 'البيت ده مش تابع لحسابك.';
  if (msg.includes('ADMIN_ONLY')) return 'الإجراء ده للإدارة فقط.';
  if (msg.includes('ADMIN_NOTE_REQUIRED')) return 'لازم تكتب سبب يوصل لصاحب البيت.';
  if (msg.includes('NEGOTIATION_NOTE_REQUIRED')) return 'اتفاق الصافي لازم يتسجل معاه سبب التفاوض.';
  if (msg.includes('AGREEMENT_SAME_DAY_SUPERSEDE'))
    return 'الاتفاق الحالي بدأ النهاردة — أقرب تاريخ لاتفاق جديد هو بكرة.';
  if (msg.includes('REQUEST_NOT_PENDING')) return 'الطلب ده اتراجع فيه بالفعل.';
  if (msg.includes('NO_ACTIVE_AGREEMENT')) return 'مفيش اتفاق سارٍ على البيت ده.';
  if (msg.includes('INVALID_AGREEMENT_MODEL')) return 'نظام تعاقد غير معروف.';
  return 'تعذّر تنفيذ الطلب. حاول مرة أخرى.';
}

// Flat, not a discriminated union: the project compiles without `strict`, so a
// boolean-literal discriminant does not narrow. Same shape createBooking and
// updateHousePolicy already use.
type AgreementResult<T> = { ok: boolean; data?: T; error?: string };

/**
 * The owner asks. MARKUP or COMMISSION — the parameter type says so, and the
 * database says so again three times over.
 */
export async function requestHouseAgreement(args: {
  houseId: string;
  modelType: OwnerAgreementModel;
  markupPct?: number | null;
  commissionRate?: number | null;
  ownerNote?: string | null;
}): Promise<AgreementResult<HouseAgreementRequest>> {
  const { data, error } = await supabase.rpc('request_house_agreement', {
    p_house_id: args.houseId,
    p_model_type: args.modelType,
    p_markup_pct: args.markupPct ?? null,
    p_commission_rate: args.commissionRate ?? null,
    p_owner_note: args.ownerNote ?? null,
  });
  if (error) {
    console.error('requestHouseAgreement:', error);
    return { ok: false, error: agreementError(error.message || '') };
  }
  return { ok: true, data: mapAgreementRequest(data as Record<string, unknown>) };
}

export async function cancelAgreementRequest(
  requestId: string,
): Promise<AgreementResult<HouseAgreementRequest>> {
  const { data, error } = await supabase.rpc('cancel_house_agreement_request', {
    p_request_id: requestId,
  });
  if (error) {
    console.error('cancelAgreementRequest:', error);
    return { ok: false, error: agreementError(error.message || '') };
  }
  return { ok: true, data: mapAgreementRequest(data as Record<string, unknown>) };
}

/**
 * The admin decides. Approving is not accepting: any term left undefined falls
 * back to what the owner asked for, and an admin who changes the model has to
 * say why — including a change to NET_RATE, which is how a negotiation is
 * recorded rather than smuggled.
 */
export async function reviewAgreementRequest(args: {
  requestId: string;
  decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
  adminNotes?: string | null;
  modelType?: AgreementModel | null;
  markupPct?: number | null;
  commissionRate?: number | null;
  netRate?: number | null;
  effectiveFrom?: string | null;
  agreementNote?: string | null;
}): Promise<AgreementResult<HouseAgreementRequest>> {
  const { data, error } = await supabase.rpc('review_house_agreement_request', {
    p_request_id: args.requestId,
    p_decision: args.decision,
    p_admin_notes: args.adminNotes ?? null,
    p_model_type: args.modelType ?? null,
    p_markup_pct: args.markupPct ?? null,
    p_commission_rate: args.commissionRate ?? null,
    p_net_rate: args.netRate ?? null,
    p_effective_from: args.effectiveFrom ?? null,
    p_agreement_note: args.agreementNote ?? null,
  });
  if (error) {
    console.error('reviewAgreementRequest:', error);
    return { ok: false, error: agreementError(error.message || '') };
  }
  return { ok: true, data: mapAgreementRequest(data as Record<string, unknown>) };
}

/** Admin creates or supersedes directly — no request needed. NET_RATE lives here. */
export async function adminSetHouseAgreement(args: {
  houseId: string;
  modelType: AgreementModel;
  markupPct?: number | null;
  commissionRate?: number | null;
  netRate?: number | null;
  effectiveFrom?: string | null;
  note?: string | null;
}): Promise<AgreementResult<HouseAgreement>> {
  const { data, error } = await supabase.rpc('admin_set_house_agreement', {
    p_house_id: args.houseId,
    p_model_type: args.modelType,
    p_markup_pct: args.markupPct ?? null,
    p_commission_rate: args.commissionRate ?? null,
    p_net_rate: args.netRate ?? null,
    p_effective_from: args.effectiveFrom ?? null,
    p_note: args.note ?? null,
  });
  if (error) {
    console.error('adminSetHouseAgreement:', error);
    return { ok: false, error: agreementError(error.message || '') };
  }
  return { ok: true, data: mapAgreement(data as Record<string, unknown>) };
}

/**
 * Closing without a successor leaves the house with no agreement in force,
 * which means it cannot be priced or booked on the financial core. That is the
 * point: it is how a house is commercially suspended.
 */
export async function adminCloseHouseAgreement(
  houseId: string,
  effectiveTo?: string | null,
): Promise<AgreementResult<HouseAgreement>> {
  const { data, error } = await supabase.rpc('admin_close_house_agreement', {
    p_house_id: houseId,
    p_effective_to: effectiveTo ?? null,
  });
  if (error) {
    console.error('adminCloseHouseAgreement:', error);
    return { ok: false, error: agreementError(error.message || '') };
  }
  return { ok: true, data: mapAgreement(data as Record<string, unknown>) };
}

/**
 * Customer-facing prices for houses, with any MARKUP already applied.
 *
 * Under MARKUP the number a guest pays is the house's listed price plus the
 * agreed percentage, so `houses.price_per_night_per_person` — which is what
 * every card, map pin and detail page has always rendered — is the OWNER's
 * figure, not the guest's. Showing it to a guest under a MARKUP agreement
 * would contradict what checkout then charges.
 *
 * fin_house_customer_rates does the arithmetic server-side and returns prices
 * only: the markup percentage never reaches the browser. For COMMISSION,
 * NET_RATE, and houses with no agreement the numbers come back untouched,
 * which is why merging this in changes nothing until a MARKUP agreement
 * exists.
 *
 * Never fails the page: on error it returns an empty map and callers fall back
 * to the raw listing, which is exactly today's behaviour.
 */
export async function loadHouseCustomerRates(
  houseIds?: string[],
): Promise<Record<string, HouseCustomerRates>> {
  const { data, error } = await supabase.rpc('fin_house_customer_rates', {
    p_house_ids: houseIds && houseIds.length ? houseIds : null,
  });
  if (error) { console.warn('loadHouseCustomerRates:', error.message); return {}; }
  const out: Record<string, HouseCustomerRates> = {};
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const id = row.house_id as string;
    out[id] = {
      houseId: id,
      pricePerNightPerPerson: row.price_per_night_per_person != null
        ? Number(row.price_per_night_per_person) : undefined,
      dayUsePricePerPerson: row.day_use_price_per_person != null
        ? Number(row.day_use_price_per_person) : undefined,
      monthlyRent: row.monthly_rent != null ? Number(row.monthly_rent) : undefined,
      seasonalRates: (row.seasonal_rates as SeasonalRate[]) ?? undefined,
    };
  }
  return out;
}

/** Attach customer rates to houses in place of nothing — raw fields are untouched. */
export function withCustomerRates(
  houses: RetreatHouse[],
  rates: Record<string, HouseCustomerRates>,
): RetreatHouse[] {
  if (!Object.keys(rates).length) return houses;
  return houses.map((h) => (rates[h.id] ? { ...h, customerRates: rates[h.id] } : h));
}

// ─── Booking creation through the financial core (0153/0155/0156) ──────────
//
// This replaces the direct `bookings` insert for every guest booking. The
// difference is not cosmetic:
//
//   legacy insert            create_booking_with_financials
//   ─────────────            ──────────────────────────────
//   client sends the price   the server prices it from the agreement
//   deposit = 15% (trigger)  deposit = the PD-16 rule on financial_settings
//   points a second call     points deducted in the same transaction
//   no idempotency           a key, a fingerprint and a safe replay
//   no snapshot              booking_financials + settlement hold
//
// The client no longer sends a price at all. It sends what the guest chose —
// house, dates, party, promotion, points — and the server decides the money.
// That is the whole point: a total computed in a browser can disagree with the
// one the engine would compute, and for MARKUP it always would.

/** Arabic for the exceptions the booking RPC raises. Never show a guest raw SQL. */
function bookingRpcError(msg: string): { code: string; message: string } {
  const m = msg || '';
  const pick = (code: string, message: string) => ({ code, message });

  if (m.includes('NO_AGREEMENT'))
    return pick('NO_AGREEMENT', 'البيت ده لسه مش جاهز لاستقبال الحجوزات. جرّب بيت تاني أو تواصل معانا.');
  if (m.includes('INSUFFICIENT_CAPACITY')) {
    const match = m.match(/Only (\d+) beds/);
    const beds = match ? Number(match[1]) : 0;
    return pick('INSUFFICIENT_CAPACITY', beds === 0
      ? 'البيت مكتمل الإشغال في التواريخ دي. اختار تواريخ تانية.'
      : `لم يتبقَ سوى ${beds} سرير في التواريخ دي. قلّل عدد الأفراد أو غيّر التواريخ.`);
  }
  if (m.includes('OVERRIDE_REQUIRED'))
    return pick('OVERRIDE_REQUIRED',
      'الحجز ده محتاج مراجعة من الإدارة قبل التأكيد. تواصل معانا وهنكمّله معاك.');
  if (m.includes('POINTS_EXCEED_CAP'))
    return pick('POINTS_EXCEED_CAP', 'النقاط اللي اخترتها أكبر من الحد المسموح خصمه على الحجز ده.');
  if (m.includes('INSUFFICIENT_POINTS'))
    return pick('INSUFFICIENT_POINTS', 'رصيد نقاطك مش كافي للخصم ده.');
  if (m.includes('DISCOUNTS_EXCEED_PRICE'))
    return pick('DISCOUNTS_EXCEED_PRICE', 'الخصومات أكبر من قيمة الحجز. قلّل النقاط المستخدمة.');
  if (m.includes('IDEMPOTENCY_CONFLICT'))
    return pick('IDEMPOTENCY_CONFLICT',
      'تفاصيل الحجز اتغيرت بعد ما بدأت. اقفل الصفحة وابدأ الحجز من أول وجديد.');
  // The client picks the booking id, so a collision is reachable. It used to
  // fall through to the generic «حاول مرة أخرى» — advice that cannot work,
  // because the booking screen holds the id across retries and would send the
  // same taken one for ever. The code travels so the screen can mint a fresh
  // id; the idempotency key is kept, which is what stops a retry double-booking.
  if (m.includes('BOOKING_ID_TAKEN'))
    return pick('BOOKING_ID_TAKEN', 'حصل تعارض في رقم الحجز. اضغط تأكيد الحجز تاني.');
  if (m.includes('PROMOTION_NOT_FOUND') || m.includes('PROMOTION_EXPIRED'))
    return pick('PROMOTION_INVALID', 'العرض ده مش متاح دلوقتي.');
  if (m.includes('NOT_AUTHENTICATED'))
    return pick('NOT_AUTHENTICATED', 'لازم تسجّل دخولك الأول.');
  if (m.includes('HOUSE_NOT_FOUND'))
    return pick('HOUSE_NOT_FOUND', 'البيت ده مش موجود.');
  if (m.includes('NO_FINANCIAL_SETTINGS'))
    return pick('NO_FINANCIAL_SETTINGS', 'تعذّر تسعير الحجز دلوقتي. حاول بعد شوية.');
  if (m.includes('rate limit') || m.includes('MAX_BOOKINGS'))
    return pick('RATE_LIMITED', 'عملت حجوزات كتير النهارده. حاول بكرة.');
  return pick('UNKNOWN', 'حدث خطأ في حفظ الحجز. حاول مرة أخرى.');
}

export interface CreateBookingInput {
  /** Stable for the whole attempt — reused unchanged on every retry. */
  bookingId: string;
  /** Stable for the whole attempt. A NEW key means a NEW booking. */
  idempotencyKey: string;
  houseId: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  childAges?: number[] | null;
  promotionId?: string | null;
  /** Deducted inside the booking transaction. Never redeem separately. */
  points?: number;
  /** Non-financial metadata the RPC cannot derive; attached straight after. */
  details?: {
    userName?: string | null;
    userPhone?: string | null;
    userEmail?: string | null;
    organizationName?: string | null;
    isLargeConferenceQuote?: boolean;
    conferenceDetails?: Record<string, unknown> | null;
  };
}

export interface CreateBookingResult {
  ok: boolean;
  error?: string;
  code?: string;
  booking?: Booking;
  /** True when the RPC recognised the key and returned the original booking. */
  replayed?: boolean;
}

/**
 * Create a booking through the financial core.
 *
 * Retry-safe by construction: call it again with the SAME bookingId and
 * idempotencyKey and the server returns the original booking instead of making
 * a second one — no second snapshot, no second points deduction. Call it with
 * a different key and you get a different booking, which is why the key must
 * be generated once per attempt and held, not regenerated per click.
 */
export async function createBookingWithFinancials(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const { data, error } = await supabase.rpc('create_booking_with_financials', {
    p_booking_id: input.bookingId,
    p_house_id: input.houseId,
    p_check_in: input.checkIn,
    p_check_out: input.checkOut,
    p_guests_count: input.guestsCount,
    p_idempotency_key: input.idempotencyKey,
    p_child_ages: input.childAges && input.childAges.length ? input.childAges : null,
    p_promotion_id: input.promotionId ?? null,
    p_points: input.points ?? 0,
    p_override_reason: null,
  });

  if (error) {
    const mapped = bookingRpcError(error.message || '');
    console.error('createBookingWithFinancials:', error);
    return { ok: false, code: mapped.code, error: mapped.message };
  }

  const snapshot = (data ?? {}) as Record<string, unknown>;
  const bookingId = (snapshot.booking_id as string) ?? input.bookingId;
  const replayed = snapshot.replayed === true;

  // Metadata the RPC cannot carry. Idempotent, money-free, and deliberately
  // not fatal: a booking that exists without its conference note is a support
  // ticket, whereas failing here after the money is committed would be a lie.
  const d = input.details;
  if (d) {
    const { error: detErr } = await supabase.rpc('attach_booking_details', {
      p_booking_id: bookingId,
      p_user_name: d.userName ?? null,
      p_user_phone: d.userPhone ?? null,
      p_user_email: d.userEmail ?? null,
      p_organization_name: d.organizationName ?? null,
      p_is_quote: d.isLargeConferenceQuote ?? false,
      p_details: d.conferenceDetails ?? null,
    });
    if (detErr) console.error('attachBookingDetails (booking is saved):', detErr);
  }

  // The RPC returns the financial snapshot, not the booking row. Read the row
  // back so the UI reflects exactly what was stored rather than what we sent.
  const { data: row, error: readErr } = await supabase
    .from('bookings').select('*').eq('id', bookingId).single();
  if (readErr || !row) {
    console.error('createBookingWithFinancials: booking saved but could not be read back', readErr);
    return { ok: true, replayed, code: 'SAVED_UNREADABLE' };
  }

  return { ok: true, replayed, booking: mapBooking(row as Record<string, unknown>) };
}

/**
 * The guest-visible slice of financial_settings (migration 0156).
 *
 * financial_settings is admin-read-only, so the browser cannot read the
 * authoritative 30% deposit directly — which is why every checkout screen was
 * still quoting platform_settings' 0.15. This returns only the fields a guest
 * legitimately needs; margins, commission and transfer fees stay server-side.
 */
export async function loadClientFinancialSettings(): Promise<Partial<PlatformSettings>> {
  const { data, error } = await supabase.rpc('fin_client_settings');
  if (error) { console.error('loadClientFinancialSettings — the guest deposit rate is NOT authoritative:', error.message); return {}; }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) return {};
  const out: Partial<PlatformSettings> = {};
  if (row.deposit_rate != null) out.depositRate = Number(row.deposit_rate);
  if (row.points_per_egp != null) out.pointsPerEgp = Number(row.points_per_egp);
  if (row.max_redemption_pct != null) out.maxRedemptionPct = Number(row.max_redemption_pct);
  return out;
}

/**
 * One user, read back from the server.
 *
 * Used after a booking redeems points: the deduction happens inside the
 * booking transaction, so the only honest way to know the new balance is to
 * ask. Recomputing it client-side is what let a retry appear to spend points
 * twice even when the server had only charged once.
 */
export async function loadUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
  if (error || !data) { if (error) console.error('loadUserById:', error); return null; }
  return mapUser(data as Record<string, unknown>);
}

// ─── Financial-core snapshots (three role-scoped views) ────────────────────

/**
 * The booking financials this caller is entitled to see.
 *
 * Three views, three audiences, each one filtered in SQL rather than here:
 *
 *   fin_booking_summary_customer  guest_user_id = auth.uid()
 *   fin_booking_summary_owner     owner_id      = auth.uid()
 *   fin_booking_summary_admin     is_admin(auth.uid())
 *
 * The column list differs too, and that is the point. The customer view has
 * no owner_entitlement and no margin at all; the owner view has no margin and
 * no other owner's rows. A screen therefore cannot leak a figure by accident
 * — the field is simply not in the payload. Nothing here filters or widens
 * what SQL returned.
 *
 * An empty result is not an error: every booking made before the financial
 * core has no snapshot, and the owner's manual booking path still creates
 * such rows. Callers treat a missing id as "no core figure", never as zero.
 */
export async function loadCustomerFinancials(): Promise<FinancialsIndex<CustomerFinancials>> {
  const { data, error } = await supabase.from('fin_booking_summary_customer').select('*');
  if (error) { console.warn('loadCustomerFinancials:', error.message); return {}; }
  return indexByBooking((data || []).map((r) => mapCustomerFinancials(r as Record<string, unknown>)));
}

export async function loadOwnerFinancials(): Promise<FinancialsIndex<OwnerFinancials>> {
  const { data, error } = await supabase.from('fin_booking_summary_owner').select('*');
  if (error) { console.warn('loadOwnerFinancials:', error.message); return {}; }
  return indexByBooking((data || []).map((r) => mapOwnerFinancials(r as Record<string, unknown>)));
}

export async function loadAdminFinancials(): Promise<FinancialsIndex<AdminFinancials>> {
  const { data, error } = await supabase.from('fin_booking_summary_admin').select('*');
  if (error) { console.warn('loadAdminFinancials:', error.message); return {}; }
  return indexByBooking((data || []).map((r) => mapAdminFinancials(r as Record<string, unknown>)));
}

/**
 * The authoritative price for a stay the guest has not booked yet.
 *
 * `fin_quote_booking` and `create_booking_with_financials` both run through
 * `fin_price_booking`, so the quote and the charge are the same calculation
 * by construction rather than by agreement between two implementations. That
 * matters most where they would otherwise diverge: PD-16 can lift the deposit
 * above the headline rate to cover the margin floor, and a screen doing
 * `total x rate` would quote the guest less than the booking charges.
 *
 * Returns null when nobody is signed in (the function is granted only to
 * `authenticated`) or when the stay is not yet priceable. Callers keep their
 * local estimate for that case; it is the same arithmetic the app has always
 * shown, and the booking itself is priced by the server either way.
 */
export async function loadBookingQuote(args: {
  houseId: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  childAges?: number[];
  promotionId?: string | null;
  points?: number;
}): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('fin_quote_booking', {
    p_house_id: args.houseId,
    p_check_in: args.checkIn,
    p_check_out: args.checkOut,
    p_guests_count: args.guestsCount,
    p_child_ages: args.childAges ?? null,
    p_promotion_id: args.promotionId ?? null,
    p_points: args.points ?? 0,
  });
  // Not an error worth surfacing: a house with no agreement, or a stay that
  // breaches capacity, is a refusal the booking screen already explains.
  if (error) { console.warn('loadBookingQuote:', error.message); return null; }
  return (data as Record<string, unknown> | null) ?? null;
}

/**
 * Record a booking the owner took off-platform, priced by the financial core.
 *
 * The RPC derives the acting identity from auth.uid() and takes the guest
 * separately, so the booking belongs to the guest while the audit trail
 * records who typed it in. It accepts no price: see OwnerBookingIntent.
 */
export async function createBookingOnBehalf(
  intent: OwnerBookingIntent,
): Promise<{ ok: boolean; error?: string; bookingId?: string; replayed?: boolean }> {
  const { data, error } = await supabase.rpc('create_booking_on_behalf_with_financials', {
    p_booking_id: intent.bookingId,
    p_house_id: intent.houseId,
    p_check_in: intent.checkIn,
    p_check_out: intent.checkOut,
    p_guests_count: intent.guestsCount,
    p_idempotency_key: intent.idempotencyKey,
    p_guest_name: intent.guestName,
    p_guest_phone: intent.guestPhone ?? null,
    p_guest_email: intent.guestEmail ?? null,
    p_organization: intent.organizationName ?? null,
    p_guest_user_id: intent.guestUserId ?? null,
    p_source: intent.source,
    p_owner_notes: intent.ownerNotes ?? null,
    p_points: intent.points ?? 0,
  });
  if (error) {
    console.error('createBookingOnBehalf:', error);
    return { ok: false, error: ownerBookingRpcError(error.message || '') };
  }
  const row = (data ?? {}) as Record<string, unknown>;
  return { ok: true, bookingId: String(row.booking_id ?? intent.bookingId), replayed: row.replayed === true };
}

/**
 * The owner-facing Arabic for the refusals this RPC can produce.
 *
 * PRICE_TOO_LOW is gone from the list on purpose: the owner no longer supplies
 * a price, so the floor he used to fall below cannot be hit.
 */
function ownerBookingRpcError(msg: string): string {
  if (msg.includes('NOT_AUTHORIZED_FOR_HOUSE')) return 'مش مسموح لك تسجّل حجز على البيت ده.';
  if (msg.includes('NO_AGREEMENT')) return 'البيت ده لسه من غير اتفاق تجاري ساري — اطلب الاتفاق الأول من صفحة الاتفاق، وبعدها هتقدر تسجّل حجوزات.';
  if (msg.includes('INSUFFICIENT_CAPACITY')) return 'مفيش أماكن كفاية في التواريخ دي.';
  if (msg.includes('IDEMPOTENCY_CONFLICT')) return 'الطلب ده اتبعت قبل كده ببيانات مختلفة. اقفل الفورم وافتحه من جديد.';
  if (msg.includes('BOOKING_ID_TAKEN')) return 'رقم الحجز ده مستعمل. اقفل الفورم وافتحه من جديد.';
  if (msg.includes('OVERRIDE_REQUIRED')) return 'الحجز ده هامشه أقل من الحد الأدنى، ومحتاج موافقة الإدارة.';
  if (msg.includes('POINTS_REQUIRE_REGISTERED_GUEST')) return 'النقاط تتخصم بس لضيف عنده حساب على بيما.';
  if (msg.includes('GUEST_NAME_REQUIRED')) return 'اكتب اسم الحاجز.';
  if (msg.includes('GUEST_NOT_FOUND')) return 'الضيف ده مش موجود على بيما.';
  if (msg.includes('NOT_AUTHENTICATED')) return 'سجّل دخولك الأول.';
  if (msg.includes('موقوف')) return 'حسابك موقوف من الإدارة.';
  if (msg.includes('rate_limit')) return 'وصلت للحد الأقصى من الحجوزات النهارده.';
  return 'حصل خطأ في حفظ الحجز. حاول تاني.';
}

/** One booking, read back from the server after the server priced it. */
export async function loadBookingById(id: string): Promise<Booking | null> {
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).single();
  if (error || !data) { if (error) console.error('loadBookingById:', error); return null; }
  return mapBooking(data as Record<string, unknown>);
}
