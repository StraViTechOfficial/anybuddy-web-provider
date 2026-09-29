// Shapes of backend replies the screens rely on. Extend here (one place) as screens need more fields.
export type Step = 1 | 2 | 3 | 4 | 5; // 5 = onboarding done
export type Verification = 0 | 1 | 2; // 0 under review, 1 approved, 2 changes needed

export interface Vendor {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  step: Step;
  verificationStatus: Verification;
  logoUrl?: string;
  description?: string;
  price?: number;
  notifyMe?: 0 | 1;
}

// Booking status: 1 requested, 2 confirmed, 3 completed, 4 cancelled (5 unpaid checkout, never shown).
export type BookingStatus = 1 | 2 | 3 | 4;
export interface Booking {
  _id: string;
  bookingId?: string;
  status: BookingStatus;
  cancelledBy?: "customer" | "provider" | "system" | null;
  price: number;
  checkInAt?: string | null;
  onTheWayAt?: string | null;
  etaMinutes?: number | null;
  expiresAt?: string | null;
  acceptedAt?: string | null; // set when the Buddy accepts: tells a decline from a cancel after accepting
  [key: string]: unknown; // service, slot, customer and address fields: read from the API docs per screen
}

export interface Balance {
  available: number;
  pending: number;
  paidTotal: number;
  deductions: number;
}

// Booking fields the board and job actions read (vendor/bookings list + detail). `user_details.phone` comes from detail only.
export type JobBooking = Booking & {
  services?: { serviceName?: string; price?: number };
  categoryName?: string;
  serviceName?: string; // list-day-wise puts it top level
  scheduledDate: string;
  selectedSlot: string; // "HH:mm", business time zone
  timeInterval?: string | number; // booked hours
  endTime?: string;
  address?: string;
  user_details?: { firstName?: string; lastName?: string; logoUrl?: string; phone?: string; countryCode?: string };
  vendorPriceAfterDetection?: number; // the Buddy's share
  checkOutAt?: string | null;
  hoursWorked?: number;
  hoursBilled?: number;
};
export interface Availability {
  availability: { day: number; isOpen: boolean; from: string | null; to: string | null }[]; // day 0 = Sunday
  breakStart?: string | null;
  breakEnd?: string | null;
  leaves?: { date: string; description?: string }[];
}

// A booking as vendor/bookings/list and /detail return it (detail adds the customer's phone, photos, rating).
export interface Job extends Booking {
  services?: { serviceName?: string; price?: number };
  categoryName?: string;
  slug?: string;
  scheduledDate: string; // business-day midnight, America/New_York
  selectedSlot?: string; // "HH:mm", business time
  endTime?: string;
  timeInterval?: string | number; // booked hours
  address?: string;
  endAddress?: string;
  user_details?: { firstName?: string; lastName?: string; phone?: string; countryCode?: string };
  userDesc?: string; // the customer's note (not yet returned by /detail)
  payment_status?: 0 | 1 | 2 | 3 | 4; // 0 pending, 1 processing, 2 paid, 3 cancelled, 4 refunded
  cancelReason?: string | null;
  checkOutAt?: string | null;
  hoursWorked?: number;
  vendorPriceAfterDetection?: number; // the Buddy's net share
  checkInImages?: { url: string }[];
  checkOutImages?: { url: string }[];
  rating?: number | null;
  feedBack?: string | null;
}

export interface Notice {
  _id: string;
  title: string;
  message?: string;
  bookingSlug: string | null;
  read_status: 0 | 1;
  createdAt: string;
}

// Earnings + account (Agent 5).
export interface VendorExtra { vendorSlug?: string } // get-profile-details?type=1 also returns the public slug (reviews)
// vendor/earnings/payouts: the Buddy's ledger. Withdrawal: requested, then paid or rejected. Deduction: status null.
export interface Payout {
  _id: string;
  type: "withdrawal" | "deduction";
  amount: number;
  status: "requested" | "paid" | "rejected" | null;
  requestedAt?: string;
  paidAt?: string;
  reference?: string;
  note?: string;
  createdAt: string;
}
// vendor/bookings/list?status=3: a finished job and the Buddy's net share of it (the balance counts the same field).
export interface FinishedJob {
  _id: string;
  bookingId?: string;
  services?: { serviceName?: string };
  hoursWorked?: number;
  checkOutAt?: string;
  scheduledDate: string;
  vendorPriceAfterDetection: number;
}
export interface Review {
  _id: string;
  rating: number;
  feedBack?: string;
  createdAt: string;
  userDetails: { firstName?: string; lastName?: string; logoUrl?: string };
}
export interface Reviews {
  reviews: Review[];
  averageCount: number;
  ratingCounts: Record<"oneRating" | "twoRating" | "threeRating" | "fourRating" | "fiveRating", number>;
}

// Setup forms (onboarding + account edit). get-profile-details type=1 returns these on top of Vendor.
export interface VendorProfile extends Vendor {
  address?: { street?: string; city?: string; state?: string; country?: string };
  postalCode?: string;
  lat?: number | null;
  long?: number | null;
  serviceArea?: string | null;
}
export interface Category { _id: string; categoryName: string }
export interface SubCategory { _id: string; serviceName: string; categoryId: string }
export interface VendorService {
  _id: string;
  price: number;
  description?: string;
  category: Category;
  subcategory: { _id: string; serviceName: string };
}
export interface DayHours { day: number; isOpen: boolean; from: string; to: string }
export interface Leave { date: string; description?: string }
export interface VendorHours { availability?: DayHours[]; breakStart?: string | null; breakEnd?: string | null; leaves?: Leave[] }
export type DocKey = "IdProofFront" | "IdProofBack" | "certificate" | "additionalDoc";
export type VendorDocs = Partial<Record<DocKey, string | null>>;
export interface VendorBank {
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  routing_number?: string;
  account_type?: string;
}
