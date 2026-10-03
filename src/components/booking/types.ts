export interface BookingSalon {
  id: string;
  slug: string;
  name: string;
  currency: string;
  timezone: string;
  bookingMode: "instant" | "approval";
  address: string | null;
  area: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  cancelCutoffHours: number;
  rescheduleCutoffHours: number;
  depositRequired: boolean;
  depositAmount: number;
  maxAdvanceDays: number;
  whatsappNumber: string | null;
}

export interface BookingService {
  id: string;
  name: string;
  category: string;
  price: number;
  durationMin: number;
  supportsTryon: boolean;
}

export interface BookingDesign {
  id: string;
  name: string;
  category: string;
  shape: string | null;
  length: string | null;
  priceAddon: number;
  durationAddonMin: number;
  coverUrl: string | null;
  serviceIds: string[];
}

export interface BookingStaff {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  serviceIds: string[];
  acceptsOnlineBooking: boolean;
}

export interface Slot {
  startsAt: string;
  endsAt: string;
  staffIds: string[];
}

export interface DayAvailability {
  date: string;
  count: number;
  firstStartsAt: string | null;
}

/** Booking as returned by POST /api/bookings and the manage endpoints (docs/api.md). */
export interface BookingView {
  id: string;
  status: "new" | "confirmed" | "completed" | "no_show" | "cancelled";
  source: string;
  startsAt: string;
  endsAt: string;
  locale: string;
  servicePrice: number;
  designPrice: number;
  totalPrice: number;
  currency: string;
  depositAmount: number;
  clientNotes: string | null;
  tryonImageUrl: string | null;
  manageToken?: string;
  salon: {
    id: string;
    slug: string;
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    whatsappNumber: string | null;
    timezone: string;
    logoUrl: string | null;
    brandColor: string;
    cancelCutoffHours: number;
    rescheduleCutoffHours: number;
  } | null;
  service: { id: string; name: string; durationMin: number } | null;
  staff: { id: string; displayName: string; avatarUrl: string | null } | null;
  design: { id: string; name: string; coverUrl: string | null } | null;
  createdAt: string;
  canCancel?: boolean;
  canReschedule?: boolean;
}
