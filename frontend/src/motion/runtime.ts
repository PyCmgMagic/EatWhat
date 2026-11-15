export const motion = {
  fast: 140,
  content: 200,
  surface: 240,
  exit: 160,
  enter: "cubic-bezier(0.22, 1, 0.36, 1)",
  move: "cubic-bezier(0.25, 1, 0.5, 1)",
} as const;

const running = new Set<Animation>();

export function instantMotion() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.motionInput === "keyboard"
  );
}

export function trackMotion(animation: Animation) {
  running.add(animation);
  void animation.finished.then(
    () => running.delete(animation),
    () => running.delete(animation),
  );
  return animation;
}

export function finishMotion() {
  for (const animation of running) {
    // Finishing also resolves an in-progress dismiss instead of leaving it stuck.
    try {
      animation.finish();
    } catch {
      animation.cancel();
    }
  }
  running.clear();
}
