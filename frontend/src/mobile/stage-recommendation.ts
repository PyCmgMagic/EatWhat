import { stagePalette } from "../api/food-display";

function hsv(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let hue = 0;
  if (delta) {
    if (max === r) hue = (g - b) / delta;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  return {
    hue: (hue * 60 + 360) % 360,
    saturation: max ? delta / max : 0,
    value: max / 255,
  };
}

const palette = Object.values(stagePalette).map((hex) => ({
  hex,
  ...hsv(
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ),
}));

/** Rank the supported stage colors against the visible circle of a cover. */
export function rankStageColors({
  data,
  width,
  height,
}: Pick<ImageData, "data" | "width" | "height">): string[] {
  const scores = palette.map(() => 0);
  for (let y = 0; y < height; y++) {
    const dy = ((y + 0.5) / height) * 2 - 1;
    for (let x = 0; x < width; x++) {
      const dx = ((x + 0.5) / width) * 2 - 1;
      const radiusSquared = dx * dx + dy * dy;
      const pixel = (y * width + x) * 4;
      const opacity = data[pixel + 3] / 255;
      if (radiusSquared > 1 || opacity < 0.1) continue;

      const color = hsv(data[pixel], data[pixel + 1], data[pixel + 2]);
      // A colorful subject carries more weight than a pale plate or shadow.
      const vividness = Math.min(1, color.saturation / 0.35);
      const weight =
        opacity *
        (1 - 0.65 * radiusSquared) *
        (0.18 + 0.82 * vividness) *
        (0.2 + 0.8 * Math.min(1, color.value / 0.24));
      palette.forEach((stage, index) => {
        const hueDelta = Math.abs(stage.hue - color.hue);
        const hueDistance = Math.min(hueDelta, 360 - hueDelta) / 180;
        const distance =
          hueDistance * 2 * vividness +
          Math.abs(stage.saturation - color.saturation) * 0.45 +
          Math.abs(stage.value - color.value) * (0.7 - 0.35 * vividness);
        // Score all nearby colors so even a single hue has ranked alternatives.
        scores[index] += weight * Math.exp(-8 * distance);
      });
    }
  }
  return palette
    .map(({ hex }, index) => ({ hex, score: scores[index] }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ hex }) => hex);
}
