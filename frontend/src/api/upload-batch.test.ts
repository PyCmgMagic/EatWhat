import { describe, expect, it, vi } from "vitest";
import { createApi, uploadFiles } from "./service";
import { createTransport } from "./client";
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
