export type UserRole = 'individual' | 'servant' | 'owner' | 'admin';

export interface PointsTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'earned' | 'redeemed';
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string;
  organizationName?: string; // For churches or servant groups
  approvalStatus?: 'pending' | 'approved' | 'rejected'; // For servant/owner, reviewed by admin
  createdAt: string;
  points?: number;
  pointsHistory?: PointsTransaction[];
  xp?: number;         // entertainment module — resets to overflow on level-up
  level?: number;      // starts at 1; N -> N+1 threshold is N * 200 XP
  gameCoins?: number;  // separate from `points` — never redeemable on bookings
  rating?: number;     // 1v1 competitive rating (starts at 100). See leagues.ts
  totalCorrectAnswers?: number;   // cumulative, across all solo games
  totalGamesPlayed?: number;      // cumulative, solo + multiplayer
  totalMatchesWon?: number;       // cumulative, multiplayer only
  unlockedAchievements?: string[]; // achievement ids already claimed — see achievements.ts
  favorites?: string[];
  referralCode?: string;
  dateOfBirth?: string; // ISO date (YYYY-MM-DD); age is derived from this, never stored directly
  address?: string; // Full address (village/city/street), free text
  governorate?: string;
  churchName?: string;
  priestName?: string;
  isBanned?: boolean;
  /** Set when an admin released the account: email handed back, records kept. */
  releasedAt?: string;
  avatarUrl?: string;
  avatar?: string;            // entertainment: display avatar used by the ported games
  equippedAssists?: string[]; // entertainment: equipped in-match power-ups (SmartAssistBar)
  streak?: number;            // entertainment: consecutive-days streak shown on the player card
  profileTitle?: string;      // entertainment: equipped rank/title shown on the player card
  emailOptOut?: boolean;      // true = transactional email suppressed (migration 079)
}

export interface ConferenceHall {
  id: string;
  name: string;
  capacity: number;
  hasSoundSystem: boolean;
  hasProjector: boolean;
  price?: number; // per-event/per-day hall rental fee, set by the owner
}

// Owner-defined seasonal rate / time-boxed offer (migration 055). First
// matching entry (array order) wins for a given night; unmatched nights
// use the house's base pricePerNightPerPerson.
export interface SeasonalRate {
  id: string;
  label: string;       // e.g. "موسم الصيف" or "عرض نص السنة"
  startDate: string;   // YYYY-MM-DD inclusive
  endDate: string;     // YYYY-MM-DD inclusive
  pricePerNight: number;
}

// How a guest sends the owner their booking payment directly — replaces
// the old platform-wide centralized InstaPay address.
export interface OwnerPaymentMethod {
  id: string;
  type: 'instapay' | 'vodafone_cash' | 'etisalat_cash' | 'orange_cash' | 'we_cash' | 'bank_transfer';
  label: string; // e.g. "إنستاباي" or a custom bank name
  value: string; // handle / phone number / IBAN
}

export interface Restaurant {
  id: string;
  name: string;
  capacity: number;
  mealsServed: ('breakfast' | 'lunch' | 'dinner')[];
}

