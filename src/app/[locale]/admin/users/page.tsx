import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UsersTable } from "./users-table";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.admin" });
  return { title: t("users") };
}

export default async function AdminUsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = createAdminClient();
  const [{ data: profiles }, { data: members }, { data: bookings }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, phone, email, is_platform_admin, preferred_locale, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("salon_members").select("user_id, role, salons(name)"),
    admin.from("bookings").select("client_id, clients!inner(user_id)").limit(5000),
  ]);
  const roles = new Map<string, string[]>();
  for (const m of members ?? [])
    roles.set(m.user_id, [...(roles.get(m.user_id) ?? []), `${m.role} · ${m.salons?.name ?? ""}`]);
  const counts = new Map<string, number>();
  for (const b of bookings ?? []) {
    const uid = b.clients?.user_id;
    if (uid) counts.set(uid, (counts.get(uid) ?? 0) + 1);
  }
  return (
    <UsersTable
      rows={(profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name,
        phone: p.phone,
        email: p.email,
        isAdmin: p.is_platform_admin,
        locale: p.preferred_locale,
        createdAt: p.created_at,
        roles: roles.get(p.id) ?? [],
        bookings: counts.get(p.id) ?? 0,
      }))}
    />
  );
}
