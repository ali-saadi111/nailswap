import { NextResponse, type NextRequest } from "next/server";
import { errors, handle, requireSalonRole } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureInvoicePdf } from "@/lib/billing/lifecycle";
import { BUCKETS, signedUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** GET /api/dashboard/:salonId/invoices/:id/pdf — generates (once) and redirects to a signed PDF URL. */
export const GET = handle(
  async (_req: NextRequest, ctx: { params: Promise<{ salonId: string; id: string }> }) => {
    const { salonId, id } = await ctx.params;
    await requireSalonRole(salonId, "manager");
    const { data: invoice } = await createAdminClient()
      .from("invoices")
      .select("id, salon_id")
      .eq("id", id)
      .maybeSingle();
    if (!invoice || invoice.salon_id !== salonId) throw errors.notFound("Invoice");
    const path = await ensureInvoicePdf(id);
    return NextResponse.redirect(await signedUrl(BUCKETS.privateDocs, path, 600), { status: 302 });
  },
);
