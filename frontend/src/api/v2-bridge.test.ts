import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createRequester,
  unavailable,
  type Envelope,
} from "./client";
import { classifyAuth, createApi } from "./service";
import { bridgeToV2, DINE_IN_SHOPS, pictureKey } from "./v2-bridge";

const consent = vi.hoisted(() => ({ answer: true, asked: [] as string[] }));
const duplicate = vi.hoisted(() => ({
  answer: null as { id: number } | "new" | null,
  shown: [] as unknown[],
}));
vi.mock("../app/duplicate-shop", () => ({
  askDuplicateShop: async (shops: unknown[]) => {
    duplicate.shown.push(shops);
    return duplicate.answer;
  },
}));
vi.mock("../app/policy-consent", () => ({
  askPolicyConsent: async (_policy: unknown, reason: string) => {
    consent.asked.push(reason);
    return consent.answer;
  },
}));

type Sent = {
  path: string;
  method: string;
  body?: any;
  query?: any;
  headers?: any;
};
function backend(reply: (sent: Sent) => Envelope<unknown> | undefined) {
  const sent: Sent[] = [];
  const transport = bridgeToV2(async (path, options) => {
    const request = {
      path,
      method: options.method ?? "GET",
      body: options.body,
      query: options.query,
      headers: options.headers,
    };
    sent.push(request);
    return reply(request) ?? { code: 0, msg: "ok", data: null };
  });
  return { sent, request: createRequester(transport), transport };
}
const ok = (data: unknown) => ({ code: 0, msg: "ok", data });
const PIC = "https://cdn.example.com/foods/2026/11/a b.webp";

beforeEach(() => {
  consent.answer = true;
  consent.asked = [];
});

