import { describe, expect, it, vi } from "vitest";
import { createApi } from "./service";
import type { Transport } from "./client";
import { foodAuthor } from "./models";
import { businessDate, growthPercent, validBusinessDate } from "./growth";

describe("APIv6 requests and read compatibility", () => {
  it("records activity without a body or client-supplied rewards", async () => {
    const send = vi.fn<Transport>(async () => ({
      code: 0,
      data: { experienceAdded: 0 },
    }));
    await createApi(send).recordActivity();
    expect(send).toHaveBeenCalledWith(
      "/user/activity",
      expect.objectContaining({ method: "POST", background: true }),
    );
    expect(send.mock.calls[0][1].body).toBeUndefined();
    expect(send.mock.calls[0][1].query).toBeUndefined();
  });
  it("keeps pagination and an optional statistics date in query parameters", async () => {
    const send = vi.fn<Transport>(async () => ({ code: 0, data: {} })),
      api = createApi(send);
    await api.growth();
    await api.growthLedger(2, 20);
    await api.engagementStats();
    await api.engagementStats("2026-11-07");
    expect(
      send.mock.calls.map(([path, options]) => [path, options.query]),
    ).toEqual([
      ["/user/growth", undefined],
      ["/user/growth/ledger", { page: 2, pageSize: 20 }],
      ["/admin/engagement/stats", { date: undefined }],
      ["/admin/engagement/stats", { date: "2026-11-07" }],
    ]);
    expect(() => api.growthLedger(10001)).toThrow();
    expect(() => api.growthLedger(1, 101)).toThrow();
    expect(() => api.growthLedger(0)).toThrow();
  });
  it.each([false, true])(
    "sends the explicit cancellation content choice %s",
    async (value) => {
      const send = vi.fn<Transport>(async () => ({ code: 0, data: {} }));
      await createApi(send).requestCancellation({
        requestId: "11111111-1111-4111-8111-111111111111",
        recoveryCapability: "test",
        deletePostsAndComments: value,
      });
      expect(send.mock.calls[0][1].body).toMatchObject({
        deletePostsAndComments: value,
      });
    },
  );
  it("prefers the new author and does not link an explicitly unavailable profile", () => {
    expect(
      foodAuthor({
        user: { id: 8, displayName: "新作者" },
        accountId: 9,
        uploaderName: "旧名字",
      }),
    ).toEqual({ id: 8, name: "新作者" });
    expect(
      foodAuthor({ user: null, accountId: 9, uploaderName: "匿名食友" }),
    ).toEqual({ id: undefined, name: "匿名食友" });
    expect(foodAuthor({ accountId: 9, uploaderName: "旧作者" })).toEqual({
      id: 9,
      name: "旧作者",
    });
    expect(
      foodAuthor({ user: { id: -1, displayName: " " } }).id,
    ).toBeUndefined();
  });
  it("uses returned thresholds, handles max level, and does not invent missing progress", () => {
    expect(
      growthPercent({
        experienceInLevel: 25,
        levelStartExperience: 100,
        nextLevelExperience: 200,
      }),
    ).toBe(25);
    expect(growthPercent({ maxLevel: true, nextLevelExperience: null })).toBe(
      100,
    );
    expect(growthPercent({})).toBeUndefined();
    expect(
      growthPercent({
        experienceInLevel: 200,
        levelStartExperience: 0,
        nextLevelExperience: 100,
      }),
    ).toBe(100);
  });
  it("uses Shanghai's day boundary and rejects invalid and future dates", () => {
    expect(businessDate(new Date("2026-11-07T16:00:00Z"))).toBe("2026-11-08");
    expect(validBusinessDate("2026-11-09", "2026-11-08")).toBe(false);
    expect(validBusinessDate("2026-02-30", "2026-11-08")).toBe(false);
    expect(validBusinessDate("2026-11-08", "2026-11-08")).toBe(true);
  });
});
