import { validateFiles } from "../api/validation";
import { rectPhotoFraming, type PhotoFraming } from "../mobile/photo-framing";

export type ShopPhotoCrop = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
export type ShopCropHandle =
  "move" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type ShopPhotoAdjustment = { turns: number; bounds: ShopPhotoCrop };
type PreviousAdjustment = { turns: number; crop?: PhotoFraming };
export type ShopPhotoSelection = {
  file: File;
  edit?: { source: File; adjustment: ShopPhotoAdjustment | PreviousAdjustment };
};

export const fullPhotoCrop: ShopPhotoCrop = {
  left: 0,
  top: 0,
  right: 1,
  bottom: 1,
};
export const originalShopPhoto: ShopPhotoAdjustment = {
  turns: 0,
  bounds: fullPhotoCrop,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function sameShopCrop(a: ShopPhotoCrop, b: ShopPhotoCrop) {
  return (Object.keys(a) as Array<keyof ShopPhotoCrop>).every(
    (edge) => Math.abs(a[edge] - b[edge]) < 1e-8,
  );
}

export function rotateShopPhoto({
  turns,
  bounds,
}: ShopPhotoAdjustment): ShopPhotoAdjustment {
  return {
    turns: (turns + 1) % 4,
    bounds: {
      left: 1 - bounds.bottom,
      top: bounds.left,
      right: 1 - bounds.top,
      bottom: bounds.right,
    },
  };
}

export function moveShopCrop(
  bounds: ShopPhotoCrop,
  handle: ShopCropHandle,
  offset: { x: number; y: number },
  min: { width: number; height: number },
): ShopPhotoCrop {
  const { left, top, right, bottom } = bounds;
  if (handle === "move") {
    const x = clamp(offset.x, -left, 1 - right);
    const y = clamp(offset.y, -top, 1 - bottom);
    return {
      left: left + x,
      top: top + y,
      right: right + x,
      bottom: bottom + y,
    };
  }
  const width = Math.min(min.width, right - left);
  const height = Math.min(min.height, bottom - top);
  return {
    left: handle.endsWith("left")
      ? clamp(left + offset.x, 0, right - width)
      : left,
    top: handle.startsWith("top")
      ? clamp(top + offset.y, 0, bottom - height)
      : top,
    right: handle.endsWith("right")
      ? clamp(right + offset.x, left + width, 1)
      : right,
    bottom: handle.startsWith("bottom")
      ? clamp(bottom + offset.y, top + height, 1)
      : bottom,
  };
}

export function orientedPhoto(
  image: Pick<HTMLImageElement, "naturalWidth" | "naturalHeight">,
  turns: number,
) {
  const { naturalWidth: width, naturalHeight: height } = image;
  return turns % 2 ? { width: height, height: width } : { width, height };
}

export function readShopPhotoAdjustment(
  image: HTMLImageElement,
  edit: ShopPhotoSelection["edit"],
): ShopPhotoAdjustment {
  if (!edit) return originalShopPhoto;
  const adjustment = edit.adjustment;
  if ("bounds" in adjustment) return adjustment;
  const { turns, crop } = adjustment;
  if (!crop) return { turns, bounds: fullPhotoCrop };
  // Previous in-memory drafts stored framing in a fixed 3:2 window.
  const { width, height } = orientedPhoto(image, turns);
  const region = rectPhotoFraming(width, height, crop, 3 / 2).source;
  return {
    turns,
    bounds: {
      left: clamp(region.x / width, 0, 1),
      top: clamp(region.y / height, 0, 1),
      right: clamp((region.x + region.width) / width, 0, 1),
      bottom: clamp((region.y + region.height) / height, 0, 1),
    },
  };
}

export async function applyShopPhotoEdit(
  source: File,
  image: HTMLImageElement,
  adjustment: ShopPhotoAdjustment,
): Promise<ShopPhotoSelection> {
  const { turns, bounds } = adjustment;
  if (!turns && sameShopCrop(bounds, fullPhotoCrop)) return { file: source };

  const { width, height } = orientedPhoto(image, turns);
  const region = {
    x: bounds.left * width,
    y: bounds.top * height,
    width: (bounds.right - bounds.left) * width,
    height: (bounds.bottom - bounds.top) * height,
  };
  // Keep a PNG fallback within the upload limit even for high-entropy RGBA.
  const scale = Math.min(1, 1600 / Math.max(region.width, region.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width * scale));
  canvas.height = Math.max(1, Math.round(region.height * scale));
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器无法编辑照片。");
    ctx.imageSmoothingQuality = "high";
    ctx.scale(canvas.width / region.width, canvas.height / region.height);
    ctx.translate(width / 2 - region.x, height / 2 - region.y);
    ctx.rotate((turns * Math.PI) / 2);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    const mime = source.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result?.size
            ? resolve(result)
            : reject(new Error("照片保存失败，请重试。")),
        mime,
        0.92,
      ),
    );
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/png": "png",
    };
    const extension = extensions[blob.type];
    if (!extension) throw new Error("浏览器未能生成可上传的照片。");
    const name = source.name.replace(/\.[^.]+$/, "") || "storefront";
    const file = new File([blob], `${name}-edited.${extension}`, {
      type: blob.type,
    });
    validateFiles([file], 0);
    return { file, edit: { source, adjustment } };
  } finally {
    canvas.width = canvas.height = 0;
  }
}
