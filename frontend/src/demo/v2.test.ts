// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
it("dismisses a restaurant from recommendation feeds for 30 days across reloads", async () => {
  const { createApi } = await import("../api/service");
  const { writeSession } = await import("../app/runtime");
  const session = { tokenName: "satoken", tokenValue: "demo-test" };
  const api = createApi((await import("./transport")).demoTransport);
  writeSession(session);
  const start = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(start);
  try {
    const before = await api.recommendFeed(8, { kind: "food" });
    const shopId = before.items[0].restaurantId!;
    await api.dismissRecommendation(shopId);
    vi.resetModules();
    const reloaded = createApi((await import("./transport")).demoTransport);
    clock.mockReturnValue(start + 30 * 86_400_000 - 1);
    const feed = await reloaded.recommendFeed(8, {
      kind: "food",
      scene: "delivery",
    });
    expect(feed.shops?.map((s) => s.id)).not.toContain(shopId);
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.items.map((dish) => dish.restaurantId)).not.toContain(shopId);
    const shopIds = async () =>
      (await reloaded.recommend()).map((dish) => dish.restaurantId);
    expect(await shopIds()).not.toContain(shopId);

    writeSession(null);
    expect(await shopIds()).toContain(shopId);
    await expect(reloaded.dismissRecommendation(shopId)).rejects.toMatchObject({
      code: 20001,
    });
    writeSession(session);
    clock.mockReturnValue(start + 30 * 86_400_000);
    const restored = await reloaded.recommendFeed(8, { kind: "food" });
    expect(restored.shops?.map((s) => s.id)).toContain(shopId);
  } finally {
    clock.mockRestore();
  }
});

it.each(["原来的昵称", "alice"])(
  "migrates the old display name %s without inferring a login name or losing uploads",
  async (oldName) => {
    const picture = "data:image/png;base64,dGVzdA==";
    localStorage.setItem(
      "eatwhat-demo-prototype-v3",
      JSON.stringify({
        user: { id: 10, userName: oldName, verified: true },
        foods: [
          {
            id: 501,
            accountId: 10,
            name: "保留的上传",
            restaurantId: 1,
            pictureUrl: [picture],
          },
        ],
        restaurants: [{ id: 1, name: "原来的店", hubId: 1 }],
        tags: [],
        notifications: [],
        history: [],
        following: [],
        privacy: { following: true, follower: true },
      }),
    );
    const { demoTransport } = await import("./transport");
    expect((await demoTransport("/user/info", {})).data).toMatchObject({
      displayName: oldName,
      userName: null,
      hasUsername: false,
    });
    await demoTransport("/user/updateInfo", {
      method: "PUT",
      body: { displayName: "新的昵称" },
    });
    const saved = JSON.parse(
      localStorage.getItem("eatwhat-demo-prototype-v3")!,
    );
    expect(saved.foods).toHaveLength(1);
    expect(saved.foods[0]).toMatchObject({
      id: 501,
      name: "保留的上传",
      pictureUrl: [picture],
      uploaderName: "新的昵称",
    });
    expect(saved.user).toMatchObject({
      displayName: "新的昵称",
      userName: null,
    });
    expect(saved.schemaVersion).toBe(2);
    const recommendation = (await demoTransport("/foods/recommend", {}))
      .data as { id: number }[];
    expect(recommendation[0].id).toBe(501);
  },
);
it("the isolated mock rejects missing and reused CAPTCHA proofs, including after a business failure", async () => {
  const { demoTransport } = await import("./transport");
  await expect(
    demoTransport("/auth/phone/code", {
      method: "POST",
      body: { mobile: "13800000000" },
    }),
  ).rejects.toMatchObject({ code: 30015 });
  const cfg = (await demoTransport("/auth/captcha/config", {})).data as {
    aidEncrypted: string;
  };
  const headers = {
    "X-Captcha-Ticket": `demo-ticket:${cfg.aidEncrypted}`,
    "X-Captcha-Randstr": cfg.aidEncrypted,
  };
  await demoTransport("/auth/phone/code", {
    method: "POST",
    body: { mobile: "13800000000" },
    headers,
  });
  await expect(
    demoTransport("/auth/phone/code", {
      method: "POST",
      body: { mobile: "13800000000" },
      headers,
    }),
  ).rejects.toMatchObject({ code: 30016 });
  const next = (await demoTransport("/auth/captcha/config", {})).data as {
    aidEncrypted: string;
  };
  const fresh = {
    "X-Captcha-Ticket": `demo-ticket:${next.aidEncrypted}`,
    "X-Captcha-Randstr": next.aidEncrypted,
  };
  await expect(
    demoTransport("/auth/phone/code", {
      method: "POST",
      body: { mobile: "13800000000" },
      headers: fresh,
    }),
  ).rejects.toMatchObject({ code: 429 });
  await expect(
    demoTransport("/auth/phone/code", {
      method: "POST",
      body: { mobile: "13800000000" },
      headers: fresh,
    }),
  ).rejects.toMatchObject({ code: 30016 });
});
