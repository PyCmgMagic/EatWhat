import { expect, it } from "vitest";
import { stagePalette } from "../api/food-display";
import { rankStageColors } from "./stage-recommendation";

function pixels(paint: (x: number, y: number) => number[]) {
  const width = 24;
  const height = 24;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(paint(x - width / 2, y - height / 2), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

it.each([
  { rgba: [157, 184, 217, 255], expected: stagePalette.porcelain },
  { rgba: [157, 191, 122, 255], expected: stagePalette.matcha },
  { rgba: [201, 68, 43, 255], expected: stagePalette.tomato },
])("ranks a matching color first and returns two distinct alternatives", ({ rgba, expected }) => {
  const stages = rankStageColors(pixels(() => rgba));
  expect(stages[0]).toBe(expected);
  expect(new Set(stages).size).toBe(3);
});

it("ranks the subject beyond a pale plate and ignores the corners outside the crop circle", () => {
  const stages = rankStageColors(
    pixels((x, y) => {
      const radius = Math.hypot(x + 0.5, y + 0.5);
      if (radius < 5) return [74, 144, 44, 255];
      return radius < 12 ? [247, 246, 243, 255] : [201, 68, 43, 255];
    }),
  );
  expect(stages[0]).toBe(stagePalette.matcha);
});

it("uses a softer supported palette on a neutral cover and ignores fully transparent pixels", () => {
  expect(rankStageColors(pixels(() => [212, 212, 212, 255]))[0]).toBe(
    stagePalette.porcelain,
  );
  expect(rankStageColors(pixels(() => [201, 68, 43, 0]))).toEqual([]);
});
