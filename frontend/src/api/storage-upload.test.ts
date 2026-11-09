import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadRequestUrl, UPLOAD_PROXY_PREFIX } from "./upload-target";
import { uploadFile, uploadFiles } from "./service";

vi.mock("./image-compression", () => ({
  compressImage: vi.fn(async (file: File) => file),
}));

const bucket =
  "https://" + "a".repeat(32) + ".r2.cloudflarestorage.com/eatwhat";
const path =
  "/staging/photo%20one?X-Amz-Signature=abc&X-Amz-SignedHeaders=content-type%3Bhost&x=%2F%2b";
afterEach(() => vi.unstubAllEnvs());

describe("development storage upload routing", () => {
  it("preserves the signed path, query order and encoding through the local proxy", () => {
    vi.stubEnv("DEV", true);
    expect(uploadRequestUrl(bucket + path, bucket)).toBe(
      UPLOAD_PROXY_PREFIX + "/eatwhat" + path,
    );
  });
  it("uses direct PUTs in production even when a development target exists", () => {
    vi.stubEnv("DEV", false);
    expect(uploadRequestUrl(bucket + path, bucket)).toBe(bucket + path);
  });
  it.each([
    "https://storage.example/photo?signature=1",
    bucket.replace("/eatwhat", "/eatwhat-other") + path,
    "http://127.0.0.1:5173/mock-storage/photo",
  ])("does not rewrite an unrelated destination: %s", (url) => {
    vi.stubEnv("DEV", true);
    expect(uploadRequestUrl(url, bucket)).toBe(url);
  });
  it("keeps direct uploading when no proxy is configured", () => {
    expect(uploadRequestUrl(bucket + path, "")).toBe(bucket + path);
  });
  it.each(["file:///tmp/file", "https://user:secret@storage.example/file"])(
    "rejects unsafe upload URLs: %s",
    (url) => {
      expect(() => uploadRequestUrl(url, "")).toThrow("上传地址无效");
    },
  );
});

describe("upload failure feedback", () => {
  const file = new File(["photo"], "dish.jpg", { type: "image/jpeg" });
  const api = () => ({
    presign: vi.fn(async () => ({ key: "foods/photo", putUrl: bucket + path })),
    presignBatch: vi.fn(async () => ({
      files: [
        { key: "foods/one", putUrl: bucket + path },
        { key: "foods/two", putUrl: bucket + path },
      ],
    })),
    complete: vi.fn(async (key: string) => ({ key })),
  });
  it.each([1, 2])(
    "does not confirm a completed PUT after cancellation (%i files)",
    async (count) => {
      const controller = new AbortController();
      const methods = api();
      const put = vi.fn(async () => {
        controller.abort();
        return new Response(null, { status: 200 });
      });
      await expect(
        uploadFiles(
          methods,
          Array(count).fill(file),
          "foods",
          controller.signal,
          put,
        ),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(put).toHaveBeenCalledOnce();
      expect(methods.complete).not.toHaveBeenCalled();
    },
  );
  it("explains a blocked connection without confirming a missing file", async () => {
    const methods = api();
    const cause = new TypeError("Failed to fetch");
    await expect(
      uploadFile(
        methods,
        file,
        "foods",
        undefined,
        vi.fn().mockRejectedValue(cause),
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining("未能连接上传服务"),
      cause,
    });
    expect(methods.complete).not.toHaveBeenCalled();
  });
  it("identifies a later batch failure and retains the already confirmed image", async () => {
    const methods = api(),
      completed = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(
      uploadFiles(
        methods,
        [file, file],
        "foods",
        undefined,
        fetcher,
        completed,
      ),
    ).rejects.toThrow("第 2 张图片未能连接上传服务");
    expect(methods.complete.mock.calls).toEqual([["foods/one"]]);
    expect(completed.mock.calls).toEqual([[0, "foods/one"]]);
  });
  it("distinguishes timeouts from network failures", async () => {
    await expect(
      uploadFile(
        api(),
        file,
        "foods",
        undefined,
        vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")),
      ),
    ).rejects.toThrow("上传超时");
  });
  it("preserves explicit cancellation", async () => {
    const cause = new DOMException("cancelled", "AbortError");
    await expect(
      uploadFile(
        api(),
        file,
        "foods",
        undefined,
        vi.fn().mockRejectedValue(cause),
      ),
    ).rejects.toBe(cause);
  });
});
