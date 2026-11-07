import { expect, it } from "vitest";
import { photoFraming } from "./photo-framing";

it("keeps the full square at the initial zoom", () => {
  const result = photoFraming(1200, 1200, { x: 0, y: 0, zoom: 1 });
  expect(result.source).toEqual({ x: 0, y: 0, size: 1200 });
  expect(result.image).toEqual({ left: 0, top: 0, width: 300, height: 300 });
});

it.each([
  [1600, 900],
  [900, 1600],
])(
  "can select either end of a %i × %i photo without exposing blank space",
  (width, height) => {
    const near = photoFraming(width, height, { x: 10000, y: 10000, zoom: 1 });
    const far = photoFraming(width, height, { x: -10000, y: -10000, zoom: 1 });
    expect(near.source.x).toBeCloseTo(0);
    expect(near.source.y).toBeCloseTo(0);
    expect(far.source.x + far.source.size).toBeCloseTo(width);
    expect(far.source.y + far.source.size).toBeCloseTo(height);
  },
);

it("exports the same off-center zoomed selection shown in the frame", () => {
  expect(photoFraming(1200, 1200, { x: 150, y: -100, zoom: 2 }).source).toEqual(
    { x: 0, y: 500, size: 600 },
  );
});

it.each([
  [900, 900],
  [1600, 900],
  [900, 1600],
])(
  "scales the frame and thumbnail proportionally for %i × %i photos",
  (width, height) => {
    const crop = { x: 83, y: -62, zoom: 1.6 };
    const large = photoFraming(width, height, crop, 300);
    const small = photoFraming(width, height, crop, 100);
    expect(small.source).toEqual(large.source);
    for (const key of ["left", "top", "width", "height"] as const)
      expect(small.image[key] * 3).toBeCloseTo(large.image[key]);
    // Visible center maps back to the same source point as the exported square.
    expect(((50 - small.image.left) / small.image.width) * width).toBeCloseTo(
      small.source.x + small.source.size / 2,
    );
    expect(((50 - small.image.top) / small.image.height) * height).toBeCloseTo(
      small.source.y + small.source.size / 2,
    );
  },
);

it("reclamps pan when zooming back out", () => {
  const result = photoFraming(1200, 1200, { x: 150, y: -150, zoom: 1 });
  expect(result.crop.x).toBeCloseTo(0);
  expect(result.crop.y).toBeCloseTo(0);
  expect(result.crop.zoom).toBe(1);
  expect(result.source).toEqual({ x: 0, y: 0, size: 1200 });
});
