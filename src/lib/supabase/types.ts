import type { Database, Tables, TablesInsert, TablesUpdate, Enums } from "@/lib/supabase/database.types";

/** Convenience aliases over the generated Supabase types. */
export type { Database, Tables, TablesInsert, TablesUpdate, Enums };

export type Salon = Tables<"salons">;
export type Service = Tables<"services">;
export type Design = Tables<"designs">;
export type Polish = Tables<"polishes">;
export type Staff = Tables<"staff">;
export type Booking = Tables<"bookings">;
export type Client = Tables<"clients">;
export type TryonJob = Tables<"tryon_jobs">;
export type Notification = Tables<"notifications">;
export type Invoice = Tables<"invoices">;
export type Payment = Tables<"payments">;
export type Subscription = Tables<"subscriptions">;
export type Plan = Tables<"plans">;
export type Profile = Tables<"profiles">;

export type BookingStatus = Enums<"booking_status">;
export type TryonJobStatus = Enums<"tryon_job_status">;
export type NotificationKind = Enums<"notification_kind">;
export type NotificationChannel = Enums<"notification_channel">;
export type AppLocale = Enums<"app_locale">;
export type PlanCode = Enums<"plan_code">;