export interface RetreatHouse {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerName: string;
  governorate: string; // المحافظة
  address: string;
  lat: number; // For map localization
  lng: number;
  roomsCount: number;
  bedsCount: number;
  roomsDescription: string;
  pricePerNightPerPerson: number;
  /** Per person for a «يوم روحي» — arrive and leave the same day, no night.
   *  Undefined means the house does not take day bookings. Migration 089. */
  dayUsePricePerPerson?: number;
  services: string[]; // ["تكييف", "واي فاي", "حمام سباحة", "ملعب كرة", "كنيسة داخل البيت", "مطبخ", "حديقة"]
  suitability: ('youth' | 'children' | 'families' | 'retreat')[]; // ["شباب", "أطفال", "أسر", "خلوات"]
  conferenceHalls: ConferenceHall[];
  restaurants: Restaurant[];
  activities: string[]; // ["مسرح", "ألعاب ترفيهية", "مساحة خضراء", "بينج بونج وبلياردو", "سينما"]
  images: string[];
  /**
   * How many photos this house actually has. List screens receive only the
   * cover (see migration 106), so `images.length` there is 1 no matter how
   * many exist — this is the real count.
   */
  imagesCount?: number;
  /**
   * True only when `images` holds the COMPLETE set, fetched by id.
   *
   * Nothing may write `images` back to the database while this is false: the
   * house came from the list view holding one photo, and saving it would
   * delete the rest. houseUpdatePayload enforces that by omitting the column.
   */
  imagesHydrated?: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rating: number;
  reviewsCount: number;
  createdAt: string;
  propertyType?: 'conference' | 'student' | 'staff';
  blockedDates?: string[];
  imageDescriptions?: { [url: string]: string };
  seaProximity?: 'near' | 'view' | 'beach' | 'far';
  studentHousingGender?: 'boys' | 'girls' | 'both';
  distanceFromUniversity?: string;
  /** Owner-written line like «12 كم من المنتزه» — shown beside the governorate. */
  nearbyLandmark?: string;
  monthlyRent?: number;
  roomCapacity?: number;
  housingRules?: string[];
  contractTerms?: string;
  // How the owner receives booking payments directly from the guest —
  // required (>=1) for onboarding to count as complete. See OwnerBookings/
  // UserBookings for where this is shown to the paying guest.
  paymentMethods: OwnerPaymentMethod[];
  // Owner-direct (no admin re-approval), like paymentMethods — see
  // migration 055 and lib/pricing.ts for the night-by-night math.
  seasonalRates?: SeasonalRate[];
  /** A percentage off, applied to stays whose CHECK-IN falls in the window.
   *  Set by the admin at the owner's request; the owner carries the cost.
   *  Owners cannot set it themselves — protect_house_owner_updates (019)
   *  reverts every house column for a non-admin caller. */
  discountPct?: number;
  discountStartsAt?: string;
  discountEndsAt?: string;
  discountNote?: string;
  // Owner-submitted edits to an already-approved house wait here for admin
  // review instead of applying immediately — only editable/listing fields.
  pendingEdit?: Partial<RetreatHouse>;
  menu?: {
    isIncluded: boolean;
    extraMealPrice?: number;
    allowsSpecialRequests: boolean; // صيامي - نباتي
    weeklyMenu?: {
      day: string;
      breakfast: string;
      lunch: string;
      dinner: string;
      price?: number;
    }[];
    fastingWeeklyMenu?: {
      day: string;
      breakfast: string;
      lunch: string;
      dinner: string;
      price?: number;
    }[];
  };
}

