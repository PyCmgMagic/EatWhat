import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { classifyAuth, createApi, uploadFile } from "./service";
import type { Schema, Page, Food } from "./models";
import type { components } from "./schema";
type ResponseData<T> = T extends {
  responses: { 200: { content: { "application/json": { data?: infer D } } } };
}
  ? NonNullable<D>
  : never;
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
  >().toEqualTypeOf<string | number>();
  expectTypeOf<
    components["schemas"]["PhoneLoginDataResponse"]["loginId"]
  >().toEqualTypeOf<string | number>();
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
