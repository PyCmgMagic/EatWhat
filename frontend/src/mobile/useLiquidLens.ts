import { useLayoutEffect, useRef } from "react";
import {
  lensDuration,
  liquidLensMotion,
  restingLens,
} from "./liquid-lens-motion";

type Flight = {
  animation: Animation;
  motion: ReturnType<typeof liquidLensMotion>;
  width: number;
};

export function useLiquidLens(
  selected: number,
  instant: boolean,
  count: number,
) {
  const lens = useRef<HTMLSpanElement>(null);
  const flight = useRef<Flight | null>(null);
  const previous = useRef(selected);
  const destination = useRef(selected);
  const snap = useRef<(() => void) | undefined>(undefined);
  const retarget = useRef<(() => void) | undefined>(undefined);
  destination.current = selected;

  useLayoutEffect(() => {
    const element = lens.current;
    if (!element) return;
    const reset = () => {
      flight.current?.animation.cancel();
      flight.current = null;
      delete element.dataset.flowing;
      element.style.willChange = "";
      element.style.transform = `translateX(calc(${destination.current * 100}% + ${destination.current * 2}px))`;
      previous.current = destination.current;
    };
    snap.current = reset;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => {
      if (reduced.matches) reset();
    };
    let lastWidth = element.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (lastWidth !== element.offsetWidth) {
        lastWidth = element.offsetWidth;
        if (flight.current) retarget.current?.();
        else reset();
      }
    });
    observer.observe(element);
    reduced.addEventListener("change", onPreference);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", onPreference);
      flight.current?.animation.cancel();
      flight.current = null;
      snap.current = undefined;
      retarget.current = undefined;
    };
  }, []);

  useLayoutEffect(() => {
    const element = lens.current;
    if (!element) return;
    if (
      instant ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof element.animate !== "function"
    ) {
      snap.current?.();
      return;
    }
    const start = () => {
      const width = parseFloat(getComputedStyle(element).width);
      if (!(width > 0)) return;
      const stride = width + 2;
      const current = flight.current;
      const from = current
        ? current.motion.sample(Number(current.animation.currentTime ?? 0))
        : restingLens(previous.current * stride, width);
      if (current && width !== current.width) {
        // A destination can change the scrollbar/viewport width mid-flight.
        // Match the live scaled lens, then keep flowing toward the resized tab.
        const ratio = width / current.width;
        from.right = from.left + (from.right - from.left) * ratio;
        from.rightVelocity =
          from.leftVelocity + (from.rightVelocity - from.leftVelocity) * ratio;
      }
      const motion = liquidLensMotion(
        from,
        selected * stride,
        width,
        count * stride - 2,
      );
      current?.animation.cancel();
      element.dataset.direction = motion.direction > 0 ? "right" : "left";
      element.dataset.flowing = "true";
      element.style.willChange = "transform";
      // React owns the resting transform; this animation temporarily replaces it.
      const animation = element.animate(motion.frames, {
        duration: lensDuration,
        easing: "linear",
      });
      const next = { animation, motion, width };
      flight.current = next;
      previous.current = selected;
      animation.onfinish = () => {
        if (flight.current !== next) return;
        flight.current = null;
        delete element.dataset.flowing;
        element.style.willChange = "";
      };
    };
    retarget.current = start;
    if (selected !== previous.current) start();
  }, [selected, instant, count]);

  return lens;
}
