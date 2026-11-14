import { describe, it, expect } from "vitest";
import { createApi, classifyAuth } from "./service";
import { resultUncertain } from "./client";
import { publishDisplay, stagePalette } from "./food-display";
import { visualFor } from "../mobile/catalog";
describe("latest business contract", () => {
  it("requires an exact valid created ID instead of losing a successful resource", async () => {
    const calls: string[] = [];
    const api = createApi(async (path) => {
      calls.push(path);
      return { code: 0, data: { id: 71 } };
    });
    expect(
      await api.createRestaurant({
        name: "店",
        address: "校区",
        gcjLng: 117,
        gcjLat: 36,
      }),
    ).toEqual({ id: 71, moderationStatus: null, revisionId: null });
    expect(calls).toEqual(["/restaurant/add"]);
  });
  it("treats a success envelope without the created ID as uncertain and never retries automatically", async () => {
    let count = 0;
    const api = createApi(async () => {
      count++;
      return { code: 0, data: {} };
    });
    let failure: unknown;
    try {
      await api.createFood({
        name: "面",
        restaurantId: 1,
        pictureUrl: ["foods/key"],
      });
    } catch (e) {
      failure = e;
    }
    expect(resultUncertain(failure)).toBe(true);
    expect(count).toBe(1);
  });
  it("retains all filters, zero budgets and repeated tag IDs in service calls", async () => {
    const calls: any[] = [];
    const api = createApi(async (path, options) => {
      calls.push({ path, ...options });
      return { code: 0, data: { items: [] } };
    });
    await api.foods(undefined, 2, {
      keyword: "面",
      minPrice: 0,
      maxPrice: 18,
      systemTagIds: [1, 2],
      sort: "PRICE_ASC",
    });
    await api.favorites(1, { myCustomTagIds: [7], category: "staple" });
    expect(calls[0].query).toMatchObject({
      restaurantId: undefined,
      page: 2,
      minPrice: 0,
      maxPrice: 18,
      systemTagIds: [1, 2],
    });
    expect(calls[1].query.myCustomTagIds).toEqual([7]);
  });
  it("uses the public phone flow and keeps state confirmation separate from a real session", async () => {
    const calls: any[] = [];
    const api = createApi(async (path, options) => {
      calls.push({ path, ...options });
      return {
        code: 0,
        data: {
          tokenName: "satoken",
          tokenValue: "mock",
          isLogin: true,
          newUser: true,
        },
      };
    });
    const reply = await api.phoneLogin({
      mobile: "13800000000",
      code: "123456",
      device: "WEB",
    });
    expect(calls[0]).toMatchObject({
      path: "/auth/phone/login",
      public: true,
      raw: true,
    });
    expect(reply.data && "newUser" in reply.data && reply.data.newUser).toBe(
      true,
    );
    expect(classifyAuth(reply).kind).toBe("session");
    expect(
      classifyAuth({ code: 0, data: { newUser: true, identityReady: true } })
        .kind,
    ).toBe("error");
  });
  it("maps display choices to cloud tokens and prioritizes server stage metadata", () => {
    const metadata = publishDisplay(stagePalette.tomato, [
      stagePalette.tomato,
      stagePalette.broth,
    ]);
    expect(metadata).toMatchObject({ stageColor: "tomato" });
    expect(metadata).not.toHaveProperty("mealTimes");
    expect(metadata.stageAlternates).toHaveLength(2);
    expect(new Set(metadata.stageAlternates).size).toBe(2);
    expect(visualFor({ name: "面", stageColor: "tomato" }).stage).toBe(
      stagePalette.tomato,
    );
  });
});
