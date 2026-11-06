import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { finishMotion, instantMotion, motion, trackMotion } from "./runtime";

export function MotionEnvironment() {
  useEffect(() => {
    const root = document.documentElement;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = () => {
      root.dataset.motionInput = root.dataset.pcMotionInput = "pointer";
    };
    const keyboard = () => {
      root.dataset.motionInput = root.dataset.pcMotionInput = "keyboard";
      finishMotion();
    };
    const preference = () => {
      if (media.matches) finishMotion();
    };
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", keyboard, true);
    media.addEventListener("change", preference);
    return () => {
      finishMotion();
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", keyboard, true);
      media.removeEventListener("change", preference);
      delete root.dataset.motionInput;
      delete root.dataset.pcMotionInput;
    };
  }, []);
  return null;
}

/** Keep one interruptible animation; no re-mounts or delayed navigation. */
export function useContentMotion(
  target: RefObject<HTMLElement | null> | (() => HTMLElement | null),
  changeKey: string | number | undefined,
  order = 0,
  axis: "x" | "y" | "opacity" = "x",
) {
  const previous = useRef({ key: changeKey, order });
  const animation = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    if (changeKey === undefined || previous.current.key === changeKey) return;
    const direction = order < previous.current.order ? -1 : 1;
    previous.current = { key: changeKey, order };
    const element = typeof target === "function" ? target() : target.current;
    const active = animation.current?.playState === "running";
    const current = element && active ? getComputedStyle(element) : null;
    const offset = axis === "x" ? `${direction * 10}px,0,0` : "0,8px,0";
    const from: Keyframe = {
      opacity: current?.opacity ?? (axis === "opacity" ? "0.86" : "0.94"),
      ...(axis !== "opacity" && {
        transform: current?.transform ?? `translate3d(${offset})`,
      }),
    };
    animation.current?.cancel();
    animation.current = null;
    if (!element || instantMotion() || !element.animate) return;
    const next = trackMotion(
      element.animate(
        [
          from,
          { opacity: 1, ...(axis !== "opacity" && { transform: "none" }) },
        ],
        { duration: motion.content, easing: motion.enter },
      ),
    );
    animation.current = next;
    void next.finished.then(
      () => {
        if (animation.current === next) animation.current = null;
      },
      () => {},
    );
  });
  useEffect(() => () => animation.current?.cancel(), []);
}

/** Retain a closing surface until its CSS exit ends; reopening cancels removal. */
export function useExitPresence<T extends string>(value: T | null) {
  const [retained, setRetained] = useState(value);
  useLayoutEffect(() => {
    if (value !== null) {
      setRetained(value);
      return;
    }
    if (retained === null) return;
    if (instantMotion()) {
      setRetained(null);
      return;
    }
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => setRetained(null);
    const preference = () => {
      if (media.matches) finish();
    };
    const timer = window.setTimeout(finish, motion.exit);
    media.addEventListener("change", preference);
    return () => {
      clearTimeout(timer);
      media.removeEventListener("change", preference);
    };
  }, [value, retained]);
  return {
    value: value ?? retained,
    exiting: value === null && retained !== null,
  };
}

/** For dialogs that are removed from React immediately by their owner. */
export function useSurfaceDismiss(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const callback = useRef(onClose);
  callback.current = onClose;
  const closing = useRef<Animation | null>(null);
  useEffect(() => () => closing.current?.cancel(), []);
  return () => {
    if (closing.current) return;
    const element = ref.current;
    if (!element || instantMotion() || !element.animate) {
      callback.current();
      return;
    }
    const style = getComputedStyle(element);
    element.dataset.dismissing = "true";
    element.inert = true;
    const animation = trackMotion(
      element.animate(
        [
          { opacity: style.opacity, transform: style.transform },
          { opacity: 0, transform: "translate3d(0,8px,0) scale(0.98)" },
        ],
        { duration: motion.exit, easing: motion.move, fill: "forwards" },
      ),
    );
    closing.current = animation;
    void animation.finished.then(
      () => {
        closing.current = null;
        callback.current();
      },
      () => {},
    );
  };
}
