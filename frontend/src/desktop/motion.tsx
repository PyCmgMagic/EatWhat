import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";

export function useMotionInput(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const pointer = () => {
      root.dataset.pcMotionInput = "pointer";
    };
    const keyboard = () => {
      root.dataset.pcMotionInput = "keyboard";
    };
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", keyboard, true);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", keyboard, true);
      delete root.dataset.pcMotionInput;
    };
  }, [enabled]);
}

function instantMotion() {
  return (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.pcMotionInput === "keyboard"
  );
}

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
  const measure = useCallback(() => {
    const container = root.current,
      indicator = marker.current;
    const selected = container?.querySelector<HTMLElement>(
      '[aria-current="page"], [aria-selected="true"]',
    );
    if (!container || !indicator || !selected) return;
    indicator.style.transform = `translate3d(${selected.offsetLeft}px,0,0) scaleX(${selected.offsetWidth / 100})`;
    container.dataset.indicatorReady = "true";
  }, []);
  useLayoutEffect(measure, [active, measure]);
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const observer = new ResizeObserver(measure);
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
  const root = useRef<HTMLDivElement>(null),
    animation = useRef<Animation | null>(null);
  const previous = useRef({ key: changeKey, order });
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
  useLayoutEffect(() => {
    if (changeKey === undefined || previous.current.key === changeKey) return;
    const direction = order < previous.current.order ? -1 : 1;
    previous.current = { key: changeKey, order };
    const element = root.current;
    if (!element) return;
    const running = animation.current?.playState === "running";
    const current = running ? getComputedStyle(element) : null;
    const from = current
      ? { opacity: current.opacity, transform: current.transform }
      : { opacity: "0.94", transform: `translate3d(${direction * 10}px,0,0)` };
    animation.current?.cancel();
    if (instantMotion()) return;
    const next = element.animate(
      [from, { opacity: "1", transform: "translate3d(0,0,0)" }],
      {
        duration: 180,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
    animation.current = next;
    void next.finished
      .then(() => {
        if (animation.current === next) animation.current = null;
      })
      .catch(() => {});
  }, [changeKey, order]);
  useEffect(() => () => animation.current?.cancel(), []);
  return (
    <div ref={root} className={`pc-motion-region ${className}`} {...props}>
      {children}
    </div>
  );
}
