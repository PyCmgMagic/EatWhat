import { photoFraming, type PhotoFraming } from "./photo-framing";
import { rankStageColors } from "./stage-recommendation";

const centered: PhotoFraming = { x: 0, y: 0, zoom: 1 };

async function readPhoto<T>(
  file: File,
  read: (image: HTMLImageElement) => T | Promise<T>,
): Promise<T> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("照片读取失败，请换一张。"));
      i.src = url;
    });
    return await read(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function sampleStageColors(img: HTMLImageElement, crop: PhotoFraming) {
  try {
    const canvas = document.createElement("canvas");
    const side = 48;
    canvas.width = canvas.height = side;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];
    const { x, y, size } = photoFraming(img.naturalWidth, img.naturalHeight, crop).source;
    ctx.drawImage(img, x, y, size, size, 0, 0, side, side);
    return rankStageColors(ctx.getImageData(0, 0, side, side));
  } catch {
    return [];
  }
}

export function recommendPhotoStage(file: File, crop = centered) {
  return readPhoto(file, (img) => sampleStageColors(img, crop));
}

export function verifyPhoto(file: File) {
  return readPhoto(file, () => undefined);
}

export function adjustPhoto(file: File, crop: PhotoFraming) {
  return readPhoto(file, async (img) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 768;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器无法处理照片。");
    const { x, y, size } = photoFraming(
      img.naturalWidth,
      img.naturalHeight,
      crop,
    ).source;
    ctx.drawImage(img, x, y, size, size, 0, 0, 768, 768);
    const colors = sampleStageColors(img, crop);
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
  });
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
