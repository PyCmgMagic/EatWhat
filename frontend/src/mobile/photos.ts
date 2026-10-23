import { stageColors } from "./catalog";
export async function adjustPhoto(
  file: File,
  crop: { x: number; y: number; zoom: number },
) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("照片读取失败，请换一张。"));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 768;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器无法处理照片。");
    const size =
      Math.min(img.naturalWidth, img.naturalHeight) / Math.max(1, crop.zoom);
    const x = (img.naturalWidth - size) / 2 - (crop.x * size) / 300,
      y = (img.naturalHeight - size) / 2 - (crop.y * size) / 300;
    ctx.drawImage(
      img,
      Math.max(0, Math.min(img.naturalWidth - size, x)),
      Math.max(0, Math.min(img.naturalHeight - size, y)),
      size,
      size,
      0,
      0,
      768,
      768,
    );
    const data = ctx.getImageData(0, 0, 768, 768).data;
    const scores = stageColors.map(() => 0);
    const hsv = (r: number, g: number, b: number) => {
      r /= 255;
      g /= 255;
      b /= 255;
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        d = max - min;
      let h = 0;
      if (d) {
        h =
          max === r
            ? ((g - b) / d) % 6
            : max === g
              ? (b - r) / d + 2
              : (r - g) / d + 4;
        h = (h * 60 + 360) % 360;
      }
      return { h, s: max === 0 ? 0 : d / max, v: max };
    };
    const palette = stageColors.map((c) =>
      hsv(
        parseInt(c.slice(1, 3), 16),
        parseInt(c.slice(3, 5), 16),
        parseInt(c.slice(5, 7), 16),
      ),
    );
    for (let p = 0; p < data.length; p += 64) {
      const pixel = p / 4,
        px = pixel % 768,
        py = Math.floor(pixel / 768);
      if ((px - 384) ** 2 + (py - 384) ** 2 > 384 ** 2) continue;
      const color = hsv(data[p], data[p + 1], data[p + 2]);
      if (color.s < 0.15 || color.v < 0.12) continue;
      let best = 0,
        distance = Infinity;
      palette.forEach((v, i) => {
        const dh =
          Math.min(Math.abs(v.h - color.h), 360 - Math.abs(v.h - color.h)) /
          180;
        const d =
          dh * 2 +
          Math.abs(v.s - color.s) * 0.35 +
          Math.abs(v.v - color.v) * 0.4;
        if (d < distance) {
          best = i;
          distance = d;
        }
      });
      scores[best] += color.s;
    }
    const colors = stageColors
      .map((color, i) => ({ color, score: scores[i] }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((c) => c.color);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("照片处理失败。"))),
        "image/jpeg",
        0.9,
      ),
    );
    return {
      file: new File(
        [blob],
        file.name.replace(/\.[^.]+$/, "") + "-cropped.jpg",
        { type: "image/jpeg" },
      ),
      colors,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function saveVisual(key: string, stage: string) {
  try {
    const all = JSON.parse(
      localStorage.getItem("eatwhat-stage-colors") || "{}",
    );
    all[key] = stage;
    localStorage.setItem("eatwhat-stage-colors", JSON.stringify(all));
  } catch {
    /* color choice is optional presentation metadata */
  }
}
