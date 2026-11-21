import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { instantMotion } from "../motion/runtime";

type Drag = {
  id: number;
  startY: number;
  origin: number;
  wasOpen: boolean;
  moved: boolean;
  samples: { y: number; time: number }[];
};

export default function ProfileSheet({
  contentKey,
  tabs,
  children,
}: {
  contentKey: string;
  tabs: ReactNode;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLDivElement>(null);
  const travel = useRef(0);
  const drag = useRef<Drag | null>(null);
  const destination = useRef<boolean | null>(null);
  const suppressClick = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();

  useLayoutEffect(() => {
    const panel = sheet.current!;
    const screen = panel.parentElement!;
    const toolbar = screen.querySelector<HTMLElement>(
      ".mobile-profile-actions",
    )!;
    const summary = toolbar.querySelector<HTMLElement>(
      ".mobile-profile-summary",
    )!;
    const stage = screen.querySelector<HTMLElement>(".mobile-profile-stage")!;
    let lastProgress = -1;

    function sync() {
      const offset = screen.scrollTop;
      const open = offset >= travel.current - 1;
      if (
        (destination.current === true && open) ||
        (destination.current === false && offset <= 1)
      )
        destination.current = null;
      if (open !== stage.inert) {
        stage.inert = open;
        summary.setAttribute("aria-hidden", String(!open));
        setExpanded(open);
      }
      // Stop updating styles once the list is scrolling under the pinned tabs.
      const progress = open ? 1 : Math.max(0, offset / travel.current);
      if (progress === lastProgress) return;
      lastProgress = progress;
      toolbar.style.setProperty("--profile-collapse", String(progress));
      toolbar.toggleAttribute("data-compact", progress >= 0.5);
      nav.current!.style.setProperty(
        "--profile-corner",
        `${32 * (1 - progress)}px`,
      );
    }
    function measure() {
      const previous = travel.current;
      travel.current = Math.max(1, panel.offsetTop - toolbar.offsetHeight);
      if (previous && stage.inert && previous !== travel.current)
        screen.scrollTop =
          travel.current + Math.max(0, screen.scrollTop - previous);
      sync();
    }
    function interrupt() {
      destination.current = null;
    }
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(stage);
    resize.observe(toolbar);
    screen.addEventListener("scroll", sync, { passive: true });
    screen.addEventListener("wheel", interrupt, { passive: true });
    screen.addEventListener("touchmove", interrupt, { passive: true });
    return () => {
      resize.disconnect();
      screen.removeEventListener("scroll", sync);
      screen.removeEventListener("wheel", interrupt);
      screen.removeEventListener("touchmove", interrupt);
    };
  }, []);

  useLayoutEffect(() => {
    // Start the new list at its first item while preserving the header position.
    const screen = sheet.current!.parentElement!;
    if (screen.scrollTop > travel.current) screen.scrollTop = travel.current;
  }, [contentKey]);

  function settle(open: boolean, immediate = false) {
    destination.current = open;
    sheet.current!.parentElement!.scrollTo({
      top: open ? travel.current : 0,
      behavior: immediate || instantMotion() ? "instant" : "smooth",
    });
  }
  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || drag.current) return;
    const screen = sheet.current!.parentElement!;
    const origin = screen.scrollTop;
    screen.scrollTo({ top: origin, behavior: "instant" });
    suppressClick.current = false;
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      origin,
      wasOpen: destination.current ?? expanded,
      moved: false,
      samples: [{ y: event.clientY, time: event.timeStamp }],
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    const delta = active.startY - event.clientY;
    active.moved ||= Math.abs(delta) > 6;
    if (!active.moved) return;
    sheet.current!.dataset.dragging = "true";
    active.samples = active.samples.filter(
      (sample) => event.timeStamp - sample.time < 100,
    );
    active.samples.push({ y: event.clientY, time: event.timeStamp });
    sheet.current!.parentElement!.scrollTop = Math.min(
      Math.max(travel.current, active.origin),
      active.origin + delta,
    );
  }
  function pointerEnd(
    event: PointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    drag.current = null;
    delete sheet.current!.dataset.dragging;
    suppressClick.current = active.moved || cancelled;
    if (event.currentTarget.hasPointerCapture(active.id))
      event.currentTarget.releasePointerCapture(active.id);
    if (cancelled) {
      if (active.origin > travel.current) {
        sheet.current!.parentElement!.scrollTop = active.origin;
      } else if (active.moved) settle(active.wasOpen);
      return;
    }
    if (
      !active.moved ||
      sheet.current!.parentElement!.scrollTop > travel.current
    )
      return;
    const first = active.samples.find(
      (sample) => event.timeStamp - sample.time < 100,
    );
    const delta = active.startY - event.clientY;
    const velocity =
      first && Math.abs(delta) >= 20
        ? (first.y - event.clientY) / Math.max(1, event.timeStamp - first.time)
        : 0;
    settle(active.origin + delta + velocity * 180 > travel.current / 2);
  }

  return (
    <div ref={sheet} className="mobile-profile-sheet" data-expanded={expanded}>
      <div ref={nav} className="mobile-profile-sheet-nav">
        <button
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
            if (!suppressClick.current || event.detail === 0)
              settle(!(destination.current ?? expanded), event.detail === 0);
            suppressClick.current = false;
          }}
          onKeyDown={(event) => {
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
        {tabs}
      </div>
      <div
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
