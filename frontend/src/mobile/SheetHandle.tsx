import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { instantMotion, motion } from "../motion/runtime";
import "./sheet-handle.css";

type Props = {
  label: string;
  mode?: "expand" | "dismiss";
  /** Ancestor selector; ancestor refs may not be attached in a child's layout effect. */
  target?: string;
  /** Keep a sibling toolbar visible when expanding this sheet. */
  expandedBelow?: string;
  /** Limit which covered siblings become inert; defaults to all preceding siblings. */
  coveredSiblings?: string;
  onDismiss?: () => void;
  disabled?: boolean;
  className?: string;
};
type Drag = {
  id: number;
  y: number;
  origin: number;
  moved: boolean;
  samples: { y: number; time: number }[];
};

/** Adds real gestures to existing artboard sheets without replacing their forms or lists. */
export default function SheetHandle({
  label,
  mode = "expand",
  target,
  expandedBelow,
  coveredSiblings,
  onDismiss,
  disabled = false,
  className = "",
}: Props) {
  const button = useRef<HTMLButtonElement>(null);
  const surface = useRef<HTMLElement | null>(null);
  const original = useRef({
    height: "",
    minHeight: "",
    marginBottom: "",
    transform: "",
    transition: "",
    animation: "",
  });
  const geometry = useRef({
    scale: 1,
    top: 0,
    height: 0,
    expanded: 0,
    absolute: false,
    margin: 0,
  });
  const active = useRef<Drag | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const skipClick = useRef(false);
  const open = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const inertSiblings = useRef<HTMLElement[]>([]);
  const latest = useRef({ disabled, onDismiss });
  latest.current = { disabled, onDismiss };

  function restoreSiblings() {
    inertSiblings.current.forEach((element) => {
      element.inert = false;
    });
    inertSiblings.current = [];
  }
  function freeze() {
    const element = surface.current!;
    const matrix = getComputedStyle(element).transform;
    const offset = matrix === "none" ? 0 : new DOMMatrixReadOnly(matrix).m42;
    clearTimeout(timer.current);
    element.style.animation = "none";
    element.style.transition = "none";
    element.style.transform = `translateY(${offset}px)`;
    return offset;
  }
  function measure() {
    const element = surface.current!;
    // A transition's current position is not a new collapsed position.
    if (
      mode === "expand" &&
      (open.current || element.hasAttribute("data-sheet-moving"))
    )
      return;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const scale = rect.width / element.offsetWidth || 1;
    const boundary = expandedBelow
      ? element.parentElement?.querySelector(expandedBelow)
      : undefined;
    const expandedTop = boundary
      ? boundary.getBoundingClientRect().bottom + 8
      : 24;
    geometry.current = {
      scale,
      top: rect.top + window.scrollY,
      height: element.offsetHeight,
      expanded: Math.min(0, (expandedTop - rect.top) / scale),
      absolute: style.position === "absolute",
      margin: parseFloat(style.marginBottom) || 0,
    };
  }
  function prepare() {
    if (mode === "dismiss") return;
    const element = surface.current!,
      g = geometry.current;
    if (g.absolute) element.style.height = `${g.height - g.expanded}px`;
    else
      element.style.minHeight = `${Math.max(g.height, (innerHeight - 24) / g.scale)}px`;
  }
  function finishLayout(offset: number) {
    const element = surface.current!;
    delete element.dataset.sheetMoving;
    delete element.dataset.sheetDragging;
    if (mode === "dismiss") return;
    const g = geometry.current;
    if (offset === 0) {
      element.style.height = original.current.height;
      element.style.minHeight = original.current.minHeight;
      element.style.marginBottom = original.current.marginBottom;
    } else if (g.absolute) element.style.height = `${g.height - offset}px`;
    else element.style.marginBottom = `${g.margin + offset}px`;
  }
  function animateTo(offset: number, immediate = false, done?: () => void) {
    const element = surface.current!;
    const from = freeze();
    delete element.dataset.sheetDragging;
    const finish = () => {
      finishLayout(offset);
      done?.();
    };
    if (immediate || instantMotion() || Math.abs(from - offset) < 1) {
      element.style.transform = `translateY(${offset}px)`;
      finish();
    } else {
      element.dataset.sheetMoving = "true";
      void element.offsetHeight;
      element.style.transition = `transform ${motion.surface}ms ${motion.move}`;
      element.style.transform = `translateY(${offset}px)`;
      timer.current = setTimeout(finish, motion.surface + 20);
    }
  }
  function settle(value: boolean, immediate = false) {
    if (!surface.current) return;
    open.current = value;
    setExpanded(value);
    surface.current.dataset.sheetExpanded = String(value);
    restoreSiblings();
    if (value) {
      for (const sibling of Array.from(
        surface.current.parentElement?.children ?? [],
      )) {
        if (sibling === surface.current) break;
        if (
          sibling instanceof HTMLElement &&
          (!coveredSiblings || sibling.matches(coveredSiblings)) &&
          !sibling.inert &&
          !sibling.contains(surface.current)
        ) {
          sibling.inert = true;
          inertSiblings.current.push(sibling);
        }
      }
    }
    prepare();
    animateTo(value ? geometry.current.expanded : 0, immediate);
  }
  function dismiss(immediate = false) {
    if (latest.current.disabled || !latest.current.onDismiss) return;
    const element = surface.current!;
    const distance =
      (innerHeight - element.getBoundingClientRect().top) /
        geometry.current.scale +
      24;
    animateTo(distance, immediate, () => {
      if (!latest.current.disabled) latest.current.onDismiss?.();
      else animateTo(0);
    });
  }

  useLayoutEffect(() => {
    const element = target
      ? button.current!.closest<HTMLElement>(target)!
      : button.current!.parentElement!;
    surface.current = element;
    for (const key of Object.keys(
      original.current,
    ) as (keyof typeof original.current)[])
      original.current[key] = element.style[key];
    element.classList.add("mobile-draggable-surface");
    measure();
    // Native dialogs stay mounted after closing. A new opening must not retain
    // the previous gesture's transform, including a completed swipe to dismiss.
    const reopened = new MutationObserver(() => {
      if (!(element instanceof HTMLDialogElement) || !element.open) return;
      clearTimeout(timer.current);
      active.current = null;
      skipClick.current = false;
      Object.assign(element.style, original.current);
      delete element.dataset.sheetMoving;
      delete element.dataset.sheetDragging;
      measure();
    });
    if (element instanceof HTMLDialogElement)
      reopened.observe(element, {
        attributes: true,
        attributeFilter: ["open"],
      });
    const resized = () => {
      const pointer = active.current;
      active.current = null;
      if (pointer && button.current?.hasPointerCapture(pointer.id))
        button.current.releasePointerCapture(pointer.id);
      settle(false, true);
      measure();
    };
    window.addEventListener("resize", resized);
    return () => {
      clearTimeout(timer.current);
      reopened.disconnect();
      window.removeEventListener("resize", resized);
      restoreSiblings();
      Object.assign(element.style, original.current);
      element.classList.remove("mobile-draggable-surface");
      delete element.dataset.sheetExpanded;
      delete element.dataset.sheetMoving;
      delete element.dataset.sheetDragging;
    };
  }, [target, expandedBelow, coveredSiblings]);

  function end(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const drag = active.current;
    if (!drag || drag.id !== event.pointerId) return;
    active.current = null;
    skipClick.current = drag.moved || cancelled;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const delta = (event.clientY - drag.y) / geometry.current.scale;
    const samples = drag.samples.filter(
      (sample) => event.timeStamp - sample.time < 100,
    );
    const first = samples[0];
    const velocity =
      first && samples.length > 1 && Math.abs(delta) > 20
        ? (event.clientY - first.y) /
          geometry.current.scale /
          Math.max(1, event.timeStamp - first.time)
        : 0;
    if (mode === "dismiss") {
      const threshold = Math.min(
        140,
        Math.max(60, geometry.current.height * 0.25),
      );
      if (
        !cancelled &&
        !disabled &&
        drag.moved &&
        delta > 20 &&
        delta + velocity * 180 > threshold
      )
        dismiss();
      else animateTo(0);
    } else if (cancelled || !drag.moved) settle(open.current);
    else
      settle(
        drag.origin + delta + velocity * 180 < geometry.current.expanded / 2,
      );
  }
  return (
    <button
      ref={button}
      type="button"
      className={`mobile-sheet-handle ${className}`}
      disabled={disabled}
      aria-label={
        mode === "dismiss"
          ? `关闭${label}`
          : `${expanded ? "收起" : "展开"}${label}`
      }
      aria-expanded={mode === "expand" ? expanded : undefined}
      onPointerDown={(event) => {
        if (
          disabled ||
          !event.isPrimary ||
          event.button !== 0 ||
          active.current
        )
          return;
        skipClick.current = false;
        const offset = freeze();
        if (!open.current && Math.abs(offset) < 1) measure();
        active.current = {
          id: event.pointerId,
          y: event.clientY,
          origin: offset,
          moved: false,
          samples: [{ y: event.clientY, time: event.timeStamp }],
        };
        prepare();
        surface.current!.dataset.sheetDragging = "true";
        surface.current!.dataset.sheetMoving = "true";
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const drag = active.current;
        if (!drag || drag.id !== event.pointerId) return;
        const delta = (event.clientY - drag.y) / geometry.current.scale;
        drag.moved ||= Math.abs(delta) > 6;
        drag.samples = drag.samples.filter(
          (sample) => event.timeStamp - sample.time < 100,
        );
        drag.samples.push({ y: event.clientY, time: event.timeStamp });
        const raw = drag.origin + delta;
        const min = mode === "dismiss" ? 0 : geometry.current.expanded;
        const max =
          mode === "dismiss" ? innerHeight / geometry.current.scale : 0;
        const resist = (value: number) => 24 * (1 - Math.exp(-value / 80));
        const offset =
          raw < min
            ? min - resist(min - raw)
            : raw > max
              ? max + resist(raw - max)
              : raw;
        surface.current!.style.transform = `translateY(${offset}px)`;
      }}
      onPointerUp={(event) => end(event)}
      onPointerCancel={(event) => end(event, true)}
      onLostPointerCapture={(event) => end(event, true)}
      onClick={(event) => {
        if (skipClick.current) {
          skipClick.current = false;
          return;
        }
        if (mode === "dismiss") dismiss(event.detail === 0);
        else {
          if (!open.current) measure();
          settle(!open.current, event.detail === 0);
        }
      }}
      onKeyDown={(event) => {
        skipClick.current = false;
        if (
          ["ArrowUp", "ArrowDown", "Home", "End", "Escape"].includes(event.key)
        ) {
          event.preventDefault();
          if (mode === "dismiss") {
            if (["ArrowDown", "End", "Escape"].includes(event.key))
              dismiss(true);
          } else {
            if (!open.current) measure();
            settle(["ArrowUp", "Home"].includes(event.key), true);
          }
        }
      }}
    >
      <span aria-hidden="true" />
    </button>
  );
}
