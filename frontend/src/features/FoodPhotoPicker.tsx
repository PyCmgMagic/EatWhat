import { useFeedbackState } from "../components/feedback";
import { useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { errorMessage } from "../api/client";
import { validateFiles } from "../api/validation";
import { Modal } from "../components/ui";
import { DesignIcon as Icon } from "../mobile/ui";
import "./food-photo-picker.css";

export type EditableFoodPhoto = { url: string; key?: string; file?: File };

export function FoodPhotoPicker({
  photos,
  disabled,
  onAdd,
  onRemove,
  feedback = false,
  compact = false,
}: {
  photos: EditableFoodPhoto[];
  disabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  feedback?: boolean;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const removedIndex = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (removedIndex.current === null || !grid.current) return;
    const previews = grid.current.querySelectorAll<HTMLButtonElement>(
      ".food-photo-preview",
    );
    const next =
      previews[Math.min(removedIndex.current, previews.length - 1)] ??
      grid.current.querySelector<HTMLButtonElement>(".food-photo-add");
    next?.focus();
    removedIndex.current = null;
  }, [photos]);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useFeedbackState();
  const [preview, setPreview] = useState<number>();
  const limit = feedback ? 3 : 9;
  const remaining = Math.max(0, limit - photos.length);
  const item = feedback ? "截图" : "照片";
  const Heading = feedback ? "h3" : "h2";
  function add(files: File[]) {
    if (disabled || !files.length) return;
    try {
      if (
        feedback &&
        (files.length > remaining ||
          files.some((file) => file.size > 8 * 1024 * 1024))
      )
        throw new Error("最多添加 3 张截图，单张不超过 8 MB。");
      validateFiles(files, photos.length);
      onAdd(files);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  function isFileDrag(event: DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }
  return (
    <>
      <div
        className="food-photo-picker"
        role="group"
        aria-label={feedback ? "反馈截图" : "菜品照片"}
        data-feedback={feedback || undefined}
        data-compact={compact || undefined}
      >
        <header className="food-photo-heading">
          <Heading>
            {feedback
              ? compact
                ? "截图（选填，最多 3 张）"
                : "截图（可选）"
              : "菜品照片"}
          </Heading>
          <span role="status" aria-live="polite">
            {photos.length} / {limit}
            {!compact && " 张"}
          </span>
        </header>
        {!feedback && (
          <p className="food-photo-caption">首张为封面，点击照片可预览。</p>
        )}
        <div
          className="food-photo-dropzone"
          data-dragging={(dragging && !disabled) || undefined}
          aria-disabled={disabled}
          onDragEnter={(event) => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            if (disabled) return;
            depth.current += 1;
            setDragging(true);
          }}
          onDragOver={(event) => {
            if (!isFileDrag(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect =
              disabled || !remaining ? "none" : "copy";
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            depth.current = Math.max(0, depth.current - 1);
            if (!depth.current) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            depth.current = 0;
            setDragging(false);
            add(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="food-photo-grid" ref={grid}>
            {photos.map((photo, index) => (
              <div className="food-photo-tile" key={photo.url + index}>
                <button
                  type="button"
                  className="food-photo-preview"
                  aria-label={`预览第 ${index + 1} 张${item}${!feedback && index === 0 ? "（封面）" : ""}`}
                  title={feedback ? photo.file?.name : undefined}
                  disabled={disabled}
                  onClick={(event) => {
                    previewTrigger.current = event.currentTarget;
                    setPreview(index);
                  }}
                >
                  <img
                    src={photo.url}
                    alt={`${feedback ? "反馈截图" : "菜品照片"} ${index + 1}`}
                    draggable={false}
                  />
                  {!feedback && (
                    <span className="food-photo-badge">
                      {index === 0 ? "封面" : index + 1}
                    </span>
                  )}
                  <span className="food-photo-zoom" aria-hidden="true">
                    <Icon name="search" size={16} />
                  </span>
                </button>
                <button
                  type="button"
                  className="food-photo-remove"
                  aria-label={`移除第 ${index + 1} 张${item}`}
                  disabled={disabled}
                  onClick={() => {
                    removedIndex.current = index;
                    onRemove(index);
                    setError("");
                  }}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            {remaining > 0 && (
              <button
                type="button"
                className="food-photo-add"
                data-empty={!photos.length || undefined}
                aria-label={`添加${item}`}
                disabled={disabled}
                onClick={() => input.current?.click()}
              >
                <span className="food-photo-add-icon">
                  <Icon name="add" size={compact ? 32 : 24} />
                </span>
                {!compact && (
                  <strong>
                    {feedback || photos.length ? `添加${item}` : "添加菜品照片"}
                  </strong>
                )}
                {!compact && (!feedback || !photos.length) && (
                  <small>
                    {photos.length
                      ? `还可添加 ${remaining} 张`
                      : `点击选择，也可将${item}拖到这里`}
                  </small>
                )}
              </button>
            )}
          </div>
          {dragging && !disabled && (
            <div className="food-photo-drop-hint" aria-hidden="true">
              <Icon name="image" size={26} />
              <b>
                {remaining
                  ? `松开添加${item}`
                  : `已满 ${limit} 张，请先移除${item}`}
              </b>
            </div>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          aria-label={feedback ? "选择反馈截图" : "选择菜品照片"}
          disabled={disabled || !remaining}
          onChange={(event) => {
            add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <p className="food-photo-help">
          {!feedback &&
            (remaining
              ? "支持拖入多张图片 · "
              : "已添加 9 张，可移除后再添加 · ")}
          JPG、PNG、WebP · 单张不超过 {feedback ? 8 : 10} MB
        </p>
      </div>
      {preview !== undefined &&
        photos[preview] &&
        createPortal(
          <Modal
            title={`${item}预览 · ${preview + 1} / ${photos.length}`}
            className={`food-photo-dialog${feedback ? " feedback-photo-dialog" : ""}`}
            onClose={() => setPreview(undefined)}
            returnFocus={previewTrigger.current}
          >
            <img
              src={photos[preview].url}
              alt={`${feedback ? "反馈截图" : "菜品照片"} ${preview + 1}`}
            />
          </Modal>,
          document.body,
        )}
    </>
  );
}
