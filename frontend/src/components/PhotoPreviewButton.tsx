import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "../api/models";
import { Icon, Modal } from "./ui";
import "./photo-preview.css";

/** Place over the photo in its positioned thumbnail frame. */
export function PhotoPreviewButton({
  pictures,
  name,
  startIndex = 0,
  onImageError,
}: {
  pictures?: string[] | null;
  name: string;
  startIndex?: number;
  onImageError?: (src: string) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [failedSrc, setFailedSrc] = useState<string>();
  if (!mediaUrl(pictures?.[startIndex])) return null;

  const photos =
    selected === null
      ? []
      : (pictures ?? []).flatMap((picture, index) => {
          const src = mediaUrl(picture);
          return src ? [{ src, index }] : [];
        });
  const position = Math.max(
    0,
    photos.findIndex((photo) => photo.index === selected),
  );
  const current = photos[position];
  const step = (direction: number) => {
    const next = (position + direction + photos.length) % photos.length;
    setSelected(photos[next].index);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="photo-preview-trigger"
        aria-label={`查看${name}大图`}
        aria-haspopup="dialog"
        onClick={() => {
          setFailedSrc(undefined);
          setSelected(startIndex);
        }}
      />
      {current &&
        createPortal(
          <Modal
            className="photo-preview"
            title={`${name} · 照片预览`}
            onClose={() => setSelected(null)}
            returnFocus={trigger.current}
            onKeyDown={(event) => {
              if (
                photos.length < 2 ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey
              )
                return;
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                step(event.key === "ArrowLeft" ? -1 : 1);
              }
            }}
          >
            {failedSrc === current.src ? (
              <p role="status">照片加载失败</p>
            ) : (
              <img
                key={current.src}
                src={current.src}
                alt={`${name}，第 ${position + 1} 张照片`}
                onLoad={({ currentTarget: img }) => {
                  img.style.setProperty(
                    "--photo-ratio",
                    String(img.naturalWidth / img.naturalHeight),
                  );
                }}
                onError={() => {
                  setFailedSrc(current.src);
                  onImageError?.(current.src);
                }}
              />
            )}
            {photos.length > 1 && (
              <div
                className="photo-preview-controls"
                role="group"
                aria-label="切换照片"
              >
                <button
                  type="button"
                  aria-label="上一张照片"
                  onClick={() => step(-1)}
                >
                  <Icon name="left" />
                </button>
                <span aria-live="polite" aria-atomic="true">
                  {position + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  aria-label="下一张照片"
                  onClick={() => step(1)}
                >
                  <Icon name="right" />
                </button>
              </div>
            )}
          </Modal>,
          document.body,
        )}
    </>
  );
}
