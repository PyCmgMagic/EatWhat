// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { watchForegroundActivity } from "./foreground-activity";

let cleanup: (() => void) | undefined,
  visible = "visible";
beforeEach(() => {
  vi.useFakeTimers();
  visible = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visible as DocumentVisibilityState,
  );
});
afterEach(() => {
  cleanup?.();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function setup(
  run = vi.fn(async (_signal: AbortSignal) => ({ growth: 5 })),
  current = () => true,
) {
  const accept = vi.fn();
  cleanup = watchForegroundActivity({ run, isCurrent: current, accept });
  return { run, accept };
}
it("coalesces entry and focus events and never runs a periodic heartbeat", async () => {
  const { run } = setup();
  await vi.advanceTimersByTimeAsync(0);
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(120_000);
  expect(run).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(0);
  expect(run).toHaveBeenCalledTimes(2);
});
it("does not report a hidden tab until it becomes visible", async () => {
  visible = "hidden";
  const { run } = setup();
  await vi.advanceTimersByTimeAsync(0);
  expect(run).not.toHaveBeenCalled();
  visible = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(run).toHaveBeenCalledTimes(1);
});
it("cancels StrictMode's discarded mount before sending", async () => {
  const { run } = setup();
  cleanup?.();
  setup(run);
  await vi.advanceTimersByTimeAsync(0);
  expect(run).toHaveBeenCalledTimes(1);
});
it("does not send for a replaced identity or apply its late result", async () => {
  let current = false,
    finish!: (value: { growth: number }) => void;
  const run = vi.fn(
    (_signal: AbortSignal) =>
      new Promise<{ growth: number }>((resolve) => {
        finish = resolve;
      }),
  );
  const { accept } = setup(run, () => current);
  await vi.advanceTimersByTimeAsync(0);
  expect(run).not.toHaveBeenCalled();
  current = true;
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(0);
  current = false;
  finish({ growth: 99 });
  await vi.advanceTimersByTimeAsync(0);
  expect(accept).not.toHaveBeenCalled();
});
it("deduplicates an in-flight request and aborts it on cleanup", async () => {
  const run = vi.fn(
    (_signal: AbortSignal) => new Promise<{ growth: number }>(() => {}),
  );
  setup(run);
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(120_000);
  window.dispatchEvent(new Event("focus"));
  expect(run).toHaveBeenCalledTimes(1);
  cleanup?.();
  expect(run.mock.calls[0][0].aborted).toBe(true);
});
it("absorbs background failures and retries only on a later foreground event", async () => {
  const run = vi.fn(async (_signal: AbortSignal) => {
    throw new Error("unavailable");
  });
  const { accept } = setup(run);
  await vi.advanceTimersByTimeAsync(0);
  expect(accept).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(run).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(0);
  expect(run).toHaveBeenCalledTimes(2);
});
