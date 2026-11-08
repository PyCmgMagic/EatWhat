import { useRef, useState, type DragEvent } from "react";
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
}: {
  photos: EditableFoodPhoto[];
  disabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<number>();
  const remaining = Math.max(0, 9 - photos.length);
  function add(files: File[]) {
    if (disabled || !files.length) return;
    try {
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
      <div className="food-photo-picker" aria-label="菜品照片">
        <header className="food-photo-heading">
          <h2>菜品照片</h2>
          <span role="status" aria-live="polite">
            {photos.length} / 9 张
          </span>
        </header>
        <p className="food-photo-caption">首张为封面，点击照片可预览。</p>
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
          <div className="food-photo-grid">
            {photos.map((photo, index) => (
              <div className="food-photo-tile" key={photo.url + index}>
                <button
                  type="button"
                  className="food-photo-preview"
                  aria-label={`预览第 ${index + 1} 张照片${index === 0 ? "（封面）" : ""}`}
                  disabled={disabled}
                  onClick={() => setPreview(index)}
                >
                  <img
                    src={photo.url}
                    alt={`菜品照片 ${index + 1}`}
                    draggable={false}
                  />
                  <span className="food-photo-badge">
                    {index === 0 ? "封面" : index + 1}
                  </span>
                  <span className="food-photo-zoom" aria-hidden="true">
                    <Icon name="search" size={16} />
                  </span>
                </button>
                <button
                  type="button"
                  className="food-photo-remove"
                  aria-label={`移除第 ${index + 1} 张照片`}
                  disabled={disabled}
                  onClick={() => {
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
                aria-label="添加照片"
                disabled={disabled}
                onClick={() => input.current?.click()}
              >
                <span className="food-photo-add-icon">
                  <Icon name="add" size={24} />
                </span>
                <strong>{photos.length ? "添加照片" : "添加菜品照片"}</strong>
                <small>
                  {photos.length
                    ? `还可添加 ${remaining} 张`
                    : "点击选择，也可将照片拖到这里"}
                </small>
              </button>
            )}
          </div>
          {dragging && !disabled && (
            <div className="food-photo-drop-hint" aria-hidden="true">
              <Icon name="image" size={26} />
              <b>{remaining ? "松开添加照片" : "已满 9 张，请先移除照片"}</b>
            </div>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          aria-label="选择菜品照片"
          disabled={disabled || !remaining}
          onChange={(event) => {
            add(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <p className="food-photo-help">
          {remaining ? "支持拖入多张图片" : "已添加 9 张，可移除后再添加"} ·
          JPG、PNG、WebP · 单张不超过 10 MB
        </p>
        {error && (
          <p className="food-photo-error" role="alert">
            <Icon name="info" size={16} />
            {error}
          </p>
        )}
      </div>
      {preview !== undefined &&
        photos[preview] &&
        createPortal(
          <Modal
            title={`照片预览 · ${preview + 1} / ${photos.length}`}
            className="food-photo-dialog"
            onClose={() => setPreview(undefined)}
          >
            <img src={photos[preview].url} alt={`菜品照片 ${preview + 1}`} />
          </Modal>,
          document.body,
        )}
    </>
  );
}
