import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, ok, parseJson, requireAdmin, userClient } from "@/lib/api";

const schema = z.object({
  plan: z.enum(["trial", "basic", "pro"]),
  reason: z.string().trim().max(300).optional(),
});

/** POST /api/admin/salons/:id/plan — change a salon's plan immediately (audited). */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseJson(req, schema);
  const supabase = await userClient();
  const subscription = ok(
    await supabase.rpc("admin_change_plan", { p_salon_id: id, p_plan: body.plan, p_reason: body.reason }),
  );
  return json({ subscription });
});
