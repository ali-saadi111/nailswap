import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentsTable } from "./payments-table";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("payments") };
}

export default async function PaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = createAdminClient();
  const { data } = await admin
    .from("payments")
    .select(
      "id, purpose, amount, currency, method, provider, status, reference_note, created_at, updated_at, salons(name, slug), invoices(number)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  return (
    <PaymentsTable
      rows={(data ?? []).map((p) => ({
        id: p.id,
        purpose: p.purpose,
        amount: Number(p.amount),
        currency: p.currency,
        method: p.method,
        provider: p.provider,
        status: p.status,
        reference: p.reference_note,
        createdAt: p.created_at,
        salonName: p.salons?.name ?? "",
        invoiceNumber: p.invoices?.number ?? null,
      }))}
    />
  );
}
