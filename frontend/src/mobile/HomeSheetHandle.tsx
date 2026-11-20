import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { instantMotion } from "../motion/runtime";

/** The home sheet travels with the document, including when its handle is dragged. */
export default function HomeSheetHandle() {
  const button = useRef<HTMLButtonElement>(null);
  const stops = useRef({ closed: 0, open: 0 });
  const drag = useRef<{ id: number; y: number; scroll: number } | null>(null);
  const dragged = useRef(false);
  const destination = useRef<boolean | null>(null);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const sheet = button.current!.parentElement!;
    const screen = sheet.parentElement!;
    const toolbar = screen.querySelector<HTMLElement>(".mobile-home-toolbar")!;
    const hero = screen.querySelector<HTMLElement>(".mobile-home-hero")!;
    let lastLabels = "";

    function sync() {
      const top = screen.getBoundingClientRect().top;
      const travel = sheet.offsetTop - toolbar.offsetHeight;
      const closed = window.scrollY + top;
      stops.current = { closed, open: closed + travel };
      const covered = -top >= travel - 1;
      if (
        (destination.current === true && covered) ||
        (destination.current === false && top >= -1)
      )
        destination.current = null;
      if (covered !== hero.inert) {
        hero.inert = covered;
        setExpanded(covered);
      }
      const labels = Math.min(
        1,
        Math.max(0, 1 + top / Math.max(1, Math.min(160, travel))),
      ).toFixed(3);
      if (labels !== lastLabels) {
        toolbar.style.setProperty("--home-labels", labels);
        toolbar.toggleAttribute("data-compact", Number(labels) < 0.5);
        lastLabels = labels;
      }
    }

    // Tabbing back to a partially covered hero action should reveal that action.
    function revealFocus(event: FocusEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.matches(":focus-visible") &&
        target.getBoundingClientRect().bottom >
          sheet.getBoundingClientRect().top
      )
        window.scrollTo({ top: stops.current.closed, behavior: "instant" });
    }

    function measure() {
      hero.style.setProperty("--home-hero-height", `${hero.offsetHeight}px`);
      sync();
    }
    function interrupt() {
      destination.current = null;
    }
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(hero);
    resize.observe(toolbar);
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchmove", interrupt, { passive: true });
    hero.addEventListener("focusin", revealFocus);
    return () => {
      resize.disconnect();
      window.removeEventListener("scroll", sync);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchmove", interrupt);
      hero.removeEventListener("focusin", revealFocus);
      hero.inert = false;
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
    if (event.currentTarget.hasPointerCapture(start.id))
      event.currentTarget.releasePointerCapture(start.id);
    if (dragged.current && event.type === "pointerup") {
      const delta = start.y - event.clientY;
      const { closed, open } = stops.current;
      moveTo(
        Math.abs(delta) > 40 ? delta > 0 : window.scrollY > (closed + open) / 2,
      );
    }
  }

  return (
    <button
      ref={button}
      type="button"
      className="mobile-sheet-handle mobile-home-handle"
      aria-label={expanded ? "收起推荐内容" : "展开推荐内容"}
      aria-expanded={expanded}
      onClick={(event) => {
        if (!dragged.current || event.detail === 0)
          moveTo(!(destination.current ?? expanded), event.detail === 0);
        dragged.current = false;
      }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        drag.current = {
          id: event.pointerId,
          y: event.clientY,
          scroll: window.scrollY,
        };
        dragged.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || start.id !== event.pointerId) return;
        const delta = start.y - event.clientY;
        dragged.current ||= Math.abs(delta) > 5;
        if (dragged.current) {
          const { closed, open } = stops.current;
          window.scrollTo({
            top: Math.max(closed, Math.min(open, start.scroll + delta)),
            behavior: "instant",
          });
        }
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={(event) => {
        if (
          ["ArrowUp", "Home", "ArrowDown", "End", "Escape"].includes(event.key)
        ) {
          event.preventDefault();
          moveTo(event.key === "ArrowUp" || event.key === "Home", true);
        }
      }}
    >
      <span aria-hidden="true" />
    </button>
  );
}