export interface Booking {
  id: string;
  houseId: string;
  houseName: string;
  userId: string;
  userName: string;
  userPhone: string;
  userEmail: string;
  userRole: UserRole;
  organizationName?: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  totalPrice: number;
  depositPaid: boolean;
  depositAmount: number;
  /** The discount that was agreed when this booking was made — frozen by the
   *  server at INSERT and never recomputed. Read live instead, every booking
   *  taken under an offer would jump back to full price in the ledger the
   *  moment the offer ended, contradicting what the guest actually paid. That
   *  is the bug commissionRate still has. */
  discountPctApplied?: number;
  /** What the stay would have cost without it. Null when there was no
   *  discount, so the «كان» line only appears when it is true. */
  priceBeforeDiscount?: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  // platform = guest booked through the app; manual = owner recorded a
  // phone/walk-in booking himself; temporary = tentative hold the owner
  // placed to block capacity while a group decides.
  source?: 'platform' | 'manual' | 'temporary';
  /** The commission rate agreed WHEN THIS BOOKING WAS MADE (migration 108).
   *  Frozen on the row; a later rate change must not touch it. */
  commissionRate?: number;
  isLargeConferenceQuote: boolean;
  paymentStatus?: 'unpaid' | 'pending_verification' | 'paid_deposit' | 'paid_full';
  // Free-form request details, stored as jsonb. Originally conference-only,
  // now also carries an ordinary booking's applicant notes and diocese — which
  // is why hallId and mealsIncluded are optional: a normal request has neither.
  conferenceDetails?: {
    hallId?: string;
    mealsIncluded?: boolean;
    extraRequests: string;
    diocese?: string;
    /** A BookingGroupKey — «خدمة ثانوي», «خدام وخدامات» and the rest. Rides in
     *  the existing jsonb, so it needed no migration. See lib/bookingGroups.
     *  Named `bookingType`, not `groupType`, because Attendee already has a
     *  `groupType` for a different thing — grouping one person, not the whole
     *  booking — and the two even share the value 'youth'. */
    bookingType?: string;
    /** What the board actually cost when the guest agreed to it. Snapshotted,
     *  not re-derived: houses.menu is owner-direct editable with no approval
     *  and no history, so a rate read back later is the rate today, not the
     *  one that was quoted. Migration-free — conference_details is jsonb. */
    mealsCost?: number;
  };
  checkedInAt?: string;
  checkedOutAt?: string;
  ownerNotes?: string;
  // Set when the admin has transferred this booking's owner share (25%) to
  // the house owner. NULL/undefined = still owed. See migration 068.
  ownerSettledAt?: string;
  // Rooms the owner assigned to this group. The servant (booking's guest)
  // then only fills attendee names inside these rooms — see migration 072.
  assignedRoomIds?: string[];
  createdAt: string;
  // Lifecycle stamps behind the booking journey — see migration 087. Both are
  // written by database triggers, never by the client. approvedAt is undefined
  // for bookings confirmed before that migration, and the journey simply shows
  // that step without a date rather than inventing one.
  approvedAt?: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  userName: string;
  amount: number;
  paymentMethod: 'bank' | 'instapay' | 'vodafone' | 'cash' | 'online';
  paymentStatus: 'pending' | 'approved' | 'rejected';
  paymentDate: string;
  /** Which of Pima's own collection accounts received this, copied at the time
   *  so deleting the account later cannot rewrite where the money went. */
  receivedAccount?: string;
  /** A refund is an event with its own date, amount and author — not a status
   *  on the original payment. Collapsing it into the status would lose all
   *  three, and could not express a partial refund at all. */
  refundedAmount?: number;
  refundedAt?: string;
  refundMethod?: string;
  refundNote?: string;
  proofImage?: string;
  transactionReference?: string;
  adminNotes?: string;
  details?: {
    bankName?: string;
    senderNumberOrAddress?: string;
    receiverName?: string;
    receiptNumber?: string;
  };
}

export interface Review {
  id: string;
  houseId: string;
  houseName?: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  rating: number; // 1 to 5
  food_rating?: number;
  service_rating?: number;
  cleanliness_rating?: number;
  organization_rating?: number;
  value_rating?: number;
  overall_rating?: number;
  comment: string;
  /** The stay being reviewed. One review per booking — replaces the old
   *  one-per-person-per-house rule, which silently overwrote a returning
   *  church's earlier reviews. See migration 114. */
  bookingId?: string;
  /** The shape of that stay, so «١٤ نجمة» can become «٩ مجموعات ثانوي ٤٠–٥٠
   *  فرد، ٣ ليالي، ذروة أغسطس». A size BAND, never an exact count, and no
   *  church is named — these stays carry minors. */
  stayGroup?: string;
  stayBand?: string;
  stayNights?: number;
  stayMonth?: number;
  createdAt: string;
  ownerReply?: string;
  ownerReplyCreatedAt?: string;
  visitPurpose?: 'conference' | 'business_meeting' | 'training_course' | 'exhibition' | 'other';
  likedTags?: string[];
  problemTags?: string[];
  problemOther?: string;
  displayAnonymous?: boolean;
}

export interface Attendee {
  id: string;
  bookingId: string;
  name: string;
  gender: 'male' | 'female';
  groupType: 'youth' | 'family' | 'child' | 'other';
  sharePaid?: boolean; // has this member paid their share to the group leader? (migration 080)
  // Migration 119. Optional because an attendee added before those columns
  // existed has neither a phone nor a stated arrival, and the list has to say
  // «غير محدد» rather than pick one for them.
  phone?: string;
  arrivalMethod?: 'with_trip' | 'own_car' | 'independent';
  /** Three states, not a boolean — unpaid and pending read differently to a servant. */
  paymentStatus?: 'unpaid' | 'pending' | 'paid';
  registeredAt?: string;
}

