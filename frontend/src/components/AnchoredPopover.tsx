import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { createAnchoredPopoverMotion } from "../motion/anchored-popover";
import "./anchored-popover.css";

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  open: boolean;
  instant?: boolean;
  duration?: number;
  closeDuration?: number;
  padding?: number;
  chrome?: boolean;
  onExited?: () => void;
  prepare?: (panel: HTMLDivElement, content: HTMLDivElement) => () => void;
};

/** A retained, interruptible surface. Position and action semantics stay with its owner. */
export function AnimatedSurface({
  open,
  instant = false,
  duration = 260,
  closeDuration = 120,
  padding = 6,
  chrome = true,
  onExited,
  prepare,
  className = "",
  style,
  children,
  ...props
}: SurfaceProps) {
  const [retained, setRetained] = useState(open);
  const present = open || retained;
  const panel = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const controller = useRef<ReturnType<
    typeof createAnchoredPopoverMotion
  > | null>(null);
  const latest = useRef({ prepare, onExited, duration, closeDuration });
  latest.current = { prepare, onExited, duration, closeDuration };
  useLayoutEffect(() => {
    if (!present || !panel.current || !surface.current || !content.current)
      return;
    const cleanup = latest.current.prepare?.(panel.current, content.current);
    const motion = createAnchoredPopoverMotion(
      panel.current,
      surface.current,
      content.current,
      {
        openDuration: latest.current.duration,
        closeDuration: latest.current.closeDuration,
      },
    );
    controller.current = motion;
    return () => {
      motion.cancel();
      controller.current = null;
      cleanup?.();
    };
  }, [present]);
  useLayoutEffect(() => {
    if (open) setRetained(true);
    controller.current?.setOpen(
      open,
      () => {
        if (!open) {
          setRetained(false);
          latest.current.onExited?.();
        }
      },
      instant,
    );
  }, [open, present, instant]);
  if (!present) return null;
  return (
    <div
      {...props}
      ref={panel}
      className={`ew-animated-surface ${className}`}
      data-state={open ? "open" : "closed"}
      data-chrome={chrome || undefined}
      inert={!open}
      aria-hidden={!open || props["aria-hidden"] || undefined}
      style={
        {
          ...style,
          padding: 0,
          border: 0,
          background: "transparent",
          boxShadow: "none",
          overflow: "visible",
          "--anchored-padding": `${padding}px`,
        } as React.CSSProperties
      }
    >
      <div ref={surface} className="ew-anchored-surface" aria-hidden="true" />
      <div className="ew-anchored-viewport">
        <div ref={content} className="ew-anchored-content">
          {children}
        </div>
      </div>
    </div>
  );
}

type PopoverProps = Omit<SurfaceProps, "prepare"> & {
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number | "anchor";
  side?: "top" | "bottom";
  align?: "start" | "end";
};

function zoomScale(node: HTMLElement) {
  let scale = 1;
  for (
    let parent: HTMLElement | null = node;
    parent;
    parent = parent.parentElement
  ) {
    const zoom = Number.parseFloat(getComputedStyle(parent).zoom);
    if (Number.isFinite(zoom) && zoom > 0) scale *= zoom;
  }
  return scale;
}

