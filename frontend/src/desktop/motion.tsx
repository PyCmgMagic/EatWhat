import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useContentMotion } from "../motion/hooks";

export function SlidingTabs({
  active,
  label,
  navigation = false,
  children,
}: {
  active: string;
  label: string;
  navigation?: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null),
    marker = useRef<HTMLSpanElement>(null);
  const measure = useCallback(
    (animate = true) => {
      const container = root.current,
        indicator = marker.current;
      const selected = container?.querySelector<HTMLElement>(
        '[aria-current="page"], [aria-selected="true"]',
      );
      if (!container || !indicator || !selected) return;
      // A breakpoint can change both rows and item widths. Snap to the new
      // geometry on resize; animate only deliberate tab selection changes.
      if (!animate) indicator.style.transition = "none";
      indicator.style.top = "0";
      indicator.style.bottom = "auto";
      indicator.style.height = navigation
        ? `${selected.offsetHeight}px`
        : "3px";
      const y =
        selected.offsetTop + (navigation ? 0 : selected.offsetHeight - 3);
      indicator.style.transform = `translate3d(${selected.offsetLeft}px,${y}px,0) scaleX(${selected.offsetWidth / 100})`;
      container.dataset.indicatorReady = "true";
      if (!animate) {
        indicator.getBoundingClientRect();
        indicator.style.transition = "";
      }
    },
    [navigation],
  );
  useLayoutEffect(() => measure(), [active, measure]);
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(container);
    container
      .querySelectorAll("a,button")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [measure]);
  const Tag = navigation ? "nav" : "div";
  return (
    <Tag
      ref={root as React.Ref<HTMLDivElement & HTMLElement>}
      className={`pc-motion-tabs ${navigation ? "pc-nav-tabs" : "pc-tabs"}`}
      role={navigation ? undefined : "tablist"}
      aria-label={label}
      onKeyDown={
        navigation
          ? undefined
          : (event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              const tabs = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]',
                ),
              ];
              const index = tabs.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              if (index < 0) return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (index +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        tabs.length) %
                      tabs.length;
              tabs[next].focus({ preventScroll: true });
              tabs[next].click();
            }
      }
    >
      <span ref={marker} className="pc-tab-indicator" aria-hidden="true" />
      {children}
    </Tag>
  );
}

export function MotionRegion({
  changeKey,
  order = 0,
  reserveSpace = false,
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  changeKey?: string | number;
  order?: number;
  reserveSpace?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useContentMotion(root, changeKey, order);
  useLayoutEffect(() => {
    const element = root.current;
    if (!reserveSpace || !element) return;
    let height = element.offsetHeight;
    const observer = new ResizeObserver(([entry]) => {
      height = Math.max(height, entry.contentRect.height);
      element.style.minHeight = `${height}px`;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reserveSpace]);
  return (
    <div ref={root} className={`pc-motion-region ${className}`} {...props}>
      {children}
    </div>
  );
}
