import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  createRequester,
  unavailable,
  type Envelope,
} from "./client";
import { bridgeToV2, pictureKey } from "./v2-bridge";

const consent = vi.hoisted(() => ({ answer: true, asked: [] as string[] }));
vi.mock("../app/policy-consent", () => ({
  askPolicyConsent: async (_policy: unknown, reason: string) => {
    consent.asked.push(reason);
    return consent.answer;
  },
}));

type Sent = { path: string; method: string; body?: any; query?: any };
function backend(reply: (sent: Sent) => Envelope<unknown> | undefined) {
  const sent: Sent[] = [];
  const transport = bridgeToV2(async (path, options) => {
    const request = {
      path,
      method: options.method ?? "GET",
      body: options.body,
      query: options.query,
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
      pictureKeys: ["foods/2026/11/a b.webp"],
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
    expect(sent[0].body).not.toHaveProperty("mealTimes");
  });

  it("edits an owner's dish through the v2 edit endpoint without blanks", async () => {
    const { request, sent } = backend(() => ok({ id: 7, revisionId: 3 }));
    await request("/foods/my/7", {
      method: "PUT",
      body: { name: "牛肉面", category: "staple", pictureUrl: [PIC] },
    });
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
      deliveryEnabled: true,
    });
  });

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

  it("reports retired features as unavailable", async () => {
    const { request, sent } = backend(() => undefined);
    const error = await request("/user/growth").catch((e) => e);
    expect(unavailable(error)).toBe(true);
    expect(await request("/topics/by-food/1")).toEqual([]);
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
    expect(sent.at(-1)?.body).toMatchObject({ policyVersion: "v3" });

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
});
