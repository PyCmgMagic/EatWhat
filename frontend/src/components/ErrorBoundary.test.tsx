// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary";

let container: HTMLDivElement, root: Root;
const reload = vi.fn();
function BrokenPage(): never {
  throw new Error("Internal request detail that must not appear in the page");
}
function crash() {
  act(() =>
    root.render(
      <ErrorBoundary>
        <BrokenPage />
      </ErrorBoundary>,
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
  reload.mockClear();
  vi.stubGlobal("location", {
    pathname: "/app/",
    search: "?view=mobile",
    reload,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("standalone error recovery", () => {
  it("renders healthy children without a fallback", () => {
    act(() =>
      root.render(
        <ErrorBoundary>
          <p>正常内容</p>
        </ErrorBoundary>,
      ),
    );
    expect(container.textContent).toBe("正常内容");
    expect(container.querySelector(".fatal-error")).toBeNull();
  });
  it("works without application providers and focuses the recovery heading", () => {
    crash();
    expect(container.querySelector("h1")?.textContent).toBe("页面遇到一点问题");
    expect(document.activeElement).toBe(container.querySelector("h1"));
    expect(document.title).toContain("页面暂时无法显示");
    expect(container.textContent).not.toContain("Internal request detail");
    expect(container.textContent).toContain("未提交的内容可能需要重新填写");
  });
  it("reloads the failed page on retry", () => {
    crash();
    act(() =>
      container.querySelector<HTMLButtonElement>("button.primary")!.click(),
    );
    expect(reload).toHaveBeenCalledOnce();
  });
  it("replaces the failed hash route and reloads when returning home", () => {
    const replace = vi
      .spyOn(history, "replaceState")
      .mockImplementation(() => {});
    crash();
    const home = container.querySelector<HTMLAnchorElement>("a.secondary")!;
    expect(home.getAttribute("href")).toBe("/app/?view=mobile#/");
    act(() => home.click());
    expect(replace).toHaveBeenCalledWith(null, "", "/app/?view=mobile#/");
    expect(reload).toHaveBeenCalledOnce();
  });
});
