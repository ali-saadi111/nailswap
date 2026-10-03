import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  createFixture,
  destroyFixture,
  userClient,
  PHONES,
  type Db,
  type Fixture,
} from "./helpers";

/**
 * Row Level Security matrix: anonymous, client, staff, manager, owner, platform admin.
 * Runs against the local Supabase stack (pnpm db:start) — see vitest.rls.config.ts.
 */
let f: Fixture;
let anon: Db;
let ownerA: Db;
let managerA: Db;
let staffA: Db;
let client: Db;
let platformAdmin: Db;
let ownerB: Db;

beforeAll(async () => {
  f = await createFixture();
  anon = anonClient();
  [ownerA, managerA, staffA, client, platformAdmin, ownerB] = await Promise.all([
    userClient(PHONES.ownerA),
    userClient(PHONES.managerA),
    userClient(PHONES.staffA),
    userClient(PHONES.client),
    userClient(PHONES.platformAdmin),
    userClient(PHONES.ownerB),
  ]);
}, 120_000);

afterAll(async () => {
  await destroyFixture();
});

describe("JWT claims (custom_access_token_hook)", () => {
  it("adds salon_roles and is_platform_admin to the token", async () => {
    const { data } = await ownerA.auth.getClaims();
    const claims = data?.claims as Record<string, unknown>;
    expect((claims.salon_roles as Record<string, string>)[f.salonA]).toBe("owner");
    expect(claims.is_platform_admin).toBe(false);
    const adminClaims = (await platformAdmin.auth.getClaims()).data?.claims as Record<string, unknown>;
    expect(adminClaims.is_platform_admin).toBe(true);
  });
});