export interface RoomAllocation {
  id: string;
  bookingId: string;
  attendeeId: string;
  roomId: string;
  bedNumber: number;
}

export interface Room {
  id: string;
  houseId: string;
  name: string;
  bedsCount: number;
  pricePerNight?: number; // undefined = inherit the house's price
  images: string[];
  status: 'available' | 'booked' | 'maintenance' | 'cleaning';
  floor?: number;
  typeId?: string; // optional link to a RoomType (badge + facilities)
  createdAt: string;
}

export type RoomFacility = 'ac' | 'bathroom' | 'tv' | 'wifi' | 'fridge' | 'balcony';

// A per-house room template. Rooms reference it via Room.typeId for the
// type badge and facilities — see migration 060_room_types.
export interface RoomType {
  id: string;
  houseId: string;
  name: string;
  price: number;
  bedsCount: number;
  facilities: RoomFacility[];
  description?: string;
  icon?: string; // badge style key: ac / standard / vip / family
  createdAt: string;
}

export interface Announcement {
  id: string;
  houseId: string;
  message: string;
  isActive: boolean;
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  houseId: string;
  houseName: string;
  userId: string;
  userName: string;
  userPhone: string;
  checkIn: string;
  checkOut: string;
  guestsCount: number;
  status: 'waiting' | 'notified' | 'expired' | 'cancelled';
  createdAt: string;
}

export interface PlatformAnnouncement {
  id: string;
  message: string;
  imageUrl?: string;
  linkedHouseId?: string;
  isActive: boolean;
  createdAt: string;
}

// Admin-managed promo banners on the public browse page (migration 076).
// A small icon link rendered inside a banner — e.g. the platform's social
// accounts, so one banner can carry several destinations.
export type PromoLinkPlatform =
  | 'instagram' | 'facebook' | 'youtube' | 'whatsapp'
  | 'telegram' | 'tiktok' | 'x' | 'website' | 'phone' | 'email';

export interface PromoBannerLink {
  id: string;
  platform: PromoLinkPlatform;
  url: string;
  label?: string;
}

// ─── Visual banner layout ──────────────────────────────────────────────────
// A banner is stored as STRUCTURED DATA, never a flattened image, so every
// property stays editable later. Geometry is expressed in PERCENT of the
// banner box (and font sizes relative to a 360px design width), so a layout
// designed once keeps working at every screen width without breaking — the
// mobile app's existing banner boxes are never resized.

export type BannerFit =
  | 'cover' | 'contain' | 'fill'
  | 'center' | 'top' | 'bottom' | 'left' | 'right';

export interface BannerImageLayer {
  fit: BannerFit;
  scale: number;     // 0.5 – 2 (zoom)
  x: number;         // pan, % of box width  (-50 … 50)
  y: number;         // pan, % of box height (-50 … 50)
  opacity: number;   // 0 – 1
}

export type BannerElementType =
  | 'badge' | 'title' | 'subtitle' | 'button' | 'icons' | 'logo'
  // Both render live data or nothing at all — never a placeholder number or a
  // made-up quote. See BannerLiveData.
  | 'availability' | 'testimonial';

export interface BannerElement {
  id: string;
  type: BannerElementType;
  visible: boolean;
  locked: boolean;
  x: number;          // % of box width  — element's start edge
  y: number;          // % of box height — element's top edge
  width?: number;     // % of box width
  fontSize?: number;  // px at the 360px design width
  color?: string;
  bg?: string;
  radius?: number;    // px
  opacity?: number;   // 0 – 1
  rotation?: number;  // deg
  align?: 'start' | 'center' | 'end';
  fontFamily?: string;
  fontWeight?: number;     // 400 – 900
  letterSpacing?: number;  // px at design width
  shadow?: boolean;        // soft drop shadow for legibility over photos
}

export interface BannerLayout {
  version: 1;
  /** CSS colour or gradient painted under the image — lets a banner work with
   *  no photo at all instead of falling back to an empty dark box. */
  background?: string;
  image: BannerImageLayer;
  overlay: { enabled: boolean; opacity: number };
  elements: BannerElement[]; // back → front
}

