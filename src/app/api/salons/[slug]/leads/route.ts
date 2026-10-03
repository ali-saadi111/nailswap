import type { NextRequest } from "next/server";
import { z } from "zod";
import { errors, handle, json, parseJson } from "@/lib/api";
import { clientIp, enforceLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBookableSalon } from "@/lib/salons/lookup";
import { normalizePhone } from "@/lib/utils";

const schema = z.object({
  phone: z.string().min(6).max(20),
  fullName: z.string().trim().max(80).optional(),
  designId: z.string().uuid().optional(),
  tryonJobId: z.string().uuid().optional(),
  notes: z.string().trim().max(500).optional(),
});

/**
 * POST /api/salons/:slug/leads — "send me this look" / call-back request from a visitor who
 * has not booked. Upserts on (salon, phone) so repeated submissions do not duplicate leads.
 */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const body = await parseJson(req, schema);
  await enforceLimit("booking_ip", clientIp(req.headers));
  const digits = normalizePhone(body.phone);
  if (!/^\d{10,15}$/.test(digits)) throw errors.unprocessable("invalid_phone");
  const salon = await loadBookableSalon(slug);
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("leads")
    .select("id")
    .eq("salon_id", salon.id)
    .eq("phone", digits)
    .in("status", ["new", "contacted"])
    .maybeSingle();
  const patch = {
    salon_id: salon.id,
    phone: digits,
    full_name: body.fullName ?? null,
    design_id: body.designId ?? null,
    tryon_job_id: body.tryonJobId ?? null,
    notes: body.notes ?? null,
  };
  const result = existing
    ? await admin.from("leads").update(patch).eq("id", existing.id).select("id, status").single()
    : await admin.from("leads").insert(patch).select("id, status").single();
  if (result.error) throw result.error;
  return json({ ok: true, lead: result.data }, { status: existing ? 200 : 201 });
});
