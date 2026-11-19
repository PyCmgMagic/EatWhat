// @vitest-environment jsdom
import { expect, it } from "vitest";
import {
  applyPhotoEdit,
  draftStage,
  type DraftPhoto,
  type DraftPhotoEdit,
} from "./draft-photo-edit";

const original = new File(["original"], "original.jpg", { type: "image/jpeg" });
const cropped = new File(["cropped"], "cropped.jpg", { type: "image/jpeg" });
const framing = { x: 12, y: -8, zoom: 1.6 };
const result = { file: cropped, colors: ["#9DBF7A", "#FFCB45", "#F3C46E"] };
const edit: DraftPhotoEdit = {
  source: original,
  url: "blob:preview",
  framing: { x: 0, y: 0, zoom: 1 },
  candidates: ["#F3C46E"],
};
const saved = (url: string): DraftPhoto => ({
  file: cropped,
  url,
  key: "foods/uploaded",
});

it("adds the confirmed crop and keeps the original and framing for later edits", () => {
  const before = [saved("blob:first")];
  const after = applyPhotoEdit(before, edit, result, "blob:new", framing);
  expect(before).toHaveLength(1);
  expect(after[0]).toBe(before[0]);
  expect(after[1]).toEqual({
    file: cropped,
    url: "blob:new",
    original,
    framing,
    stageCandidates: result.colors,
  });
});

it("replaces the selected photo, preserves the others, and clears its stale upload key", () => {
  const before = [saved("blob:first"), saved("blob:second")];
  const after = applyPhotoEdit(
    before,
    { ...edit, targetUrl: "blob:first" },
    result,
    "blob:edited",
    framing,
  );
  expect(after).toHaveLength(2);
  expect(before[0].url).toBe("blob:first");
  expect(after[0]).toEqual({
    file: cropped,
    url: "blob:edited",
    original,
    framing,
    stageCandidates: result.colors,
  });
  expect(after[1]).toBe(before[1]);
});

it("finds the selected photo after its position in the list changes", () => {
  const before = [saved("blob:other"), saved("blob:target")];
  const after = applyPhotoEdit(
    before,
    { ...edit, targetUrl: "blob:target" },
    result,
    "blob:edited",
    framing,
  );
  expect(after[0]).toBe(before[0]);
  expect(after[1].url).toBe("blob:edited");
});

it("does not replace another photo if the edited one was removed", () => {
  const before = [saved("blob:other")];
  expect(() =>
    applyPhotoEdit(
      before,
      { ...edit, targetUrl: "blob:removed" },
      result,
      "blob:new",
      framing,
    ),
  ).toThrow("这张照片已被移除");
  expect(before[0].url).toBe("blob:other");
});

it("allows editing at the photo limit while rejecting an additional photo", () => {
  const before = Array.from({ length: 9 }, (_, index) =>
    saved(`blob:${index}`),
  );
  expect(() =>
    applyPhotoEdit(before, edit, result, "blob:extra", framing),
  ).toThrow("最多选择 9 张");
  expect(
    applyPhotoEdit(
      before,
      { ...edit, targetUrl: "blob:0" },
      result,
      "blob:edited",
      framing,
    ),
  ).toHaveLength(9);
});

it("uses the current cover's candidates while preserving an explicit stage choice", () => {
  const cover = { ...saved("blob:cover"), stageCandidates: ["#9DB8D9"] };
  const images = applyPhotoEdit([cover], edit, result, "blob:new", framing);
  expect(draftStage({ images })).toBe("#9DB8D9");
  expect(draftStage({ images: [images[1], cover] })).toBe("#9DBF7A");
  expect(draftStage({ images: [images[1]], stage: "#C9442B" })).toBe("#C9442B");
  expect(draftStage({ images: [] })).toBe("#F3C46E");
});
