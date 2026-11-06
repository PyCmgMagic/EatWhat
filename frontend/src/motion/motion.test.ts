// @vitest-environment jsdom
import { act, createElement, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MotionEnvironment,
  useContentMotion,
  useExitPresence,
  useSurfaceDismiss,
} from "./hooks";
import { finishMotion } from "./runtime";

let host: HTMLDivElement,
  root: Root,
  reduced = false;
let media: MediaQueryList;
const animations: ReturnType<typeof animationDouble>[] = [];
function animationDouble() {
  let resolve!: () => void, reject!: (reason: Error) => void;
  const finished = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  const animation = {
    playState: "running",
    finished,
    finish: vi.fn(() => {
      animation.playState = "finished";
      resolve();
    }),
    cancel: vi.fn(() => {
      animation.playState = "idle";
      reject(new Error("cancelled"));
    }),
  };
  return animation;
}
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  animations.length = 0;
  media = Object.assign(new EventTarget(), {
    get matches() {
      return reduced;
    },
    media: "(prefers-reduced-motion: reduce)",
  }) as MediaQueryList;
  // Object.assign copies getter values, so keep this preference live.
  Object.defineProperty(media, "matches", { get: () => reduced });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Element.prototype.animate = vi.fn(() => {
    const animation = animationDouble();
    animations.push(animation);
    return animation as unknown as Animation;
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
    finishMotion();
  });
  host.remove();
  delete document.documentElement.dataset.motionInput;
  delete document.documentElement.dataset.pcMotionInput;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function Content({ value, order = 0 }: { value: string; order?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useContentMotion(ref, value, order);
  return createElement("div", { ref }, value);
}
function Presence({ value }: { value: string | null }) {
  const presence = useExitPresence(value);
  return (
    presence.value &&
    createElement("div", { "data-exiting": presence.exiting }, presence.value)
  );
}

describe("interruptible application motion", () => {
  it("does not animate mounting or unchanged content, and cancels replaced motion", async () => {
    await act(async () =>
      root.render(createElement(Content, { value: "home" })),
    );
    expect(animations).toHaveLength(0);
    await act(async () =>
      root.render(createElement(Content, { value: "nearby", order: 1 })),
    );
    expect(animations).toHaveLength(1);
    await act(async () =>
      root.render(createElement(Content, { value: "nearby", order: 1 })),
    );
    expect(animations).toHaveLength(1);
    await act(async () =>
      root.render(createElement(Content, { value: "me", order: 2 })),
    );
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(animations).toHaveLength(2);
    await act(async () => root.render(null));
    expect(animations[1].cancel).toHaveBeenCalledOnce();
  });

  it("uses the previous visual position when interrupted and reverses direction", async () => {
    await act(async () =>
      root.render(createElement(Content, { value: "one", order: 1 })),
    );
    await act(async () =>
      root.render(createElement(Content, { value: "two", order: 2 })),
    );
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      opacity: "0.98",
      transform: "matrix(1, 0, 0, 1, 3, 0)",
    } as CSSStyleDeclaration);
    await act(async () =>
      root.render(createElement(Content, { value: "one", order: 1 })),
    );
    const animate = vi.mocked(Element.prototype.animate);
    expect((animate.mock.calls[1][0] as Keyframe[])[0]).toEqual({
      opacity: "0.98",
      transform: "matrix(1, 0, 0, 1, 3, 0)",
    });
    await act(async () => animations.at(-1)!.finish());
    await act(async () =>
      root.render(createElement(Content, { value: "zero", order: 0 })),
    );
    expect((animate.mock.calls[2][0] as Keyframe[])[0].transform).toBe(
      "translate3d(-10px,0,0)",
    );
  });

  it.each(["keyboard", "reduced"])(
    "skips content motion for %s",
    async (mode) => {
      if (mode === "keyboard")
        document.documentElement.dataset.motionInput = "keyboard";
      else reduced = true;
      await act(async () =>
        root.render(createElement(Content, { value: "one" })),
      );
      await act(async () =>
        root.render(createElement(Content, { value: "two" })),
      );
      expect(animations).toHaveLength(0);
    },
  );

  it("finishes running motion when the preference changes or keyboard input arrives", async () => {
    const render = (value: string) =>
      createElement(
        "div",
        null,
        createElement(MotionEnvironment),
        createElement(Content, { value }),
      );
    await act(async () => root.render(render("one")));
    await act(async () => root.render(render("two")));
    await act(async () => {
      reduced = true;
      media.dispatchEvent(new Event("change"));
    });
    expect(animations[0].finish).toHaveBeenCalledOnce();
    reduced = false;
    await act(async () => root.render(render("three")));
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" })),
    );
    expect(animations[1].finish).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.motionInput).toBe("keyboard");
  });
});

