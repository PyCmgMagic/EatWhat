// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  ActionMenu,
  AnimatedSurface,
  AnchoredPopover,
} from "./AnchoredPopover";

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("keeps action controls native, closes after selection and returns focus", async () => {
  const selected = vi.fn();
  await act(async () =>
    root.render(
      <ActionMenu
        className="actions"
        triggerClassName="trigger"
        panelClassName="panel"
        label="更多"
        icon="…"
      >
        <button onClick={selected}>编辑</button>
        <a href="#history">记录</a>
      </ActionMenu>,
    ),
  );
  const trigger = host.querySelector<HTMLButtonElement>(".trigger")!;
  await act(async () => trigger.click());
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".panel button")!.click(),
  );
  expect(selected).toHaveBeenCalledOnce();
  expect(host.querySelector(".panel")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  await act(async () => trigger.click());
  await act(async () =>
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
  );
  expect(host.querySelector(".panel")).toBeNull();
});

it("retains an inert exit and ignores completion from a replaced close", async () => {
  const effects: {
    finished: Promise<void>;
    currentTime: number;
    finish: () => void;
    cancel: () => void;
  }[] = [];
  const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "animate",
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: (_frames: Keyframe[], options: KeyframeAnimationOptions) => {
      let resolve!: () => void, reject!: (error: Error) => void;
      const finished = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const animation = {
        finished,
        currentTime: 0,
        finish: () => {
          animation.currentTime = Number(options.duration);
          resolve();
        },
        cancel: () => reject(new Error("cancelled")),
      };
      effects.push(animation);
      return animation;
    },
  });
  try {
    const exited = vi.fn();
    const render = (open: boolean) =>
      act(async () =>
        root.render(
          <AnimatedSurface open={open} onExited={exited}>
            选项
          </AnimatedSurface>,
        ),
      );
    const settle = () =>
      act(async () => effects.slice(-3).forEach((a) => a.finish()));
    await render(true);
    await settle();
    const panel = host.querySelector(".ew-animated-surface");
    await render(false);
    expect(panel?.hasAttribute("inert")).toBe(true);
    const closing = effects.slice(-3);
    closing.forEach((a) => (a.currentTime = 60));
    await render(true);
    await act(async () => closing.forEach((a) => a.finish()));
    await settle();
    expect(host.querySelector(".ew-animated-surface")).toBe(panel);
    expect(exited).not.toHaveBeenCalled();
    await render(false);
    await settle();
    expect(host.querySelector(".ew-animated-surface")).toBeNull();
    expect(exited).toHaveBeenCalledOnce();
  } finally {
    if (descriptor)
      Object.defineProperty(Element.prototype, "animate", descriptor);
    else Reflect.deleteProperty(Element.prototype, "animate");
  }
});

it("keeps Escape inside the popup and restores the anchor", async () => {
  const close = vi.fn();
  function Example() {
    const anchor = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={anchor}>菜单</button>
        <AnchoredPopover anchor={anchor} open onClose={close}>
          <button>选项</button>
        </AnchoredPopover>
      </>
    );
  }
  await act(async () => root.render(<Example />));
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  await act(async () =>
    host.querySelector(".ew-animated-surface button")!.dispatchEvent(event),
  );
  expect(event.defaultPrevented).toBe(true);
  expect(close).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(host.querySelector("button"));
});
