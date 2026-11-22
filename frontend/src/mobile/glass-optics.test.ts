import { describe, expect, it } from "vitest";
import { rasterizeGlass, sampleGlassSurface } from "./glass-optics";

describe("glass surface optics", () => {
  it.each([60, 218, 288, 418])(
    "keeps the %i px lens symmetric and finite",
    (width) => {
      for (let y = 0; y <= 60; y += 3) {
        for (let x = 0; x <= width; x += 3) {
          const point = sampleGlassSurface(x, y, width, 60);
          const mirror = sampleGlassSurface(width - x, 60 - y, width, 60);
          expect(Object.values(point).every(Number.isFinite)).toBe(true);
          expect(point.dx).toBeCloseTo(-mirror.dx, 10);
          expect(point.dy).toBeCloseTo(-mirror.dy, 10);
        }
      }
    },
  );

  it("retains strong rim lensing and the existing central magnification", () => {
    const centre = sampleGlassSurface(100, 25, 300, 60);
    expect(centre.dx).toBeCloseTo(2.25);
    expect(centre.dy).toBeCloseTo(1);
    const rim = Array.from({ length: 52 }, (_, i) =>
      sampleGlassSurface(150, (i + 0.5) / 4, 300, 60),
    );
    // The old rim peaked at 17 CSS px including the central magnification.
    expect(Math.max(...rim.map((point) => point.dy))).toBeGreaterThan(17);
    expect(rim.every((point) => point.dy > centre.dy)).toBe(true);
  });

  it("joins the straight and rounded portions without a seam", () => {
    for (const y of [0.25, 2, 6, 12]) {
      const left = sampleGlassSurface(30 - 0.001, y, 300, 60);
      const right = sampleGlassSurface(30 + 0.001, y, 300, 60);
      for (const key of ["dx", "dy", "highlight", "shade"] as const) {
        expect(Math.abs(left[key] - right[key])).toBeLessThan(0.002);
      }
    }
  });

  it("lights the curved surface directionally without whitening the centre", () => {
    const top = sampleGlassSurface(150, 0.5, 300, 60);
    const bottom = sampleGlassSurface(150, 59.5, 300, 60);
    const centre = sampleGlassSurface(150, 30, 300, 60);
    expect(top.highlight).toBeGreaterThan(bottom.highlight);
    expect(bottom.shade).toBeGreaterThan(top.shade);
    expect(centre.highlight).toBeCloseTo(0, 10);
    expect(centre.shade).toBe(0);
  });

  it.each([1, 2, 3])(
    "encodes the full field without clipping at density %i",
    (density) => {
      const map = rasterizeGlass(418, 60, density);
      expect(map.width).toBe(418 * Math.min(density, 2));
      expect(map.height).toBe(60 * Math.min(density, 2));
      expect(map.lighting[3]).toBe(0); // Outside the rounded silhouette.
      let minimum = 255;
      let maximum = 0;
      for (let pixel = 0; pixel < map.width * map.height; pixel++) {
        for (let channel = 0; channel < 2; channel++) {
          const encoded = map.displacement[pixel * 4 + channel];
          minimum = Math.min(minimum, encoded);
          maximum = Math.max(maximum, encoded);
        }
      }
      expect(minimum).toBeGreaterThan(0);
      expect(maximum).toBeLessThan(255);
      const x = Math.floor(map.width / 2);
      const y = Math.floor(map.height / 2);
      expect(map.lighting[(y * map.width + x) * 4 + 3]).toBe(0);
      // Raster resolution may change, but refraction remains in CSS pixels.
      const source = sampleGlassSurface(
        ((x + 0.5) * 418) / map.width,
        ((y + 0.5) * 60) / map.height,
        418,
        60,
      );
      const decoded =
        (map.displacement[(y * map.width + x) * 4] / 255 - 0.5) * map.scale;
      expect(Math.abs(decoded - source.dx)).toBeLessThanOrEqual(
        map.scale / 510,
      );
    },
  );
});
