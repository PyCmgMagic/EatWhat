import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { classifyAuth, createApi, uploadFile } from "./service";
import { createTransport } from "./client";
import type { Schema, Page, Food } from "./models";
import type { components } from "./schema";
type ResponseData<T> = T extends {
  responses: { 200: { content: { "application/json": { data?: infer D } } } };
}
  ? NonNullable<D>
  : never;

describe("recommendation response formats", () => {
  const food: Food = {
    id: 1000000245,
    accountId: 1000000001,
    name: "招牌牛筋面",
    restaurantId: 1000000141,
    restaurantName: "测试餐厅",
    category: "staple",
    description: "免费加面 吃得很爽",
    price: 18.9,
    pictureKeys: ["foods/test/noodles.jpg"],
    pictureUrl: ["https://images.example.test/noodles.jpg?signature=test"],
    coverCrop: { centerX: 0.5, centerY: 0.4704, diameter: 1 },
    stageColor: "soy",
    stageAlternates: ["redoil", "chili"],
    mealTimes: ["lunch", "dinner"],
    isLiked: true,
    isFavorite: false,
    myCustomTags: [],
  };

  it("reads the deployed data array through the real HTTP adapter without losing display fields", async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ code: 0, data: [food] })),
    );
    const api = createApi(createTransport("/api", () => null, fetcher));
    await expect(
      api.recommend(4, {
        campusId: 1,
        mealTime: "dinner",
        category: "staple",
        deviceId: "test-device",
      }),
    ).resolves.toEqual([food]);
    expect(fetcher.mock.calls[0][0]).toBe(
      "/api/foods/recommend?size=4&campusId=1&mealTime=dinner&category=staple&deviceId=test-device",
    );
  });

  it.each([
    { data: [], expected: [] },
    { data: { items: [food], totalItems: 1 }, expected: [food] },
    { data: { items: [], totalItems: 0 }, expected: [] },
  ])(
    "also accepts empty arrays and documented page responses: $data",
    async ({ data, expected }) => {
      const api = createApi(async () => ({ code: 0, data }));
      await expect(api.recommend()).resolves.toEqual(expected);
    },
  );

  it.each([{}, { items: null }, { items: {} }, "invalid"])(
    "reports malformed recommendation data instead of displaying an empty result: %j",
    async (data) => {
      const api = createApi(async () => ({ code: 0, data }));
      await expect(api.recommend()).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
    },
  );

  it("keeps missing data and business failures distinct from empty recommendations", async () => {
    const missing = createApi(async () => ({ code: 0, data: null }));
    await expect(missing.recommend()).rejects.toMatchObject({
      code: "MISSING_DATA",
    });
    const failed = createApi(async () => ({
      code: 503,
      msg: "推荐服务暂不可用",
      data: [],
    }));
    await expect(failed.recommend()).rejects.toMatchObject({ code: 503 });
  });
});