export interface PromoBanner {
  id: string;
  placement: 'carousel' | 'countdown';
  isActive: boolean;
  sort: number;
  badge?: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  imageUrl?: string;
  endsAt?: string | null;
  createdAt: string;
  // Where the CTA button goes. Empty → keeps the default behaviour (scrolls
  // to the listings) so existing banners are unaffected.
  linkUrl?: string;
  // Icon links shown inside the banner (social accounts, phone, site…).
  links?: PromoBannerLink[];
  // Visual layout from the banner designer. Absent → the banner renders with
  // the original fixed design, so every existing banner is unaffected.
  layout?: BannerLayout | null;
  // The CTA opens this house inside the app (takes precedence over linkUrl).
  linkedHouseId?: string | null;
  // Publish state. 'scheduled' shows only between startsAt and endsAt.
  status?: 'draft' | 'published' | 'scheduled';
  startsAt?: string | null;
  // Who this banner is for. Empty/absent → everyone.
  audience?: BannerAudience;
  // Banners sharing an experiment key are variants; one is picked per visitor.
  experiment?: string | null;
  variant?: string | null;
}

export interface BannerAudience {
  roles?: UserRole[];
  governorates?: string[];
  booked?: 'any' | 'yes' | 'no';
}

export interface PlatformSettings {
  commissionRate: number;    // 0.05 = 5% platform cut
  depositRate: number;       // 0.15 = 15% upfront deposit
  pointsPerEgp: number;      // 100 points = 1 EGP on redemption
  maxRedemptionPct: number;  // 0.10 = points can cover up to 10% of a booking
  referralBonusPoints: number;
  // Cancellation policy (migration 054): full refund when cancelling
  // >= freeCancelDays before check-in; partialRefundPct of the paid amount
  // when >= partialRefundDays; nothing below that.
  freeCancelDays: number;
  partialRefundDays: number;
  partialRefundPct: number;
  // Central platform payment accounts guests send the deposit to (manual
  // collection model — migration 069). Empty = fall back to owner-direct.
  paymentMethods: OwnerPaymentMethod[];
  // Support line every "contact us" link resolves to (migration 103). Bare
  // wa.me format: country code + number, digits only, no '+'.
  supportWhatsApp: string;
  // How many bookings one account may create in a rolling 24 hours. Enforced
  // by a DB trigger, not just here — the owner of the house and admins are
  // exempt, because an owner entering bookings taken by phone is not the thing
  // being rate limited.
  maxBookingsPerDay: number;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  commissionRate: 0.05,
  // Must match the DB default (migration 024: deposit_rate NUMERIC DEFAULT
  // 0.15). This is only the fallback used when loadPlatformSettings fails —
  // at 0.30 the guest was quoted double the deposit that the server had
  // already normalised into bookings.deposit_amount, which is what every
  // owner finance screen sums.
  depositRate: 0.15,
  pointsPerEgp: 100,
  maxRedemptionPct: 0.10,
  referralBonusPoints: 2000,
  freeCancelDays: 7,
  partialRefundDays: 3,
  partialRefundPct: 0.5,
  paymentMethods: [],
  supportWhatsApp: '201096126259',
  maxBookingsPerDay: 20,
};

export interface AppNotification {
  id: string;
  userId: string;
  bookingId: string;
  title: string;
  message: string;
  type: 'success' | 'danger' | 'info';
  isRead: boolean;
  createdAt: string;
}

export interface BookingMessage {
  id: number;
  bookingId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  readAt?: string;
  // Optional attachment (stored as a data URL, like the app's other images).
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file' | 'audio';
  attachmentName?: string;
  replyToId?: number;   // quoted message id (resolve preview client-side)
  deletedAt?: string;   // set = "message deleted" placeholder
}

export interface Expense {
  id: string;
  houseId: string;
  description: string;
  amount: number;
  expenseDate: string;
  createdAt: string;
}

