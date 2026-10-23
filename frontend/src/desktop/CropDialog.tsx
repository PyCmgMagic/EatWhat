import { useEffect, useRef, useState } from "react";
import { DesignIcon as Icon, type Draft } from "../mobile/ui";
import { adjustPhoto } from "../mobile/photos";
import { errorMessage } from "../api/client";

export default function CropDialog({
  image,
  onClose,
  onApply,
  variant = "food",
}: {
  image: Draft["images"][number];
  variant?: "food" | "avatar";
  onClose: () => void;
  onApply: (
    result: Awaited<ReturnType<typeof adjustPhoto>>,
    framing: { x: number; y: number; zoom: number },
  ) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    pointer = useRef<{
      id: number;
      x: number;
      y: number;
      ox: number;
      oy: number;
    } | null>(null);
  const [crop, setCrop] = useState(image.framing ?? { x: 0, y: 0, zoom: 1 });
  const [size, setSize] = useState({ width: 300, height: 300 }),
    [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const source = image.original ?? image.file;
  useEffect(() => {
    const src = URL.createObjectURL(source);
    setUrl(src);
    dialog.current?.showModal();
    return () => {
      URL.revokeObjectURL(src);
      dialog.current?.close();
    };
  }, [source]);
  function position(x: number, y: number, zoom = crop.zoom) {
    const maxX = Math.max(0, (size.width * zoom - 300) / 2),
      maxY = Math.max(0, (size.height * zoom - 300) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
      zoom,
    };
  }
  return (
    <dialog
      ref={dialog}
      className="pc-crop-dialog"
      aria-labelledby="pc-crop-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <div>
          <h2 id="pc-crop-title">
            {variant === "avatar" ? "调整头像" : "调整菜品照片"}
          </h2>
          <p>
            {variant === "avatar"
              ? "拖动和缩放，选一个最适合你的角度。"
              : "拖动照片，把好吃的放在画面中间。"}
          </p>
        </div>
        <button
          type="button"
          className="pc-icon-button"
          aria-label="关闭照片调整"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" size={21} />
        </button>
      </header>
      <div className="pc-crop-body">
        <div className="pc-crop-stage">
          <div
            className="pc-crop-frame"
            tabIndex={0}
            role="group"
            aria-label="照片取景，拖动或使用方向键调整"
            onKeyDown={(event) => {
              if (
                busy ||
                !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  event.key,
                )
              )
                return;
              event.preventDefault();
              const d = event.shiftKey ? 15 : 5;
              setCrop(
                position(
                  crop.x +
                    (event.key === "ArrowLeft"
                      ? -d
                      : event.key === "ArrowRight"
                        ? d
                        : 0),
                  crop.y +
                    (event.key === "ArrowUp"
                      ? -d
                      : event.key === "ArrowDown"
                        ? d
                        : 0),
                ),
              );
            }}
            onPointerDown={(event) => {
              if (busy || !event.isPrimary || event.button !== 0) return;
              pointer.current = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                ox: crop.x,
                oy: crop.y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const start = pointer.current;
              if (!start || start.id !== event.pointerId) return;
              const scale =
                event.currentTarget.getBoundingClientRect().width / 300;
              setCrop(
                position(
                  start.ox + (event.clientX - start.x) / scale,
                  start.oy + (event.clientY - start.y) / scale,
                ),
              );
            }}
            onPointerUp={() => {
              pointer.current = null;
            }}
            onPointerCancel={() => {
              pointer.current = null;
            }}
          >
            {url && (
              <img
                src={url}
                alt={variant === "avatar" ? "待裁剪的头像" : "待裁剪的菜品照片"}
                draggable={false}
                onLoad={(event) => {
                  const img = event.currentTarget,
                    min = Math.min(img.naturalWidth, img.naturalHeight);
                  setSize({
                    width: (img.naturalWidth / min) * 300,
                    height: (img.naturalHeight / min) * 300,
                  });
                }}
                style={{
                  width: size.width,
                  height: size.height,
                  transform: `translate(-50%,-50%) translate3d(${crop.x}px,${crop.y}px,0) scale(${crop.zoom})`,
                }}
              />
            )}
            <span aria-hidden="true" className="pc-crop-crosshair" />
          </div>
        </div>
        <div className="pc-crop-controls">
          <span className="pc-eyebrow">画面调整</span>
          <h3>
            {variant === "avatar" ? "让食友一眼认出你" : "让这一口更出彩"}
          </h3>
          <p>
            {variant === "avatar"
              ? "圆形区域就是头像展示的范围。调整完成后，记得保存个人资料。"
              : "拖动调整位置，放大突出菜品。使用原照片重新取景，随时可以取消。"}
          </p>
          <label htmlFor="pc-crop-zoom">
            缩放 <span>{crop.zoom.toFixed(1)}×</span>
          </label>
          <input
            id="pc-crop-zoom"
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={crop.zoom}
            disabled={busy}
            onChange={(event) =>
              setCrop(position(crop.x, crop.y, Number(event.target.value)))
            }
          />
          <button
            type="button"
            className="pc-small-link"
            disabled={busy}
            onClick={() => setCrop({ x: 0, y: 0, zoom: 1 })}
          >
            恢复原始取景
          </button>
          <small>
            {variant === "avatar"
              ? "确认取景只会更新预览，保存资料后才会更换头像。"
              : "调整仅应用到这次分享，原文件会保留。"}
          </small>
          {error && (
            <p className="pc-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <footer>
        <button
          type="button"
          className="pc-button light"
          disabled={busy}
          onClick={onClose}
        >
          取消
        </button>
        <button
          type="button"
          className="pc-button"
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError("");
            try {
              const result = await adjustPhoto(source, crop);
              onApply(result, crop);
            } catch (e) {
              setError(errorMessage(e));
              setBusy(false);
            }
          }}
        >
          {busy
            ? "正在处理…"
            : variant === "avatar"
              ? "使用这个头像"
              : "使用这张照片"}
          <Icon name="check" size={18} />
        </button>
      </footer>
    </dialog>
  );
}
