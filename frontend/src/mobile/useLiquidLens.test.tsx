// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useLiquidLens } from "./useLiquidLens";

let root: Root, host: HTMLDivElement;
let reduced = false;
let preference: (() => void) | undefined;
let resized: (() => void) | undefined;
const flights: {
  frames: Keyframe[];
  currentTime: number;
  cancel: ReturnType<typeof vi.fn>;
  onfinish: (() => void) | null;
}[] = [];
const originalAnimate = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "animate",
);
const originalWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetWidth",
);

function Probe({
  selected,
  instant = false,
  width = 90,
}: {
  selected: number;
  instant?: boolean;
  width?: number;
}) {
  const ref = useLiquidLens(selected, instant, 3);
  return (
    <span
      ref={ref}
      style={{
        width,
        transform: `translateX(calc(${selected * 100}% + ${selected * 2}px))`,
      }}
    />
  );
}
const render = async (selected: number, instant = false, width = 90) => {
  await act(async () =>
    root.render(<Probe selected={selected} instant={instant} width={width} />),
  );
};

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  reduced = false;
  flights.length = 0;
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_: string, listener: () => void) => {
      preference = listener;
    },
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return parseFloat(this.style.width);
    },
  });
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value(frames: Keyframe[]) {
      const flight = {
        frames,
        currentTime: 0,
        cancel: vi.fn(),
        onfinish: null,
      };
      flights.push(flight);
      return flight;
    },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  if (originalAnimate)
    Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  if (originalWidth)
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalWidth);
  vi.unstubAllGlobals();
});

it("rests on mount and immediately cancels an in-flight spring for keyboard navigation", async () => {
  await render(0);
  expect(flights).toHaveLength(0);
  await render(2);
  expect(flights).toHaveLength(1);
  flights[0].currentTime = 70;
  await render(1, true);
  expect(flights[0].cancel).toHaveBeenCalledOnce();
  expect(flights).toHaveLength(1);
  expect(host.firstElementChild?.getAttribute("data-flowing")).toBeNull();
  expect((host.firstElementChild as HTMLElement).style.willChange).toBe("");
  expect((host.firstElementChild as HTMLElement).style.transform).toContain(
    "100% + 2px",
  );
});

it("honors reduced motion both initially and when it is enabled during movement", async () => {
  reduced = true;
  await render(0);
  await render(2);
  expect(flights).toHaveLength(0);
  reduced = false;
  await render(1);
  expect(flights).toHaveLength(1);
  reduced = true;
  preference?.();
  expect(flights[0].cancel).toHaveBeenCalledOnce();
  expect(host.firstElementChild?.getAttribute("data-flowing")).toBeNull();
});

it("retargets during a resize and releases its compositor layer on completion", async () => {
  await render(0);
  await render(1);
  flights[0].currentTime = 70;
  await render(1, false, 120);
  resized?.();
  expect(flights).toHaveLength(2);
  expect(flights[0].cancel).toHaveBeenCalledOnce();
  expect(flights[1].frames[0].transform).not.toBe(
    "translateX(0px) scale(1, 1)",
  );
  expect(flights[1].frames.at(-1)?.transform).toBe(
    "translateX(122px) scale(1, 1)",
  );
  flights[1].onfinish?.();
  expect(host.firstElementChild?.getAttribute("data-flowing")).toBeNull();
  expect((host.firstElementChild as HTMLElement).style.willChange).toBe("");
});
