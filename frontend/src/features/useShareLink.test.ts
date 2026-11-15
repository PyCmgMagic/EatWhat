// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { copyLink, shareLink } from "./useShareLink";

const data = { title: "栗子布朗尼", url: "https://eat.example/#/foods/15" };
let writeText: ReturnType<typeof vi.fn>, nativeShare: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  nativeShare = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { share: nativeShare, clipboard: { writeText } });
});
afterEach(() => vi.unstubAllGlobals());
it("invokes native share with the dish title and URL", async () => {
  expect(await shareLink(data)).toBe("shared");
  expect(nativeShare).toHaveBeenCalledWith(data);
  expect(writeText).not.toHaveBeenCalled();
});
it.each(["NotAllowedError", "InvalidStateError", "DataError"])(
  "keeps copying an explicit choice when native share fails with %s",
  async (name) => {
    nativeShare.mockRejectedValue(new DOMException("unavailable", name));
    expect(await shareLink(data)).toBe("failed");
    expect(writeText).not.toHaveBeenCalled();
  },
);
it("reports unsupported native sharing without copying the link", async () => {
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  expect(await shareLink(data)).toBe("unsupported");
  expect(writeText).not.toHaveBeenCalled();
});
it("copies the link without invoking native sharing", async () => {
  expect(await copyLink(data.url)).toBe(true);
  expect(writeText).toHaveBeenCalledWith(data.url);
  expect(nativeShare).not.toHaveBeenCalled();
});
it("provides manual copying when clipboard permission is denied", async () => {
  writeText.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
  expect(await copyLink(data.url)).toBe(false);
  expect(nativeShare).not.toHaveBeenCalled();
});
it("provides manual copying without either browser API", async () => {
  vi.stubGlobal("navigator", {});
  expect(await copyLink(data.url)).toBe(false);
});
it("does not copy a link after native sharing is cancelled", async () => {
  nativeShare.mockRejectedValue(new DOMException("cancelled", "AbortError"));
  expect(await shareLink(data)).toBe("cancelled");
  expect(writeText).not.toHaveBeenCalled();
});