/** Native top layer supplies clipping safety while keeping the original DOM and focus order. */
export function AnchoredPopover({
  anchor,
  onClose,
  width = 216,
  side = "bottom",
  align = "end",
  ...props
}: PopoverProps) {
  const latest = useRef({
    anchor,
    onClose,
    width,
    side,
    align,
    open: props.open,
  });
  latest.current = { anchor, onClose, width, side, align, open: props.open };
  function prepare(panel: HTMLDivElement, content: HTMLDivElement) {
    if (typeof panel.showPopover === "function" && panel.isConnected)
      panel.showPopover();
    const update = () => {
      const cfg = latest.current,
        button = cfg.anchor.current;
      if (!button) return;
      const rect = button.getBoundingClientRect(),
        view = window.visualViewport;
      const viewWidth = view?.width ?? innerWidth,
        viewHeight = view?.height ?? innerHeight;
      const x = view?.offsetLeft ?? 0,
        y = view?.offsetTop ?? 0;
      if (rect.bottom < y || rect.top > y + viewHeight) {
        cfg.onClose();
        return;
      }
      const scale = zoomScale(panel);
      const size = Math.min(
        cfg.width === "anchor" ? rect.width : cfg.width * scale,
        viewWidth - 24,
      );
      panel.style.width = `${size / scale}px`;
      const below = y + viewHeight - rect.bottom - 18,
        above = rect.top - y - 18;
      const needed = Math.min(content.scrollHeight * scale, 420);
      const flip =
        cfg.side === "top"
          ? !(above < needed && below > above)
          : below < needed && above > below;
      const maxHeight = Math.max(44, Math.min(420, flip ? above : below));
      const left = Math.max(
        x + 12,
        Math.min(
          cfg.align === "end" ? rect.right - size : rect.left,
          x + viewWidth - size - 12,
        ),
      );
      panel.dataset.side = flip ? "top" : "bottom";
      Object.assign(panel.style, {
        position: "fixed",
        inset: "auto",
        margin: "0",
        right: "auto",
        bottom: "auto",
        width: `${size / scale}px`,
        maxHeight: `${maxHeight / scale}px`,
        left: `${left / scale}px`,
        top: `${(flip ? Math.max(y + 12, rect.top - Math.min(needed, maxHeight) - 8) : rect.bottom + 8) / scale}px`,
        transformOrigin: `${Math.max(12, Math.min(size - 12, rect.left + rect.width / 2 - left)) / scale}px ${flip ? "bottom" : "top"}`,
      });
    };
    update();
    const outside = (event: Event) => {
      if (
        latest.current.open &&
        !panel.contains(event.target as Node) &&
        !latest.current.anchor.current?.contains(event.target as Node)
      )
        latest.current.onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !latest.current.open) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current.onClose();
      latest.current.anchor.current?.focus({ preventScroll: true });
    };
    const scroll = (event: Event) => {
      if (!panel.contains(event.target as Node)) update();
    };
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    if (latest.current.anchor.current)
      observer?.observe(latest.current.anchor.current);
    observer?.observe(content);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    window.addEventListener("keydown", escape);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer?.disconnect();
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      if (
        typeof panel.hidePopover === "function" &&
        panel.matches(":popover-open")
      )
        panel.hidePopover();
    };
  }
  return <AnimatedSurface {...props} popover="manual" prepare={prepare} />;
}

export function ActionMenu({
  className,
  triggerClassName,
  panelClassName,
  label,
  children,
  icon,
  width = 184,
}: {
  className: string;
  triggerClassName: string;
  panelClassName: string;
  label: string;
  children: ReactNode;
  icon: ReactNode;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const instant = useRef(false);
  const focusFirst = () =>
    document
      .getElementById(id)
      ?.querySelector<HTMLElement>("a[href],button:not(:disabled)")
      ?.focus();
  return (
    <div className={className} data-open={open || undefined}>
      <button
        ref={trigger}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => {
          instant.current = event.detail === 0;
          setOpen((v) => !v);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            instant.current = true;
            setOpen(true);
            requestAnimationFrame(focusFirst);
          }
        }}
      >
        {icon}
      </button>
      <AnchoredPopover
        open={open}
        onClose={() => setOpen(false)}
        anchor={trigger}
        id={id}
        className={panelClassName}
        width={width}
        instant={instant.current}
        role="group"
        aria-label={label}
        onKeyDown={(event) => {
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "a[href],button:not(:disabled)",
            ),
          );
          if (
            !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) ||
            !items.length
          )
            return;
          event.preventDefault();
          const at = items.indexOf(document.activeElement as HTMLElement);
          items[
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? items.length - 1
                : (at + (event.key === "ArrowDown" ? 1 : items.length - 1)) %
                  items.length
          ]?.focus();
        }}
        onClick={(event) => {
          if (!(event.target as Element).closest("a,button")) return;
          instant.current = event.detail === 0;
          setOpen(false);
          trigger.current?.focus({ preventScroll: true });
        }}
      >
        {children}
      </AnchoredPopover>
    </div>
  );
}
