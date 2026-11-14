import { describe, expect, it } from "vitest";
import { mealSlotAt, mealSlotEnd } from "./food-display";

// Beijing is UTC+8, so 05:00 Beijing is 21:00 UTC the day before.
const beijing = (hhmm: string) => Date.parse(`2026-11-14T${hhmm}:00+08:00`);

describe("meal slots", () => {
  it("uses the backend's Beijing-time boundaries", () => {
    expect(mealSlotAt(beijing("04:59"))).toBe("night");
    expect(mealSlotAt(beijing("05:00"))).toBe("breakfast");
    expect(mealSlotAt(beijing("09:59"))).toBe("breakfast");
    expect(mealSlotAt(beijing("10:00"))).toBe("lunch");
    expect(mealSlotAt(beijing("14:00"))).toBe("dinner");
    expect(mealSlotAt(beijing("20:30"))).toBe("dinner");
    expect(mealSlotAt(beijing("21:00"))).toBe("night");
    expect(mealSlotAt(beijing("00:30"))).toBe("night");
  });

  it("ends a slot at its next boundary, across midnight for night", () => {
    expect(mealSlotEnd(beijing("15:20"))).toBe(beijing("21:00"));
    expect(mealSlotEnd(beijing("10:00"))).toBe(beijing("14:00"));
    expect(mealSlotEnd(beijing("22:10"))).toBe(
      Date.parse("2026-11-15T05:00:00+08:00"),
    );
  });
});
