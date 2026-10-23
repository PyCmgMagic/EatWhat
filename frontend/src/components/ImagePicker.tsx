import { useEffect, useRef, useState } from "react";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { Icon } from "./ui";
export type UploadImage = {
  id: string;
  file: File;
  preview: string;
  key?: string;
  status: "ready" | "uploading" | "confirming" | "done" | "error";
};
import { validateFiles } from "../api/validation";
export function ImagePicker({
  images,
  onChange,
  disabled = false,
}: {
  images: UploadImage[];
  onChange: (images: UploadImage[]) => void;
  disabled?: boolean;
}) {
  const { toast } = useApp(),
    [sampleBusy, setSampleBusy] = useState(false),
    urls = useRef(new Set<string>());
  useEffect(
    () => () => urls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  function add(files: File[]) {
    try {
      validateFiles(files, images.length);
      const next = files.map((file) => {
        const preview = URL.createObjectURL(file);
        urls.current.add(preview);
        return {
          id: crypto.randomUUID(),
          file,
          preview,
          status: "ready" as const,
        };
      });
      onChange([...images, ...next]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "图片读取失败。");
    }
  }
  return (
    <>
      <div className="upload-zone">
        <input
          id="photo-input"
          aria-label="选择菜品图片"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled}
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            e.currentTarget.value = "";
          }}
        />
        <Icon name="image" />
        <strong>把这一刻的好味道，拍下来。</strong>
        <p>选择 1–9 张 JPG / PNG / WebP 图片，单张最多 10 MB</p>
      </div>
      {images.length > 0 && (
        <div className="upload-previews">
          {images.map((image, i) => (
            <div className="upload-preview" key={image.id}>
              <img src={image.preview} alt={`待分享图片${i + 1}`} />
              <button
                aria-label={`移除第${i + 1}张图片`}
                disabled={disabled}
                onClick={() => {
                  URL.revokeObjectURL(image.preview);
                  urls.current.delete(image.preview);
                  onChange(images.filter((x) => x.id !== image.id));
                }}
              >
                <Icon name="close" />
              </button>
              <span>
                {image.status === "uploading"
                  ? "上传中…"
                  : image.status === "confirming"
                    ? "确认中…"
                    : image.status === "done"
                      ? "已上传"
                      : image.status === "error"
                        ? "上传失败，可重试"
                        : i === 0
                          ? "封面"
                          : "待上传"}
              </span>
            </div>
          ))}
        </div>
      )}
      {isDemo && (
        <button
          type="button"
          className="text-link"
          disabled={disabled || sampleBusy || images.length >= 9}
          onClick={async () => {
            setSampleBusy(true);
            try {
              const response = await fetch("/assets/noodles.jpg");
              add([
                new File([await response.blob()], "示例拉面.jpg", {
                  type: "image/jpeg",
                }),
              ]);
            } catch {
              toast("示例图片读取失败。");
            } finally {
              setSampleBusy(false);
            }
          }}
        >
          使用一张演示照片体验
        </button>
      )}
    </>
  );
}
