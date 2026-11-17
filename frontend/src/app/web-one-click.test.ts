// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  createWebOneClickTiming,
  webOneClickTimingHeaders,
  webOneClickToken,
  webOneClickAvailable,
  looksLikePhone,
  webOneClickLog,
} from "./web-one-click";

function sdk(overrides: Record<string, unknown> = {}) {
  return {
    // The page must leave network detection to checkLoginAvailable.
    getConnection: vi.fn(() => {
      throw new Error("getConnection must not be called");
    }),
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
      expect(
        log.mock.calls
          .filter((call) => call[0] === "phone_auth_timing")
          .map((call) => call[1].stage),
      ).toEqual(["sdk", "token", "environment", "carrier"]);
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

  it.each([
    [600011, "运营商取号失败"],
    [600015, "运营商响应超时"],
    [600032, "配置不匹配"],
  ])(
    "shows a safe SDK error code %s without exposing the reply",
    async (code, message) => {
      const log = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const server = sdk({
          getLoginToken: (o: any) =>
            o.error({ code, msg: "private-reply", spToken: "private-token" }),
        });
        await expect(
          webOneClickToken(
            {
              webOneClickToken: async () => ({
                accessToken: "a",
                jwtToken: "j",
              }),
            },
            server as any,
          ),
        ).rejects.toThrow(`${message}`);
        expect(log).toHaveBeenCalledWith(
          "phone_auth_error",
          expect.objectContaining({
            trace: expect.any(String),
            stage: "carrier",
            code: String(code),
          }),
        );
        expect(JSON.stringify(log.mock.calls)).not.toMatch(
          /private-reply|private-token/,
        );
      } finally {
        log.mockRestore();
      }
    },
  );

  it("never reflects arbitrary provider codes or messages", async () => {
    const server = sdk({
      getLoginToken: (o: any) =>
        o.error({ code: "private-code", msg: "private-message" }),
    });
    await expect(
      webOneClickToken(
        { webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }) },
        server as any,
      ),
    ).rejects.toThrow("本机号码一键登录没有完成，请用短信验证码登录。");
  });

  it("preserves carrier subcodes from a real-shaped SDK error without leaking credentials", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const server = sdk({
        getLoginToken: (o: any) =>
          o.error(
            JSON.stringify({
              code: 600011,
              requestId: "private-request",
              content: [
                {
                  vender: "CM",
                  code: "103211",
                  msgId: "private-id",
                  message: "private-phone",
                  token: "private-token",
                },
                { vender: "CU", resultCode: "100001", result: "100001" },
                { vender: "CT", code: "800001" },
              ],
            }),
          ),
      });
      const error = await webOneClickToken(
        { webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }) },
        server as any,
      ).catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(
        "600011；CM:103211；CU:100001；CT:800001",
      );
      expect(log).toHaveBeenCalledWith(
        "phone_auth_error",
        expect.objectContaining({
          carriers: ["CM:103211", "CU:100001", "CT:800001"],
        }),
      );
      expect(
        JSON.stringify(log.mock.calls) + (error as Error).message,
      ).not.toContain("private-");
    } finally {
      log.mockRestore();
    }
  });

  it("preserves negative carrier codes from live-shaped CU and CT failures", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const server = sdk({
        getLoginToken: (o: any) =>
          o.error({
            code: 600011,
            content: [
              { vender: "CM", code: "103111" },
              { vender: "CU", code: "-2", msg: "private-message" },
              { vender: "CT", result: -30408, msg: "private-message" },
            ],
          }),
      });
      await expect(
        webOneClickToken(
          {
            webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }),
          },
          server as any,
        ),
      ).rejects.toThrow("600011；CM:103111；CU:-2；CT:-30408");
      expect(log).toHaveBeenCalledWith(
        "phone_auth_error",
        expect.objectContaining({
          carriers: ["CM:103111", "CU:-2", "CT:-30408"],
        }),
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain("private-message");
    } finally {
      log.mockRestore();
    }
  });

  it("logs a support report for the carrier failure with correlation IDs and device context", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const timing = createWebOneClickTiming();
    const requestId = "12345678-abcd-4321-abcd-123456789abc";
    const msgId = "abcdef0123456789abcdef0123456789";
    try {
      const server = sdk({
        getLoginToken: (o: any) =>
          o.error(
            JSON.stringify({
              code: 600011,
              requestId,
              msg: "private-message",
              spToken: "private-token",
              content: [
                {
                  vender: "CU",
                  code: "-2",
                  msg: "request timeout: private-token",
                },
                { vender: "CM", code: "103111", msgId },
                {
                  vender: "CT",
                  result: -30408,
                  requestId,
                  carrier: { carrierTraceId: msgId, carrierSdkCode: -30408 },
                  mobile: "13800000000",
                },
              ],
            }),
          ),
      });
      await expect(
        webOneClickToken(
          {
            webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }),
          },
          server as any,
          timing,
        ),
      ).rejects.toThrow("600011；CU:-2；CM:103111；CT:-30408");
      expect(log).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith(
        "phone_auth_error",
        expect.objectContaining({
          trace: timing.trace,
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          sdkVersion: "2.1.15",
          stage: "carrier",
          code: "600011",
          requestId,
          network: { online: navigator.onLine },
          browser: expect.any(Object),
          carrierDetails: [
            { vendor: "CU", codes: ["-2"], reason: "TIMEOUT" },
            { vendor: "CM", codes: ["103111"], msgId },
            {
              vendor: "CT",
              codes: ["-30408"],
              requestId,
              carrierTraceId: msgId,
            },
          ],
        }),
      );
      expect(JSON.stringify(log.mock.calls)).not.toMatch(
        /private-|13800000000/,
      );
    } finally {
      log.mockRestore();
    }
  });

  it("logs only validated provider IDs and categorizes script errors without logging URLs", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await expect(
        webOneClickAvailable(
          {
            webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }),
          },
          sdk({
            checkLoginAvailable: (o: any) =>
              o.error({
                code: 600011,
                requestId: "13800000000",
                content: [
                  {
                    vender: "CM",
                    msgId: "private-token",
                    carrier: {
                      carrierTraceId: "https://private.example/?token=secret",
                    },
                    msg: "https://private.example/sdk?token=secret script资源加载失败",
                  },
                ],
              }),
          }) as any,
        ),
      ).resolves.toBe(false);
      expect(log).toHaveBeenCalledWith(
        "phone_auth_error",
        expect.objectContaining({
          stage: "environment",
          carrierDetails: [
            { vendor: "CM", codes: [], reason: "SCRIPT_LOAD_FAILED" },
          ],
        }),
      );
      expect(JSON.stringify(log.mock.calls)).not.toMatch(
        /private|secret|13800000000/,
      );
    } finally {
      log.mockRestore();
    }
  });

  it("extracts diagnostics from a single carrier SDK failure as well as aggregated failures", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const userAgent = vi
      .spyOn(navigator, "userAgent", "get")
      .mockReturnValue(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1 private-value",
      );
    const requestId = "12345678-abcd-4321-abcd-123456789abc";
    const msgId = "abcdef0123456789abcdef0123456789";
    try {
      await expect(
        webOneClickToken(
          {
            webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }),
          },
          sdk({
            getLoginToken: (o: any) =>
              o.error({
                code: 600011,
                vender: "CU",
                requestId,
                carrier: {
                  carrierTraceId: msgId,
                  carrierSdkCode: "-2",
                  carrierRespCode: "100001",
                  carrierSdkMsg: "network error: private-value",
                },
                content: {
                  result: "-2",
                  resultCode: "100001",
                  msgId,
                  accessToken: "private-value",
                },
              }),
          }) as any,
        ),
      ).rejects.toThrow("运营商取号失败");
      expect(log).toHaveBeenCalledWith(
        "phone_auth_error",
        expect.objectContaining({
          requestId,
          carrierDetails: [
            {
              vendor: "CU",
              codes: ["100001", "-2"],
              reason: "NETWORK_ERROR",
              requestId,
              msgId,
              carrierTraceId: msgId,
            },
          ],
          browser: {
            platform: "iPhone OS 18_0",
            versions: ["Version/18.0", "Safari/604.1"],
          },
        }),
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain("private-value");
    } finally {
      userAgent.mockRestore();
      log.mockRestore();
    }
  });

  it.each([
    [null, ""],
    [[{ vender: "CT", result: "-13800000000" }], "CT:NO_CODE"],
    [[{ vender: "CU", code: "-2-private-token" }], "CU:NO_CODE"],
    [
      [
        {
          vender: "CM",
          msg: "https://private.example/file?secret=xscript资源加载失败",
        },
      ],
      "CM:SCRIPT_LOAD_FAILED",
    ],
    [
      [{ vender: "CM", msg: "ReferenceError: private-name" }],
      "CM:SCRIPT_ERROR",
    ],
    ["private-message", ""],
    [[{ vender: "private-vendor", code: "123" }], ""],
    [
      [
        {
          vender: "CM",
          code: "13800000000",
          resultCode: "private-token",
          msg: "secret",
        },
      ],
      "CM:NO_CODE",
    ],
    [
      [{ vender: "CM", code: { toString: (): string => "secret" } }],
      "CM:NO_CODE",
    ],
  ])(
    "sanitizes malformed or sensitive carrier details %#",
    async (content, expected) => {
      const server = sdk({
        getLoginToken: (o: any) => o.error({ code: 600011, content }),
      });
      const error = await webOneClickToken(
        { webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }) },
        server as any,
      ).catch((e: Error) => e);
      expect((error as Error).message).toBe(
        `运营商取号失败，可使用短信或密码登录。（错误码 600011${expected ? "；" + expected : ""}）`,
      );
    },
  );

  it("offers the entry only after the carrier precheck succeeds", async () => {
    const api = {
      webOneClickToken: vi.fn(async () => ({
        accessToken: "a",
        jwtToken: "j",
      })),
    };
    const server = sdk();
    await expect(webOneClickAvailable(api, server as any)).resolves.toBe(true);
    expect(api.webOneClickToken).toHaveBeenCalledOnce();
    expect(server.getLoginToken).not.toHaveBeenCalled();
  });

  it("hides the entry when the carrier rejects or cannot precheck", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const rejected = sdk({
        checkLoginAvailable: (o: any) => o.error({ code: 600018 }),
      });
      const unsuccessful = sdk({
        checkLoginAvailable: (o: any) => o.success({ code: 600011 }),
      });
      const api = {
        webOneClickToken: async () => ({ accessToken: "a", jwtToken: "j" }),
      };
      await expect(webOneClickAvailable(api, rejected as any)).resolves.toBe(
        false,
      );
      await expect(
        webOneClickAvailable(api, unsuccessful as any),
      ).resolves.toBe(false);
      await expect(
        webOneClickAvailable(
          { webOneClickToken: async () => ({}) },
          sdk() as any,
        ),
      ).resolves.toBe(false);
    } finally {
      warn.mockRestore();
    }
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

  it("keeps a diagnostics log for the Console button without any token", async () => {
    webOneClickLog.clear();
    const api = {
      webOneClickToken: vi.fn(async () => ({
        accessToken: "secret-a",
        jwtToken: "secret-j",
      })),
    };
    const quiet = [
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
    ];
    try {
      await expect(
        webOneClickAvailable(
          api,
          sdk({
            checkLoginAvailable: (o: any) => o.error({ code: 600025 }),
          }) as any,
        ),
      ).resolves.toBe(false);
      await expect(webOneClickToken(api, sdk() as any)).resolves.toBe("sp-1");
    } finally {
      quiet.forEach((spy) => spy.mockRestore());
    }
    const entries = webOneClickLog.snapshot();
    expect(entries.map((entry) => entry.event)).toEqual(
      expect.arrayContaining(["token", "error", "available", "timing"]),
    );
    expect(
      entries.find((entry) => entry.event === "error")?.detail,
    ).toMatchObject({ code: "600025" });
    const text = JSON.stringify(entries);
    expect(text).not.toContain("secret-a");
    expect(text).not.toContain("secret-j");
    expect(text).not.toContain("sp-1");
    webOneClickLog.clear();
    expect(webOneClickLog.snapshot()).toEqual([]);
  });
});
