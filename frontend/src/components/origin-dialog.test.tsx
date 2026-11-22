// @vitest-environment jsdom
import { act, StrictMode, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Modal } from "./ui";

let host: HTMLDivElement, root: Root;
const animations: {
  target: Element;
  frames: Keyframe[];
  currentTime: number;
  finish: () => void;
}[] = [];
const rect = (x: number, y: number, width: number, height: number) =>
  ({
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON() {},
  }) as DOMRect;
const oldAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "animate",
);
const oldShow = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const oldClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  animations.length = 0;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      if (this.tagName !== "DIALOG") return rect(24, 620, 260, 44);
      const transform = (this as HTMLElement).style.transform;
      const translation = transform.match(
        /translate\(([-.\d]+)px, ([-.\d]+)px\)/,
      );
      const scale = transform.match(/scale\(([-.\d]+), ([-.\d]+)\)/);
      return rect(
        180 + Number(translation?.[1] ?? 0),
        200 + Number(translation?.[2] ?? 0),
        360 * Number(scale?.[1] ?? 1),
        220 * Number(scale?.[2] ?? 1),
      );
    },
  );
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
      this.querySelector<HTMLButtonElement>("button")?.focus();
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: function (
      this: Element,
      frames: Keyframe[],
      timing: KeyframeAnimationOptions,
    ) {
      let resolve!: () => void, reject!: (error: Error) => void;
      const finished = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      const animation = {
        target: this,
        frames,
        currentTime: 0,
        finished,
        finish: () => {
          animation.currentTime = Number(timing.duration);
          resolve();
        },
        cancel: () => reject(new Error("cancelled")),
      };
      animations.push(animation);
      return animation;
    },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  for (const [prototype, key, descriptor] of [
    [Element.prototype, "animate", oldAnimate],
    [HTMLDialogElement.prototype, "showModal", oldShow],
    [HTMLDialogElement.prototype, "close", oldClose],
  ] as const) {
    if (descriptor) Object.defineProperty(prototype, key, descriptor);
    else Reflect.deleteProperty(prototype, key);
  }
  delete document.documentElement.dataset.motionInput;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function Example() {
  const trigger = useRef<HTMLButtonElement>(null),
    [open, setOpen] = useState(false);
  return (
    <>
      <button ref={trigger} onClick={() => setOpen(true)}>
        评分
      </button>
      {open && (
        <Modal
          title="评分"
          returnFocus={trigger.current}
          motionOrigin={trigger.current}
          onClose={() => setOpen(false)}
        >
          {(dismiss) => <button onClick={dismiss}>取消</button>}
        </Modal>
      )}
    </>
  );
}
const settle = () =>
  act(async () =>
    animations.slice(-3).forEach((animation) => animation.finish()),
  );

it("starts at the triggering control and retains the native dialog through its return", async () => {
  await act(async () =>
    root.render(
      <StrictMode>
        <Example />
      </StrictMode>,
    ),
  );
  const trigger = host.querySelector<HTMLButtonElement>("button")!;
  await act(async () => trigger.click());
  const dialog = host.querySelector("dialog")!;
  const entrance = animations
    .filter((animation) => animation.target === dialog)
    .at(-1)!;
  expect(String(entrance.frames[0].transform)).toContain(
    "translate(-156px, 420px)",
  );
  expect(String(entrance.frames.at(-1)!.transform)).toContain(
    "translate(0px, 0px) scale(1, 1)",
  );
  await settle();
  await act(async () =>
    Array.from(host.querySelectorAll("dialog button"))
      .find((button) => button.textContent === "取消")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true })),
  );
  expect(dialog.open).toBe(true);
  expect(dialog.inert).toBe(true);
  const exit = animations
    .slice(-3)
    .find((animation) => animation.target === dialog)!;
  expect(String(exit.frames.at(-1)!.transform)).toContain(
    "translate(-156px, 420px)",
  );
  await settle();
  expect(host.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it.each(["keyboard", "reduced"])(
  "keeps %s entry and exit instant",
  async (mode) => {
    if (mode === "keyboard")
      document.documentElement.dataset.motionInput = "keyboard";
    else vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await act(async () => root.render(<Example />));
    const trigger = host.querySelector<HTMLButtonElement>("button")!;
    await act(async () => trigger.click());
    expect(animations).toHaveLength(0);
    expect(host.querySelector("dialog")?.open).toBe(true);
    await act(async () =>
      host.querySelector<HTMLButtonElement>(".modal-close")!.click(),
    );
    expect(animations).toHaveLength(0);
    expect(host.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  },
);
