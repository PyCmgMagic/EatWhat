import { describe, it, expect, vi } from "vitest";
import {
  ApiError,
  buildUrl,
  createRequester,
  createTransport,
  errorMessage,
  resultUncertain,
  requiredData,
  safeJson,
} from "./client";
describe("v2 transport boundaries", () => {
  it.each([50001, "50001"])(
    "does not mislabel a one-click provider failure %s as a captcha failure",
    async (code) => {
      const request = createRequester(async () => ({
        code,
        msg: "第三方服务不可用",
        data: null,
      }));
      const failure = await request("/auth/phone/web-one-click/token", {
        method: "POST",
        public: true,
        body: { url: "https://eat.v50to.you/" },
      }).catch((error: unknown) => error);
      expect(errorMessage(failure)).toBe(
        "第三方服务暂不可用，请稍后重试（错误码 50001）。",
      );
      expect(errorMessage(new ApiError("人机验证服务暂不可用", 50004))).toBe(
        "人机验证暂不可用，请稍后重试。",
      );
    },
  );

  it("preserves the gateway and controller prefixes, array parameters and zero values", () => {
    expect(buildUrl("/api/", "/api/location/provinces")).toBe(
      "/api/api/location/provinces",
    );
    expect(
      buildUrl("https://host/api", "/foods/list", {
        restaurantId: 2,
        systemTagIds: [3, 4],
        keyword: "面 & 饭",
        price: 0,
        unused: undefined,
      }),
    ).toBe(
      "https://host/api/foods/list?restaurantId=2&systemTagIds=3&systemTagIds=4&keyword=%E9%9D%A2+%26+%E9%A5%AD&price=0",
    );
  });
  it("uses the returned header name and Bearer value, and excludes sessions on public requests", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"code":0,"data":null}'));
    const transport = createTransport(
      "/api",
      () => ({ tokenName: "custom-satoken", tokenValue: "secret" }),
      fetcher,
    );
    await transport("/foods/my", {});
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get("custom-satoken"),
    ).toBe("Bearer secret");
    expect(fetcher.mock.calls[0][1]?.redirect).toBe("error");
    fetcher.mockResolvedValueOnce(new Response('{"code":0,"data":null}'));
    await transport("/auth/login", {
      method: "POST",
      public: true,
      body: { username: "x" },
    });
    expect(
      new Headers(fetcher.mock.calls[1][1]?.headers).has("custom-satoken"),
    ).toBe(false);
  });
  it("rejects business failures even when HTTP succeeds; does not invent missing success codes", async () => {
    const request = createRequester(async () => ({
      code: 20005,
      msg: "authorization pending",
      data: {},
    }));
    await expect(request("/foods/my")).rejects.toMatchObject({
      code: 20005,
      message: "authorization pending",
    });
    expect(await request("/auth/login", { raw: true })).toMatchObject({
      code: 20005,
    });
    await expect(
      createRequester(async () => ({ data: null }))("/foods/upload"),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      createRequester(async () => ({ code: "0", data: 0 }))(
        "/notification/unread/count",
      ),
    ).resolves.toBe(0);
  });
  it("distinguishes permission errors, malformed responses and network failures", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const transport = createTransport("/api", () => null, fetcher);
    fetcher.mockResolvedValueOnce(
      new Response('{"code":"FORBIDDEN","msg":"verified required"}', {
        status: 403,
      }),
    );
    await expect(transport("/foods/my", {})).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    fetcher.mockResolvedValueOnce(
      new Response("<html>gateway error</html>", { status: 502 }),
    );
    await expect(transport("/foods/my", {})).rejects.toMatchObject({
      status: 502,
      code: "INVALID_RESPONSE",
    });
    fetcher.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(transport("/foods/my", {})).rejects.toMatchObject({
      code: "NETWORK",
    });
  });
  it("refuses silently rounded IDs and rejects missing required data", () => {
    expect(() => safeJson('{"id":9223372036854775807}')).toThrow("安全范围");
    expect(
      safeJson('{"id":123,"price":0,"createdAt":1792656000000}'),
    ).toMatchObject({ id: 123, price: 0 });
    expect(() => requiredData(null)).toThrow("未返回所需数据");
    expect(requiredData(false)).toBe(false);
  });
  it("treats a lost response body after successful POST headers as uncertain", async () => {
    const transport = createTransport(
      "/api",
      () => null,
      async () =>
        new Response(
          new ReadableStream({
            start(stream) {
              stream.error(new TypeError("connection reset"));
            },
          }),
          { status: 200 },
        ),
    );
    const error = await transport("/foods/upload", { method: "POST" }).catch(
      (e) => e,
    );
    expect(error).toMatchObject({ code: "NETWORK" });
    expect(resultUncertain(error)).toBe(true);
  });
  it.each([200, 500])(
    "handles UNKNOWN_ERROR as an uncertain server failure even with HTTP %s",
    async (status) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 90004,
            data: null,
            msg: "未捕获异常",
            timestamp: 1794153014570,
          }),
          { status },
        ),
      );
      const request = createRequester(
        createTransport("/api", () => null, fetcher),
      );
      let failure: unknown;
      try {
        await request("/restaurant/add", {
          method: "POST",
          body: { name: "测试店" },
        });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(ApiError);
      expect((failure as ApiError).code).toBe(90004);
      expect((failure as ApiError).message).toBe("未捕获异常");
      expect(errorMessage(failure)).toBe(
        "服务端处理请求时出现异常（错误码 90004）。",
      );
      expect(resultUncertain(failure)).toBe(true);
      expect(resultUncertain(new ApiError("未捕获异常", "90004"))).toBe(true);
      expect(resultUncertain(new ApiError("地址过长", 10001))).toBe(false);
      expect(errorMessage(new ApiError("地址过长", 10001))).toBe("地址过长");
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
});
