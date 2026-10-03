import "server-only";
import { errors } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_RE = /^[0-9a-f]{48}$/;

/** Loads a booking by its manage token (from WhatsApp/SMS links). */
export async function loadBookingByToken(token: string) {
  if (!TOKEN_RE.test(token)) throw errors.notFound("Booking");
  const admin = createAdminClient();
  const { data: booking, error } = await admin
    .from("bookings")
    .select("*")
    .eq("manage_token", token)
    .maybeSingle();
  if (error) throw error;
  if (!booking) throw errors.notFound("Booking");
  return booking;
}
