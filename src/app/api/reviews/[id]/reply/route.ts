import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, handle, json, parseJson, requireSalonRole, userClient } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ reply: z.string().trim().min(1).max(600) });

/** POST /api/reviews/:id/reply — salon manager replies publicly to a review. */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = await parseJson(req, schema);
  const { data: review } = await createAdminClient()
    .from("reviews")
    .select("id, salon_id")
    .eq("id", id)
    .maybeSingle();
  if (!review) throw errors.notFound("Review");
  await requireSalonRole(review.salon_id, "manager");
  const supabase = await userClient();
  const { data, error } = await supabase
    .from("reviews")
    .update({ salon_reply: body.reply, replied_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, salon_reply, replied_at")
    .single();
  if (error) throw error;
  return json({ review: data });
});
