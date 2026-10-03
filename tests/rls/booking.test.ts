import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, createFixture, destroyFixture, futureSlot, type Fixture } from "./helpers";

/** book_slot() + the exclusion constraint: no double booking, even under concurrency. */
let f: Fixture;

beforeAll(async () => {
  f = await createFixture();
}, 120_000);

afterAll(async () => {
  await destroyFixture();
});

function book(startsAt: Date, phone: string, staffId: string | null = null) {
  return admin.rpc("book_slot", {
    p_salon_id: f.salonA,
    p_service_id: f.serviceA,
    p_staff_id: staffId as unknown as string,
    p_starts_at: startsAt.toISOString(),
    p_client_name: `Client ${phone.slice(-3)}`,
    p_client_phone: phone,
    p_source: "direct",
    p_locale: "en",
  });
}

describe("book_slot", () => {
  it("books, upserts the CRM client and queues notifications", async () => {
    const start = futureSlot(10, 11);
    const { data, error } = await book(start, "96171000001", f.staffAId);
    expect(error).toBeNull();
    expect(data?.status).toBe("confirmed"); // salon A is instant-booking
    expect(data?.manage_token).toHaveLength(48);
    const { data: client } = await admin
      .from("clients")
      .select("full_name")
      .eq("salon_id", f.salonA)
      .eq("phone", "96171000001")
      .single();
    expect(client?.full_name).toBe("Client 001");
    const { data: notifications } = await admin
      .from("notifications")
      .select("kind, channel")
      .eq("booking_id", data!.id);
    expect(notifications?.map((n) => n.kind)).toContain("booking_confirmation");
    // reminders scheduled on confirmation
    expect(notifications?.some((n) => n.kind === "booking_reminder_24h")).toBe(true);
  });

  it("rejects an overlapping booking for the same technician", async () => {
    const start = futureSlot(11, 15);
    const first = await book(start, "96171000002", f.staffAId);
    expect(first.error).toBeNull();
    const overlapping = new Date(start.getTime() + 30 * 60_000);
    const second = await book(overlapping, "96171000003", f.staffAId);
    expect(second.error?.code).toMatch(/P0012|P0013/);
  });

  it("assigns another free technician when none is chosen", async () => {
    const start = futureSlot(12, 16);
    const a = await book(start, "96171000004");
    const b = await book(start, "96171000005");
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.data?.staff_id).not.toBe(b.data?.staff_id);
    const c = await book(start, "96171000006");
    expect(c.error?.code).toBe("P0012");
  });

  it("never double-books under concurrent requests", async () => {
    const start = futureSlot(13, 17);
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => book(start, `9617100001${i}`, f.staffAId)),
    );
    const ok = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(5);
    for (const r of failed) expect(r.error?.code).toMatch(/P0012|P0013/);
  });

  it("enforces lead time and cancellation cutoff via manage tokens", async () => {
    await admin.from("salons").update({ min_lead_time_min: 120 }).eq("id", f.salonA);
    const tooSoon = await book(new Date(Date.now() + 5 * 60_000), "96171000020", f.otherStaffId);
    expect(tooSoon.error?.code).toBe("P0010");
    await admin.from("salons").update({ min_lead_time_min: 0 }).eq("id", f.salonA);

    const start = futureSlot(14, 12);
    const { data: booking } = await book(start, "96171000021", f.otherStaffId);
    const { data: viaToken } = await admin.rpc("booking_by_token", { p_token: booking!.manage_token });
    expect(viaToken?.[0]?.id).toBe(booking!.id);

    const { data: cancelled, error } = await admin.rpc("cancel_booking_by_token", {
      p_token: booking!.manage_token,
      p_reason: "changed my mind",
    });
    expect(error).toBeNull();
    expect(cancelled?.status).toBe("cancelled");
    const { data: reminders } = await admin
      .from("notifications")
      .select("status")
      .eq("booking_id", booking!.id)
      .in("kind", ["booking_reminder_24h", "booking_reminder_2h"]);
    expect(reminders?.every((n) => n.status === "cancelled")).toBe(true);

    const again = await admin.rpc("cancel_booking_by_token", { p_token: booking!.manage_token });
    expect(again.error?.code).toBe("P0020");
  });
});
