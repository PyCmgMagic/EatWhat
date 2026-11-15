// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  createWebOneClickTiming,
  webOneClickTimingHeaders,
  webOneClickToken,
  looksLikePhone,
} from "./web-one-click";

function sdk(overrides: Record<string, unknown> = {}) {
  return {
    getConnection: () => "cellular",
    closeLoginPage: vi.fn(),
    checkLoginAvailable: vi.fn((o: any) => o.success({ code: 600000 })),
    getLoginToken: vi.fn((o: any) =>
      o.success(JSON.stringify({ code: 600000, spToken: "sp-1" })),
    ),
    ...overrides,
  };
}

describe("web one-click login", () => {
  it("passes the backend tokens to the SDK and returns the carrier spToken", async () => {
    const api = {
      webOneClickToken: vi.fn(async () => ({
        accessToken: "a",
        jwtToken: "j",
      })),
    };
    const server = sdk();
    await expect(webOneClickToken(api, server as any)).resolves.toBe("sp-1");
    expect(api.webOneClickToken).toHaveBeenCalledWith(
      location.href,
      expect.any(String),
    );
    expect(server.checkLoginAvailable.mock.calls[0][0]).toMatchObject({
      accessToken: "a",
      jwtToken: "j",
    });
  });

  it("sends only bounded stage durations and a random correlation ID", async () => {
    const timing = createWebOneClickTiming();
    const api = {
      webOneClickToken: vi.fn(async () => ({
        accessToken: "secret-a",
        jwtToken: "secret-j",
      })),
    };
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      await expect(webOneClickToken(api, sdk() as any, timing)).resolves.toBe(
        "sp-1",
      );
      expect(api.webOneClickToken).toHaveBeenCalledWith(
        location.href,
        timing.trace,
      );
      const headers = webOneClickTimingHeaders(timing);
      expect(headers["X-Phone-Auth-Trace"]).toBe(timing.trace);
      expect(headers["X-Phone-Auth-Timing"]).toMatch(
        /^sdk=\d{1,6},token=\d{1,6},environment=\d{1,6},carrier=\d{1,6}$/,
      );
      expect(log.mock.calls.map((call) => call[1].stage)).toEqual([
        "sdk",
        "token",
        "environment",
        "carrier",
      ]);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(
        /secret-a|secret-j|sp-1/,
      );
    } finally {
      log.mockRestore();
    }
  });

  it("records a failed step without recording SDK error contents", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      await expect(
        webOneClickToken(
          {
            webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }),
          },
          sdk({
            checkLoginAvailable: (o: any) =>
              o.error({ code: 600008, msg: "private-value" }),
          }) as any,
        ),
      ).rejects.toThrow("关闭 Wi-Fi");
      expect(log.mock.calls.at(-1)?.[1]).toMatchObject({
        stage: "environment",
        result: "error",
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain("private-value");
    } finally {
      log.mockRestore();
    }
  });

  it("stops before asking the backend when the phone is on Wi-Fi", async () => {
    const api = { webOneClickToken: vi.fn() };
    await expect(
      webOneClickToken(api, sdk({ getConnection: () => "wifi" }) as any),
    ).rejects.toThrow("关闭 Wi-Fi");
    expect(api.webOneClickToken).not.toHaveBeenCalled();
  });

  it("explains failed carrier checks and never resolves without a token", async () => {
    const api = {
      webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }),
    };
    const envFailed = sdk({
      checkLoginAvailable: (o: any) => o.error('{"code":600008}'),
    });
    await expect(webOneClickToken(api, envFailed as any)).rejects.toThrow(
      "关闭 Wi-Fi",
    );
    const noToken = sdk({
      getLoginToken: (o: any) => o.success({ code: 600000 }),
    });
    await expect(webOneClickToken(api, noToken as any)).rejects.toThrow(
      "短信验证码",
    );
    await expect(
      webOneClickToken({ webOneClickToken: async () => ({}) }, sdk() as any),
    ).rejects.toThrow("暂时不可用");
  });

  it("opens authorization from the SDK callback and closes it after success", async () => {
    let inCallback = false;
    const server = sdk({
      checkLoginAvailable: (o: any) => {
        inCallback = true;
        o.success({ code: 600000 });
        inCallback = false;
      },
      getLoginToken: (o: any) => {
        expect(inCallback).toBe(true);
        expect(o.authPageOption).toMatchObject({
          manualClose: true,
          btnText: "登录 / 注册",
        });
        o.success({ code: "600000", spToken: "authorized-token" });
      },
    });
    await expect(
      webOneClickToken(
        { webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }) },
        server as any,
      ),
    ).resolves.toBe("authorized-token");
    expect(server.closeLoginPage).toHaveBeenCalledOnce();
  });

  it("releases the flow on cancellation and ignores a late success", async () => {
    const server = sdk({
      getLoginToken: (o: any) => {
        o.watch(2);
        o.success({ code: 600000, spToken: "late-token" });
      },
    });
    await expect(
      webOneClickToken(
        { webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }) },
        server as any,
      ),
    ).rejects.toThrow("已取消");
    expect(server.closeLoginPage).toHaveBeenCalledOnce();
  });

  it("only offers it on phones", () => {
    expect(
      looksLikePhone("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"),
    ).toBe(true);
    expect(looksLikePhone("Mozilla/5.0 (Linux; Android 15; Pixel 8)")).toBe(
      true,
    );
    expect(
      looksLikePhone("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"),
    ).toBe(false);
  });
});
