// @vitest-environment jsdom
import { expect, it } from "vitest";
import {
  applyPhotoEdit,
  type DraftPhoto,
  type DraftPhotoEdit,
} from "./draft-photo-edit";

const original = new File(["original"], "original.jpg", { type: "image/jpeg" });
const cropped = new File(["cropped"], "cropped.jpg", { type: "image/jpeg" });
const framing = { x: 12, y: -8, zoom: 1.6 };
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
  const after = applyPhotoEdit(before, edit, cropped, "blob:new", framing);
  expect(before).toHaveLength(1);
  expect(after[0]).toBe(before[0]);
  expect(after[1]).toEqual({
    file: cropped,
    url: "blob:new",
    original,
    framing,
  });
});

it("replaces the selected photo, preserves the others, and clears its stale upload key", () => {
  const before = [saved("blob:first"), saved("blob:second")];
  const after = applyPhotoEdit(
    before,
    { ...edit, targetUrl: "blob:first" },
    cropped,
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
  });
  expect(after[1]).toBe(before[1]);
});

it("finds the selected photo after its position in the list changes", () => {
  const before = [saved("blob:other"), saved("blob:target")];
  const after = applyPhotoEdit(
    before,
    { ...edit, targetUrl: "blob:target" },
    cropped,
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
      cropped,
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
    applyPhotoEdit(before, edit, cropped, "blob:extra", framing),
  ).toThrow("最多选择 9 张");
  expect(
    applyPhotoEdit(
      before,
      { ...edit, targetUrl: "blob:0" },
      cropped,
      "blob:edited",
      framing,
    ),
  ).toHaveLength(9);
});
