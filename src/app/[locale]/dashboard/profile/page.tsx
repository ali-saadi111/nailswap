import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext } from "@/lib/dashboard/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const context = await getDashboardContext();
  if (!context.salon) redirect({ href: "/dashboard/onboarding", locale });
  if (context.role === "staff") redirect({ href: "/dashboard/bookings", locale });
  const client = context.role === "admin" ? createAdminClient() : await createClient();
  const { data, error } = await client
    .from("salon_hours")
    .select("weekday,open_time,close_time,is_closed")
    .eq("salon_id", context.salon!.id);
  if (error) throw error;
  return <ProfileForm salon={context.salon!} initialHours={data ?? []} />;
}
