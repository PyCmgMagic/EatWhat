import { describe, expect, it, vi } from "vitest";
import { createApi } from "./service";
import { commentBody } from "./comments";
import { requestAccess } from "./access-policy";
import { createTransport, type Transport } from "./client";

const key = "11111111-1111-4111-8111-111111111111";
describe("APIv7 comment contract", () => {
  it("uses root IDs in reply routes and target IDs in the body", async () => {
    const send = vi.fn<Transport>(async () => ({ code: 0, data: { id: 1 } }));
    await createApi(send).replyToComment(
      7,
      8,
      {
        text: "  回复  ",
        replyToId: 9,
        pictureKeys: ["comments/photo"],
        campusId: 2,
      },
      key,
    );
    expect(send).toHaveBeenCalledWith("/foods/7/comments/8/replies", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: {
        text: "回复",
        replyToId: 9,
        pictureKeys: ["comments/photo"],
        campusId: 2,
      },
    });
  });
  it("accepts 200 Unicode code points and rejects invalid text and image keys", () => {
    expect(commentBody({ text: "🍜".repeat(200) }).text).toHaveLength(400);
    for (const body of [
      { text: " " },
      { text: "🍜".repeat(201) },
      { text: "评论", pictureKeys: ["https://example.com/signed"] },
      { text: "评论", pictureKeys: Array(4).fill("comments/key") },
    ])
      expect(() => commentBody(body)).toThrow();
  });
  it("separates public reading, logged-in text and verified image uploads", () => {
    expect(requestAccess("/foods/1/comments")).toBe("public");
    expect(requestAccess("/foods/1/gallery")).toBe("public");
    expect(requestAccess("/comments/1/replies")).toBe("public");
    expect(requestAccess("/foods/1/comments", { method: "POST" })).toBe(
      "login",
    );
    expect(requestAccess("/comments/1/like", { method: "PUT" })).toBe("login");
    expect(
      requestAccess("/upload/presign", {
        method: "POST",
        body: { biz: "comments" },
      }),
    ).toBe("verified");
  });
  it("preserves optional sessions on public comment reads", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ code: 0, data: { items: [] } }), {
          status: 200,
        }),
    );
    const api = createApi(
      createTransport(
        "/api",
        () => ({ tokenName: "custom-session", tokenValue: "token" }),
        fetcher,
      ),
    );
    await api.foodComments(1);
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get("custom-session"),
    ).toBe("Bearer token");
  });
  it("rejects invalid identifiers before a request, and nonzero business responses", async () => {
    const send = vi.fn<Transport>(async () => ({
        code: 40001,
        msg: "评论未通过校验",
      })),
      api = createApi(send);
    expect(() => api.likeComment(1, "bad-key")).toThrow();
    expect(() => api.foodComments(-1)).toThrow();
    expect(() => api.foodComments(1, "NEWEST", 0)).toThrow();
    expect(send).not.toHaveBeenCalled();
    await expect(
      api.createFoodComment(1, { text: "用餐感受" }, key),
    ).rejects.toMatchObject({ code: 40001 });
  });
  it("uses a body decision UUID for moderation, without an invented header", async () => {
    const send = vi.fn<Transport>(async () => ({ code: 0, data: {} }));
    await createApi(send).reviewComment({
      decisionId: key,
      revisionId: key,
      verdict: "REJECT",
      reasonCode: "TEXT",
    });
    expect(send.mock.calls[0][1]).toEqual({
      method: "POST",
      body: {
        decisionId: key,
        revisionId: key,
        verdict: "REJECT",
        reasonCode: "TEXT",
      },
    });
  });
});
