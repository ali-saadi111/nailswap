import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

loadEnv({ path: ".env.local" });
loadEnv();

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!ANON_KEY || !SERVICE_KEY)
  throw new Error("Set NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (see .env.example)");

export type Db = SupabaseClient<Database>;

/** Service-role client (bypasses RLS) for fixtures and assertions. */
export const admin: Db = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function anonClient(): Db {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Test phone numbers registered in supabase/config.toml → [auth.sms.test_otp] (OTP 123456). */
export const PHONES = {
  ownerA: "96170000031",
  managerA: "96170000032",
  staffA: "96170000033",
  client: "96170000034",
  platformAdmin: "96170000035",
  ownerB: "96170000036",
} as const;

/**
 * Signs in through GoTrue with the test OTP so the session carries the real
 * custom_access_token_hook claims (is_platform_admin, salon_roles).
 */
export async function userClient(phone: string): Promise<Db> {
  const c = anonClient();
  const { error: sendErr } = await c.auth.signInWithOtp({ phone: `+${phone}` });
  if (sendErr) throw new Error(`signInWithOtp ${phone}: ${sendErr.message}`);
  const { error: verifyErr } = await c.auth.verifyOtp({ phone: `+${phone}`, token: "123456", type: "sms" });
  if (verifyErr) throw new Error(`verifyOtp ${phone}: ${verifyErr.message}`);
  return c;
}

export async function ensureUser(
  phone: string,
  fullName: string,
  extra: Partial<Database["public"]["Tables"]["profiles"]["Update"]> = {},
) {
  const { data: existing } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
  if (existing) {
    await admin
      .from("profiles")
      .update({ full_name: fullName, ...extra })
      .eq("id", existing.id);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    phone: `+${phone}`,
    phone_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new Error(`createUser ${phone}: ${error?.message}`);
  await admin
    .from("profiles")
    .update({ full_name: fullName, ...extra })
    .eq("id", data.user.id);
  return data.user.id;
}

export async function deleteUsersByPhone(phones: string[]) {
  const { data } = await admin.from("profiles").select("id").in("phone", phones);
  for (const u of data ?? []) await admin.auth.admin.deleteUser(u.id);
}

export function must<T>(r: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as NonNullable<T>;
}

/** Next Monday 12:00 in Beirut (UTC+3 in summer, +2 in winter — we use a fixed offset that is valid for the test's assertions). */
export function futureSlot(daysAhead = 7, hour = 12) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  // Move to a Monday–Friday
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hour - 3, 0, 0, 0); // 12:00 Beirut ≈ 09:00 UTC
  return d;
}

export interface Fixture {
  salonA: string;
  salonB: string;
  ownerA: string;
  managerA: string;
  staffA: string;
  staffAId: string;
  otherStaffId: string;
  clientUser: string;
  adminUser: string;
  ownerB: string;
  serviceA: string;
  designA: string;
  clientRow: string;
  bookingOwn: string;
  bookingOther: string;
}

const SLUGS = ["rls-salon-a", "rls-salon-b"];

