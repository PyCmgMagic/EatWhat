// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { compressImage } from "../api/image-compression";
import { demoUpload } from "./transport";

vi.mock("../api/image-compression", () => ({ compressImage: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  vi.mocked(compressImage).mockReset();
});

it.each(["foods", "avatar", "restaurants", "feedback", "comments", "activity"])(
  "stores the compressed %s image in isolated demo mode",
  async (biz) => {
    const original = new File(["original"], "picture.png", {
      type: "image/png",
    });
    const prepared = new File(["small"], "picture.webp", {
      type: "image/webp",
    });
    vi.mocked(compressImage).mockResolvedValueOnce(prepared);
    const key = await demoUpload(original, biz);
    expect(compressImage).toHaveBeenCalledWith(original, biz);
    expect(key.startsWith(`${biz}/`)).toBe(true);
    expect(localStorage.getItem(`eatwhat-demo-media-v4:${key}`)).toBe(
      "data:image/webp;base64,c21hbGw=",
    );
  },
);

it("does not store the original when compression fails", async () => {
  vi.mocked(compressImage).mockRejectedValueOnce(new Error("图片读取失败"));
  await expect(
    demoUpload(new File(["bad"], "bad.png", { type: "image/png" })),
  ).rejects.toThrow("图片读取失败");
  expect(localStorage.length).toBe(0);
});
