import { startOfMonth, subDays } from "date-fns";
import { handle, json, requireAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/overview — platform KPIs for the admin home. */
export const GET = handle(async () => {
  await requireAdmin();
  const admin = createAdminClient();
  const monthStart = startOfMonth(new Date()).toISOString();
  const weekAgo = subDays(new Date(), 7).toISOString();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [
    salonsPending,
    salonsActive,
    salonsSuspended,
    bookingsWeek,
    jobsMonth,
    pendingModeration,
    pendingPayments,
    trialing,
    active,
    grace,
  ] = await Promise.all([
    count(admin.from("salons").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(admin.from("salons").select("id", { count: "exact", head: true }).eq("status", "active")),
    count(admin.from("salons").select("id", { count: "exact", head: true }).eq("status", "suspended")),
    count(admin.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", weekAgo)),
    count(
      admin.from("tryon_jobs").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
    ),
    count(
      admin.from("moderation_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ),
    count(
      admin
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("provider", "manual"),
    ),
    count(admin.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "trialing")),
    count(admin.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active")),
    count(
      admin
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .in("status", ["grace", "past_due"]),
    ),
  ]);
  const [{ data: cost }, { data: revenue }] = await Promise.all([
    admin.from("ai_cost_log").select("cost_usd").gte("created_at", monthStart),
    admin.from("payments").select("amount").eq("status", "paid").gte("updated_at", monthStart),
  ]);
  return json({
    salons: { pending: salonsPending, active: salonsActive, suspended: salonsSuspended },
    subscriptions: { trialing, active, grace },
    bookingsLast7Days: bookingsWeek,
    aiJobsThisMonth: jobsMonth,
    aiCostThisMonthUsd: Math.round((cost ?? []).reduce((s, r) => s + Number(r.cost_usd), 0) * 100) / 100,
    revenueThisMonthUsd: Math.round((revenue ?? []).reduce((s, r) => s + Number(r.amount), 0) * 100) / 100,
    queues: { moderation: pendingModeration, manualPayments: pendingPayments },
  });
});
