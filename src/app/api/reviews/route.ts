import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, handle, json, parseJson, requireUser, userClient } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  bookingId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(1000).optional(),
});

/** Very small denylist; matches go to the moderation queue instead of being published. */
const FLAGGED = /\b(scam|fraud|kys|nazi|whore|slut|bitch|fuck|shit|كسمك|شرموطة|عرص)\b/i;

/**
 * POST /api/reviews — leaves a review for one of the caller's completed bookings.
 * RLS + a trigger enforce that only completed bookings of this client can be reviewed.
 */
export const POST = handle(async (req: NextRequest) => {
  const auth = await requireUser();
  const body = await parseJson(req, schema);
  const { data: booking } = await createAdminClient()
    .from("bookings")
    .select("id, salon_id, client_id, status")
    .eq("id", body.bookingId)
    .maybeSingle();
  if (!booking) throw errors.notFound("Booking");
  if (booking.status !== "completed")
    throw errors.conflict("booking_not_completed", "You can review a visit once it is completed");

  const supabase = await userClient();
  const flagged = body.body ? FLAGGED.test(body.body) : false;
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      booking_id: booking.id,
      salon_id: booking.salon_id,
      client_id: booking.client_id,
      user_id: auth.userId,
      rating: body.rating,
      body: body.body ?? null,
      status: flagged ? "pending" : "approved",
      flagged_reason: flagged ? "language" : null,
    })
    .select("id, rating, body, status, created_at")
    .single();
  if (error) throw error;
  return json({ review: data, pendingModeration: flagged }, { status: 201 });
});
