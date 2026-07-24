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
  avatarUrl?: string;
  avatar?: string;            // entertainment: display avatar used by the ported games
  equippedAssists?: string[]; // entertainment: equipped in-match power-ups (SmartAssistBar)
  streak?: number;            // entertainment: consecutive-days streak shown on the player card
  profileTitle?: string;      // entertainment: equipped rank/title shown on the player card
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
  services: string[]; // ["تكييف", "واي فاي", "حمام سباحة", "ملعب كرة", "كنيسة داخل البيت", "مطبخ", "حديقة"]
  suitability: ('youth' | 'children' | 'families' | 'retreat')[]; // ["شباب", "أطفال", "أسر", "خلوات"]
  conferenceHalls: ConferenceHall[];
  restaurants: Restaurant[];
  activities: string[]; // ["مسرح", "ألعاب ترفيهية", "مساحة خضراء", "بينج بونج وبلياردو", "سينما"]
  images: string[];
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
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  // platform = guest booked through the app; manual = owner recorded a
  // phone/walk-in booking himself; temporary = tentative hold the owner
  // placed to block capacity while a group decides.
  source?: 'platform' | 'manual' | 'temporary';
  isLargeConferenceQuote: boolean;
  paymentStatus?: 'unpaid' | 'pending_verification' | 'paid_deposit' | 'paid_full';
  conferenceDetails?: {
    hallId?: string;
    mealsIncluded: boolean;
    extraRequests: string;
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
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  commissionRate: 0.05,
  depositRate: 0.30,
  pointsPerEgp: 100,
  maxRedemptionPct: 0.10,
  referralBonusPoints: 2000,
  freeCancelDays: 7,
  partialRefundDays: 3,
  partialRefundPct: 0.5,
  paymentMethods: [],
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

