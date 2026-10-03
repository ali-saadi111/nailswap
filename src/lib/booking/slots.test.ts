import { describe, it, expect } from "vitest";
import { computeSlots, findNextAvailableDate, bookingDuration, bookingPrice, type SlotQuery } from "./slots";

const tz = "Asia/Beirut";
// 2026-09-30 is a Wednesday (weekday 3). Beirut is UTC+3 in September (EEST).
const date = "2026-09-30";
const now = new Date("2026-09-29T12:00:00Z");

const hours = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  open_time: "10:00",
  close_time: "19:00",
  is_closed: weekday === 0,
}));

function staff(id: string, extra: Partial<SlotQuery["staff"][number]> = {}) {
  return {
    id,
    rules: [
      { weekday: 3, kind: "work" as const, start_time: "10:00", end_time: "18:00" },
      { weekday: 3, kind: "break" as const, start_time: "13:00", end_time: "14:00" },
    ],
    timeOff: [],
    bookings: [],
    ...extra,
  };
}

function base(over: Partial<SlotQuery> = {}): SlotQuery {
  return {
    date,
    timezone: tz,
    salonHours: hours,
    holidays: [],
    staff: [staff("a")],
    durationMin: 60,
    bufferMin: 0,
    slotIntervalMin: 30,
    minLeadTimeMin: 60,
    now,
    ...over,
  };
}

const local = (t: string) => new Date(`${date}T${t}:00+03:00`);

describe("computeSlots", () => {
  it("produces slots inside working hours minus breaks", () => {
    const slots = computeSlots(base());
    const starts = slots.map((s) => s.startsAt.toISOString());
    expect(starts[0]).toBe(local("10:00").toISOString());
    // Last slot must end by 18:00 (staff end) → 17:00 start
    expect(starts.at(-1)).toBe(local("17:00").toISOString());
    // 12:30 would overlap the 13:00 break (60-min service) → excluded; 13:00 and 13:30 excluded too
    expect(starts).not.toContain(local("12:30").toISOString());
    expect(starts).not.toContain(local("13:00").toISOString());
    expect(starts).not.toContain(local("13:30").toISOString());
    expect(starts).toContain(local("14:00").toISOString());
    expect(starts).toContain(local("12:00").toISOString());
  });

  it("excludes slots overlapping existing bookings, including buffer", () => {
    const slots = computeSlots(
      base({
        bufferMin: 15,
        staff: [staff("a", { bookings: [{ start: local("15:00"), end: local("16:00") }] })],
      }),
    );
    const starts = slots.map((s) => s.startsAt.toISOString());
    // 14:00 + 60 + 15 buffer = 15:15 overlaps booking → excluded
    expect(starts).not.toContain(local("14:00").toISOString());
    expect(starts).toContain(local("16:00").toISOString());
    expect(starts).not.toContain(local("15:30").toISOString());
  });

  it("returns nothing on holidays and closed days", () => {
    expect(computeSlots(base({ holidays: [date] }))).toEqual([]);
    // Sunday 2026-10-04
    expect(computeSlots(base({ date: "2026-10-04" }))).toEqual([]);
  });

  it("respects minimum lead time", () => {
    const soon = new Date(`${date}T08:30:00Z`); // 11:30 local
    const slots = computeSlots(base({ now: soon, minLeadTimeMin: 60 }));
    const starts = slots.map((s) => s.startsAt.toISOString());
    // Earliest start is 12:30 local; 12:30 itself collides with the 13:00 break (60-min service),
    // so the first bookable slot is 14:00.
    expect(starts).not.toContain(local("12:00").toISOString());
    expect(starts).not.toContain(local("12:30").toISOString());
    expect(starts[0]).toBe(local("14:00").toISOString());

    const relaxed = computeSlots(base({ now: soon, minLeadTimeMin: 30 }));
    const relaxedStarts = relaxed.map((s) => s.startsAt.toISOString());
    expect(relaxedStarts).not.toContain(local("11:30").toISOString());
    expect(relaxedStarts).toContain(local("12:00").toISOString());
  });

  it("merges staff: a slot lists every free technician", () => {
    const slots = computeSlots(
      base({
        staff: [staff("a", { bookings: [{ start: local("10:00"), end: local("11:00") }] }), staff("b")],
      }),
    );
    const ten = slots.find((s) => s.startsAt.getTime() === local("10:00").getTime());
    expect(ten?.staffIds).toEqual(["b"]);
    const eleven = slots.find((s) => s.startsAt.getTime() === local("11:00").getTime());
    expect(eleven?.staffIds.sort()).toEqual(["a", "b"]);
  });

  it("clips to salon closing time even if staff works later", () => {
    const slots = computeSlots(
      base({
        staff: [
          staff("a", { rules: [{ weekday: 3, kind: "work", start_time: "09:00", end_time: "22:00" }] }),
        ],
        durationMin: 90,
      }),
    );
    const starts = slots.map((s) => s.startsAt.toISOString());
    expect(starts[0]).toBe(local("10:00").toISOString());
    expect(starts.at(-1)).toBe(local("17:30").toISOString()); // 17:30 + 90 = 19:00
  });

  it("excludes staff time off", () => {
    const slots = computeSlots(
      base({
        staff: [
          staff("a", { timeOff: [{ start: local("00:00"), end: new Date(`2026-10-01T00:00:00+03:00`) }] }),
        ],
      }),
    );
    expect(slots).toEqual([]);
  });

  it("respects max advance window", () => {
    expect(computeSlots(base({ maxAdvanceDays: 0 }))).toEqual([]);
    expect(computeSlots(base({ maxAdvanceDays: 5 })).length).toBeGreaterThan(0);
  });
});

describe("findNextAvailableDate", () => {
  it("skips closed days", () => {
    // Staff "a" only works Wednesdays; Sunday 10-04 is closed → next Wednesday is 10-07.
    const next = findNextAvailableDate((d) => base({ date: d }), "2026-10-04", 7);
    expect(next).toBe("2026-10-07");
    expect(findNextAvailableDate((d) => base({ date: d }), "2026-10-04", 2)).toBeNull();
  });
});

describe("pricing", () => {
  it("adds design add-ons", () => {
    expect(bookingDuration(45, 15)).toBe(60);
    expect(bookingPrice(25, 10.5)).toBe(35.5);
    expect(bookingPrice(19.99, 0.011)).toBe(20);
  });
});
