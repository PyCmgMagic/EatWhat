// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  createLocalNumberTiming,
  localNumberTimingHeaders,
  localNumberToken,
  looksLikePhone,
} from "./local-number";

function sdk(overrides: Record<string, unknown> = {}) {
  return {
    getConnection: () => "cellular",
    checkAuthAvailable: vi.fn((o: any) => o.success({ code: 600000 })),
    getVerifyToken: vi.fn((o: any) =>
      o.success(JSON.stringify({ code: 600000, spToken: "sp-1" })),
    ),
    ...overrides,
  };
}

describe("local number verification", () => {
  it("passes the backend tokens to the SDK and returns the carrier spToken", async () => {
    const api = {
      webVerifyToken: vi.fn(async () => ({ accessToken: "a", jwtToken: "j" })),
    };
    const server = sdk();
    await expect(localNumberToken(api, server as any)).resolves.toBe("sp-1");
    expect(api.webVerifyToken).toHaveBeenCalledWith(
      location.href,
      expect.any(String),
    );
    expect(server.checkAuthAvailable.mock.calls[0][0]).toMatchObject({
      accessToken: "a",
      jwtToken: "j",
    });
  });

  it("sends only bounded stage durations and a random correlation ID", async () => {
    const timing = createLocalNumberTiming();
    const api = {
      webVerifyToken: vi.fn(async () => ({
        accessToken: "secret-a",
        jwtToken: "secret-j",
      })),
    };
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      await expect(localNumberToken(api, sdk() as any, timing)).resolves.toBe(
        "sp-1",
      );
      expect(api.webVerifyToken).toHaveBeenCalledWith(
        location.href,
        timing.trace,
      );
      const headers = localNumberTimingHeaders(timing);
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
        localNumberToken(
          { webVerifyToken: async () => ({ accessToken: "a", jwtToken: "j" }) },
          sdk({
            checkAuthAvailable: (o: any) =>
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
    const api = { webVerifyToken: vi.fn() };
    await expect(
      localNumberToken(api, sdk({ getConnection: () => "wifi" }) as any),
    ).rejects.toThrow("关闭 Wi-Fi");
    expect(api.webVerifyToken).not.toHaveBeenCalled();
  });

  it("explains failed carrier checks and never resolves without a token", async () => {
    const api = {
      webVerifyToken: async () => ({ accessToken: "a", jwtToken: "j" }),
    };
    const envFailed = sdk({
      checkAuthAvailable: (o: any) => o.error('{"code":600008}'),
    });
    await expect(localNumberToken(api, envFailed as any)).rejects.toThrow(
      "关闭 Wi-Fi",
    );
    const noToken = sdk({
      getVerifyToken: (o: any) => o.success({ code: 600000 }),
    });
    await expect(localNumberToken(api, noToken as any)).rejects.toThrow(
      "短信验证码",
    );
    await expect(
      localNumberToken({ webVerifyToken: async () => ({}) }, sdk() as any),
    ).rejects.toThrow("暂时不可用");
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
