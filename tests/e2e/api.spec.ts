import { test, expect } from "@playwright/test";

/**
 * API smoke tests against the running app + seeded local Supabase (pnpm db:seed).
 * UI journeys (try-on → booking, onboarding, admin) are added once the pages exist.
 */
test.describe("API", () => {
  test("health reports the database and integrations", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.database).toBe("ok");
    expect(body.integrations).toHaveProperty("ai");
  });

  test("directory lists the seeded salons", async ({ request }) => {
    const res = await request.get("/api/salons?limit=10");
    expect(res.ok()).toBeTruthy();
    const { items } = await res.json();
    expect(items.map((s: { slug: string }) => s.slug)).toEqual(
      expect.arrayContaining(["glow-beirut", "nailbar-jounieh", "studio-rose"]),
    );
    // Pro plan salons rank first
    expect(items[0].slug).toBe("glow-beirut");
  });

  test("salon profile, availability and slots", async ({ request }) => {
    const profile = await (await request.get("/api/salons/glow-beirut")).json();
    expect(profile.salon.name).toBe("Glow Nails Beirut");
    expect(profile.designs.length).toBeGreaterThan(0);
    const gel = profile.services.find((s: { category: string }) => s.category === "gel");
    expect(gel).toBeTruthy();

    const availability = await (
      await request.get(`/api/salons/glow-beirut/availability?serviceId=${gel.id}&days=14`)
    ).json();
    expect(availability.days).toHaveLength(14);
    const openDay = availability.days.find((d: { count: number }) => d.count > 0);
    expect(openDay).toBeTruthy();

    const slots = await (
      await request.get(`/api/salons/glow-beirut/slots?serviceId=${gel.id}&date=${openDay.date}`)
    ).json();
    expect(slots.slots.length).toBe(openDay.count);
    expect(slots.slots[0]).toHaveProperty("staffIds");
  });

  test("protected routes reject anonymous and unauthenticated internal calls", async ({ request }) => {
    expect((await request.get("/api/account/bookings")).status()).toBe(401);
    expect((await request.post("/api/internal/notifications/dispatch")).status()).toBe(401);
    expect((await request.get("/api/admin/overview")).status()).toBe(401);
  });

  test("phone OTP sign-in via the API sets a session", async ({ request }) => {
    const send = await request.post("/api/auth/otp/send", { data: { phone: "+961 70 000 021" } });
    expect(send.ok()).toBeTruthy();
    const verify = await request.post("/api/auth/otp/verify", {
      data: { phone: "96170000021", code: "123456" },
    });
    expect(verify.ok()).toBeTruthy();
    const me = await (await request.get("/api/auth/me")).json();
    expect(me.user?.phone).toBe("96170000021");
    const bookings = await request.get("/api/account/bookings");
    expect(bookings.ok()).toBeTruthy();
    const logout = await request.post("/api/auth/logout");
    expect(logout.ok()).toBeTruthy();
    expect((await (await request.get("/api/auth/me")).json()).user).toBeNull();
  });

  test("internal cron endpoints run with the shared secret", async ({ request }) => {
    const secret = process.env.INTERNAL_API_SECRET ?? "local-dev-internal-secret-change-me";
    const res = await request.post("/api/internal/notifications/dispatch", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toHaveProperty("considered");
  });
});
