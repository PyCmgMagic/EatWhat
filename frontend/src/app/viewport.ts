import { useLayoutEffect } from "react";

// Keep overlay controls inside the visible area when a mobile keyboard pans
// the visual viewport without resizing the document's layout viewport.
export function useVisibleViewport() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    let previousHeight = "",
      previousTop = "",
      previousOccluded = "";
    const update = () => {
      const height = viewport?.height ?? innerHeight;
      const nextHeight = `${height}px`,
        nextTop = `${viewport?.offsetTop ?? 0}px`;
      const occluded = String(
        Math.abs((viewport?.scale ?? 1) - 1) < 0.05 &&
          innerHeight - height > 120,
      );
      if (previousHeight !== nextHeight) {
        root.style.setProperty("--visible-height", nextHeight);
        previousHeight = nextHeight;
      }
      if (previousTop !== nextTop) {
        root.style.setProperty("--visible-top", nextTop);
        previousTop = nextTop;
      }
      if (previousOccluded !== occluded) {
        root.dataset.viewportOccluded = occluded;
        previousOccluded = occluded;
      }
    };
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          update();
        });
    };
    update();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.style.removeProperty("--visible-height");
      root.style.removeProperty("--visible-top");
      delete root.dataset.viewportOccluded;
    };
  }, []);
}
