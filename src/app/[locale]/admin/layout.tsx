import { setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClaims } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const claims = await getClaims();
  const admin = createAdminClient();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [pending, payments, moderation, { data: me }] = await Promise.all([
    count(admin.from("salons").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(
      admin
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("provider", "manual"),
    ),
    count(
      admin.from("moderation_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ),
    admin.from("profiles").select("full_name, phone").eq("id", claims.userId!).maybeSingle(),
  ]);
  return (
    <AdminNav
      locale={locale}
      counts={{ pending, payments, moderation }}
      adminName={me?.full_name ?? me?.phone ?? "Admin"}
    >
      {children}
    </AdminNav>
  );
}
