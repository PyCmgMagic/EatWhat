import { expect, it } from "vitest";
import {
  fullPhotoCrop,
  moveShopCrop,
  readShopPhotoAdjustment,
  rotateShopPhoto,
  sameShopCrop,
  shopCropMinimum,
} from "./shop-photo-edit";

it("resizes only the selected edges and keeps a draggable selection", () => {
  const bounds = moveShopCrop(
    fullPhotoCrop,
    "top-right",
    { x: -1, y: 1 },
    { width: 0.25, height: 0.125 },
  );
  expect(bounds).toEqual({ left: 0, top: 0.875, right: 0.25, bottom: 1 });
});

it("fits a moved selection inside the photo without changing its size", () => {
  const bounds = moveShopCrop(
    { left: 0.125, top: 0.125, right: 0.75, bottom: 0.5 },
    "move",
    { x: -0.5, y: 1 },
    { width: 0.25, height: 0.125 },
  );
  expect(bounds).toEqual({ left: 0, top: 0.625, right: 0.625, bottom: 1 });
});

it("can crop both axes of narrow, rotated, and small photos", () => {
  for (const [width, height] of [
    [180, 1200],
    [1200, 180],
    [8, 10],
  ]) {
    const minimum = shopCropMinimum(width, height);
    const cropped = moveShopCrop(
      fullPhotoCrop,
      "top-left",
      { x: 0.5, y: 0.5 },
      minimum,
    );
    expect(cropped).toEqual({ left: 0.5, top: 0.5, right: 1, bottom: 1 });
    expect(minimum.width * width).toBeGreaterThanOrEqual(1);
    expect(minimum.height * height).toBeGreaterThanOrEqual(1);
  }
});

it("rotates the selected pixels with the photo", () => {
  const initial = {
    turns: 0,
    bounds: { left: 0.125, top: 0.25, right: 0.5, bottom: 0.875 },
  };
  const once = rotateShopPhoto(initial);
  expect(once).toEqual({
    turns: 1,
    bounds: { left: 0.125, top: 0.125, right: 0.75, bottom: 0.5 },
  });
  expect(rotateShopPhoto(rotateShopPhoto(rotateShopPhoto(once)))).toEqual(
    initial,
  );
});

it("reopens the same crop from a draft saved with fixed framing", () => {
  const image = { naturalWidth: 600, naturalHeight: 400 } as HTMLImageElement;
  const source = new File([], "storefront.jpg");
  const edit = {
    source,
    adjustment: { turns: 1, crop: { x: 0, y: 0, zoom: 1 } },
  };
  const adjustment = readShopPhotoAdjustment(image, edit);
  expect(adjustment.turns).toBe(1);
  expect(
    sameShopCrop(adjustment.bounds, {
      left: 0,
      top: 5 / 18,
      right: 1,
      bottom: 13 / 18,
    }),
  ).toBe(true);
});