// A transfer request the owner raises against the balance Pima holds
// (deposits collected via the platform, minus commission). Admin marks it
// completed later — see migration 059_owner_payouts.
export interface Payout {
  id: string;
  houseId: string;
  ownerId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  method?: string;
  note?: string;
  requestedAt: string;
  completedAt?: string;
  /** The bookings this transfer settled. Empty for an owner-requested payout,
   *  which names an amount rather than specific bookings. Without it a payout
   *  could only be explained by an admin reconstructing it from timestamps. */
  bookingIds?: string[];
  /** The bank or wallet reference. This is what answers an owner who disputes
   *  a transfer six months later — Pima captures one on every payment IN and
   *  captured none on the way out until migration 115. */
  transactionReference?: string;
  /** Which of Pima's accounts it left from, so الخزنة can subtract it and
   *  become a cash position rather than a record of money received. */
  paidFromAccount?: string;
}

export interface AuditLogEntry {
  id: number;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Entertainment — Conference Hub (interactive conference/retreat companion)
// ---------------------------------------------------------------------------
export interface ConferenceScheduleItem {
  id: string;
  time: string;
  title: string;
  location: string;
  duration: string;
  speaker: string;
  info: string;
  completed: boolean;
  isCurrent: boolean;
}

export interface ConferenceEvent {
  id: string;
  title: string;
  day: string;
  time: string;
  icon: string;
  points: number;
}

export interface ConferenceAnnouncementComment {
  id: string;
  author: string;
  text: string;
  date: string;
}

export interface ConferenceAnnouncement {
  id: string;
  text: string;
  isPinned: boolean;
  timestamp: string;
  isUrgent: boolean;
  comments: ConferenceAnnouncementComment[];
}

export interface ConferenceChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface ConferenceLiveChatMessage {
  id: string;
  author: string;
  text: string;
}

export interface PresentationSlide {
  id: string;
  title: string;
  content: string;
  imageUrl: string;
}

export interface ConferenceRoom {
  id: string;
  bookingId?: string;
  houseId?: string;
  houseName: string;
  title: string;
  organizationName: string;
  /** Check-in of the booking this was opened against (migration 125). The
   *  countdown had nothing to count to before these existed. */
  startsAt?: string;
  endsAt?: string;
  /** Seats booked. What the hub's «عدد المشاركين» should have been reading. */
  guestsCount?: number;
  conferenceCode: string; // e.g. YTH2026, MARG4587, RET-9031
  qrCodeUrl: string; // Generated SVG/visual path/base64 representation
  joiningRequirements: 'open' | 'approval_needed';
  isDisabled?: boolean;
  hostUserId: string; // The servant/church host who can manage it

  schedule: ConferenceScheduleItem[];
  events: ConferenceEvent[];
  announcements: ConferenceAnnouncement[];
  checklist: ConferenceChecklistItem[];

  liveMode: {
    eventName: string;
    speaker: string;
    location: string;
    minutesLeft: number;
    viewersCount: number;
    isLive: boolean;
    chatMessages: ConferenceLiveChatMessage[];
  };

  notificationsLog: {
    id: string;
    title: string;
    body: string;
    time: string;
  }[];

  pendingUserRequests?: {
    userId: string;
    userName: string;
    userEmail: string;
  }[];
  joinedUserIds: string[];
  presentationSlides?: PresentationSlide[];
  activeSlideId?: string | null;
  instantAlert?: {
    id: string;
    message: string;
    sentAt: number;
    senderName: string;
  } | null;
}

export interface CardAuditLog {
  id: string;
  action: string;
  details: string;
  updatedBy: string;
  timestamp: string;
}

export interface ParticipantCard {
  userId: string;
  userName: string;
  avatarUrl: string;
  teamName: string;
  roomNo: string;
  building: string;
  floor: string;
  points: number;
  level: number;
  attendanceStatus: 'تم التسجيل' | 'لم يسجل';
  cardStatus: 'فعالة' | 'موقوفة' | 'ملغاة';
  qrCodeData: string;
  auditLog: CardAuditLog[];
  updatedAt: string;
}

export interface SpiritualJournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  favoriteVerses: string[];
  decisions: string[];
  createdAt: string;
  updatedAt: string;
}