describe("v2 bridge", () => {
  it.each([true, false, undefined])(
    "preserves the phone registration signal (%s) and establishes a session",
    async (newUser) => {
      const { transport, sent } = backend(() =>
        ok({
          tokenName: "satoken",
          tokenValue: "demo-session",
          ...(newUser === undefined ? {} : { newUser }),
        }),
      );
      const reply = await createApi(transport).phoneLogin({
        mobile: "13800000000",
        code: "123456",
        device: "WEB",
      });
      expect(
        reply.data && "newUser" in reply.data ? reply.data.newUser : undefined,
      ).toBe(newUser);
      expect(classifyAuth(reply).kind).toBe("session");
      expect(sent[0].path).toBe("/auth/phone/login");
    },
  );

  it("signs in with a carrier token without sending a mobile number or deletion key", async () => {
    const { transport, sent } = backend(() =>
      ok({ tokenName: "satoken", tokenValue: "web-one-click-session" }),
    );
    const headers = {
      "X-Phone-Auth-Trace": crypto.randomUUID(),
      "X-Phone-Auth-Timing": "sdk=1,token=2,environment=3,carrier=4",
    };
    const reply = await createApi(transport).webOneClickLogin(
      {
        spToken: "sp-1",
      },
      headers,
    );
    expect(classifyAuth(reply).kind).toBe("session");
    const login = sent.find(
      (s) => s.path === "/auth/phone/web-one-click/login",
    )!;
    expect(login.body).toMatchObject({
      spToken: "sp-1",
    });
    expect(login.body).not.toHaveProperty("deletionKey");
    expect(login.body).not.toHaveProperty("mobile");
    expect(login.headers).toMatchObject(headers);
  });

  it("recovers upload keys from v2 public picture URLs", () => {
    expect(pictureKey(PIC.replace(" ", "%20"))).toBe("foods/2026/11/a b.webp");
    expect(pictureKey("foods/2026/11/x.png")).toBe("foods/2026/11/x.png");
    expect(pictureKey("https://cdn.example.com/other.png")).toBeUndefined();
  });

  it("returns dishes in the APIv7 shape", async () => {
    const { request } = backend(() =>
      ok({
        id: 7,
        restaurantId: 2,
        restaurantName: "一口面馆",
        accountId: 9,
        name: "牛肉面",
        category: "主食",
        price: 22,
        pictureUrls: [PIC],
        pictureKeys: ["foods/original.webp"],
        tags: ["辣"],
        signature: true,
        likeCount: 12,
        favoriteCount: 3,
        isLiked: true,
        createdAt: 1,
        updatedAt: 2,
      }),
    );
    const dish = await request<any>("/foods/detail/7");
    expect(dish).toMatchObject({
      category: "staple",
      categoryLabel: "主食",
      pictureUrl: [PIC],
      pictureKeys: ["foods/original.webp"],
      likesCount: 12,
      user: { id: 9 },
      systemTags: [{ id: 1, name: "辣" }],
      myCustomTags: [],
    });
  });

  it("maps a new dish onto the v2 upload body", async () => {
    const { request, sent } = backend(() => ok({ id: 31 }));
    const result = await request<any>("/foods/upload", {
      method: "POST",
      body: {
        restaurantId: 2,
        name: "酸辣粉",
        category: "dessert",
        price: 12,
        pictureUrl: ["foods/2026/11/x.png", PIC],
        systemTagIds: [1, 4],
        myCustomTagNames: ["清淡", "好吃"],
        mealTimes: ["lunch"],
        deliveryEnabled: true,
        stageColor: "chili",
      },
    });
    expect(result).toEqual({
      id: 31,
      moderationStatus: null,
      revisionId: null,
    });
    expect(sent[0]).toMatchObject({
      path: "/foods/upload",
      method: "POST",
      body: {
        restaurantId: 2,
        name: "酸辣粉",
        category: "饮品甜品",
        price: 12,
        description: "",
        pictures: ["foods/2026/11/x.png", "foods/2026/11/a b.webp"],
        tags: ["辣", "酸", "清淡"],
        signature: false,
      },
    });
    // The dish's own meal times and delivery flag go to v2 as they are.
    expect(sent[0].body).toMatchObject({
      mealTimes: ["lunch"],
      deliveryEnabled: true,
    });
  });

  it.each(["Maycry", "", null])(
    "keeps the dish author's avatar even with display name %j",
    async (displayName) => {
      const { transport, sent } = backend(({ path }) =>
        path === "/user/userInfo"
          ? ok({ id: 21, displayName, avatar: PIC })
          : ok({ id: 7, accountId: 21, name: "甜品" }),
      );
      const dish = await createApi(transport).food(7);
      expect(dish.user).toEqual({ id: 21, displayName, avatar: PIC });
      expect(sent.map((s) => s.path)).toEqual([
        "/foods/detail/7",
        "/user/userInfo",
      ]);
      expect(sent[1].query).toEqual({ userId: 21 });
    },
  );

  it("still opens the dish when the author's profile is unavailable", async () => {
    const { transport } = backend(({ path }) =>
      path === "/user/userInfo"
        ? { code: 40401, msg: "用户不可用", data: null }
        : ok({ id: 7, accountId: 21, name: "甜品" }),
    );
    expect(await createApi(transport).food(7)).toMatchObject({
      id: 7,
      name: "甜品",
      user: { id: 21, displayName: null },
    });
  });

  it("leaves a dish's meal times and delivery alone unless the form sets them", async () => {
    const { request, sent } = backend(({ path }) =>
      path === "/foods/detail/5"
        ? ok({
            id: 5,
            name: "豆浆",
            category: "饮品甜品",
            mealTimes: ["breakfast"],
            effectiveMealTimes: ["breakfast"],
            deliveryEnabled: true,
          })
        : ok({ id: 5 }),
    );
    await request("/foods/my/5", { method: "PUT", body: { name: "热豆浆" } });
    expect(sent.at(-1)!.body).not.toHaveProperty("mealTimes");
    expect(sent.at(-1)!.body).not.toHaveProperty("deliveryEnabled");
    // [] puts the dish back on its shop's meal times; false turns delivery off.
    await request("/foods/my/5", {
      method: "PUT",
      body: { mealTimes: [], deliveryEnabled: false },
    });
    expect(sent.at(-1)!.body).toMatchObject({
      mealTimes: [],
      deliveryEnabled: false,
    });
    expect(await request<any>("/foods/detail/5")).toMatchObject({
      mealTimes: ["breakfast"],
      effectiveMealTimes: ["breakfast"],
      deliveryEnabled: true,
    });
  });

  it("edits an owner's dish through the v2 edit endpoint without blanks", async () => {
    const pictureKeys = ["foods/2026/11/a b.webp"];
    const { request, sent } = backend(() => ok({ id: 7, revisionId: 3, pictureKeys }));
    const result = await request("/foods/my/7", {
      method: "PUT",
      body: { name: "牛肉面", category: "staple", pictureUrl: [PIC] },
    });
    expect(result).toMatchObject({ id: 7, revisionId: 3, pictureKeys });
    expect(sent[0].path).toBe("/foods/edit/7");
    expect(sent[0].method).toBe("PUT");
    expect(sent[0].body).toEqual({
      name: "牛肉面",
      category: "主食",
      price: null,
      pictures: ["foods/2026/11/a b.webp"],
    });
  });

  it("keeps v2-only shop fields when the old form edits a shop", async () => {
    const { request, sent } = backend(({ method }) =>
      method === "GET"
        ? ok({
            id: 3,
            poi: "B000",
            kind: "drink",
            mealTimes: ["night"],
            priceBand: "OVER_30",
            categories: ["粉面"],
            tags: ["甜"],
            deliveryEnabled: true,
          })
        : ok({ id: 3 }),
    );
    await request("/restaurant/edit/3", {
      method: "PUT",
      body: { name: "新店名", address: "路 1 号", gcjLng: 1, gcjLat: 2 },
    });
    expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual([
      "GET /restaurant/detail/3",
      "PUT /restaurant/edit/3",
    ]);
    expect(sent[1].body).toMatchObject({
      name: "新店名",
      poi: "B000",
      kind: "drink",
      mealTimes: ["night"],
      priceBand: "OVER_30",
      categories: ["粉面"],
      tags: ["甜"],
    });
    // Delivery is a read-only summary of the shop's dishes in v2.
    expect(sent[1].body).not.toHaveProperty("deliveryEnabled");
  });

  it("never invents a price band for a shop that has none", async () => {
    const { request, sent } = backend(({ method }) =>
      method === "GET"
        ? ok({ id: 4, kind: "food", priceBand: null, mealTimes: ["lunch"] })
        : ok({ id: 4 }),
    );
    await request("/restaurant/edit/4", {
      method: "PUT",
      body: { name: "店", address: "路 2 号", gcjLng: 1, gcjLat: 2 },
    });
    expect(sent[1].body.priceBand).toBeNull();
  });

  it.each(["/foods/1/comments", "/comments/5/replies"])(
    "preserves the author's profile details in %s",
    async (path) => {
      const { request } = backend(() =>
        ok({
          items: [
            {
              id: 5,
              author: {
                id: 21,
                displayName: "小山",
                avatar: PIC,
                title: "美食家",
              },
            },
            { id: 6, author: null },
          ],
        }),
      );
      const list = await request<any>(path);
      expect(list.items[0]).toMatchObject({
        authorId: 21,
        authorName: "小山",
        authorAvatar: PIC,
        authorTitle: "美食家",
      });
      expect(list.items[1]).toMatchObject({
        authorId: null,
        authorAvatar: null,
      });
    },
  );

  it("answers comment like state from the list and tracks changes", async () => {
    const { request } = backend(({ path }) =>
      path.endsWith("/comments")
        ? ok({
            items: [
              {
                id: 5,
                likeCount: 2,
                isLiked: false,
                createdAt: 0,
                author: { displayName: "小山" },
              },
            ],
          })
        : ok(null),
    );
    const list = await request<any>("/foods/1/comments");
    expect(list.items[0]).toMatchObject({
      authorName: "小山",
      likesCount: 2,
      createdAt: "1970-01-01T00:00:00.000Z",
    });
    expect(await request("/comments/5/like")).toMatchObject({
      liked: false,
      likesCount: 2,
    });
    expect(await request("/comments/5/like", { method: "PUT" })).toMatchObject({
      liked: true,
      likesCount: 3,
    });
  });

  it("forwards unchanged endpoints with their query and body", async () => {
    const { request, sent } = backend(() => undefined);
    await request("/auth/phone/code", {
      method: "POST",
      body: { mobile: "13800000000" },
      headers: { "X-Captcha-Ticket": "t", "X-Captcha-Randstr": "r" },
    });
    await request("/user/follow", { method: "POST", query: { userId: 3 } });
    expect(sent).toMatchObject([
      {
        path: "/auth/phone/code",
        method: "POST",
        body: { mobile: "13800000000" },
      },
      { path: "/user/follow", method: "POST", query: { userId: 3 } },
    ]);
  });

  it("loads the admin dish list across meal times with server pagination", async () => {
    const { transport, sent } = backend(() =>
      ok({
        currentPage: 2,
        totalItems: 13,
        items: [{ id: 7, name: "早餐豆浆", uploaderName: "豆浆同学", category: "饮品甜品", pictureUrls: [PIC] }],
      }),
    );
    const result = await createApi(transport).adminFoods(undefined, 2, {
      keyword: "豆浆",
      sort: "NEWEST",
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].path).toBe("/admin/foods/list");
    expect(sent[0].query).toEqual({ page: 2, pageSize: 12, keyword: "豆浆", sort: "NEWEST" });
    expect(result).toMatchObject({ totalItems: 13, items: [{ id: 7, name: "早餐豆浆", uploaderName: "豆浆同学" }] });
  });

  it("serves a category tab from the dish list without using up recommendations", async () => {
    const { request, sent } = backend(({ path }) =>
      path === "/foods/list"
        ? ok({
            items: [{ id: 1, category: "饮品甜品", pictureUrls: [], tags: [] }],
          })
        : ok({ items: [] }),
    );
    const dishes = await request<any[]>("/foods/recommend", {
      query: {
        size: 8,
        campusId: 1,
        mealTime: "afternoon_tea",
        scene: "delivery",
        category: "dessert",
      },
    });
    expect(sent.map((s) => s.path)).toEqual(["/foods/list"]);
    expect(sent[0].query).toMatchObject({
      category: "饮品甜品",
      mealTime: "afternoon_tea",
      scene: "delivery",
    });
    await request<any[]>("/foods/recommend", {
      query: { size: 8, category: "dessert" },
    });
    expect(sent[1].query).toMatchObject({ scene: "dine_in" });
    expect(sent[0].query).not.toHaveProperty("campusId");
    expect(dishes[0]).toMatchObject({
      id: 1,
      category: "dessert",
      categoryLabel: "饮品甜品",
    });
  });

  it("shows earned likes from v2 and counts shared dishes", async () => {
    const { request } = backend(({ path }) =>
      path === "/user/userInfo"
        ? ok({ id: 7, displayName: "食友", level: 2, earnedLikes: 4 })
        : ok({ items: [], totalItems: 3 }),
    );
    const user = await request<any>("/user/userInfo", {
      query: { userId: 7 },
    });
    expect(user).toMatchObject({ earnedLikes: 4, uploadedFoodsCount: 3 });
  });

  it("asks for delivery recommendations without padding them with other shops' dishes", async () => {
    const { request, sent } = backend(({ path }) =>
      path === "/recommend"
        ? ok({
            items: [
              {
                id: 9,
                name: "一口面馆",
                signatureFoods: [{ id: 2, name: "牛肉面", price: 22 }],
              },
            ],
            mealTime: "night",
          })
        : ok({ items: [{ id: 5, category: "菜", pictureUrls: [], tags: [] }] }),
    );
    const feed = await request<any>("/foods/recommend", {
      query: { size: 4, campusId: 1, scene: "delivery" },
    });
    expect(sent.map((s) => s.path)).toEqual(["/recommend"]);
    // No mealTime: the backend picks the slot and says which one it used.
    expect(sent[0].query).toEqual({ scene: "delivery" });
    expect(feed.items.map((d: any) => d.id)).toEqual([2]);
    expect(feed.mealTime).toBe("night");
  });

  it("lists recommended dine-in shops and puts one signature dish per shop in the carousel", async () => {
    const { request, sent } = backend(({ path }) =>
      path === "/recommend"
        ? ok({
            mealTime: "lunch",
            items: [
              {
                id: 9,
                name: "一口面馆",
                dineIn: { rate: 0.9, count: 8 },
                signatureFoods: [
                  { id: 2, name: "牛肉面", price: 22, pictureUrl: PIC },
                  { id: 4, name: "炸酱面", price: 18, pictureUrl: PIC },
                ],
              },
              // No signature dish yet: listed, but nothing for the carousel.
              { id: 10, name: "南门砂锅", signatureFoods: [] },
            ],
          })
        : ok({ items: [{ id: 3, category: "汤", pictureUrls: [], tags: [] }] }),
    );
    const feed = await request<{
      items: any[];
      shops: any[];
      mealTime: string;
    }>("/foods/recommend", {
      query: {
        size: 8,
        campusId: 1,
        mealTime: "lunch",
        scene: "dine_in",
        deviceId: "abcdefgh",
        gcjLng: 117.134,
        gcjLat: 36.667,
      },
    });
    // Scene, the selected area's point and meal go along; the device id stays behind.
    expect(sent.find((s) => s.path === "/recommend")?.query).toEqual({
      scene: "dine_in",
      mealTime: "lunch",
      gcjLng: 117.134,
      gcjLat: 36.667,
      page: 1,
      pageSize: DINE_IN_SHOPS,
    });
    // Every shop the ranking returned is listed, with its signature dishes.
    expect(feed.shops.map((s) => s.id)).toEqual([9, 10]);
    expect(feed.shops[0]).toMatchObject({
      dineIn: { rate: 0.9, count: 8 },
      signatureFoods: [
        { id: 2, name: "牛肉面", coverUrl: PIC },
        { id: 4, name: "炸酱面" },
      ],
    });
    // Carousel: the first signature dish of each shop, no newest-dish filler.
    expect(feed.items.map((d) => d.id)).toEqual([2]);
    expect(feed.items[0]).toMatchObject({
      restaurantId: 9,
      restaurantName: "一口面馆",
      pictureUrl: [PIC],
    });
    expect(sent.some((s) => s.path === "/foods/list")).toBe(false);
    expect(feed.mealTime).toBe("lunch");
  });

  it("rates a dish 1-5 and reads the rating back on dishes and featured dishes", async () => {
    const { transport, sent } = backend(({ path, method }) =>
      path === "/foods/2/rating"
        ? ok({
            myRating: method === "PUT" ? 4 : null,
            rating: { score: method === "PUT" ? 4.5 : 5, count: 2 },
          })
        : path === "/foods/detail/2"
          ? ok({
              id: 2,
              name: "牛肉面",
              category: "主食",
              rating: { score: 4.5, count: 2 },
              myRating: 4,
            })
          : path === "/recommend"
            ? ok({
                mealTime: "lunch",
                items: [
                  {
                    id: 9,
                    name: "一口面馆",
                    signatureFoods: [
                      {
                        id: 2,
                        name: "牛肉面",
                        signature: true,
                        rating: { score: 4.5, count: 2 },
                      },
                      { id: 4, name: "炸酱面", signature: false },
                    ],
                  },
                ],
              })
            : undefined,
    );
    const api = createApi(transport);
    expect(await api.rateFood(2, 4)).toEqual({
      myRating: 4,
      rating: { score: 4.5, count: 2 },
    });
    expect(sent.at(-1)).toMatchObject({
      path: "/foods/2/rating",
      method: "PUT",
      body: { score: 4 },
    });
    expect((await api.unrateFood(2)).myRating).toBeNull();
    expect(sent.at(-1)).toMatchObject({
      path: "/foods/2/rating",
      method: "DELETE",
    });
    expect(await api.food(2)).toMatchObject({
      rating: { score: 4.5, count: 2 },
      myRating: 4,
    });
    const feed = await api.recommendFeed(8, { scene: "dine_in" });
    expect(feed.shops?.[0].signatureFoods).toMatchObject([
      { id: 2, signature: true, rating: { score: 4.5, count: 2 } },
      { id: 4, signature: false, rating: { score: null, count: 0 } },
    ]);
    expect(feed.items[0]).toMatchObject({
      id: 2,
      signature: true,
      rating: { score: 4.5, count: 2 },
    });
  });

  it("keeps the delivery recommendation as signature dishes without shops", async () => {
    const { request, sent } = backend(({ path }) =>
      path === "/recommend"
        ? ok({
            items: [
              {
                id: 9,
                name: "一口面馆",
                signatureFoods: [
                  { id: 2, name: "牛肉面", price: 22, pictureUrl: PIC },
                ],
              },
            ],
          })
        : ok({ items: [] }),
    );
    const feed = await request<{ items: any[]; shops?: any[] }>(
      "/foods/recommend",
      { query: { size: 2, scene: "delivery", gcjLng: 117.1, gcjLat: 36.6 } },
    );
    expect(sent.find((s) => s.path === "/recommend")?.query).toEqual({
      scene: "delivery",
      gcjLng: 117.1,
      gcjLat: 36.6,
    });
    expect(feed.items.map((d) => d.id)).toEqual([2]);
    expect(feed.shops).toBeUndefined();
  });

  it("maps levels, bans, telemetry and stage colours added in backend v2", async () => {
    const { request, sent } = backend(({ path }) => {
      if (path === "/user/level")
        return ok({
          level: 3,
          experience: 120,
          levelExperience: 100,
          nextLevel: 4,
          nextLevelExperience: 250,
          toNextLevel: 130,
          maxLevel: false,
          dailyUseExperience: 5,
        });
      if (path === "/telemetry/consent")
        return ok({ enabled: true, retentionDays: 90 });
      if (path === "/user/info")
        return ok({
          id: 1,
          level: 3,
          banned: true,
          banReason: "刷屏",
          banUntil: 0,
        });
      return ok({ id: 9 });
    });
    expect(await request("/user/growth")).toMatchObject({
      totalExperience: 120,
      level: 3,
      experienceInLevel: 20,
      experienceToNextLevel: 130,
      dailyExperience: 5,
    });
    expect(await request("/telemetry/consent")).toMatchObject({
      enabled: true,
      retentionDays: 90,
    });
    expect(await request("/user/info")).toMatchObject({
      level: 3,
      banned: true,
      banReason: "刷屏",
      banUntil: "1970-01-01T00:00:00.000Z",
    });
    await request("/user/ban/5", {
      method: "POST",
      body: { reason: "广告", banUntil: "2030-01-01T00:00:00.000Z" },
    });
    expect(sent.at(-1)?.body).toEqual({
      reason: "广告",
      banUntil: Date.parse("2030-01-01T00:00:00.000Z"),
    });
    await request("/foods/upload", {
      method: "POST",
      body: {
        restaurantId: 1,
        name: "面",
        category: "staple",
        pictureUrl: ["foods/2026/11/a.png"],
        stageColor: "chili",
        stageAlternates: ["mango", "soy"],
        coverCrop: { centerX: 0.4, centerY: 0.5, diameter: 0.9 },
      },
    });
    expect(sent.at(-1)?.body).toMatchObject({
      stageColor: "chili",
      stageAlternates: ["mango", "soy"],
      coverCrop: { centerX: 0.4, centerY: 0.5, diameter: 0.9 },
    });
  });

  it("sends this device's deletion key when signing in", async () => {
    const store = new Map([["eatwhat-deletion-key", "undo-me"]]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
    const { transport, sent } = backend(() =>
      ok({ tokenName: "satoken", tokenValue: "t" }),
    );
    await transport("/auth/login", {
      method: "POST",
      body: { userName: "a", password: "p", device: "WEB" },
    });
    expect(sent[0].body).toMatchObject({ deletionKey: "undo-me" });
    vi.unstubAllGlobals();
  });

  it("sends this device's install id when signing in and registers the device", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
    const { transport, sent } = backend(() =>
      ok({ tokenName: "satoken", tokenValue: "t" }),
    );
    await transport("/auth/login", {
      method: "POST",
      body: { userName: "a", password: "p", device: "WEB" },
    });
    const id = store.get("eatwhat.installId");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent[0]).toMatchObject({
      path: "/auth/login",
      body: { installId: id },
    });
    await vi.waitFor(() =>
      expect(
        sent.find((s) => s.path === "/device/register")?.body,
      ).toMatchObject({
        installId: id,
        platform: "web",
      }),
    );
    await transport("/telemetry/events", {
      method: "POST",
      body: { events: [] },
    });
    expect(sent.at(-1)).toMatchObject({
      path: "/telemetry/events",
      body: { installId: id },
    });
    vi.unstubAllGlobals();
  });

  it("reports retired features as unavailable", async () => {
    const { request, sent } = backend(() => undefined);
    const error = await request("/user/cancellation", { method: "POST" }).catch(
      (e) => e,
    );
    expect(unavailable(error)).toBe(true);
    expect(await request("/topics/by-food/1")).toEqual([]);
    expect(sent).toHaveLength(0);
  });

  it("reports the missing hometown dictionaries without calling v2", async () => {
    const { transport, sent } = backend(() => undefined);
    const api = createApi(transport);
    for (const lookup of [() => api.provinces(), () => api.cities(1)]) {
      await expect(lookup()).rejects.toMatchObject({
        code: "FEATURE_RETIRED",
        status: 404,
      });
    }
    expect(sent).toHaveLength(0);
  });

  it("asks for policy consent at sign-in and retries with the version", async () => {
    const { transport, sent } = backend(({ path, body }) =>
      path === "/auth/consent/policy"
        ? ok({ version: "v3" })
        : body?.policyVersion === "v3"
          ? ok({ tokenName: "satoken", tokenValue: "t" })
          : { code: 20005, msg: "请同意当前政策。", data: null },
    );
    const reply = await transport("/auth/login", {
      method: "POST",
      body: { userName: "xiaoshan", password: "p", device: "WEB" },
      raw: true,
    });
    expect(consent.asked).toEqual(["login"]);
    expect(reply.data).toMatchObject({ isLogin: true, tokenValue: "t" });
    expect(
      sent.filter((s) => s.path === "/auth/login").at(-1)?.body,
    ).toMatchObject({ policyVersion: "v3" });

    consent.answer = false;
    const declined = await transport("/auth/login", {
      method: "POST",
      body: { userName: "xiaoshan", password: "p", device: "WEB" },
    });
    expect(declined.code).toBe("POLICY_DECLINED");
  });

  it("re-agrees to an updated policy and repeats the request", async () => {
    let agreed = false;
    const { request, sent } = backend(({ path }) => {
      if (path === "/auth/consent/policy") return ok({ version: "v4" });
      if (path === "/auth/consent/grant") {
        agreed = true;
        return ok({ agreedVersion: "v4" });
      }
      return agreed
        ? ok({ id: 1, role: "user" })
        : { code: 20009, msg: "请同意当前政策。", data: null };
    });
    expect(await request<any>("/user/info")).toMatchObject({ id: 1 });
    expect(consent.asked).toEqual(["update"]);
    expect(sent.find((s) => s.path === "/auth/consent/grant")).toMatchObject({
      method: "POST",
      body: { policyVersion: "v4" },
    });
  });

  it("keeps business errors as envelopes", async () => {
    const { request } = backend(() => ({
      code: 40016,
      msg: "重复",
      data: { id: 3 },
    }));
    const error = await request("/foods/upload", {
      method: "POST",
      body: { category: "staple" },
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 40016, data: { id: 3 } });
  });

  describe("possible duplicate shops (40017)", () => {
    const shop = { name: "一口面馆", address: "南门", gcjLng: 117, gcjLat: 36 };
    const reply = (sent: Sent) =>
      sent.path === "/restaurant/add" && !sent.body.force
        ? {
            code: 40017,
            msg: "这家店可能已经有了",
            data: { duplicates: [{ id: 5, name: "一口面馆", closed: false }] },
          }
        : sent.path === "/restaurant/add"
          ? ok({ id: 9 })
          : undefined;

    it("uses the shop the person picked", async () => {
      duplicate.answer = { id: 5 };
      duplicate.shown = [];
      const { request, sent } = backend(reply);
      const result: any = await request("/restaurant/add", {
        method: "POST",
        body: shop,
      });
      expect(result.id).toBe(5);
      expect(duplicate.shown[0]).toMatchObject([
        { id: 5, permanentlyClosed: false },
      ]);
      expect(sent.filter((s) => s.path === "/restaurant/add")).toHaveLength(1);
    });

    it("adds anyway with force when the person insists", async () => {
      duplicate.answer = "new";
      const { request, sent } = backend(reply);
      const picture = "restaurants/2026/11/storefront.jpg";
      const result: any = await request("/restaurant/add", {
        method: "POST",
        body: { ...shop, pictureUrl: [picture] },
      });
      expect(result.id).toBe(9);
      expect(sent.at(-1)?.body).toMatchObject({
        name: "一口面馆",
        picture,
        force: true,
      });
    });

    it("stops when the person goes back", async () => {
      duplicate.answer = null;
      const { request } = backend(reply);
      const error = await request("/restaurant/add", {
        method: "POST",
        body: shop,
      }).catch((e) => e);
      expect(error).toMatchObject({ code: "DUPLICATE_DECLINED" });
    });
  });

  it("lists the dish that matched a shop search", async () => {
    const { request } = backend(() =>
      ok({
        items: [
          {
            id: 2,
            name: "一口面馆",
            matchedFood: { id: 7, name: "牛肉面", price: 22 },
          },
        ],
      }),
    );
    const page: any = await request("/restaurant/search", {
      query: { keyword: "牛肉" },
    });
    expect(page.items[0].matchedFoods).toEqual([
      { id: 7, restaurantId: 2, name: "牛肉面", price: 22 },
    ]);
  });

  it("names signed-in devices and keeps the last-use time", async () => {
    const { request } = backend(() =>
      ok({
        devices: [
          {
            sessionId: "a",
            device: "WEB",
            name: "Chrome · macOS",
            lastActiveAt: "2026-11-14T02:00:00Z",
          },
        ],
        nextCursor: null,
      }),
    );
    const v: any = await request("/auth/sessions");
    expect(v.devices[0]).toMatchObject({
      name: "Chrome · macOS",
      lastSeenAt: "2026-11-14T02:00:00Z",
    });
  });

  it("sends the admin's delete reason", async () => {
    const { request, sent } = backend(() => undefined);
    await request("/foods/delete/7", {
      method: "DELETE",
      body: { reason: "图片与菜品不符" },
    });
    expect(sent[0]).toMatchObject({
      path: "/foods/delete/7",
      method: "DELETE",
      body: { reason: "图片与菜品不符" },
    });
  });

  it("lists my comments from v2 /comments/my as published", async () => {
    const { request, sent } = backend(() =>
      ok({
        items: [
          {
            id: 4,
            foodId: 7,
            rootId: 2,
            text: "好吃",
            pictureUrls: [PIC],
            createdAt: 0,
          },
        ],
      }),
    );
    const v: any = await request("/comments/submissions/my", {
      query: { page: 1, pageSize: 20 },
    });
    expect(sent[0].path).toBe("/comments/my");
    expect(v.items[0]).toMatchObject({
      id: 4,
      foodId: 7,
      kind: "REPLY",
      moderationStatus: "APPROVED",
      text: "好吃",
      imageCount: 1,
    });
  });

  it("adapts /foods/likes and forwards buffet kind on restaurant search", async () => {
    const { request, sent } = backend(({ path }) => {
      if (path === "/foods/likes")
        return ok({
          items: [
            {
              id: 8,
              name: "自助小火锅",
              category: "主食",
              price: 39,
              pictureUrls: [PIC],
              tags: [],
              likeCount: 6,
              isLiked: true,
              isFavorite: false,
            },
          ],
          hasNext: false,
          totalItems: 1,
        });
      return ok({
        items: [{ id: 12, name: "校园自助", kind: "buffet", mealTimes: [] }],
        hasNext: false,
        totalItems: 1,
      });
    });
    const likes: any = await request("/foods/likes", {
      query: { page: 2, pageSize: 12 },
    });
    expect(sent[0]).toMatchObject({
      path: "/foods/likes",
      query: { page: 2, pageSize: 12 },
    });
    expect(likes.items[0]).toMatchObject({
      id: 8,
      name: "自助小火锅",
      isLiked: true,
      likesCount: 6,
    });
    const shops: any = await request("/restaurant/search", {
      query: { kind: "buffet", page: 1, pageSize: 12 },
    });
    expect(sent[1]).toMatchObject({
      path: "/restaurant/search",
      query: { kind: "buffet", page: 1, pageSize: 12 },
    });
    expect(shops.items[0]).toMatchObject({ id: 12, kind: "buffet" });
  });
});
