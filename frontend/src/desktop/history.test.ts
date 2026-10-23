import { expect, it } from "vitest";
import { historyEntry, historyGroups, historyTime } from "./history";

it("recognises epoch seconds and milliseconds without changing the calendar instant", () => {
  const now = new Date(2026, 9, 23, 12).getTime();
  expect(historyTime(now, now)?.getTime()).toBe(now);
  expect(historyTime(now / 1000, now)?.getTime()).toBe(now);
  expect(historyTime(0, now)).toBeUndefined();
  expect(historyTime(NaN, now)).toBeUndefined();
  expect(historyTime(now + 86400000, now)).toBeUndefined();
});
it("groups by local calendar day, including yesterday at a month boundary", () => {
  const now = new Date(2026, 9, 1, 12).getTime();
  const groups = historyGroups(
    [
      { viewedAt: new Date(2026, 8, 30, 23).getTime() },
      { viewedAt: now },
      { viewedAt: null },
    ],
    now,
  );
  expect(groups.map((g) => g.label)).toEqual(["今天", "昨天", "时间待确认"]);
});
it("never links unavailable, unsafe, conflicting or unknown history targets", () => {
  expect(
    historyEntry({ targetId: 1, food: null }, "food").href,
  ).toBeUndefined();
  expect(
    historyEntry({ targetId: 1, food: { id: 2, name: "不匹配" } }, "food").href,
  ).toBeUndefined();
  expect(
    historyEntry(
      { targetId: Number.MAX_SAFE_INTEGER + 1, food: { name: "溢出" } },
      "food",
    ).href,
  ).toBeUndefined();
  expect(
    historyEntry({ targetType: "unknown", targetId: 1 }, "food").href,
  ).toBeUndefined();
});
it("keeps food and restaurant IDs in their respective routes", () => {
  expect(
    historyEntry(
      { targetType: "food", targetId: 7, food: { id: 7, name: "一碗面" } },
      "food",
    ).href,
  ).toBe("/foods/7");
  expect(
    historyEntry(
      {
        targetType: "restaurant",
        targetId: 7,
        restaurant: { id: 7, name: "面馆" },
      },
      "restaurant",
    ).href,
  ).toBe("/restaurants/7");
});
