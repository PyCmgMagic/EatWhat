import { instantMotion, trackMotion } from "./runtime";

// Measured from the reference recording. The surface grows while its contents
// keep their size; opening and closing deliberately use different timing.
const openDuration = 340;
const closeDuration = 120;
const openCurve = [0.105, 0.908, 0.193, 0.964] as const;
const closeCurve = [0.4, 0, 1, 1] as const;

type State = {
  x: number;
  sx: number;
  sy: number;
  y: number;
  surface: number;
  content: number;
};
const opened: State = { x: 0, sx: 1, sy: 1, y: 0, surface: 1, content: 1 };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function bezier(t: number, [x1, y1, x2, y2]: readonly number[]) {
  if (t <= 0 || t >= 1) return clamp(t);
  const at = (s: number, a: number, b: number) =>
    3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s ** 2 * b + s ** 3;
  let lo = 0,
    hi = 1;
  for (let step = 0; step < 22; step++) {
    const mid = (lo + hi) / 2;
    if (at(mid, x1, x2) < t) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2, y1, y2);
}

// Sample once, then let the compositor interpolate transform/opacity. The
// counter-scale is sampled at the same times to keep text from stretching.
const phases = [true, false].map((opening) =>
  Array.from({ length: 61 }, (_, index) => {
    const t = index / 60;
    return {
      shape: bezier(t, opening ? openCurve : closeCurve),
      surface: opening ? bezier(clamp(t / 0.8), [0.25, 0.1, 0.25, 1]) : t * t,
      content: clamp(t / (opening ? 0.16 : 0.8)),
    };
  }),
);
const transform = (s: State) =>
  `translate(${s.x}px, ${s.y}px) scale(${s.sx}, ${s.sy})`;
const counterScale = (s: State) => `scale(${1 / s.sx}, ${1 / s.sy})`;

/** Owns one mounted surface; a new target starts at its visible frame. */
export function createAnchoredPopoverMotion(
  panel: HTMLElement,
  surface: HTMLElement,
  content: HTMLElement,
  config: {
    openDuration?: number;
    closeDuration?: number;
    origin?: () => { x: number; y: number; sx: number; sy: number } | undefined;
  } = {},
) {
  let current: State | undefined;
  let running:
    | {
        animations: Animation[];
        frames: State[];
        duration: number;
      }
    | undefined;

  function paint(state: State) {
    current = state;
    panel.style.transform = transform(state);
    surface.style.opacity = String(state.surface);
    content.style.transform = counterScale(state);
    content.style.opacity = String(state.content);
  }
  function clearHints() {
    panel.style.willChange = "";
    surface.style.willChange = "";
    content.style.willChange = "";
  }
  function cancel() {
    const previous = running;
    if (previous) {
      const time = Number(previous.animations[0].currentTime ?? 0);
      const frame =
        clamp(time / previous.duration) * (previous.frames.length - 1);
      const left = previous.frames[Math.floor(frame)];
      const right = previous.frames[Math.ceil(frame)];
      const t = frame - Math.floor(frame);
      // This is the same interpolation the compositor uses between keyframes.
      paint({
        x: mix(left.x, right.x, t),
        sx: mix(left.sx, right.sx, t),
        sy: mix(left.sy, right.sy, t),
        y: mix(left.y, right.y, t),
        surface: mix(left.surface, right.surface, t),
        content: mix(left.content, right.content, t),
      });
      running = undefined;
      previous.animations.forEach((animation) => animation.cancel());
    }
    clearHints();
  }

  return {
    cancel,
    setOpen(open: boolean, onSettled: () => void, instant = false) {
      cancel();
      const offset = Math.min(24, (panel.offsetHeight || 96) / 4);
      const closed: State = {
        x: 0,
        sx: 0.4,
        sy: 0.45,
        y: panel.dataset.side === "top" ? offset : -offset,
        surface: 0,
        content: 0,
        ...config.origin?.(),
      };
      const from = current ?? closed;
      const to = open ? opened : closed;
      if (instant || !panel.animate || !window.matchMedia || instantMotion()) {
        paint(to);
        onSettled();
        return;
      }
      const distance = Math.max(
        Math.abs(from.sx - to.sx) / Math.max(0.01, Math.abs(1 - closed.sx)),
        Math.abs(from.sy - to.sy) / Math.max(0.01, Math.abs(1 - closed.sy)),
        Math.abs(from.x - to.x) / Math.max(1, Math.abs(closed.x)),
        Math.abs(from.y - to.y) / Math.max(1, Math.abs(closed.y)),
        Math.abs(from.surface - to.surface),
      );
      if (distance < 0.001) {
        paint(to);
        onSettled();
        return;
      }
      const duration =
        (open
          ? (config.openDuration ?? openDuration)
          : (config.closeDuration ?? closeDuration)) * Math.min(1, distance);
      const frames = phases[open ? 0 : 1].map(
        ({ shape, surface, content }) => ({
          sx: mix(from.sx, to.sx, shape),
          x: mix(from.x, to.x, shape),
          sy: mix(from.sy, to.sy, shape),
          y: mix(from.y, to.y, shape),
          surface: mix(from.surface, to.surface, surface),
          content: mix(from.content, to.content, content),
        }),
      );
      paint(from);
      panel.style.willChange = "transform";
      surface.style.willChange = "opacity";
      content.style.willChange = "transform, opacity";
      const timing: KeyframeAnimationOptions = {
        duration,
        easing: "linear",
        fill: "both",
      };
      const animations = [
        panel.animate(
          frames.map((s) => ({ transform: transform(s) })),
          timing,
        ),
        surface.animate(
          frames.map((s) => ({ opacity: s.surface })),
          timing,
        ),
        content.animate(
          frames.map((s) => ({
            transform: counterScale(s),
            opacity: s.content,
          })),
          timing,
        ),
      ].map(trackMotion);
      const startTime = document.timeline?.currentTime;
      if (startTime != null)
        animations.forEach((animation) => {
          animation.startTime = startTime;
        });
      const next = { animations, frames, duration };
      running = next;
      void Promise.all(animations.map((animation) => animation.finished)).then(
        () => {
          if (running !== next) return;
          running = undefined;
          paint(to);
          animations.forEach((animation) => animation.cancel());
          clearHints();
          onSettled();
        },
        () => {},
      );
    },
  };
}
