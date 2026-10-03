import { setRequestLocale } from "next-intl/server";
import { getDashboardContext } from "@/lib/dashboard/context";
import { DashboardNav } from "./dashboard-nav";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  return (
    <DashboardNav
      locale={locale}
      salon={
        ctx.salon
          ? {
              id: ctx.salon.id,
              name: ctx.salon.name,
              host: ctx.host,
              planLabel: ctx.planName,
              onboardingComplete: Boolean(ctx.salon.onboarding_completed_at),
            }
          : null
      }
      salons={ctx.salons.map((s) => ({ id: s.id, name: s.name }))}
      pendingBookings={ctx.pendingBookings}
      role={ctx.role}
      impersonating={
        ctx.impersonating
          ? { salonName: ctx.salon?.name ?? "", expiresAt: ctx.impersonating.expiresAt }
          : null
      }
      subscription={
        ctx.subscription
          ? {
              status: ctx.subscription.status,
              graceEndsAt: ctx.subscription.grace_ends_at,
              trialEndsAt: ctx.subscription.trial_ends_at,
            }
          : null
      }
      isAdmin={ctx.isPlatformAdmin}
    >
      {children}
    </DashboardNav>
  );
}
