import type { NextRequest } from "next/server";
import { z } from "zod";
import { handle, json, okOne, parseJson, requireAdmin, userClient } from "@/lib/api";

const schema = z.object({
  status: z.enum(["pending", "active", "suspended"]),
  directoryApproved: z.boolean().optional(),
  reason: z.string().trim().max(300).optional(),
});

/** POST /api/admin/salons/:id/status — approve / suspend a salon (audited). */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseJson(req, schema);
  const supabase = await userClient();
  const salon = okOne(
    await supabase.rpc("admin_set_salon_status", {
      p_salon_id: id,
      p_status: body.status,
      p_directory_approved: body.directoryApproved,
      p_reason: body.reason,
    }),
  );
  return json({
    salon: {
      id: salon.id,
      slug: salon.slug,
      status: salon.status,
      directoryApproved: salon.directory_approved,
    },
  });
});
