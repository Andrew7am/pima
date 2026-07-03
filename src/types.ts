export type UserRole = 'individual' | 'servant' | 'church' | 'owner' | 'admin';

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
  isApproved?: boolean; // For owners, reviewed by admin
  createdAt: string;
  points?: number;
  pointsHistory?: PointsTransaction[];
  favorites?: string[];
  referralCode?: string;
}

export interface ConferenceHall {
  id: string;
  name: string;
  capacity: number;
  hasSoundSystem: boolean;
  hasProjector: boolean;
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
  status: 'pending' | 'approved' | 'rejected';
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
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  isLargeConferenceQuote: boolean;
  paymentStatus?: 'unpaid' | 'pending_verification' | 'paid_deposit' | 'paid_full';
  conferenceDetails?: {
    hallId?: string;
    mealsIncluded: boolean;
    extraRequests: string;
  };
  checkedInAt?: string;
  checkedOutAt?: string;
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
  status: 'available' | 'booked' | 'maintenance';
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

