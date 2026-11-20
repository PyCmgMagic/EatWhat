import { GripHorizontal } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { DesignIcon } from "./ui";
import "./dish-photo-picker.css";

type PhotoDrag = {
  pointerId: number;
  url: string;
  content: HTMLElement;
  scroller: HTMLElement | null;
  startScroll: number;
  scale: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  frame: number;
};

function clearDrag(drag: PhotoDrag | null) {
  if (!drag) return;
  cancelAnimationFrame(drag.frame);
  drag.content.style.removeProperty("transform");
}

export default function DishPhotoPicker({
  images,
  disabled,
  processing,
  onAdd,
  onEdit,
  onRemove,
  onMove,
}: {
  images: readonly { url: string }[];
  disabled: boolean;
  processing?: boolean;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onMove: (source: string, target: string) => void;
}) {
  const instructionsId = useId();
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<PhotoDrag>(null);
  const skipClick = useRef(false);
  const focusAfterSort = useRef<string>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const sortable = images.length > 1;

  useEffect(() => () => clearDrag(drag.current), []);
  useEffect(() => {
    if (!disabled || !drag.current) return;
    clearDrag(drag.current);
    drag.current = null;
    setDragging(null);
    setTarget(null);
  }, [disabled]);

  useLayoutEffect(() => {
    if (!focusAfterSort.current) return;
    const tile = Array.from(
      grid.current?.querySelectorAll<HTMLElement>("[data-photo-url]") ?? [],
    ).find((node) => node.dataset.photoUrl === focusAfterSort.current);
    tile
      ?.querySelector<HTMLButtonElement>(".mobile-publish-photo-grip")
      ?.focus();
    focusAfterSort.current = null;
  }, [images]);

  function dropTarget(x: number, y: number, scroller: HTMLElement | null) {
    const visible = scroller?.getBoundingClientRect();
    if (visible && (y < visible.top || y >= visible.bottom)) return null;
    for (const tile of grid.current?.querySelectorAll<HTMLElement>(
      "[data-photo-url]",
    ) ?? []) {
      const rect = tile.getBoundingClientRect();
      if (x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom)
        return tile.dataset.photoUrl ?? null;
    }
    return null;
  }

  function drawDrag() {
    const current = drag.current;
    if (!current?.active) return;
    const { scroller, x, y, startX, startY, scale } = current;
    if (scroller) {
      const rect = scroller.getBoundingClientRect();
      const fromTop = y - Math.max(0, rect.top);
      const fromBottom = Math.min(window.innerHeight, rect.bottom) - y;
      const before = scroller.scrollTop;
      if (fromTop >= 0 && fromBottom >= 0) {
        const step = Math.max(0, 32 - fromBottom) - Math.max(0, 32 - fromTop);
        if (step) scroller.scrollTop += Math.round(step / 4);
      }
      if (scroller.scrollTop !== before)
        current.frame = requestAnimationFrame(drawDrag);
    }
    const scrollOffset = (scroller?.scrollTop ?? 0) - current.startScroll;
    const nextTarget = dropTarget(x, y, scroller);
    current.content.style.transform = `translate3d(${(x - startX) / scale}px, ${(y - startY) / scale + scrollOffset}px, 0)`;
    setTarget(nextTarget === current.url ? null : nextTarget);
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, url: string) {
    if (disabled || drag.current || !event.isPrimary || event.button !== 0)
      return;
    const handle = event.currentTarget;
    const content = handle.parentElement!;
    const scroller = content.closest<HTMLElement>(".mobile-publish-fields");
    const { clientX: x, clientY: y, pointerId } = event;
    handle.setPointerCapture(pointerId);
    skipClick.current = false;
    drag.current = {
      pointerId,
      url,
      content,
      scroller,
      startScroll: scroller?.scrollTop ?? 0,
      scale: content.getBoundingClientRect().width / content.offsetWidth || 1,
      startX: x,
      startY: y,
      x,
      y,
      active: false,
      frame: 0,
    };
  }

  function updateDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId || disabled) return;
    current.x = event.clientX;
    current.y = event.clientY;
    if (!current.active) {
      if (
        Math.hypot(current.x - current.startX, current.y - current.startY) < 6
      )
        return;
      current.active = true;
      skipClick.current = true;
      setSelected(null);
      setMessage("");
      setDragging(current.url);
    }
    cancelAnimationFrame(current.frame);
    current.frame = requestAnimationFrame(drawDrag);
  }

  function move(source: string, destination: string) {
    if (disabled || source === destination) return;
    const index = images.findIndex((image) => image.url === destination);
    if (index === -1 || !images.some((image) => image.url === source)) return;
    onMove(source, destination);
    setMessage(index === 0 ? "已设为封面" : `照片已移到第 ${index + 1} 位`);
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    drag.current = null;
    clearDrag(current);
    setDragging(null);
    setTarget(null);
    if (!current.active || event.type !== "pointerup") return;
    const destination = dropTarget(
      event.clientX,
      event.clientY,
      current.scroller,
    );
    if (destination) move(current.url, destination);
  }

  return (
    <section className="mobile-publish-photos" aria-label="菜品照片">
      {sortable && (
        <>
          <p className="sr-only" id={instructionsId}>
            拖动手柄，或先选择要移动的照片，再选择目标位置。
          </p>
          <span className="sr-only" role="status">
            {message}
          </span>
        </>
      )}
      <div className="mobile-publish-photo-grid" ref={grid}>
        {images.map((image, index) => (
          <div
            key={image.url}
            className="mobile-publish-photo"
            data-photo-url={image.url}
            data-dragging={dragging === image.url || undefined}
            data-sort-highlight={
              target === image.url || selected === image.url || undefined
            }
          >
            <div className="mobile-publish-photo-content">
              <button
                type="button"
                className="mobile-publish-photo-edit"
                aria-label={`编辑第 ${index + 1} 张照片`}
                disabled={disabled || dragging !== null}
                onClick={() => onEdit(index)}
              >
                <img src={image.url} alt="" draggable={false} />
                {index === 0 && (
                  <span className="mobile-publish-photo-cover">封面</span>
                )}
                {!sortable && (
                  <span
                    className="mobile-publish-photo-edit-mark"
                    aria-hidden="true"
                  >
                    <DesignIcon name="edit" size={14} />
                  </span>
                )}
              </button>
              <button
                type="button"
                className="mobile-publish-photo-remove"
                aria-label={`移除第 ${index + 1} 张照片`}
                disabled={disabled || dragging !== null}
                onClick={() => {
                  if (selected === image.url || images.length === 2)
                    setSelected(null);
                  onRemove(index);
                }}
              >
                <span className="mobile-publish-photo-close" aria-hidden="true">
                  <DesignIcon name="close" size={14} />
                </span>
              </button>
              {sortable && (
                <button
                  type="button"
                  className="mobile-publish-photo-grip"
                  aria-label={`调整第 ${index + 1} 张照片的顺序`}
                  aria-describedby={instructionsId}
                  aria-pressed={selected === image.url}
                  title="拖动排序"
                  disabled={disabled}
                  onPointerDown={(event) => startDrag(event, image.url)}
                  onPointerMove={updateDrag}
                  onPointerUp={finishDrag}
                  onPointerCancel={finishDrag}
                  onLostPointerCapture={finishDrag}
                  onContextMenu={(event) => event.preventDefault()}
                  onClick={(event) => {
                    if (
                      drag.current?.active ||
                      (skipClick.current && event.detail !== 0)
                    )
                      return;
                    if (selected) {
                      if (event.detail === 0 && selected !== image.url)
                        focusAfterSort.current = selected;
                      move(selected, image.url);
                      setSelected(null);
                    } else {
                      setSelected(image.url);
                      setMessage(
                        `已选择第 ${index + 1} 张照片，请选择目标位置`,
                      );
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && selected) {
                      setSelected(null);
                      setMessage("已取消排序");
                    }
                  }}
                >
                  <span
                    className="mobile-publish-photo-grip-mark"
                    aria-hidden="true"
                  >
                    <GripHorizontal size={16} />
                  </span>
                </button>
              )}
            </div>
          </div>
        ))}
        {images.length < 9 && (
          <button
            type="button"
            className="mobile-publish-photo-add"
            aria-label="添加菜品照片"
            disabled={disabled || dragging !== null}
            onClick={onAdd}
          >
            <DesignIcon name="add" size={24} />
          </button>
        )}
      </div>
      <output aria-label="已添加照片">{images.length} / 9</output>
      {processing !== undefined && (
        <span role="status" className="mobile-publish-photo-status">
          {processing ? "正在处理照片…" : ""}
        </span>
      )}
    </section>
  );
}
