import {
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type PointerEvent,
} from "react";
import { instantMotion } from "../motion/runtime";

/** Keep the cover behind the scrolling sheet and the same actions within reach. */
export function useDishScroll() {
  const screen = useRef<HTMLElement>(null);
  const stops = useRef({ closed: 0, open: 0 });
  const destination = useRef<boolean | null>(null);
  const drag = useRef<{
    id: number;
    y: number;
    scroll: number;
    wasOpen: boolean;
  } | null>(null);
  const dragged = useRef(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const page = screen.current!;
    const hero = page.querySelector<HTMLElement>(".dish-hero")!;
    const toolbar = page.querySelector<HTMLElement>(".dish-toolbar")!;
    const summary = page.querySelector<HTMLElement>(".dish-toolbar-summary")!;
    const sheet = page.querySelector<HTMLElement>(".dish-sheet")!;
    let lastProgress = "";

    function sync() {
      const offset = -page.getBoundingClientRect().top;
      const travel = Math.max(1, sheet.offsetTop - toolbar.offsetHeight);
      const closed = window.scrollY - offset;
      stops.current = { closed, open: closed + travel };
      const covered = offset >= travel - 1;
      if (
        (destination.current === true && covered) ||
        (destination.current === false && offset <= 1)
      )
        destination.current = null;
      const progress = (covered ? 1 : Math.max(0, offset / travel)).toFixed(3);
      if (progress !== lastProgress) {
        toolbar.style.setProperty("--dish-collapse", progress);
        toolbar.toggleAttribute("data-compact", Number(progress) >= 0.35);
        // Like the profile sheet, flatten the corners as it meets the toolbar.
        const corner = `${28 * (1 - Number(progress))}px`;
        sheet.style.borderTopLeftRadius = corner;
        sheet.style.borderTopRightRadius = corner;
        lastProgress = progress;
      }
      if (hero.inert !== covered) {
        hero.inert = covered;
        hero.setAttribute("aria-hidden", String(covered));
        summary.setAttribute("aria-hidden", String(!covered));
        setExpanded(covered);
      }
    }

    function measure() {
      hero.style.setProperty("--dish-hero-height", `${hero.offsetHeight}px`);
      sync();
    }

    function interrupt() {
      destination.current = null;
    }

    // A partially covered photo/price control must be revealed when tabbed to.
    function revealFocus(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(":focus-visible"))
        return;
      const bounds = target.getBoundingClientRect();
      if (
        bounds.bottom > sheet.getBoundingClientRect().top ||
        bounds.top < toolbar.getBoundingClientRect().bottom
      )
        window.scrollTo({
          top: window.scrollY + page.getBoundingClientRect().top,
          behavior: "instant",
        });
    }

    measure();
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    resize?.observe(hero);
    resize?.observe(toolbar);
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchmove", interrupt, { passive: true });
    hero.addEventListener("focusin", revealFocus);
    return () => {
      resize?.disconnect();
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", measure);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchmove", interrupt);
      hero.removeEventListener("focusin", revealFocus);
      hero.inert = false;
      hero.removeAttribute("aria-hidden");
    };
  }, []);

  function moveTo(open: boolean, immediate = false) {
    destination.current = open;
    window.scrollTo({
      top: open ? stops.current.open : stops.current.closed,
      behavior: immediate || instantMotion() ? "instant" : "smooth",
    });
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.removeAttribute("data-dragging");
    if (event.currentTarget.hasPointerCapture(start.id))
      event.currentTarget.releasePointerCapture(start.id);
    if (!dragged.current) return;
    if (event.type !== "pointerup") {
      moveTo(start.wasOpen);
      return;
    }
    const delta = start.y - event.clientY;
    const { closed, open } = stops.current;
    moveTo(
      Math.abs(delta) > 40 ? delta > 0 : window.scrollY > (closed + open) / 2,
    );
  }

  const handleProps: ButtonHTMLAttributes<HTMLButtonElement> = {
    "aria-expanded": expanded,
    "aria-label": expanded ? "收起菜品详情" : "展开菜品详情",
    onClick(event) {
      if (!dragged.current || event.detail === 0)
        moveTo(!(destination.current ?? expanded), event.detail === 0);
      dragged.current = false;
    },
    onPointerDown(event) {
      if (!event.isPrimary || event.button !== 0 || drag.current) return;
      const scroll = window.scrollY;
      window.scrollTo({ top: scroll, behavior: "instant" });
      drag.current = {
        id: event.pointerId,
        y: event.clientY,
        scroll,
        wasOpen: destination.current ?? expanded,
      };
      dragged.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event) {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      const delta = start.y - event.clientY;
      dragged.current ||= Math.abs(delta) > 5;
      if (!dragged.current) return;
      event.currentTarget.setAttribute("data-dragging", "");
      const { closed, open } = stops.current;
      window.scrollTo({
        top: Math.max(closed, Math.min(open, start.scroll + delta)),
        behavior: "instant",
      });
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
    onKeyDown(event) {
      if (
        ["ArrowUp", "Home", "ArrowDown", "End", "Escape"].includes(event.key)
      ) {
        event.preventDefault();
        moveTo(event.key === "ArrowUp" || event.key === "Home", true);
      }
    },
  };

  return { screen, handleProps };
}
