import { useId, useLayoutEffect, useRef, useState } from "react";
import { DesignIcon as Icon } from "../mobile/ui";

export default function PublishPhotoThumbnails({
  images,
  selected,
  disabled,
  onSelect,
  onAdd,
  onRemove,
  onMove,
}: {
  images: readonly { url: string }[];
  selected: string;
  disabled: boolean;
  onSelect: (url: string) => void;
  onAdd: () => void;
  onRemove: (url: string) => void;
  onMove: (source: string, target: string) => void;
}) {
  const instructions = useId();
  const strip = useRef<HTMLDivElement>(null);
  const source = useRef<string | null>(null);
  const focusAfterMove = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const sortable = images.length > 1 && !disabled;

  useLayoutEffect(() => {
    if (!focusAfterMove.current) return;
    const thumbnails = strip.current?.querySelectorAll<HTMLButtonElement>(
      ".pc-composer-thumbnail-preview",
    );
    Array.from(thumbnails ?? [])
      .find((button) => button.dataset.photoUrl === focusAfterMove.current)
      ?.focus();
    focusAfterMove.current = null;
  }, [images]);

  function clearDrag() {
    source.current = null;
    setDragging(null);
    setTarget(null);
  }

  function move(url: string, destination: string) {
    if (!sortable || url === destination) return;
    const index = images.findIndex((image) => image.url === destination);
    if (index === -1) return;
    onMove(url, destination);
    setMessage(index === 0 ? "已设为封面" : `照片已移到第 ${index + 1} 位`);
  }

  return (
    <div
      className="pc-composer-thumbnails"
      ref={strip}
      role="group"
      aria-label="照片顺序"
    >
      {sortable && (
        <span className="sr-only" id={instructions}>
          拖动照片，或在照片上按住 Shift 加左右方向键调整顺序。第一张是封面。
        </span>
      )}
      {images.map(({ url }, index) => (
        <div
          className="pc-composer-thumbnail"
          key={url}
          data-dragging={dragging === url || undefined}
          data-drop-target={target === url || undefined}
          onDragOver={(event) => {
            if (!sortable || !source.current) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setTarget(source.current === url ? null : url);
          }}
          onDragLeave={(event) => {
            const next = event.relatedTarget;
            if (!(next instanceof Node) || !event.currentTarget.contains(next))
              setTarget((current) => (current === url ? null : current));
          }}
          onDrop={(event) => {
            if (!source.current) return;
            event.preventDefault();
            const from = source.current;
            clearDrag();
            move(from, url);
          }}
        >
          <button
            className="pc-composer-thumbnail-preview"
            type="button"
            aria-label={`选择照片 ${index + 1}`}
            aria-pressed={selected === url}
            aria-describedby={sortable ? instructions : undefined}
            aria-keyshortcuts={
              sortable ? "Shift+ArrowLeft Shift+ArrowRight" : undefined
            }
            data-photo-url={url}
            draggable={sortable}
            disabled={disabled}
            onClick={() => onSelect(url)}
            onDragStart={(event) => {
              if (!sortable) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("application/x-eatwhat-photo", "move");
              source.current = url;
              setDragging(url);
            }}
            onDragEnd={clearDrag}
            onKeyDown={(event) => {
              if (!sortable || !event.shiftKey) return;
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                return;
              event.preventDefault();
              const direction = event.key === "ArrowLeft" ? -1 : 1;
              const next = images[index + direction];
              if (!next) return;
              focusAfterMove.current = url;
              move(url, next.url);
            }}
          >
            <img src={url} alt="" draggable={false} />
            {index === 0 && <span className="pc-composer-cover-label">封面</span>}
          </button>
          <button
            className="pc-composer-thumbnail-remove"
            type="button"
            aria-label={`移除第 ${index + 1} 张照片`}
            disabled={disabled}
            onClick={() => onRemove(url)}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
      {images.length < 9 && (
        <button
          type="button"
          className="pc-composer-add-photo"
          aria-label="添加菜品照片"
          disabled={disabled}
          onClick={onAdd}
        >
          <Icon name="add" size={21} />
        </button>
      )}
      <span className="sr-only" role="status">
        {message}
      </span>
    </div>
  );
}
