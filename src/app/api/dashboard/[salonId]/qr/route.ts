import type { NextRequest } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { errors, handle, parseQuery, requireSalonRole, salonUrl } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  format: z.enum(["png", "svg"]).default("png"),
  size: z.coerce.number().int().min(128).max(2048).default(1024),
  locale: z.enum(["en"]).optional(),
  /** Deep link target: salon home, try-on or booking. */
  target: z.enum(["home", "try", "book"]).default("home"),
});

/** GET /api/dashboard/:salonId/qr?format=png|svg&size=1024&target=home|try|book — printable QR. */
export const GET = handle(async (req: NextRequest, ctx: { params: Promise<{ salonId: string }> }) => {
  const { salonId } = await ctx.params;
  await requireSalonRole(salonId, "staff");
  const q = parseQuery(req, schema);
  const { data: salon } = await createAdminClient()
    .from("salons")
    .select("slug, default_locale, brand_color")
    .eq("id", salonId)
    .maybeSingle();
  if (!salon) throw errors.notFound("Salon");
  const path = q.target === "try" ? "/try" : q.target === "book" ? "/book" : "";
  const url = `${salonUrl(salon.slug, "en", path)}?utm_source=qr`;
  const color = { dark: salon.brand_color, light: "#FFFFFF" };
  if (q.format === "svg") {
    const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color });
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=3600" },
    });
  }
  const png = await QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: q.size,
    color,
  });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
});
