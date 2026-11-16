// @vitest-environment jsdom
import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  MemoryRouter,
  UNSAFE_LocationContext,
  NavigationType,
  useNavigate,
  type NavigateFunction,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authNext,
  localDestination,
  RouteContinuityProvider,
  useReturnTo,
} from "./navigation";

let root: Root, container: HTMLDivElement, navigate: NavigateFunction;
let top = 0,
  maxScroll = 2000;
function Probe() {
  const nav = useNavigate(),
    back = useReturnTo("/fallback");
  useLayoutEffect(() => {
    navigate = nav;
  }, [nav]);
  return <output>{back}</output>;
}
async function mount(path = "/search?q=云吞") {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <RouteContinuityProvider>
          <Probe />
        </RouteContinuityProvider>
      </MemoryRouter>,
    ),
  );
}
async function go(path: string | number) {
  await act(async () =>
    typeof path === "number" ? navigate(path) : navigate(path),
  );
}
async function elapse(ms = 1300) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  top = 0;
  maxScroll = 2000;
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => top,
  });
  vi.spyOn(window, "scrollTo").mockImplementation(
    (options: ScrollToOptions | number) => {
      top = Math.min(
        maxScroll,
        typeof options === "number" ? options : (options.top ?? 0),
      );
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("route continuity", () => {
  it("tracks native hash navigation even when history keys are reused", async () => {
    const render = async (pathname: string) =>
      act(async () =>
        root.render(
          <MemoryRouter>
            <UNSAFE_LocationContext.Provider
              value={{
                location: {
                  pathname,
                  search: "",
                  hash: "",
                  state: null,
                  key: "native",
                },
                navigationType: NavigationType.Pop,
              }}
            >
              <RouteContinuityProvider>
                <Probe />
              </RouteContinuityProvider>
            </UNSAFE_LocationContext.Provider>
          </MemoryRouter>,
        ),
      );
    await render("/");
    await render("/search");
    await render("/foods/1");
    expect(container.textContent).toBe("/search");
  });
  it("retains the filtered list through a detail/edit/detail round trip", async () => {
    await mount();
    await go("/foods/1");
    expect(container.textContent).toBe("/search?q=云吞");
    await go("/foods/1/edit");
    expect(container.textContent).toBe("/foods/1");
    await go("/foods/1");
    expect(container.textContent).toBe("/search?q=云吞");
  });
  it("retains a detail's original parent when its query changes", async () => {
    await mount();
    await go("/foods/1");
    await go("/foods/1?section=comments");
    expect(container.textContent).toBe("/search?q=云吞");
    await go("/foods/1/edit");
    await go(-1);
    expect(container.textContent).toBe("/search?q=云吞");
  });
  it("restores the list scroll after delayed content becomes tall enough", async () => {
    await mount();
    await elapse();
    window.scrollTo({ top: 600 });
    window.dispatchEvent(new Event("scroll"));
    await go("/foods/1");
    await elapse();
    maxScroll = 0;
    await go(-1);
    await elapse(1500);
    expect(top).toBe(0);
    maxScroll = 2000;
    await act(async () => {
      container.append(document.createElement("div"));
    });
    await elapse(50);
    expect(top).toBe(600);
  });
  it("gives every workspace tab its own scroll position", async () => {
    await mount("/me");
    await elapse();
    window.scrollTo({ top: 600 });
    window.dispatchEvent(new Event("scroll"));
    // A tab that has not been visited yet starts at the top instead of
    // inheriting the offset of the tab it is opened from.
    await act(async () =>
      navigate("/me/shares", { state: { workspaceSwitch: true } }),
    );
    await elapse(50);
    expect(top).toBe(0);
    window.scrollTo({ top: 200 });
    window.dispatchEvent(new Event("scroll"));
    // Coming back to a tab restores the place left there, not a default one.
    await act(async () => navigate("/me", { state: { workspaceSwitch: true } }));
    await elapse(50);
    expect(top).toBe(600);
    await act(async () =>
      navigate("/me/shares", { state: { workspaceSwitch: true } }),
    );
    await elapse(50);
    expect(top).toBe(200);
    await go("/favorites");
    await elapse(50);
    expect(top).toBe(0);
  });
  it("restores the mobile canvas scroll on the way back", async () => {
    const screen = document.createElement("div");
    screen.className = "design-screen";
    let screenTop = 0;
    Object.defineProperty(screen, "scrollTop", {
      configurable: true,
      get: () => screenTop,
      set: (value: number) => {
        screenTop = value;
      },
    });
    screen.scrollTo = ((options: ScrollToOptions) => {
      screenTop = options.top ?? 0;
    }) as typeof screen.scrollTo;
    document.body.append(screen);
    try {
      await mount("/me");
      await elapse();
      screen.scrollTop = 220;
      window.dispatchEvent(new Event("scroll"));
      await go("/foods/1");
      await elapse(50);
      expect(screen.scrollTop).toBe(0);
      await go(-1);
      await elapse(1500);
      expect(screen.scrollTop).toBe(220);
    } finally {
      screen.remove();
    }
  });
});

describe("authentication return targets", () => {
  it("preserves the full local target through nested query encoding", () => {
    const target = "/search?q=云吞&min=0";
    expect(
      new URLSearchParams(authNext("?next=" + encodeURIComponent(target))).get(
        "next",
      ),
    ).toBe(target);
  });
  it("rejects external and slash-escape targets", () => {
    for (const value of [
      "https://example.com",
      "//example.com",
      "/\\example.com",
      "/foo\nbar",
      null,
    ])
      expect(localDestination(value)).toBeUndefined();
    expect(authNext("?next=https%3A%2F%2Fexample.com")).toBe("");
  });
});
