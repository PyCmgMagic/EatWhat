import { describe, expect, it, vi } from "vitest";
import { accessFor, createV2Api } from "./backend-v2";
import { endpoints } from "./backend-v2-endpoints";
import { ApiError, type Transport } from "./client";

describe("backend v2 client", () => {
  it("uses the corrected reset payload and a scoped rating deletion query", async () => {
    const transport = vi
      .fn<Transport>()
      .mockResolvedValue({ code: 0, data: null });
    const call = createV2Api({
      transport,
      hasSession: () => true,
      identity: () => ({ role: "admin" }),
      captcha: async () => {
        throw new Error("Unexpected captcha");
      },
    });
    await call("adminResetPassword", {
      path: { userId: 42 },
      body: { password: "secret-42" },
    });
    expect(transport).toHaveBeenCalledWith(
      "/admin/users/42/password",
      expect.objectContaining({
        method: "POST",
        body: { password: "secret-42" },
      }),
    );
    await call("unrate", { path: { id: 17 }, query: { scene: "delivery" } });
    expect(transport).toHaveBeenCalledWith(
      "/restaurant/17/rating",
      expect.objectContaining({
        method: "DELETE",
        query: { scene: "delivery" },
      }),
    );
    expect(Object.keys(endpoints)).toHaveLength(149);
  });

  it("retries password login with the challenge only after a 30015", async () => {
    const transport = vi
      .fn<Transport>()
      .mockResolvedValueOnce({ code: 30015 })
      .mockResolvedValueOnce({ code: 0, data: { enabled: true } })
      .mockResolvedValueOnce({
        code: 0,
        data: { tokenName: "satoken", tokenValue: "test" },
      });
    const call = createV2Api({
      transport,
      hasSession: () => false,
      identity: () => undefined,
      captcha: async (config, send) => {
        const signal = new AbortController().signal;
        expect(await config(signal)).toEqual({ enabled: true });
        await send(
          { "X-Captcha-Ticket": "ticket", "X-Captcha-Randstr": "randstr" },
          signal,
        );
      },
    });
    await expect(
      call("login", {
        body: { userName: "me", password: "secret", device: "WEB" },
      }),
    ).resolves.toMatchObject({ tokenValue: "test" });
    expect(transport).toHaveBeenLastCalledWith(
      "/auth/login",
      expect.objectContaining({
        headers: {
          "X-Captcha-Ticket": "ticket",
          "X-Captcha-Randstr": "randstr",
        },
      }),
    );
  });

  it("allows administrators to edit while requiring verification for the shop image upload", async () => {
    const transport = vi
      .fn<Transport>()
      .mockResolvedValue({ code: 0, data: { id: 5 } });
    const call = createV2Api({
      transport,
      hasSession: () => true,
      identity: () => ({ role: "admin", verified: false }),
      captcha: async () => {},
    });
    await call("editRestaurant", { path: { id: 5 }, body: { name: "新店名" } });
    expect(accessFor("presign", { biz: "restaurants" })).toBe("verified");
    await expect(
      call("presign", {
        body: { biz: "restaurants", contentType: "image/png", fileSize: 12 },
      }),
    ).rejects.toMatchObject({ code: "20004" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("reports stale consent separately from a failed unauthenticated request", async () => {
    const onFailure = vi.fn();
    const call = createV2Api({
      transport: async () => ({ code: 20009, msg: "新政策" }),
      hasSession: () => true,
      identity: () => undefined,
      captcha: async () => {},
      onFailure,
    });
    await expect(call("me")).rejects.toBeInstanceOf(ApiError);
    await expect(
      call("currentPolicy", { public: true }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(
      onFailure.mock.calls.map(([error, authenticated]) => [
        error.code,
        authenticated,
      ]),
    ).toEqual([
      [20009, true],
      [20009, false],
    ]);
  });
});
