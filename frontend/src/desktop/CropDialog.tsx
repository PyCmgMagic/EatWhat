import { useFeedbackState } from "../components/feedback";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { DesignIcon as Icon, type Draft } from "../mobile/ui";
import { adjustPhoto } from "../mobile/photos";
import { photoFraming, type PhotoFraming } from "../mobile/photo-framing";
import { MAX_PHOTO_ZOOM } from "../mobile/photo-gesture";
import { errorMessage } from "../api/client";
import { useSurfaceDismiss } from "../motion/hooks";

const originalFraming = { x: 0, y: 0, zoom: 1 };

function frameBounds(element: HTMLElement) {
  const bounds = element.getBoundingClientRect();
  return {
    centreX: bounds.left + bounds.width / 2,
    centreY: bounds.top + bounds.height / 2,
    scale: (bounds.width * element.clientWidth) / (element.offsetWidth * 300),
    height: bounds.height,
  };
}

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
    framing: PhotoFraming,
  ) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    frame = useRef<HTMLDivElement>(null),
    pointer = useRef<{
      id: number;
      x: number;
      y: number;
    } | null>(null);
  const [crop, setCrop] = useState(image.framing ?? originalFraming);
  const [size, setSize] = useState({ width: 300, height: 300 }),
    [url, setUrl] = useState(""),
    [frameSize, setFrameSize] = useState(300);
  const [busy, setBusy] = useState(false),
    [, setError] = useFeedbackState();
  const isAvatar = variant === "avatar";
  const source = image.original ?? image.file;
  const dismiss = useSurfaceDismiss(dialog, onClose);
  const constrain = useCallback(
    (framing: PhotoFraming) =>
      photoFraming(size.width, size.height, framing).crop,
    [size.width, size.height],
  );
  const layout = photoFraming(size.width, size.height, crop, frameSize).image;
  useEffect(() => {
    if (!frame.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setFrameSize(entry.contentRect.width);
    });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const src = URL.createObjectURL(source);
    setUrl(src);
    dialog.current?.showModal();
    return () => {
      URL.revokeObjectURL(src);
      dialog.current?.close();
    };
  }, [source]);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const zoomWithWheel = (event: WheelEvent) => {
      const { deltaMode, deltaY } = event;
      if (busy || !deltaY || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const { centreX, centreY, scale, height } = frameBounds(element);
      const delta = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? height : 1);
      const anchorX = (event.clientX - centreX) / scale;
      const anchorY = (event.clientY - centreY) / scale;
      setCrop((current) => {
        const zoom = Math.max(
          1,
          Math.min(MAX_PHOTO_ZOOM, current.zoom * Math.exp(-delta * 0.0025)),
        );
        if (zoom === current.zoom) return current;
        const ratio = zoom / current.zoom;
        return constrain({
          x: anchorX + (current.x - anchorX) * ratio,
          y: anchorY + (current.y - anchorY) * ratio,
          zoom,
        });
      });
    };
    element.addEventListener("wheel", zoomWithWheel, { passive: false });
    return () => element.removeEventListener("wheel", zoomWithWheel);
  }, [busy, constrain]);

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current?.id === event.pointerId) pointer.current = null;
  }
  function movePhoto(event: PointerEvent<HTMLDivElement>) {
    const last = pointer.current;
    if (!last || last.id !== event.pointerId || busy) return;
    const { scale } = frameBounds(event.currentTarget);
    const x = event.clientX;
    const y = event.clientY;
    pointer.current = {
      id: event.pointerId,
      x,
      y,
    };
    setCrop((current) =>
      constrain({
        ...current,
        x: current.x + (x - last.x) / scale,
        y: current.y + (y - last.y) / scale,
      }),
    );
  }
  return (
    <dialog
      ref={dialog}
      className={`pc-crop-dialog${isAvatar ? " pc-profile-crop" : ""}`}
      aria-labelledby="pc-crop-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) dismiss();
      }}
    >
      <header>
        <div>
          <h2 id="pc-crop-title">{isAvatar ? "调整头像" : "调整菜品照片"}</h2>
          <p id="pc-crop-input-help">滚轮缩放，按住照片拖动。</p>
        </div>
        <button
          type="button"
          className="pc-icon-button"
          aria-label="关闭照片调整"
          disabled={busy}
          onClick={dismiss}
        >
          <Icon name="close" size={21} />
        </button>
      </header>
      <div className="pc-crop-body">
        <div className="pc-crop-stage">
          <div
            ref={frame}
            className="pc-crop-frame"
            tabIndex={0}
            role="group"
            aria-label="照片取景，拖动或使用方向键调整"
            aria-describedby="pc-crop-input-help"
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
              setCrop((current) =>
                constrain({
                  ...current,
                  x:
                    current.x +
                    (event.key === "ArrowLeft"
                      ? -d
                      : event.key === "ArrowRight"
                        ? d
                        : 0),
                  y:
                    current.y +
                    (event.key === "ArrowUp"
                      ? -d
                      : event.key === "ArrowDown"
                        ? d
                        : 0),
                }),
              );
            }}
            onPointerDown={(event) => {
              if (
                busy ||
                !event.isPrimary ||
                event.button !== 0 ||
                pointer.current
              )
                return;
              pointer.current = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={movePhoto}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
          >
            {url && (
              <img
                src={url}
                alt={isAvatar ? "待裁剪的头像" : "待裁剪的菜品照片"}
                draggable={false}
                onLoad={(event) => {
                  const img = event.currentTarget;
                  setSize({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                }}
                style={layout}
              />
            )}
            <span aria-hidden="true" className="pc-crop-crosshair" />
          </div>
        </div>
        <div className="pc-crop-controls">
          {!isAvatar && (
            <>
              <span className="pc-eyebrow">画面调整</span>
              <h3>让这一口更出彩</h3>
              <p>
                拖动调整位置，放大突出菜品。使用原照片重新取景，随时可以取消。
              </p>
            </>
          )}
          <label htmlFor="pc-crop-zoom">
            缩放 <span>{crop.zoom.toFixed(1)}×</span>
          </label>
          <input
            id="pc-crop-zoom"
            type="range"
            min="1"
            max={MAX_PHOTO_ZOOM}
            step="0.05"
            value={crop.zoom}
            disabled={busy}
            onChange={(event) => {
              const zoom = Number(event.target.value);
              setCrop((current) => constrain({ ...current, zoom }));
            }}
          />
          <button
            type="button"
            className={isAvatar ? "pc-profile-action" : "pc-small-link"}
            disabled={
              busy ||
              (isAvatar && crop.x === 0 && crop.y === 0 && crop.zoom === 1)
            }
            onClick={() => setCrop(originalFraming)}
          >
            恢复原始取景
          </button>
          <small>
            {isAvatar
              ? "保存资料后更换头像。"
              : "调整仅应用到这次分享，原文件会保留。"}
          </small>
        </div>
      </div>
      <footer>
        <button
          type="button"
          className="pc-button light"
          disabled={busy}
          onClick={dismiss}
        >
          取消
        </button>
        <button
          type="button"
          className={isAvatar ? "pc-button pc-profile-primary" : "pc-button"}
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
          {busy ? "正在处理…" : isAvatar ? "使用这个头像" : "使用这张照片"}
          <Icon name="check" size={18} />
        </button>
      </footer>
    </dialog>
  );
}
