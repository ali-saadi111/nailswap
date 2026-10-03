import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, handle, json, parseJson, requireAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp } from "@/lib/rate-limit";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(300).optional(),
});

/** POST /api/admin/moderation/:id — resolve a moderation item and apply it to the referenced row. */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const auth = await requireAdmin();
  const { id } = await ctx.params;
  const body = await parseJson(req, schema);
  const admin = createAdminClient();
  const { data: item } = await admin.from("moderation_queue").select("*").eq("id", id).maybeSingle();
  if (!item) throw errors.notFound("Moderation item");
  if (item.status !== "pending") throw errors.conflict("already_resolved");
  const status = body.action === "approve" ? "approved" : "rejected";

  if (item.kind === "review") {
    await admin.from("reviews").update({ status }).eq("id", item.ref_id);
  } else if (item.kind === "design") {
    await admin
      .from("designs")
      .update({ is_visible: body.action === "approve" })
      .eq("id", item.ref_id);
  } else if (item.kind === "upload" && body.action === "reject") {
    await admin
      .from("tryon_jobs")
      .update({ status: "rejected", error_code: "inappropriate" })
      .eq("id", item.ref_id);
  }
  const { data: resolved, error } = await admin
    .from("moderation_queue")
    .update({ status, reviewed_by: auth.userId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await admin.from("admin_audit_log").insert({
    admin_id: auth.userId,
    action: `moderation_${body.action}`,
    target_type: item.kind,
    target_id: item.ref_id,
    payload: { note: body.note ?? null, queue_id: id },
    ip: clientIp(req.headers),
  });
  return json({ item: resolved });
});
