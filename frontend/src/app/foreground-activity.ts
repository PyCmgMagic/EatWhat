/** Foreground events only, no heartbeat. Coalesce focus/visibility and short visits. */
export function watchForegroundActivity<T>({
  run,
  isCurrent,
  accept,
  now = Date.now,
}: {
  run: (signal: AbortSignal) => Promise<T>;
  isCurrent: () => boolean;
  accept: (result: T) => void;
  now?: () => number;
}) {
  let active = true,
    pending = false,
    last = -Infinity;
  const controller = new AbortController();
  const report = () => {
    if (
      !active ||
      pending ||
      document.visibilityState !== "visible" ||
      !isCurrent() ||
      now() - last < 60_000
    )
      return;
    pending = true;
    last = now();
    void Promise.resolve()
      .then(() => {
        controller.signal.throwIfAborted();
        if (!isCurrent()) return;
        return run(controller.signal);
      })
      .then((result) => {
        if (result !== undefined && active && isCurrent()) accept(result);
      })
      .catch(() => {
        /* Daily accounting also happens on normal business calls. */
      })
      .finally(() => {
        pending = false;
      });
  };
  const initial = setTimeout(report, 0);
  document.addEventListener("visibilitychange", report);
  window.addEventListener("focus", report);
  return () => {
    active = false;
    clearTimeout(initial);
    controller.abort();
    document.removeEventListener("visibilitychange", report);
    window.removeEventListener("focus", report);
  };
}
