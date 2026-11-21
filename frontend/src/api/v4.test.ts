import { expect, it } from "vitest";
import { createApi } from "./service";
import { unreadCount } from "./notifications";
import { ApiError } from "./client";
import { createTransport, type RequestOptions } from "./client";
it("uses card unread members and falls back only when the new endpoint is unavailable", async () => {
  const api = {
    unreadCards: async () => ({ members: 7, cards: 2 }),
    unread: async () => 3,
  };
  expect(await unreadCount(api)).toBe(7);
  expect(
    await unreadCount({
      ...api,
      unreadCards: async () => {
        throw new ApiError("未部署", 404, 404);
      },
    }),
  ).toBe(3);
  await expect(
    unreadCount({
      ...api,
      unreadCards: async () => {
        throw new ApiError("失败", 503, 503);
      },
    }),
  ).rejects.toMatchObject({ status: 503 });
  await expect(
    unreadCount({ ...api, unreadCards: async () => ({}) }),
  ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
});
it("sends recovery capabilities without attaching a stale login session", async () => {
  const sent: { url: string; headers: Headers }[] = [];
  const api = createApi(
    createTransport(
      "https://api.example/api",
      () => ({ tokenName: "satoken", tokenValue: "old-login" }),
      async (input, init) => {
        sent.push({ url: String(input), headers: new Headers(init?.headers) });
        return new Response(
          JSON.stringify({ code: 0, data: { status: "PENDING" } }),
          { status: 200 },
        );
      },
    ),
  );
  await api.resumeDeviceSessions("command-a", "session-proof");
  await api.resumeMobile("command-b", "mobile-proof");
  await api.cancellationStatus("subject", "request", "lifecycle-proof");
  for (const call of sent) {
    expect(call.headers.has("satoken")).toBe(false);
    expect(call.url).not.toContain("proof");
  }
  expect(sent[0].headers.get("X-Recovery-Capability")).toBe("session-proof");
  expect(sent[1].headers.get("X-Recovery-Capability")).toBe("mobile-proof");
  expect(sent[2].headers.get("X-Lifecycle-Recovery")).toBe("lifecycle-proof");
});
it("preserves feedback idempotency and pending moderation acceptance metadata", async () => {
  const calls: RequestOptions[] = [];
  const api = createApi(async (_path, options) => {
    calls.push(options);
    return {
      code: 0,
      data: {
        id: 71,
        moderationStatus: "PENDING",
        revisionId: "private-revision",
      },
    };
  });
  await api.createFeedback({ text: "建议", category: "SUGGESTION" }, "stable-key");
  expect(calls[0].body).toMatchObject({ category: "SUGGESTION" });
  expect(calls[0].headers?.["Idempotency-Key"]).toBe("stable-key");
  await api.ban(1, "期限测试", "2026-12-01T00:00:00+08:00");
  expect(calls[1].body).toEqual({
    reason: "期限测试",
    banUntil: "2026-12-01T00:00:00+08:00",
  });
  expect(
    await api.createFood({
      name: "云吞",
      restaurantId: 1,
      pictureUrl: ["foods/key"],
    }),
  ).toEqual({
    id: 71,
    moderationStatus: "PENDING",
    revisionId: "private-revision",
  });
});
it("retains non-success consent progress instead of treating it as a login result", async () => {
  const api = createApi(async () => ({
    code: 20006,
    data: {
      status: "PROVISIONAL",
      identityReady: false,
      policyVersion: "v4",
      backfillStatus: "ACCOUNT_PENDING",
      cleanupStatus: "NOT_REQUIRED",
      registrationAccepted: true,
    },
  }));
  const reply = await api.consentOfferWithPassword({
    userName: "student",
    password: "example",
  });
  expect(reply.code).toBe(20006);
  expect(reply.data).toMatchObject({
    status: "PROVISIONAL",
    identityReady: false,
  });
});