describe("surface presence", () => {
  it("keeps a closing surface, cancels obsolete removal on reopen, then removes it", async () => {
    await act(async () =>
      root.render(createElement(Presence, { value: "location" })),
    );
    await act(async () =>
      root.render(createElement(Presence, { value: null })),
    );
    expect(host.textContent).toBe("location");
    expect(host.firstElementChild?.getAttribute("data-exiting")).toBe("true");
    await act(async () => vi.advanceTimersByTime(80));
    await act(async () =>
      root.render(createElement(Presence, { value: "tags" })),
    );
    await act(async () => vi.advanceTimersByTime(200));
    expect(host.textContent).toBe("tags");
    await act(async () =>
      root.render(createElement(Presence, { value: null })),
    );
    await act(async () => vi.advanceTimersByTime(160));
    expect(host.childElementCount).toBe(0);
  });

  it("removes a closing surface immediately when reduced motion is enabled", async () => {
    await act(async () =>
      root.render(createElement(Presence, { value: "notice" })),
    );
    await act(async () =>
      root.render(createElement(Presence, { value: null })),
    );
    await act(async () => {
      reduced = true;
      media.dispatchEvent(new Event("change"));
    });
    expect(host.childElementCount).toBe(0);
  });

  it("deduplicates dismiss clicks and finishes a pending close", async () => {
    const close = vi.fn();
    function Surface() {
      const ref = useRef<HTMLDivElement>(null);
      const dismiss = useSurfaceDismiss(ref, close);
      return createElement(
        "div",
        { ref },
        createElement("button", { onClick: dismiss }, "close"),
      );
    }
    await act(async () => root.render(createElement(Surface)));
    await act(async () => {
      host.querySelector("button")!.click();
      host.querySelector("button")!.click();
    });
    expect(animations).toHaveLength(1);
    expect(close).not.toHaveBeenCalled();
    await act(async () => finishMotion());
    expect(close).toHaveBeenCalledOnce();
  });

  it("can close a new dialog after the same owner reopens it", async () => {
    const close = vi.fn();
    function Owner() {
      const [shown, setShown] = useState(true);
      const ref = useRef<HTMLDivElement>(null);
      const dismiss = useSurfaceDismiss(ref, () => {
        close();
        setShown(false);
      });
      return createElement(
        "section",
        null,
        shown &&
          createElement(
            "div",
            { ref, "data-surface": true },
            createElement("button", { onClick: dismiss }, "close"),
          ),
        createElement(
          "button",
          { onClick: () => setShown(true), "data-open": true },
          "open",
        ),
      );
    }
    await act(async () => root.render(createElement(Owner)));
    for (let i = 0; i < 2; i++) {
      await act(async () =>
        host.querySelector<HTMLButtonElement>("[data-surface] button")!.click(),
      );
      await act(async () => finishMotion());
      expect(host.querySelector("[data-surface]")).toBeNull();
      await act(async () =>
        host.querySelector<HTMLButtonElement>("[data-open]")!.click(),
      );
    }
    expect(animations).toHaveLength(2);
    expect(close).toHaveBeenCalledTimes(2);
  });
});
