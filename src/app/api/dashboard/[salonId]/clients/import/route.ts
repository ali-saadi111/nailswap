import type { NextRequest } from "next/server";
import Papa from "papaparse";
import { errors, handle, json, parseForm, requireSalonRole, userClient } from "@/lib/api";
import { normalizePhone } from "@/lib/utils";

export const maxDuration = 60;

interface Row {
  full_name?: string;
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  locale?: string;
}

/**
 * POST /api/dashboard/:salonId/clients/import — multipart { file: CSV }
 * Columns (header row, any order): full_name|name, phone, email?, notes?, locale?
 * Upserts on phone. Returns counts and per-row errors.
 */
export const POST = handle(async (req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  await requireSalonRole(salonId, "manager");
  const form = await parseForm(req);
  const file = form.get("file");
  if (!(file instanceof File)) throw errors.badRequest("file_required");
  if (file.size > 5 * 1024 * 1024) throw errors.tooLarge("CSV too large (max 5 MB)");
  const text = (await file.text()).replace(/^﻿/, "");
  const parsed = Papa.parse<Row>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const rows: Array<{
    salon_id: string;
    full_name: string;
    phone: string;
    email: string | null;
    notes: string | null;
    preferred_locale: "en" | "ar" | "fr";
  }> = [];
  const rowErrors: Array<{ line: number; error: string }> = [];
  parsed.data.forEach((r, i) => {
    const name = (r.full_name ?? r.name ?? "").trim();
    const phone = r.phone ? normalizePhone(String(r.phone)) : "";
    if (!name || !/^\d{10,15}$/.test(phone)) {
      rowErrors.push({ line: i + 2, error: !name ? "missing name" : "invalid phone" });
      return;
    }
    rows.push({
      salon_id: salonId,
      full_name: name,
      phone,
      email: r.email?.trim() || null,
      notes: r.notes?.trim() || null,
      preferred_locale: "en",
    });
  });
  if (rows.length > 5000) throw errors.tooLarge("Import at most 5000 clients at a time");

  const supabase = await userClient();
  let imported = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error, count } = await supabase
      .from("clients")
      .upsert(chunk, { onConflict: "salon_id,phone", ignoreDuplicates: false, count: "exact" });
    if (error) throw error;
    imported += count ?? chunk.length;
  }
  return json({ imported, skipped: rowErrors.length, errors: rowErrors.slice(0, 50) });
});