describe("anonymous visitor", () => {
  it("reads public salon data only", async () => {
    const { data: salon } = await anon
      .from("salons")
      .select("id, name")
      .eq("slug", "rls-salon-a")
      .maybeSingle();
    expect(salon?.name).toBe("RLS Salon A");
    const { data: designs } = await anon.from("designs").select("slug").eq("salon_id", f.salonA);
    expect(designs?.map((d) => d.slug)).toEqual(["rls-design"]); // hidden design filtered out
    const { data: services } = await anon.from("services").select("id").eq("salon_id", f.salonA);
    expect(services).toHaveLength(1);
    const { data: staff } = await anon.from("staff").select("id").eq("salon_id", f.salonA);
    expect(staff).toHaveLength(2);
  });

  it("cannot see private tables", async () => {
    for (const table of [
      "clients",
      "bookings",
      "notifications",
      "tryon_jobs",
      "subscriptions",
      "invoices",
      "payments",
      "leads",
      "analytics_events",
    ] as const) {
      const { data, error } = await anon.from(table).select("*").limit(5);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("cannot write", async () => {
    const { error } = await anon
      .from("salons")
      .insert({ slug: "rls-hack", name: "Hack", owner_id: f.ownerA });
    expect(error).not.toBeNull();
    const { error: bookErr } = await anon.rpc("book_slot", {
      p_salon_id: f.salonA,
      p_service_id: f.serviceA,
      p_staff_id: null as unknown as string,
      p_starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      p_client_name: "Anon",
      p_client_phone: "96170000099",
    });
    expect(bookErr?.message).toMatch(/permission denied|not exist/i);
  });
});

describe("salon owner", () => {
  it("updates own salon but not plan-gated / status fields", async () => {
    const { error } = await ownerA.from("salons").update({ name: "RLS Salon A+" }).eq("id", f.salonA);
    expect(error).toBeNull();
    const { error: statusErr } = await ownerA
      .from("salons")
      .update({ status: "suspended" })
      .eq("id", f.salonA);
    expect(statusErr).not.toBeNull();
    const { error: brandingErr } = await ownerA
      .from("salons")
      .update({ remove_branding: true })
      .eq("id", f.salonA);
    expect(brandingErr).not.toBeNull();
    const { data } = await admin
      .from("salons")
      .select("name, status, remove_branding")
      .eq("id", f.salonA)
      .single();
    expect(data).toMatchObject({ name: "RLS Salon A+", status: "active", remove_branding: false });
  });

  it("cannot touch another salon", async () => {
    const { data: updated } = await ownerA
      .from("salons")
      .update({ name: "pwned" })
      .eq("id", f.salonB)
      .select("id");
    expect(updated).toEqual([]);
    const { data: clients } = await ownerB.from("clients").select("id").eq("salon_id", f.salonA);
    expect(clients).toEqual([]);
  });

  it("manages catalog and team, but cannot create a second owner", async () => {
    const { error } = await ownerA
      .from("services")
      .insert({ salon_id: f.salonA, name: "Pedicure", category: "pedicure", price: 25, duration_min: 45 });
    expect(error).toBeNull();
    const { error: ownerErr } = await ownerA
      .from("salon_members")
      .insert({ salon_id: f.salonA, user_id: f.clientUser, role: "owner" });
    expect(ownerErr).not.toBeNull();
    const { error: staffErr } = await ownerA
      .from("salon_members")
      .insert({ salon_id: f.salonA, user_id: f.clientUser, role: "staff" });
    expect(staffErr).toBeNull();
    await admin.from("salon_members").delete().eq("salon_id", f.salonA).eq("user_id", f.clientUser);
  });

  it("can record a pending manual payment only", async () => {
    const { error } = await ownerA
      .from("payments")
      .insert({
        salon_id: f.salonA,
        purpose: "topup",
        amount: 9,
        method: "whish",
        provider: "manual",
        status: "pending",
        metadata: { credits: 50 },
      });
    expect(error).toBeNull();
    const { error: paidErr } = await ownerA
      .from("payments")
      .insert({
        salon_id: f.salonA,
        purpose: "topup",
        amount: 9,
        method: "whish",
        provider: "manual",
        status: "paid",
      });
    expect(paidErr).not.toBeNull();
  });
});

describe("manager", () => {
  it("reads all salon bookings and updates salon settings", async () => {
    const { data: bookings } = await managerA.from("bookings").select("id").eq("salon_id", f.salonA);
    expect(bookings?.map((b) => b.id).sort()).toEqual([f.bookingOwn, f.bookingOther].sort());
    const { error } = await managerA.from("salons").update({ slot_interval_min: 30 }).eq("id", f.salonA);
    expect(error).toBeNull();
  });

  it("cannot change the owner", async () => {
    const { error } = await managerA.from("salons").update({ owner_id: f.managerA }).eq("id", f.salonA);
    expect(error).not.toBeNull();
  });
});

describe("staff (technician)", () => {
  it("sees only their own bookings", async () => {
    const { data } = await staffA.from("bookings").select("id").eq("salon_id", f.salonA);
    expect(data?.map((b) => b.id)).toEqual([f.bookingOwn]);
  });

  it("can mark their booking completed and edit notes, but not price or time", async () => {
    const { error } = await staffA
      .from("bookings")
      .update({ staff_notes: "Chrome, size 3 tips" })
      .eq("id", f.bookingOwn);
    expect(error).toBeNull();
    const { error: priceErr } = await staffA
      .from("bookings")
      .update({ total_price: 1 })
      .eq("id", f.bookingOwn);
    expect(priceErr?.message).toMatch(/Staff may only/);
    const { error: cancelErr } = await staffA
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", f.bookingOwn);
    expect(cancelErr?.message).toMatch(/Staff may only/);
    const { data: other } = await staffA
      .from("bookings")
      .update({ staff_notes: "x" })
      .eq("id", f.bookingOther)
      .select("id");
    expect(other).toEqual([]);
  });

  it("cannot edit the catalog", async () => {
    const { error } = await staffA
      .from("designs")
      .insert({ salon_id: f.salonA, slug: "staff-design", name: "Nope" });
    expect(error).not.toBeNull();
  });
});

describe("client", () => {
  it("sees their own bookings via phone match and nothing else", async () => {
    const { data } = await client.from("bookings").select("id").order("created_at");
    expect(data?.map((b) => b.id).sort()).toEqual([f.bookingOwn, f.bookingOther].sort());
    const { data: clients } = await client.from("clients").select("id");
    expect(clients?.map((c) => c.id)).toEqual([f.clientRow]);
  });

  it("can only review a completed booking", async () => {
    const { error } = await client
      .from("reviews")
      .insert({
        booking_id: f.bookingOwn,
        salon_id: f.salonA,
        client_id: f.clientRow,
        user_id: f.clientUser,
        rating: 5,
        body: "Great",
      });
    expect(error).not.toBeNull();
    await admin.from("bookings").update({ status: "completed" }).eq("id", f.bookingOwn);
    const { error: okErr } = await client
      .from("reviews")
      .insert({
        booking_id: f.bookingOwn,
        salon_id: f.salonA,
        client_id: f.clientRow,
        user_id: f.clientUser,
        rating: 5,
        body: "Great",
      });
    expect(okErr).toBeNull();
    const { data: salon } = await admin
      .from("salons")
      .select("rating_avg, rating_count")
      .eq("id", f.salonA)
      .single();
    expect(salon).toMatchObject({ rating_count: 1 });
    expect(Number(salon?.rating_avg)).toBe(5);
  });

  it("cannot read the salon's private data", async () => {
    const { data } = await client.from("notifications").select("id");
    expect(data).toEqual([]);
    const { data: subs } = await client.from("subscriptions").select("id");
    expect(subs).toEqual([]);
  });
});

describe("platform admin", () => {
  it("reads everything and changes plans through the audited RPC", async () => {
    const { data: clients } = await platformAdmin.from("clients").select("id").eq("salon_id", f.salonA);
    expect(clients?.length).toBe(1);
    const { data: sub, error } = await platformAdmin.rpc("admin_change_plan", {
      p_salon_id: f.salonA,
      p_plan: "pro",
      p_reason: "test",
    });
    expect(error).toBeNull();
    expect(sub?.plan_code).toBe("pro");
    const { data: audit } = await platformAdmin
      .from("admin_audit_log")
      .select("action")
      .eq("target_id", f.salonA);
    expect(audit?.some((a) => a.action === "change_plan")).toBe(true);
    const { data: salon } = await admin.from("salons").select("remove_branding").eq("id", f.salonA).single();
    expect(salon?.remove_branding).toBe(true);
  });

  it("non-admins cannot use admin RPCs or read the audit log", async () => {
    const { error } = await ownerA.rpc("admin_change_plan", { p_salon_id: f.salonA, p_plan: "basic" });
    expect(error?.message).toMatch(/Admin only/);
    const { data } = await ownerA.from("admin_audit_log").select("id");
    expect(data).toEqual([]);
  });
});
