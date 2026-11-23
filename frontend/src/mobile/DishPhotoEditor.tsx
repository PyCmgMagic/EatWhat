import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { stageCode, stageNames, stagePalette } from "../api/food-display";
import type { DraftPhotoEdit } from "./draft-photo-edit";
import {
  PHOTO_FRAMING_SIZE,
  photoFraming,
  type PhotoFraming,
} from "./photo-framing";
import { createPhotoGesture, MAX_PHOTO_ZOOM } from "./photo-gesture";
import { sampleStageColors } from "./photos";
import "./dish-photo-editor.css";

const arrows: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function cropPoint(event: PointerEvent<HTMLDivElement>) {
  const frame = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - frame.left) / frame.width - 0.5) * PHOTO_FRAMING_SIZE,
    y: ((event.clientY - frame.top) / frame.height - 0.5) * PHOTO_FRAMING_SIZE,
  };
}

export default function DishPhotoEditor({
  edit,
  cover,
  busy,
  onCancel,
  onApply,
}: {
  edit: DraftPhotoEdit;
  cover?: { name: string; stage?: string };
  busy: boolean;
  onCancel: () => void;
  onApply: (framing: PhotoFraming, stageChoice?: string | null) => void;
}) {
  const helpId = useId();
  const colorGroup = useId();
  const [gesture] = useState(createPhotoGesture);
  const [crop, setCrop] = useState(edit.framing);
  const [image, setImage] = useState<HTMLImageElement>();
  const [failed, setFailed] = useState(false);
  const [colors, setColors] = useState(edit.candidates);
  const [stageChoice, setStageChoice] = useState<string | null>();
  const showCover = !!cover;
  const ready = !!image && !busy;
  const manualStage = stageChoice === undefined ? cover?.stage : stageChoice;
  const selectedColor = manualStage ?? colors[0] ?? stagePalette.broth;
  const palette = [...new Set([...colors, selectedColor])];

  useEffect(() => {
    if (!showCover || !image) return;
    const timer = setTimeout(
      () => setColors(sampleStageColors(image, crop)),
      120,
    );
    return () => clearTimeout(timer);
  }, [showCover, image, crop]);

  const width = image?.naturalWidth ?? PHOTO_FRAMING_SIZE;
  const height = image?.naturalHeight ?? PHOTO_FRAMING_SIZE;
  const shortestSide = Math.min(width, height);
  const constrain = (framing: PhotoFraming) =>
    photoFraming(width, height, framing).crop;
  const { crop: framing, image: layout } = photoFraming(
    width,
    height,
    crop,
    100,
  );
  const baseWidth = (width / shortestSide) * 100;
  const baseHeight = (height / shortestSide) * 100;
  const imageStyle = {
    width: `${baseWidth}%`,
    height: `${baseHeight}%`,
    transform: `translate(${(100 * layout.left) / baseWidth}%, ${(100 * layout.top) / baseHeight}%) scale(${framing.zoom})`,
  };

  function startGesture(event: PointerEvent<HTMLDivElement>) {
    if (!ready || event.button !== 0) return;
    if (!gesture.down(event.pointerId, cropPoint(event), crop)) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A native touch can end before the browser grants capture.
    }
  }

  function endGesture(event: PointerEvent<HTMLDivElement>) {
    gesture.up(event.pointerId);
  }

  function zoomTo(zoom: number) {
    gesture.reset();
    setCrop((current) => {
      const next = Math.max(1, Math.min(MAX_PHOTO_ZOOM, zoom));
      const ratio = next / current.zoom;
      return constrain({
        x: current.x * ratio,
        y: current.y * ratio,
        zoom: next,
      });
    });
  }

  function panWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const direction = arrows[event.key];
    if (!ready || !direction) return;
    event.preventDefault();
    gesture.reset();
    const step = event.shiftKey ? 15 : 5;
    setCrop((current) =>
      constrain({
        ...current,
        x: current.x + direction[0] * step,
        y: current.y + direction[1] * step,
      }),
    );
  }

  return (
    <main
      className={`mobile-crop-screen${showCover ? " mobile-crop-with-cover" : ""}`}
      aria-busy={busy}
    >
      <header className="mobile-crop-toolbar">
        <button
          className="mobile-crop-cancel"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          取消
        </button>
        <h1>调整照片</h1>
        <button
          className="mobile-crop-done"
          type="button"
          disabled={!ready}
          onClick={() => onApply(framing, stageChoice)}
        >
          {busy ? "处理中…" : "完成"}
        </button>
      </header>
      <div className="mobile-crop-body">
        <div
          className="mobile-crop-frame"
          role="group"
          aria-label="照片取景，方向键可移动照片"
          aria-describedby={helpId}
          tabIndex={0}
          onKeyDown={panWithKeyboard}
          onPointerDown={startGesture}
          onPointerMove={(event) => {
            if (!ready) return;
            const next = gesture.move(
              event.pointerId,
              cropPoint(event),
              constrain,
            );
            if (next) setCrop(next);
          }}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onLostPointerCapture={endGesture}
        >
          <img
            src={edit.url}
            alt="所选照片"
            draggable={false}
            style={imageStyle}
            onLoad={(event) => setImage(event.currentTarget)}
            onError={() => setFailed(true)}
          />
          <div className="mobile-crop-ring" aria-hidden="true" />
        </div>
        <div className="mobile-crop-controls">
          {failed && <p role="alert">照片读取失败，请返回后重新选择。</p>}
          <p className="mobile-crop-help" id={helpId}>
            拖动摆正，双指缩放
          </p>
          <div className="mobile-crop-zoom" role="group" aria-label="照片缩放">
            <button
              type="button"
              aria-label="缩小照片"
              disabled={!ready || crop.zoom <= 1}
              onClick={() => zoomTo(crop.zoom - 0.25)}
            >
              −
            </button>
            <input
              type="range"
              aria-label="缩放"
              aria-valuetext={`${Number(crop.zoom.toFixed(2))} 倍`}
              min={1}
              max={MAX_PHOTO_ZOOM}
              step={0.01}
              value={crop.zoom}
              disabled={!ready}
              onChange={(event) => zoomTo(Number(event.currentTarget.value))}
            />
            <button
              type="button"
              aria-label="放大照片"
              disabled={!ready || crop.zoom >= MAX_PHOTO_ZOOM}
              onClick={() => zoomTo(crop.zoom + 0.25)}
            >
              +
            </button>
          </div>
          {cover && (
            <div className="mobile-crop-cover">
              <div className="mobile-crop-palette">
                <div>
                  <h2>舞台颜色</h2>
                  <button
                    type="button"
                    className="mobile-crop-auto"
                    aria-pressed={manualStage == null}
                    disabled={busy}
                    onClick={() => setStageChoice(null)}
                  >
                    跟随封面
                  </button>
                </div>
                <div
                  className="mobile-crop-swatches"
                  role="radiogroup"
                  aria-label="舞台颜色"
                >
                  {palette.map((color) => (
                    <label className="mobile-crop-swatch" key={color}>
                      <input
                        type="radio"
                        name={colorGroup}
                        checked={manualStage === color}
                        disabled={busy}
                        onChange={() => setStageChoice(color)}
                      />
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: color }}
                      />
                      {stageNames[stageCode(color)]}
                    </label>
                  ))}
                </div>
              </div>
              <div
                className="mobile-crop-preview"
                style={{
                  backgroundColor: selectedColor,
                  color: [
                    stagePalette.tomato,
                    stagePalette.redoil,
                    stagePalette.soy,
                  ].some((color) => color === selectedColor)
                    ? "#fff"
                    : "#231c18",
                }}
              >
                <div>
                  <span>首页预览</span>
                  <strong>{cover.name || "你的这道菜"}</strong>
                </div>
                <div className="mobile-crop-preview-photo">
                  <img src={edit.url} alt="首页裁剪预览" style={imageStyle} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
