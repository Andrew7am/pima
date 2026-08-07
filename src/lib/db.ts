import { supabase } from './supabase';
import type { RetreatHouse, Booking, Review, Payment, User, AppNotification, Attendee, RoomAllocation, PointsTransaction, Room, RoomType, Announcement, WaitlistEntry, PlatformAnnouncement, PlatformSettings, AuditLogEntry, Expense, Payout, PromoBanner } from '../types';
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
  'room_capacity,housing_rules,contract_terms,menu,image_descriptions,pending_edit';

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
  // The view and the table return different row shapes, so both are widened to
  // the same thing the mapper already takes.
  type Row = Record<string, unknown>;
  const first = await supabase.from('houses_list')
    .select(`${HOUSE_PUBLIC_COLUMNS},images_count`).order('created_at');
  let data = first.data as unknown as Row[] | null;
  let error = first.error;
  if (error) {
    // A deploy can land before its migration; fall back to the table so the
    // site still works — heavy, but correct, and it says so in the console.
    console.error('loadHouses (view missing, falling back to full images):', error);
    const table = await supabase.from('houses').select(HOUSE_PUBLIC_COLUMNS).order('created_at');
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
    const fallbackColumns = HOUSE_PUBLIC_COLUMNS
      .replace('nearby_landmark,', '')
      .replace('day_use_price_per_person,', '');
    const retry = await supabase.from('houses').select(fallbackColumns).order('created_at');
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

// Daily rewarded-ad claim (migration 088). True = 25 points were granted just
// now; false = already claimed today (or signed out). The server is the only
// judge — the client cannot self-grant.
export async function claimDailyAdPoints(): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_daily_ad_points');
  if (error) { console.error('claimDailyAdPoints:', error); return false; }
  return data === true;
}
export async function deleteHouse(houseId: string): Promise<boolean> {
  const { error } = await supabase.from('houses').delete().eq('id', houseId);
  if (error) { console.error('deleteHouse:', error); return false; }
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
    .select('id, booking_id, user_id, user_name, amount, payment_method, payment_status, payment_date, transaction_reference, admin_notes, details, created_at')
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
}): Promise<boolean> {
  const now = new Date().toISOString();
  const payoutId = `payout_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const { error: pErr } = await supabase.from('owner_payouts').insert({
    id: payoutId, house_id: args.houseId, owner_id: args.ownerId, amount: args.amount,
    status: 'completed', method: args.method ?? null, note: args.note ?? null,
    requested_at: now, completed_at: now,
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
  if (error || !data) { if (error) console.error('loadPlatformSettings:', error); return DEFAULT_PLATFORM_SETTINGS; }
  return mapPlatformSettings(data as Record<string, unknown>);
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
    source: b.source ?? 'platform',
    is_large_conference_quote: b.isLargeConferenceQuote,
    payment_status: b.paymentStatus ?? 'unpaid',
    conference_details: b.conferenceDetails ?? null,
    checked_in_at: b.checkedInAt ?? null,
    checked_out_at: b.checkedOutAt ?? null,
    owner_notes: b.ownerNotes ?? null,
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
