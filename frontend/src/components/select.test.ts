// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Select } from "./Select";
import { MotionEnvironment } from "../motion/hooks";

let container: HTMLDivElement, root: Root;
const option = (value: string, label: string, disabled = false) =>
  h("option", { value, disabled, key: value }, label);
const options = [
  option("", "请选择"),
  option("a", "早饭"),
  option("b", "午饭", true),
  option("c", "晚饭"),
];
const button = () =>
  container.querySelector<HTMLButtonElement>("[role=combobox]")!;
const native = () => container.querySelector<HTMLSelectElement>("select")!;
const menu = () => document.querySelector("[role=listbox]");
const click = (element: Element) =>
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const key = (key: string) =>
  act(() => {
    button().dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true }),
    );
  });
function render(props = {}, children: ReactNode = options) {
  act(() =>
    root.render(
      h(
        "form",
        null,
        h(Select, { "aria-label": "饭点", name: "meal", ...props }, children),
        h("button", { type: "submit" }, "保存"),
      ),
    ),
  );
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("custom select interaction and native form contract", () => {
  it("keeps a labelled, keyboard-focusable combobox and hides the native duplicate", () => {
    render({ id: "meal", required: true, defaultValue: "a" });
    expect(button().textContent).toBe("早饭");
    expect(button().getAttribute("aria-label")).toBe("饭点");
    expect(button().getAttribute("aria-required")).toBe("true");
    expect(native().tabIndex).toBe(-1);
    expect(native().getAttribute("aria-hidden")).toBe("true");
  });
  it("makes an enclosing label activate the visible control", () => {
    act(() =>
      root.render(
        h("label", null, "饭点", h(Select, { name: "meal" }, options)),
      ),
    );
    expect(container.querySelector("label")!.control).toBe(button());
    click(container.querySelector("label")!);
    expect(button().getAttribute("aria-expanded")).toBe("true");
  });
  it("keeps a popup inside its dialog so modal focus and inertness still work", () => {
    act(() =>
      root.render(
        h(
          "dialog",
          { open: true },
          h(Select, { "aria-label": "饭点" }, options),
        ),
      ),
    );
    click(button());
    expect(menu()?.closest("dialog")).toBe(container.querySelector("dialog"));
    key("Escape");
    expect(menu()).toBeNull();
    expect(container.querySelector("dialog")!.open).toBe(true);
  });
  it("submits the actual value through FormData and emits one native change", () => {
    const changed = vi.fn();
    render({ defaultValue: "a", onChange: changed });
    click(button());
    click(document.querySelector('[role=option][data-index="3"]')!);
    expect(button().textContent).toBe("晚饭");
    expect(new FormData(container.querySelector("form")!).get("meal")).toBe(
      "c",
    );
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0][0].target).toBe(native());
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(button());
  });
  it("honors a controlled parent's value, including rejection of a change", () => {
    render({ value: "a", onChange: () => {} });
    click(button());
    click(document.querySelector('[role=option][data-index="3"]')!);
    expect(button().textContent).toBe("早饭");
    expect(native().value).toBe("a");
  });
  it("updates a controlled parent with the existing select onChange signature", () => {
    function Parent() {
      const [value, setValue] = useState("a");
      return h(
        Select,
        { value, onChange: (e) => setValue(e.target.value) },
        options,
      );
    }
    act(() => root.render(h(Parent)));
    click(button());
    key("End");
    key("Enter");
    expect(button().textContent).toBe("晚饭");
    expect(native().value).toBe("c");
  });
  it("skips disabled options with arrows and supports Home, End, Enter and Escape", () => {
    render({ defaultValue: "a" });
    key("ArrowDown");
    key("ArrowDown");
    expect(
      document.getElementById(button().getAttribute("aria-activedescendant")!)
        ?.textContent,
    ).toBe("晚饭");
    key("Home");
    expect(
      document.getElementById(button().getAttribute("aria-activedescendant")!)
        ?.textContent,
    ).toBe("请选择");
    key("End");
    key("Escape");
    expect(native().value).toBe("a");
    expect(menu()).toBeNull();
    key("ArrowUp");
    key("ArrowUp");
    key("Enter");
    expect(native().value).toBe("");
  });
  it("supports typing an option prefix and Tab closes without applying it", () => {
    render({ defaultValue: "a" });
    key("晚");
    expect(
      document.getElementById(button().getAttribute("aria-activedescendant")!)
        ?.textContent,
    ).toBe("晚饭");
    key("Tab");
    expect(menu()).toBeNull();
    expect(native().value).toBe("a");
  });
  it("keeps disabled options inert and closes on outside pointer down", () => {
    render();
    click(button());
    click(document.querySelector('[role=option][data-index="2"]')!);
    expect(native().value).toBe("");
    expect(menu()).not.toBeNull();
    act(() =>
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })),
    );
    expect(menu()).toBeNull();
  });
  it("tracks asynchronous options and native form reset", () => {
    render({ defaultValue: "a" });
    click(button());
    key("End");
    key("Enter");
    act(() => container.querySelector("form")!.reset());
    expect(native().value).toBe("a");
    expect(button().textContent).toBe("早饭");
    render({}, [option("new", "新选项")]);
    expect(button().textContent).toBe("新选项");
    expect(native().value).toBe("new");
  });
  it("retains required validation and moves invalid focus to the visible control", () => {
    render({ required: true });
    let valid = true;
    act(() => {
      valid = container.querySelector("form")!.checkValidity();
    });
    expect(valid).toBe(false);
    expect(document.activeElement).toBe(button());
    expect(button().getAttribute("aria-invalid")).toBe("true");
    click(button());
    click(document.querySelector('[role=option][data-index="1"]')!);
    expect(container.querySelector("form")!.checkValidity()).toBe(true);
    expect(button().hasAttribute("aria-invalid")).toBe(false);
  });
  it("closes when disabled or unmounted and leaves no floating options", () => {
    render();
    click(button());
    render({ disabled: true });
    expect(menu()).toBeNull();
    expect(button().disabled).toBe(true);
    render();
    click(button());
    act(() => root.render(null));
    expect(menu()).toBeNull();
  });
  it("renders color swatches and excludes hidden placeholders", () => {
    render({}, [
      h("option", { value: "", hidden: true, key: "empty" }, "选择颜色"),
      h(
        "option",
        { value: "warm", "data-color": "#ffcf44", key: "warm" },
        "暖汤",
      ),
    ]);
    click(button());
    expect(document.querySelectorAll("[role=option]")).toHaveLength(1);
    expect(
      document
        .querySelector(".ew-select-option .ew-select-swatch")
        ?.getAttribute("style"),
    ).toContain("rgb(255, 207, 68)");
  });
});

