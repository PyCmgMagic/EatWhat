import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import {
  withActionAccess,
  isVerificationRequired,
  type AccessPrompt,
} from "./access";
import { actionUnavailable, requestAccess } from "./access-policy";
import {
  AccessRequiredError,
  ApiError,
  errorMessage,
  type Session,
  type Transport,
} from "./client";
import { createApi } from "./service";

function setup() {
  const state = {
    session: { tokenName: "test", tokenValue: "test" } as Session | null,
    user: { verified: false, banned: false } as
      { verified: boolean; banned: boolean } | undefined,
    context: "#/foods/7",
  };
  const prompt = vi.fn((_request: AccessPrompt) => true);
  const send = vi.fn<Transport>(async () => ({ code: 0, data: null }));
  const loadUser = vi.fn(async () => ({ verified: false, banned: false }));
  const transport = withActionAccess(send, {
    session: () => state.session,
    user: () => state.user,
    context: () => state.context,
    prompt,
    loadUser,
  });
  return {
    state,
    prompt,
    send,
    loadUser,
    transport,
    api: createApi(transport),
  };
}
describe("shared request permissions", () => {
  it("keeps APIv6 public and optional-login operations accessible despite security export conflicts", () => {
    const spec = JSON.parse(
      readFileSync(
        new URL(
          "../../../docs/EatWhat 业务服务 APIv6.openapi.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    let optional = 0;
    for (const [path, methods] of Object.entries(spec.paths))
      for (const [method, op] of Object.entries(
        methods as Record<string, { summary?: string }>,
      )) {
        if (!/^【(?:公开|可选登录)】/.test(op.summary ?? "")) continue;
        expect(requestAccess(path.replace(/\{[^}]+\}/g, "7"), { method })).toBe(
          "public",
        );
        if (op.summary?.includes("可选登录")) optional++;
      }
    expect(optional).toBe(23);
  });
  it("rejects passive activity for guests without opening a login dialog", async () => {
    const s = setup();
    s.state.session = null;
    await expect(s.api.recordActivity()).rejects.toMatchObject({
      presented: false,
    });
    expect(s.prompt).not.toHaveBeenCalled();
    expect(s.send).not.toHaveBeenCalled();
  });
  it("covers every verified operation declared by the current API contract", () => {
    const spec = parse(
      readFileSync(
        new URL(
          "../../../docs/EatWhat 业务服务 APIv6.openapi.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    let count = 0;
    for (const [path, operations] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(
        operations as Record<string, { summary?: string }>,
      )) {
        if (!operation.summary?.includes("【需verified】")) continue;
        expect(requestAccess(path.replace(/\{[^}]+\}/g, "7"), { method })).toBe(
          "verified",
        );
        count++;
      }
    }
    expect(count).toBeGreaterThan(20);
  });
  it.each(["foods", "restaurants", "activity", "comments"])(
    "requires verification for %s uploads",
    (biz) => {
      expect(
        requestAccess("/upload/presign", { method: "POST", body: { biz } }),
      ).toBe("verified");
      expect(
        requestAccess("/upload/presign/batch", {
          method: "POST",
          body: { biz },
        }),
      ).toBe("verified");
    },
  );
  it.each(["avatar", "feedback"])(
    "only requires login for %s uploads",
    (biz) => {
      expect(
        requestAccess("/upload/presign", { method: "POST", body: { biz } }),
      ).toBe("login");
    },
  );
  it.each([
    ["POST", "/foods/7/favorite"],
    ["POST", "/foods/7/like"],
    ["POST", "/foods/7/unlike"],
    ["POST", "/foods/7/tags/custom"],
    ["DELETE", "/foods/my/7"],
    ["POST", "/user/follow"],
    ["POST", "/foods/upload"],
    ["PUT", "/restaurant/7/favorite"],
    ["PUT", "/restaurant/7/rating"],
    ["POST", "/activity/spring/posts"],
    ["POST", "/user/getCode"],
  ])(
    "blocks %s %s without any button guard or network write",
    async (method, path) => {
      const s = setup();
      await expect(s.transport(path, { method })).rejects.toBeInstanceOf(
        AccessRequiredError,
      );
      expect(s.send).not.toHaveBeenCalled();
      expect(s.prompt).toHaveBeenCalledExactlyOnceWith({
        reason: "verification",
        context: "#/foods/7",
        serverRequired: false,
      });
    },
  );
  it("distinguishes adding and removing a favorite, including methods on the same path", async () => {
    const s = setup();
    await expect(s.api.favorite(7, false)).rejects.toBeInstanceOf(
      AccessRequiredError,
    );
    await s.api.favorite(7, true);
    await s.api.unfavoriteRestaurant(7);
    expect(
      s.send.mock.calls.map(([path, options]) => [path, options.method]),
    ).toEqual([
      ["/foods/7/unfavorite", "POST"],
      ["/restaurant/7/favorite", "DELETE"],
    ]);
  });
  it("allows verified actions once and does not replay denied actions", async () => {
    const s = setup(),
      success = vi.fn();
    await s.api.favorite(7, false).then(success, () => {});
    expect(success).not.toHaveBeenCalled();
    s.state.user!.verified = true;
    expect(s.send).not.toHaveBeenCalled();
    await s.api.favorite(7, false);
    expect(s.send).toHaveBeenCalledTimes(1);
  });
  it("opens login for guests while public login and read APIs stay available", async () => {
    const s = setup();
    s.state.session = null;
    await expect(s.api.favorite(7, false)).rejects.toMatchObject({
      reason: "login",
    });
    expect(s.loadUser).not.toHaveBeenCalled();
    await s.transport("/auth/login", { method: "POST" });
    await s.transport("/foods/detail/7", {});
    expect(s.send).toHaveBeenCalledTimes(2);
    expect(s.prompt).toHaveBeenCalledTimes(1);
  });
  it("waits for an unknown account and cancels if the page changes during that wait", async () => {
    const s = setup();
    s.state.user = undefined;
    s.loadUser.mockImplementationOnce(async () => {
      s.state.context = "#/me";
      return { verified: true, banned: false };
    });
    await expect(s.api.favorite(7, false)).rejects.toMatchObject({
      code: "ACTION_CANCELLED",
    });
    expect(s.send).not.toHaveBeenCalled();
    expect(s.prompt).not.toHaveBeenCalled();
  });
  it("preserves banned-account errors", async () => {
    const s = setup();
    s.state.user!.banned = true;
    await expect(s.api.favorite(7, false)).rejects.toMatchObject({
      code: "USER_DISABLED",
    });
    expect(s.prompt).not.toHaveBeenCalled();
    expect(s.send).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "handles server verification denial with stale verified state (HTTP rejection: %s)",
    async (httpError) => {
      const s = setup();
      s.state.user!.verified = true;
      s.send.mockImplementationOnce(async () => {
        if (httpError) throw new ApiError("权限不足：用户未验证", 20004, 403);
        return { code: 20004, msg: "权限不足：用户未验证" };
      });
      await expect(s.api.favorite(7, false)).rejects.toMatchObject({
        reason: "verification",
        presented: true,
      });
      expect(s.prompt).toHaveBeenCalledExactlyOnceWith({
        reason: "verification",
        context: "#/foods/7",
        serverRequired: true,
      });
      expect(s.send).toHaveBeenCalledTimes(1);
    },
  );
  it("also handles newly introduced commands with an explicit server denial", async () => {
    const s = setup();
    s.send.mockResolvedValueOnce({ code: 40002, msg: "请先完成学生认证" });
    await expect(
      s.transport("/future/action", { method: "POST" }),
    ).rejects.toBeInstanceOf(AccessRequiredError);
    expect(s.prompt).toHaveBeenCalledTimes(1);
  });
  it("does not misclassify admin, ownership, captcha or generic state errors", () => {
    for (const error of [
      new ApiError("需要管理员权限", 20004, 403),
      new ApiError("权限不足", 20004),
      new ApiError("当前状态不允许该操作", 40002),
      new ApiError("验证已失效", 30016),
    ])
      expect(isVerificationRequired(error)).toBe(false);
  });
  it("does not prompt for background reads or a response from a previous account", async () => {
    const s = setup();
    s.send.mockResolvedValueOnce({ code: 20004, msg: "用户未验证" });
    await s.transport("/foods/tags/my", {});
    expect(s.prompt).not.toHaveBeenCalled();
    s.state.user!.verified = true;
    s.send.mockImplementationOnce(async () => {
      s.state.session = { tokenName: "test", tokenValue: "another-account" };
      return { code: 20004, msg: "用户未验证" };
    });
    await expect(s.api.favorite(7, false)).rejects.toBeInstanceOf(
      AccessRequiredError,
    );
    expect(s.prompt).not.toHaveBeenCalled();
  });
  it("suppresses only errors already presented by the central dialog", () => {
    expect(errorMessage(new AccessRequiredError("verification", true))).toBe(
      "",
    );
    expect(
      errorMessage(new AccessRequiredError("verification", false)),
    ).toContain("学生认证");
    expect(errorMessage(new ApiError("服务暂不可用", 50001))).not.toBe("");
  });
  it("keeps the existing maintenance and feature flag restrictions", () => {
    expect(
      actionUnavailable(
        { maintenance: { mode: "READ_ONLY" } },
        "/foods/7/like",
      ),
    ).toBeTruthy();
    expect(
      actionUnavailable(
        { flags: { publish: { on: false, reason: "暂停发布" } } },
        "/foods/upload",
      ),
    ).toBe("暂停发布");
  });
});
