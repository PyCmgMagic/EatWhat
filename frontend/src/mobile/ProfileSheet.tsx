import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { instantMotion, motion } from "../motion/runtime";

type Drag = {
  id: number;
  startY: number;
  origin: number;
  moved: boolean;
  samples: { y: number; time: number }[];
};

/** The profile artboard's handle owns the drag; its content keeps native scrolling. */
export default function ProfileSheet({ children }: { children: ReactNode }) {
  const sheet = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const metrics = useRef({ height: 844, top: 24, distance: 348 });
  const drag = useRef<Drag | null>(null);
  const expandedRef = useRef(false);
  const suppressClick = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  function resizeContent(offset: number) {
    if (!content.current || !handle.current) return;
    content.current.style.height = `${Math.max(0, metrics.current.height - metrics.current.top - offset - handle.current.offsetHeight)}px`;
  }

  function currentOffset() {
    const transform = getComputedStyle(sheet.current!).transform;
    return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
  }

  function freeze() {
    const element = sheet.current!;
    const offset = currentOffset();
    clearTimeout(timer.current);
    element.style.transition = "none";
    element.style.transform = `translateY(${offset}px)`;
    return offset;
  }

  function settle(open: boolean, immediate = false) {
    const element = sheet.current;
    if (!element) return;
    const start = freeze();
    const target = open ? 0 : metrics.current.distance;
    expandedRef.current = open;
    setExpanded(open);
    delete element.dataset.dragging;
    const finish = () => {
      delete element.dataset.moving;
      resizeContent(target);
    };
    if (immediate || instantMotion() || Math.abs(start - target) < 1) {
      element.style.transform = `translateY(${target}px)`;
      finish();
      return;
    }
    // Keep the full surface available while it travels; resize the scrollport
    // only once it reaches its resting position, never on each pointer move.
    resizeContent(0);
    element.dataset.moving = "true";
    void element.offsetHeight;
    element.style.transition = `transform ${motion.surface}ms ${motion.move}`;
    element.style.transform = `translateY(${target}px)`;
    timer.current = setTimeout(finish, motion.surface + 20);
  }

  useLayoutEffect(() => {
    const element = sheet.current!;
    const measure = () => {
      const height = element.parentElement!.clientHeight;
      const top = parseFloat(getComputedStyle(element).top) || 24;
      const collapsed = Math.min(372, Math.max(top + 120, height - 144));
      metrics.current = { height, top, distance: collapsed - top };
      const active = drag.current;
      drag.current = null;
      if (active && handle.current?.hasPointerCapture(active.id))
        handle.current.releasePointerCapture(active.id);
      settle(expandedRef.current, true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element.parentElement!);
    return () => {
      observer.disconnect();
      clearTimeout(timer.current);
    };
  }, []);

  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || drag.current) return;
    suppressClick.current = false;
    const origin = freeze();
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      origin,
      moved: false,
      samples: [{ y: event.clientY, time: event.timeStamp }],
    };
    sheet.current!.dataset.dragging = "true";
    sheet.current!.dataset.moving = "true";
    resizeContent(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    const delta = event.clientY - active.startY;
    active.moved ||= Math.abs(delta) > 6;
    active.samples = active.samples.filter(
      (sample) => event.timeStamp - sample.time < 100,
    );
    active.samples.push({ y: event.clientY, time: event.timeStamp });
    const raw = active.origin + delta;
    const end = metrics.current.distance;
    const resistance = (overshoot: number) =>
      24 * (1 - Math.exp(-overshoot / 80));
    const offset =
      raw < 0
        ? -resistance(-raw)
        : raw > end
          ? end + resistance(raw - end)
          : raw;
    sheet.current!.style.transform = `translateY(${offset}px)`;
  }

  function pointerEnd(
    event: PointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    drag.current = null;
    suppressClick.current = active.moved || cancelled;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled || !active.moved) {
      settle(expandedRef.current);
      return;
    }
    const recent = active.samples.filter(
      (sample) => event.timeStamp - sample.time < 100,
    );
    const first = recent[0];
    const delta = event.clientY - active.startY;
    const velocity =
      first && recent.length > 1 && Math.abs(delta) >= 20
        ? (event.clientY - first.y) / Math.max(1, event.timeStamp - first.time)
        : 0;
    const projected = active.origin + delta + velocity * 180;
    settle(projected < metrics.current.distance / 2);
  }

  return (
    <div ref={sheet} className="mobile-profile-sheet" data-expanded={expanded}>
      <button
        ref={handle}
        type="button"
        className="mobile-profile-sheet-handle"
        aria-label={expanded ? "收起我的内容" : "展开我的内容"}
        aria-expanded={expanded}
        aria-controls={contentId}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={(event) => pointerEnd(event)}
        onPointerCancel={(event) => pointerEnd(event, true)}
        onLostPointerCapture={(event) => pointerEnd(event, true)}
        onClick={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          settle(!expandedRef.current, event.detail === 0);
        }}
        onKeyDown={(event) => {
          suppressClick.current = false;
          if (
            ["ArrowUp", "ArrowDown", "Home", "End", "Escape"].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            settle(["ArrowUp", "Home"].includes(event.key), true);
          }
        }}
      >
        <span aria-hidden="true" />
      </button>
      <div
        ref={content}
        id={contentId}
        className="mobile-profile-sheet-content"
        role="region"
        aria-label="我的内容"
      >
        {children}
      </div>
    </div>
  );
}
