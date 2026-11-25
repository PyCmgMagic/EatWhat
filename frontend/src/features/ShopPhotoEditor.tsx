import { RotateCcw, RotateCw } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { errorMessage } from "../api/client";
import { usePageLifetime } from "../app/drafts";
import { Modal } from "../components/ui";
import {
  applyShopPhotoEdit,
  fullPhotoCrop,
  moveShopCrop,
  orientedPhoto,
  originalShopPhoto,
  readShopPhotoAdjustment,
  rotateShopPhoto,
  sameShopCrop,
  type ShopCropHandle,
  type ShopPhotoAdjustment,
  type ShopPhotoCrop,
  type ShopPhotoSelection,
} from "./shop-photo-edit";
import "./shop-photo-editor.css";

const corners = [
  ["top-left", "左上角"],
  ["top-right", "右上角"],
  ["bottom-left", "左下角"],
  ["bottom-right", "右下角"],
] as const;
const directions: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

type CropDrag = {
  id: number;
  handle: ShopCropHandle;
  bounds: ShopPhotoCrop;
  x: number;
  y: number;
  width: number;
  height: number;
};

function moveCropByPixels(
  crop: ShopPhotoCrop,
  handle: ShopCropHandle,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return moveShopCrop(
    crop,
    handle,
    { x: x / width, y: y / height },
    { width: 64 / width, height: 64 / height },
  );
}

export function ShopPhotoEditor({
  photo,
  origin,
  onApply,
  onClose,
}: {
  photo: ShopPhotoSelection;
  origin: HTMLButtonElement | null;
  onApply: (photo: ShopPhotoSelection) => void;
  onClose: () => void;
}) {
  const source = photo.edit?.source ?? photo.file;
  const [adjustment, setAdjustment] = useState<ShopPhotoAdjustment>();
  const [url, setUrl] = useState("");
  const [image, setImage] = useState<HTMLImageElement>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hint = useId();
  const active = usePageLifetime();
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<CropDrag | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(source);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  const initial = image
    ? readShopPhotoAdjustment(image, photo.edit)
    : originalShopPhoto;
  const current = adjustment ?? initial;
  const { turns, bounds } = current;
  const { width, height } = image
    ? orientedPhoto(image, turns)
    : { width: 3, height: 2 };
  const ready = !!image && !saving;
  const full = sameShopCrop(bounds, fullPhotoCrop);
  const changed =
    turns !== initial.turns || !sameShopCrop(bounds, initial.bounds);

  function cropControl(handle: ShopCropHandle) {
    const adjustable = ready && (!full || handle !== "move");
    return {
      tabIndex: adjustable ? 0 : undefined,
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (!adjustable || event.button !== 0 || drag.current) return;
        const box = frame.current?.getBoundingClientRect();
        if (!box?.width || !box.height) return;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          return;
        }
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        drag.current = {
          id: event.pointerId,
          handle,
          bounds,
          x: event.clientX,
          y: event.clientY,
          width: box.width,
          height: box.height,
        };
      },
      onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const direction = directions[event.key];
        const box = frame.current?.getBoundingClientRect();
        if (
          !adjustable ||
          drag.current ||
          !direction ||
          !box?.width ||
          !box.height
        )
          return;
        event.preventDefault();
        const step = event.shiftKey ? 20 : 4;
        setAdjustment({
          turns,
          bounds: moveCropByPixels(
            bounds,
            handle,
            direction[0] * step,
            direction[1] * step,
            box.width,
            box.height,
          ),
        });
      },
    };
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }

  function update(next: ShopPhotoAdjustment) {
    drag.current = null;
    setAdjustment(next);
  }

  async function save(dismiss: () => void) {
    if (!image || saving || !changed) return;
    setError("");
    setSaving(true);
    try {
      const result = await applyShopPhotoEdit(source, image, current);
      if (!active.current) return;
      onApply(result);
      dismiss();
    } catch (cause) {
      if (active.current) setError(errorMessage(cause));
    } finally {
      if (active.current) setSaving(false);
    }
  }

  return createPortal(
    <Modal
      title="编辑门头照片"
      className="shop-photo-editor"
      motionOrigin={origin}
      returnFocus={origin}
      dismissible={!saving}
      onClose={onClose}
    >
      {(dismiss) => (
        <>
          <div
            className="shop-photo-edit-frame"
            style={{ "--photo-aspect": width / height } as CSSProperties}
          >
            {url && (
              <div
                className="shop-photo-edit-orientation"
                ref={frame}
                style={
                  {
                    "--crop-top": `${bounds.top * 100}%`,
                    "--crop-right": `${(1 - bounds.right) * 100}%`,
                    "--crop-bottom": `${(1 - bounds.bottom) * 100}%`,
                    "--crop-left": `${bounds.left * 100}%`,
                  } as CSSProperties
                }
                onPointerMove={(event) => {
                  const start = drag.current;
                  if (!ready || start?.id !== event.pointerId) return;
                  setAdjustment({
                    turns,
                    bounds: moveCropByPixels(
                      start.bounds,
                      start.handle,
                      event.clientX - start.x,
                      event.clientY - start.y,
                      start.width,
                      start.height,
                    ),
                  });
                }}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={endDrag}
              >
                <img
                  src={url}
                  alt="门头照片"
                  hidden={!image}
                  draggable={false}
                  style={
                    image && {
                      width: `${(100 * image.naturalWidth) / width}%`,
                      height: `${(100 * image.naturalHeight) / height}%`,
                      transform: `translate(-50%, -50%) rotate(${turns * 90}deg)`,
                    }
                  }
                  onLoad={(event) => setImage(event.currentTarget)}
                  onError={() => setError("照片读取失败，请关闭后更换照片。")}
                />
                {image && (
                  <>
                    <div className="shop-photo-crop-shade" aria-hidden="true" />
                    <div className="shop-photo-crop-selection" data-full={full}>
                      <div
                        className="shop-photo-crop-move"
                        role="group"
                        aria-label="移动裁剪框"
                        aria-describedby={hint}
                        {...cropControl("move")}
                      />
                      {corners.map(([corner, label]) => (
                        <div
                          className="shop-photo-crop-handle"
                          data-corner={corner}
                          key={corner}
                          role="group"
                          aria-label={`${label}裁剪手柄`}
                          aria-describedby={hint}
                          {...cropControl(corner)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {!image && !error && <span role="status">正在读取照片…</span>}
          </div>
          <p id={hint} className="shop-photo-edit-hint">
            拖动四角裁剪，拖动框内移动
            <span className="sr-only">
              。可用方向键调整选中的手柄或裁剪框。
            </span>
          </p>
          {error && (
            <p className="shop-photo-edit-error" role="alert">
              {error}
            </p>
          )}
          <div className="shop-photo-edit-actions">
            <button
              type="button"
              aria-label="顺时针旋转 90 度"
              disabled={!ready}
              onClick={() => update(rotateShopPhoto(current))}
            >
              <RotateCw size={17} aria-hidden="true" />
              旋转
            </button>
            <button
              type="button"
              aria-label="还原原图"
              disabled={!ready || (!turns && full)}
              onClick={() => update(originalShopPhoto)}
            >
              <RotateCcw size={17} aria-hidden="true" />
              还原
            </button>
            <button
              type="button"
              className="shop-photo-edit-save"
              disabled={!ready || !changed}
              onClick={() => void save(dismiss)}
            >
              {saving ? "正在保存…" : "保存修改"}
            </button>
          </div>
        </>
      )}
    </Modal>,
    document.body,
  );
}
