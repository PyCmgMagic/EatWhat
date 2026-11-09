import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApi, uploadFiles } from "./service";
import { createTransport } from "./client";
import { compressImage } from "./image-compression";

vi.mock("./image-compression", () => ({
  compressImage: vi.fn(async (file: File) => file),
}));
beforeEach(() => {
  vi.mocked(compressImage)
    .mockReset()
    .mockImplementation(async (file) => file);
});
const files = [
  new File(["png"], "a.png", { type: "image/png" }),
  new File(["jpeg"], "b.jpg", { type: "image/jpeg" }),
];
const makeApi = () => ({
  presign: vi.fn(async () => ({
    key: "foods/a",
    putUrl: "https://storage.test/a",
  })),
  presignBatch: vi.fn(async () => ({
    files: [
      { key: "foods/a", putUrl: "https://storage.test/a" },
      { key: "foods/b", putUrl: "https://storage.test/b" },
    ],
  })),
  complete: vi.fn(async (key: string) => ({ key, revision: 1, size: 3 })),
});
describe("batch image uploading", () => {
  it.each([
    "foods",
    "avatar",
    "restaurants",
    "feedback",
    "comments",
    "activity",
  ] as const)(
    "compresses every %s image before signing a batch and uploads the prepared files in order",
    async (biz) => {
      const api = makeApi();
      const prepared = [
        new File(["a"], "a.webp", { type: "image/webp" }),
        new File(["b"], "b.jpg", { type: "image/jpeg" }),
      ];
      vi.mocked(compressImage)
        .mockResolvedValueOnce(prepared[0])
        .mockResolvedValueOnce(prepared[1]);
      const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
      const completed = vi.fn();
      await uploadFiles(api, files, biz, undefined, fetcher, completed);
      expect(vi.mocked(compressImage).mock.calls).toEqual([
        [files[0], biz, undefined],
        [files[1], biz, undefined],
      ]);
      expect(api.presignBatch).toHaveBeenCalledWith({
        biz,
        files: prepared.map((file) => ({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        })),
      });
      expect(fetcher).toHaveBeenNthCalledWith(
        1,
        "https://storage.test/a",
        expect.objectContaining({
          body: prepared[0],
          headers: { "Content-Type": "image/webp" },
        }),
      );
      expect(fetcher).toHaveBeenNthCalledWith(
        2,
        "https://storage.test/b",
        expect.objectContaining({
          body: prepared[1],
          headers: { "Content-Type": "image/jpeg" },
        }),
      );
      expect(completed.mock.calls).toEqual([
        [0, "foods/a"],
        [1, "foods/b"],
      ]);
    },
  );
  it("does not request signatures or upload originals when compression fails", async () => {
    const api = makeApi(),
      fetcher = vi.fn();
    vi.mocked(compressImage).mockRejectedValueOnce(new Error("图片读取失败"));
    await expect(
      uploadFiles(api, files, "foods", undefined, fetcher),
    ).rejects.toThrow("图片读取失败");
    expect(api.presign).not.toHaveBeenCalled();
    expect(api.presignBatch).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requests one batch, sends each raw file without application credentials, and confirms ordered keys", async () => {
    const api = makeApi(),
      fetcher = vi.fn(
        async (_url: RequestInfo | URL, _options?: RequestInit) =>
          new Response(null, { status: 200 }),
      ),
      completed = vi.fn();
    expect(
      await uploadFiles(api, files, "foods", undefined, fetcher, completed),
    ).toEqual(["foods/a", "foods/b"]);
    expect(api.presignBatch).toHaveBeenCalledWith({
      biz: "foods",
      files: [
        { fileName: "a.png", contentType: "image/png", fileSize: 3 },
        { fileName: "b.jpg", contentType: "image/jpeg", fileSize: 4 },
      ],
    });
    expect(api.presign).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.map((call) => call[1])).toMatchObject([
      {
        method: "PUT",
        credentials: "omit",
        redirect: "error",
        headers: { "Content-Type": "image/png" },
        body: files[0],
      },
      {
        method: "PUT",
        credentials: "omit",
        redirect: "error",
        headers: { "Content-Type": "image/jpeg" },
        body: files[1],
      },
    ]);
    expect(completed.mock.calls).toEqual([
      [0, "foods/a"],
      [1, "foods/b"],
    ]);
  });
  it("retains the first confirmed key when a later upload fails so retry can skip it", async () => {
    const api = makeApi(),
      fetcher = vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(new Response(null, { status: 503 })),
      completed = vi.fn();
    await expect(
      uploadFiles(api, files, "foods", undefined, fetcher, completed),
    ).rejects.toThrow("第 2 张");
    expect(completed.mock.calls).toEqual([[0, "foods/a"]]);
    expect(api.complete.mock.calls).toEqual([["foods/a"]]);
  });
  it("rejects inconsistent or duplicate credentials before uploading any bytes", async () => {
    const api = makeApi(),
      fetcher = vi.fn();
    api.presignBatch.mockResolvedValueOnce({
      files: [{ key: "foods/a", putUrl: "https://storage.test/a" }],
    });
    await expect(
      uploadFiles(api, files, "foods", undefined, fetcher),
    ).rejects.toThrow("不一致");
    api.presignBatch.mockResolvedValueOnce({
      files: [
        { key: "foods/a", putUrl: "https://storage.test/a" },
        { key: "foods/a", putUrl: "https://storage.test/b" },
      ],
    });
    await expect(
      uploadFiles(api, files, "foods", undefined, fetcher),
    ).rejects.toThrow("不一致");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects failed file confirmation without adding that key to the draft", async () => {
    const api = makeApi(),
      completed = vi.fn();
    api.complete.mockResolvedValueOnce({
      key: "foods/other",
      revision: 1,
      size: 3,
    });
    await expect(
      uploadFiles(
        api,
        files,
        "foods",
        undefined,
        vi.fn(async () => new Response(null, { status: 200 })),
        completed,
      ),
    ).rejects.toThrow("不一致");
    expect(completed).not.toHaveBeenCalled();
  });
});
it("password withdrawal uses the public request boundary and excludes a prior session", async () => {
  const fetcher = vi.fn(
    async (_input: RequestInfo | URL, options?: RequestInit) => {
      expect(new Headers(options?.headers).has("x-existing-session")).toBe(
        false,
      );
      return new Response(
        JSON.stringify({ code: 0, data: { status: "WITHDRAWN" } }),
        { status: 200 },
      );
    },
  );
  const api = createApi(
    createTransport(
      "https://gateway.test/api",
      () => ({ tokenName: "x-existing-session", tokenValue: "private" }),
      fetcher,
    ),
  );
  expect(
    await api.withdrawConsentWithPassword({
      userName: "student",
      password: "private-password",
    }),
  ).toMatchObject({ status: "WITHDRAWN" });
});
