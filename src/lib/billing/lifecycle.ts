import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, uploadObject } from "@/lib/storage";
import { env } from "@/lib/env";
import { log, errorMessage } from "@/lib/logger";
import { renderInvoicePdf } from "./invoice-pdf";
import { LINKS, queueNotification } from "@/lib/notifications/dispatch";
import { errors } from "@/lib/api";

/** Renders and stores the PDF for an invoice (no-op when it already exists). Returns the path. */
export async function ensureInvoicePdf(invoiceId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: invoice } = await admin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) throw errors.notFound("Invoice");
  if (invoice.pdf_path) return invoice.pdf_path;
  const { data: salon } = await admin
    .from("salons")
    .select("name, address, city, email, phone")
    .eq("id", invoice.salon_id)
    .single();
  const pdf = await renderInvoicePdf(invoice, salon!);
  const path = `${invoice.salon_id}/invoices/${invoice.number}.pdf`;
  await uploadObject(BUCKETS.privateDocs, path, pdf, "application/pdf", true);
  await admin.from("invoices").update({ pdf_path: path }).eq("id", invoiceId);
  return path;
}

/**
 * Runs after `run_billing_lifecycle()` (daily cron): generates PDFs for freshly issued
 * invoices and emails salon owners, then sends AI-quota warnings.
 */
export async function afterBillingLifecycle() {
  const admin = createAdminClient();
  const appUrl = env().NEXT_PUBLIC_APP_URL;
  let invoicesProcessed = 0;
  let warnings = 0;

  const { data: pending } = await admin
    .from("invoices")
    .select("id, salon_id, number, status, salons(email, default_locale, name)")
    .is("pdf_path", null)
    .in("status", ["open", "paid"])
    .order("created_at", { ascending: true })
    .limit(100);

  for (const inv of pending ?? []) {
    try {
      await ensureInvoicePdf(inv.id);
      invoicesProcessed++;
      const salon = inv.salons;
      if (salon?.email && inv.status === "open") {
        await queueNotification({
          salonId: inv.salon_id,
          kind: "salon_invoice",
          channel: "email",
          recipient: salon.email,
          locale: salon.default_locale,
          payload: { salon: salon.name, link: `${appUrl}${LINKS.dashboardBilling(salon.default_locale)}` },
        });
      }
    } catch (err) {
      log.error("invoice pdf failed", { invoiceId: inv.id, error: errorMessage(err) });
    }
  }

  // Quota warnings at 80% of the monthly plan quota (once per period).
  const { data: subs } = await admin
    .from("subscriptions")
    .select("salon_id, current_period_start, salons(email, name, default_locale)")
    .in("status", ["trialing", "active", "grace", "past_due"]);
  for (const sub of subs ?? []) {
    const salon = sub.salons;
    if (!salon?.email) continue;
    const { data: quota } = await admin.rpc("salon_ai_quota", { p_salon_id: sub.salon_id }).maybeSingle();
    if (!quota || quota.quota <= 0) continue;
    if (quota.used / quota.quota < 0.8) continue;
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", sub.salon_id)
      .eq("kind", "salon_quota_warning")
      .gte("created_at", sub.current_period_start);
    if (count && count > 0) continue;
    await queueNotification({
      salonId: sub.salon_id,
      kind: "salon_quota_warning",
      channel: "email",
      recipient: salon.email,
      locale: salon.default_locale,
      payload: { salon: salon.name, link: `${appUrl}${LINKS.dashboardBilling(salon.default_locale)}` },
    });
    warnings++;
  }

  return { invoicesProcessed, warnings };
}