describe("animated popup lifecycle", () => {
  let reduced: boolean;
  let media: MediaQueryList;
  const animations: Array<{
    currentTime: number;
    duration: number;
    finished: Promise<void>;
    cancel: ReturnType<typeof vi.fn>;
    finish: () => void;
  }> = [];
  const originalAnimate = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "animate",
  );
  const pointerClick = (element: Element) =>
    act(() => {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 1 }),
      );
    });
  const settleAnimations = async () =>
    act(async () => {
      animations.slice(-3).forEach((animation) => animation.finish());
    });

  beforeEach(() => {
    reduced = false;
    animations.length = 0;
    media = Object.assign(new EventTarget(), {
      media: "(prefers-reduced-motion: reduce)",
    }) as MediaQueryList;
    Object.defineProperty(media, "matches", { get: () => reduced });
    vi.stubGlobal("matchMedia", () => media);
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: vi.fn((_frames, timing: KeyframeAnimationOptions) => {
        let resolve!: () => void, reject!: (reason: Error) => void;
        const finished = new Promise<void>((yes, no) => {
          resolve = yes;
          reject = no;
        });
        const animation = {
          currentTime: 0,
          duration: Number(timing.duration),
          finished,
          cancel: vi.fn(() => reject(new Error("cancelled"))),
          finish: () => {
            animation.currentTime = animation.duration;
            resolve();
          },
        };
        animations.push(animation);
        return animation as unknown as Animation;
      }),
    });
  });
  afterEach(() => {
    if (originalAnimate)
      Object.defineProperty(Element.prototype, "animate", originalAnimate);
    else Reflect.deleteProperty(Element.prototype, "animate");
    delete document.documentElement.dataset.motionInput;
    delete document.documentElement.dataset.pcMotionInput;
    vi.unstubAllGlobals();
  });

  it("retains the same top-layer surface through closing and rapid reopening", async () => {
    render({ defaultValue: "a" });
    pointerClick(button());
    const panel = document.querySelector<HTMLElement>(".ew-select-popup")!;
    const hide = vi.fn();
    panel.hidePopover = hide;
    vi.spyOn(panel, "matches").mockImplementation(
      (selector) => selector === ":popover-open",
    );
    await settleAnimations();
    pointerClick(button());
    const closing = animations.slice(-3);
    expect(panel.hasAttribute("inert")).toBe(true);
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(menu()).not.toBeNull();
    expect(hide).not.toHaveBeenCalled();
    closing.forEach((animation) => {
      animation.currentTime = animation.duration / 2;
    });
    pointerClick(button());
    expect(document.querySelector(".ew-select-popup")).toBe(panel);
    expect(panel.hasAttribute("inert")).toBe(false);
    await act(async () => closing.forEach((animation) => animation.finish()));
    await settleAnimations();
    expect(menu()).not.toBeNull();
    expect(hide).not.toHaveBeenCalled();
    pointerClick(button());
    await settleAnimations();
    expect(menu()).toBeNull();
    expect(hide).toHaveBeenCalledOnce();
  });

  it("finishes a closing popup if reduced motion is enabled mid-flight", async () => {
    act(() =>
      root.render(
        h(
          "div",
          null,
          h(MotionEnvironment),
          h(Select, { "aria-label": "饭点" }, options),
        ),
      ),
    );
    pointerClick(button());
    await settleAnimations();
    pointerClick(button());
    expect(menu()).not.toBeNull();
    await act(async () => {
      reduced = true;
      media.dispatchEvent(new Event("change"));
    });
    expect(menu()).toBeNull();
    const count = animations.length;
    pointerClick(button());
    expect(menu()).not.toBeNull();
    expect(animations).toHaveLength(count);
  });

  it("keeps asynchronous options on screen without restarting their animation", () => {
    render({ defaultValue: "a" });
    pointerClick(button());
    const panel = document.querySelector(".ew-select-popup");
    const count = animations.length;
    render({ defaultValue: "a" }, [...options, option("new", "夜宵")]);
    expect(document.querySelector(".ew-select-popup")).toBe(panel);
    expect(menu()?.textContent).toContain("夜宵");
    expect(animations).toHaveLength(count);
    key("Escape");
    expect(menu()).toBeNull();
  });
});
