import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, handle, json, noContent, parseJson, requireSalonRole, userClient } from "@/lib/api";

const schema = z.object({ role: z.enum(["manager", "staff"]) });

/** PATCH /api/dashboard/:salonId/members/:userId — owner changes a member's role. */
export const PATCH = handle(
  async (req: NextRequest, ctx: { params: Promise<{ salonId: string; userId: string }> }) => {
    const { salonId, userId } = await ctx.params;
    const auth = await requireSalonRole(salonId, "owner");
    if (userId === auth.userId) throw errors.badRequest("cannot_change_own_role");
    const body = await parseJson(req, schema);
    const supabase = await userClient();
    const { data, error } = await supabase
      .from("salon_members")
      .update({ role: body.role })
      .eq("salon_id", salonId)
      .eq("user_id", userId)
      .select("user_id, role")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw errors.notFound("Member");
    return json({ member: data });
  },
);

/** DELETE /api/dashboard/:salonId/members/:userId — owner removes a member (owner rows are protected by RLS). */
export const DELETE = handle(
  async (_req: NextRequest, ctx: { params: Promise<{ salonId: string; userId: string }> }) => {
    const { salonId, userId } = await ctx.params;
    const auth = await requireSalonRole(salonId, "owner");
    if (userId === auth.userId) throw errors.badRequest("cannot_remove_owner");
    const supabase = await userClient();
    const { error } = await supabase
      .from("salon_members")
      .delete()
      .eq("salon_id", salonId)
      .eq("user_id", userId);
    if (error) throw error;
    await supabase.from("staff").update({ user_id: null }).eq("salon_id", salonId).eq("user_id", userId);
    return noContent();
  },
);
