export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
export function validateFiles(files: File[], existing: number) {
  if (existing + files.length > 9)
    throw new Error("每次分享最多选择 9 张图片。");
  for (const f of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type))
      throw new Error("请选择 JPG、PNG 或 WebP 图片。");
    if (!f.size) throw new Error("不能上传空文件。");
    if (f.size > MAX_IMAGE_SIZE)
      throw new Error("为保证上传体验，前端单张图片限制为 10 MB。");
  }
}
