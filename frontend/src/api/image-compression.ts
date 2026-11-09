import { validateFiles } from "./validation";

const PHOTO_LIMITS = { edge: 1920, bytes: 1024 * 1024 };
const AVATAR_LIMITS = { edge: 768, bytes: 256 * 1024 };

/** Prepare every uploaded image before requesting a signature for its exact bytes. */
export async function compressImage(
  file: File,
  biz: string,
  signal?: AbortSignal,
): Promise<File> {
  signal?.throwIfAborted();
  validateFiles([file], 0);
  const limits = biz === "avatar" ? AVATAR_LIMITS : PHOTO_LIMITS;
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement("canvas");
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        image.onload = image.onerror = null;
        signal?.removeEventListener("abort", abort);
      };
      const abort = () => {
        cleanup();
        reject(signal?.reason);
      };
      image.onload = () => {
        cleanup();
        resolve();
      };
      image.onerror = () => {
        cleanup();
        reject(new Error("图片读取失败，请重新选择 JPG、PNG 或 WebP 图片。"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      image.src = url;
    });
    signal?.throwIfAborted();
    const sourceEdge = Math.max(image.naturalWidth, image.naturalHeight);
    if (!sourceEdge || !image.naturalWidth || !image.naturalHeight)
      throw new Error("图片尺寸无效，请重新选择图片。");
    // Small images still pass validation and decoding, without another lossy encode.
    if (sourceEdge <= limits.edge && file.size <= 128 * 1024) return file;
    const scale = Math.min(1, limits.edge / sourceEdge);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器无法压缩图片，请更新浏览器后重试。");
    // WebP preserves PNG transparency. Unsupported encoders return PNG instead.
    const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    let quality = 0.84;
    for (let attempt = 0; attempt < 8; attempt++) {
      signal?.throwIfAborted();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result?.size
              ? resolve(result)
              : reject(new Error("图片压缩失败，请重新选择图片后重试。")),
          type,
          quality,
        );
      });
      signal?.throwIfAborted();
      if (blob.size <= limits.bytes) {
        if (sourceEdge <= limits.edge && blob.size >= file.size) return file;
        const extensions: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };
        const extension = extensions[blob.type];
        if (!extension) throw new Error("浏览器未能生成可上传的图片格式。");
        return new File(
          [blob],
          `${file.name.replace(/\.[^.]+$/, "") || "image"}.${extension}`,
          { type: blob.type, lastModified: file.lastModified },
        );
      }
      // Reduce quality once, then shrink rather than making text/photos very blurry.
      if (blob.type !== "image/png" && quality > 0.7) {
        quality = 0.7;
      } else {
        canvas.width = Math.max(1, Math.floor(canvas.width * 0.8));
        canvas.height = Math.max(1, Math.floor(canvas.height * 0.8));
      }
    }
    throw new Error("图片压缩后仍然过大，请换一张图片重试。");
  } finally {
    image.src = "";
    canvas.width = canvas.height = 0;
    URL.revokeObjectURL(url);
  }
}
