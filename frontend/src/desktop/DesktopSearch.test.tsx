// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DesktopSearch from "./DesktopSearch";

let root: Root, host: HTMLDivElement;
function LocationValue() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search}
    </output>
  );
}
async function mount() {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <DesktopSearch />
        <LocationValue />
      </MemoryRouter>,
    ),
  );
}
function input() {
  return host.querySelector<HTMLInputElement>(".pc-header-search input")!;
}
async function focusSearch() {
  await act(async () => input().focus());
}
async function enter(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function button(text: string) {
  return [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent === text || item.ariaLabel === text,
  )!;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("opens suggestions on focus and closes with Escape", async () => {
  await mount();
  expect(host.querySelector(".pc-header-search-panel")).toBeNull();
  await focusSearch();
  expect(host.querySelector(".pc-header-search-panel")).not.toBeNull();
  expect(input().getAttribute("aria-expanded")).toBe("true");
  await act(async () =>
    input().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(host.querySelector(".pc-header-search-panel")).toBeNull();
});

it("submits a restaurant query from the header and stores recent searches", async () => {
  await mount();
  await focusSearch();
  await enter("云吞");
  await act(async () => button("店铺").click());
  await act(async () => button("搜索店铺").click());
  expect(host.querySelector('[data-testid="location"]')!.textContent).toBe(
    "/search?q=%E4%BA%91%E5%90%9E&type=shop",
  );
  expect(
    JSON.parse(localStorage.getItem("eatwhat-recent-searches-v1")!)[0],
  ).toEqual({ query: "云吞", kind: "shop" });
  input().blur();
  await focusSearch();
  expect(host.querySelector(".pc-header-search-panel")!.textContent).toContain(
    "最近搜索",
  );
});

it("submits a recent keyword without navigating to a separate search form", async () => {
  localStorage.setItem(
    "eatwhat-recent-searches-v1",
    JSON.stringify([{ query: "麻辣香锅", kind: "food" }]),
  );
  await mount();
  await focusSearch();
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".pc-search-suggestion")!.click(),
  );
  expect(host.querySelector('[data-testid="location"]')!.textContent).toBe(
    "/search?q=%E9%BA%BB%E8%BE%A3%E9%A6%99%E9%94%85",
  );
});
