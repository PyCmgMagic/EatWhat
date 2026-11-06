// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedSearch } from "./search";

describe("network search debounce", () => {
  let node: HTMLDivElement, root: Root;
  function Probe({ value }: { value: string }) {
    return createElement("output", null, useDebouncedSearch(value));
  }
  const render = (value: string) =>
    act(() => root.render(createElement(Probe, { value })));
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    node = document.createElement("div");
    document.body.append(node);
    root = createRoot(node);
  });
  afterEach(() => {
    act(() => root.unmount());
    node.remove();
    vi.useRealTimers();
  });
  it("uses an existing keyword immediately on entry", () => {
    render("云吞");
    expect(node.textContent).toBe("云吞");
  });
  it("commits only the final input after a pause", () => {
    render("");
    render("云");
    act(() => vi.advanceTimersByTime(100));
    render("云吞");
    act(() => vi.advanceTimersByTime(249));
    expect(node.textContent).toBe("");
    act(() => vi.advanceTimersByTime(1));
    expect(node.textContent).toBe("云吞");
  });
  it("clears immediately and cancels a pending keyword", () => {
    render("云吞");
    render("饺子");
    render("");
    expect(node.textContent).toBe("");
    act(() => vi.advanceTimersByTime(500));
    expect(node.textContent).toBe("");
  });
});