describe("authentication states", () => {
  it("accepts only an explicit successful logged-in session", () => {
    expect(
      classifyAuth({
        code: 0,
        data: { tokenName: "satoken", tokenValue: "abc", isLogin: true },
      }),
    ).toEqual({
      kind: "session",
      session: { tokenName: "satoken", tokenValue: "abc" },
    });
    for (const data of [
      null,
      { tokenName: "satoken", tokenValue: "abc" },
      { tokenName: "", tokenValue: "abc", isLogin: true },
      { tokenName: "satoken", tokenValue: "abc", isLogin: false },
    ])
      expect(classifyAuth({ code: 0, data }).kind).toBe("error");
    expect(
      classifyAuth({
        code: 403,
        data: { tokenName: "satoken", tokenValue: "abc", isLogin: true },
      }).kind,
    ).toBe("error");
  });
  it("never treats consent proofs or accepted registration as a session", () => {
    expect(
      classifyAuth({
        code: 20005,
        data: { consentProof: "proof", status: "PENDING" },
      }),
    ).toMatchObject({ kind: "consent", proof: "proof" });
    expect(
      classifyAuth({
        code: 0,
        data: { identityReady: false, registrationAccepted: true },
      }).kind,
    ).toBe("consent");
  });
});
describe("three-step storage upload", () => {
  it("uploads raw bytes without app headers and completes the same key", async () => {
    const events: string[] = [],
      api = {
        presign: vi.fn(async () => {
          events.push("presign");
          return {
            key: "foods/key.jpg",
            putUrl: "https://storage.invalid/signed?signature=x",
          };
        }),
        complete: vi.fn(async (key: string) => {
          events.push("complete");
          return { key, fileId: "uuid", revision: 1, size: 3 };
        }),
      };
    const fetcher = vi.fn<typeof fetch>(async () => {
      events.push("PUT");
      return new Response(null, { status: 200 });
    });
    const file = new File(["raw"], "photo.jpg", { type: "image/jpeg" });
    await expect(
      uploadFile(api, file, "foods", undefined, fetcher),
    ).resolves.toBe("foods/key.jpg");
    expect(events).toEqual(["presign", "PUT", "complete"]);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: "PUT",
      credentials: "omit",
      body: file,
      headers: { "Content-Type": "image/jpeg" },
    });
    expect(Object.keys(fetcher.mock.calls[0][1]?.headers || {})).toEqual([
      "Content-Type",
    ]);
    expect(api.complete).toHaveBeenCalledWith("foods/key.jpg");
  });
  it("does not confirm failed PUTs or accept inconsistent completion keys", async () => {
    const api = {
      presign: vi.fn(async () => ({
        key: "k",
        putUrl: "https://storage.invalid/put",
      })),
      complete: vi.fn(async () => ({
        key: "wrong",
        fileId: "uuid",
        revision: 1,
        size: 1,
      })),
    };
    await expect(
      uploadFile(
        api,
        new File(["x"], "x.png", { type: "image/png" }),
        "foods",
        undefined,
        vi.fn(async () => new Response(null, { status: 403 })),
      ),
    ).rejects.toThrow("上传失败");
    expect(api.complete).not.toHaveBeenCalled();
    await expect(
      uploadFile(
        api,
        new File(["x"], "x.png", { type: "image/png" }),
        "foods",
        undefined,
        vi.fn(async () => new Response(null, { status: 200 })),
      ),
    ).rejects.toThrow("不一致");
  });
});
it("response types preserve array, page and consent status distinctions from v3", () => {
  const api = createApi(async () => ({ code: 0, data: null }));
  expectTypeOf<
    components["schemas"]["BrowseHistoryItemDTOResponse"]
  >().not.toBeNever();
  expectTypeOf<
    components["schemas"]["FoodVOResponse"]["coverCrop"]
  >().toEqualTypeOf<components["schemas"]["CoverCropDTOResponse"] | null>();
  expectTypeOf<Awaited<ReturnType<typeof api.consent>>>().toEqualTypeOf<
    Schema["ConsentStatusViewResponse"]
  >();
  expectTypeOf<
    components["schemas"]["SaTokenInfoResponse"]["loginId"]
  >().toEqualTypeOf<string>();
  expectTypeOf<
    components["schemas"]["PhoneLoginDataResponse"]["loginId"]
  >().toEqualTypeOf<string>();
  expectTypeOf<Awaited<ReturnType<typeof api.systemTags>>>().toEqualTypeOf<
    Schema["FoodTagSummaryVOResponse"][]
  >();
  expectTypeOf<Awaited<ReturnType<typeof api.hubs>>>().toEqualTypeOf<
    Page<Schema["HubResponse"]>
  >();
  expectTypeOf<Awaited<ReturnType<typeof api.recommend>>>().toEqualTypeOf<
    Food[]
  >();
  expectTypeOf<
    Awaited<ReturnType<typeof api.unread>>
  >().toEqualTypeOf<number>();
});