export async function createFixture(): Promise<Fixture> {
  await destroyFixture();
  const ownerA = await ensureUser(PHONES.ownerA, "Owner A");
  const managerA = await ensureUser(PHONES.managerA, "Manager A");
  const staffA = await ensureUser(PHONES.staffA, "Staff A");
  const clientUser = await ensureUser(PHONES.client, "Client");
  const adminUser = await ensureUser(PHONES.platformAdmin, "Admin", { is_platform_admin: true });
  const ownerB = await ensureUser(PHONES.ownerB, "Owner B");

  const salonA = must(
    await admin
      .from("salons")
      .insert({
        slug: SLUGS[0],
        name: "RLS Salon A",
        owner_id: ownerA,
        status: "active",
        directory_approved: true,
        city: "Beirut",
        min_lead_time_min: 0,
      })
      .select("id")
      .single(),
    "salon A",
  ).id;
  const salonB = must(
    await admin
      .from("salons")
      .insert({
        slug: SLUGS[1],
        name: "RLS Salon B",
        owner_id: ownerB,
        status: "active",
        directory_approved: true,
        city: "Jounieh",
      })
      .select("id")
      .single(),
    "salon B",
  ).id;
  must(
    await admin.from("salon_members").insert([
      { salon_id: salonA, user_id: managerA, role: "manager" },
      { salon_id: salonA, user_id: staffA, role: "staff" },
    ]),
    "members",
  );
  must(
    await admin
      .from("salon_hours")
      .insert(
        [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          salon_id: salonA,
          weekday,
          open_time: "09:00",
          close_time: "20:00",
          is_closed: false,
        })),
      ),
    "hours",
  );
  const serviceA = must(
    await admin
      .from("services")
      .insert({ salon_id: salonA, name: "Gel", category: "gel", price: 30, duration_min: 60 })
      .select("id")
      .single(),
    "service",
  ).id;
  const designA = must(
    await admin
      .from("designs")
      .insert({ salon_id: salonA, slug: "rls-design", name: "RLS Design", is_visible: true })
      .select("id")
      .single(),
    "design",
  ).id;
  const hidden = must(
    await admin
      .from("designs")
      .insert({ salon_id: salonA, slug: "rls-hidden", name: "Hidden", is_visible: false })
      .select("id")
      .single(),
    "hidden design",
  );
  void hidden;
  const staffAId = must(
    await admin
      .from("staff")
      .insert({ salon_id: salonA, user_id: staffA, display_name: "Staff A" })
      .select("id")
      .single(),
    "staff row",
  ).id;
  const otherStaffId = must(
    await admin
      .from("staff")
      .insert({ salon_id: salonA, user_id: null, display_name: "Other Tech" })
      .select("id")
      .single(),
    "other staff",
  ).id;
  must(
    await admin
      .from("staff_schedule_rules")
      .insert(
        [staffAId, otherStaffId].flatMap((staff_id) =>
          [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
            staff_id,
            weekday,
            kind: "work" as const,
            start_time: "09:00",
            end_time: "20:00",
          })),
        ),
      ),
    "rules",
  );
  must(
    await admin.from("staff_services").insert([
      { staff_id: staffAId, service_id: serviceA },
      { staff_id: otherStaffId, service_id: serviceA },
    ]),
    "staff_services",
  );

  const clientRow = must(
    await admin
      .from("clients")
      .insert({ salon_id: salonA, user_id: clientUser, full_name: "Client", phone: PHONES.client })
      .select("id")
      .single(),
    "client",
  ).id;
  const start = futureSlot(3, 10);
  const end = new Date(start.getTime() + 60 * 60_000);
  const bookingOwn = must(
    await admin
      .from("bookings")
      .insert({
        salon_id: salonA,
        client_id: clientRow,
        staff_id: staffAId,
        service_id: serviceA,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "confirmed",
        service_price: 30,
        total_price: 30,
      })
      .select("id")
      .single(),
    "booking own",
  ).id;
  const bookingOther = must(
    await admin
      .from("bookings")
      .insert({
        salon_id: salonA,
        client_id: clientRow,
        staff_id: otherStaffId,
        service_id: serviceA,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "confirmed",
        service_price: 30,
        total_price: 30,
      })
      .select("id")
      .single(),
    "booking other",
  ).id;

  return {
    salonA,
    salonB,
    ownerA,
    managerA,
    staffA,
    staffAId,
    otherStaffId,
    clientUser,
    adminUser,
    ownerB,
    serviceA,
    designA,
    clientRow,
    bookingOwn,
    bookingOther,
  };
}

export async function destroyFixture() {
  await admin.from("salons").delete().in("slug", SLUGS);
  await deleteUsersByPhone(Object.values(PHONES));
}
