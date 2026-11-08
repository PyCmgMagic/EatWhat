import { expect, it } from "vitest";
import { demoGrowth, type DemoGrowth } from "./growth";

it("awards once per Shanghai business day even when growth reads and reports race", () => {
  const state: DemoGrowth = { entries: [] },
    before = new Date("2026-11-07T15:59:59Z"),
    after = new Date("2026-11-07T16:00:00Z");
  expect(demoGrowth(state, "/user/activity", {}, before)).toMatchObject({
    firstUseToday: true,
    experienceAdded: 5,
    businessDate: "2026-11-07",
  });
  expect(demoGrowth(state, "/user/activity", {}, before)).toMatchObject({
    firstUseToday: false,
    experienceAdded: 0,
  });
  expect(demoGrowth(state, "/user/growth", {}, after)).toMatchObject({
    totalExperience: 10,
  });
  expect(demoGrowth(state, "/user/activity", {}, after)).toMatchObject({
    firstUseToday: false,
    experienceAdded: 0,
  });
  expect(
    demoGrowth(state, "/user/growth/ledger", { page: 2, pageSize: 1 }, after),
  ).toMatchObject({
    currentPage: 2,
    totalItems: 2,
    hasNext: false,
    items: [{ businessDate: "2026-11-07" }],
  });
});
it("counts unique demo users rather than summing daily records, without awarding on admin reads", () => {
  const state: DemoGrowth = {
    entries: [
      { businessDate: "2026-10-31", experience: 5 },
      { businessDate: "2026-11-01", experience: 5 },
      { businessDate: "2026-11-02", experience: 5 },
    ],
  };
  expect(
    demoGrowth(
      state,
      "/admin/engagement/stats",
      { date: "2026-11-03" },
      new Date("2026-11-08T00:00:00Z"),
    ),
  ).toMatchObject({
    dailyActiveUsers: 0,
    monthlyActiveUsers: 1,
    rolling30ActiveUsers: 1,
  });
  expect(state.entries).toHaveLength(3);
});
