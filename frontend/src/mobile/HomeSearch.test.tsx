// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HomeSearchButton, HomeSearchOverlay } from "./HomeSearch";

let host: HTMLDivElement;
let root: Root;
const dialogPrototype = HTMLDialogElement.prototype;
const showModal = Object.getOwnPropertyDescriptor(dialogPrototype, "showModal");
const closeModal = Object.getOwnPropertyDescriptor(dialogPrototype, "close");

function render(node: React.ReactNode) {
  return act(async () => root.render(node));
}

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function texts(selector: string) {
  return [...document.querySelectorAll(selector)]
    .map((node) => node.textContent ?? "")
    .filter(Boolean);
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })),
  );
  Object.defineProperty(dialogPrototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(dialogPrototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  if (showModal) Object.defineProperty(dialogPrototype, "showModal", showModal);
  else Reflect.deleteProperty(dialogPrototype, "showModal");
  if (closeModal) Object.defineProperty(dialogPrototype, "close", closeModal);
  else Reflect.deleteProperty(dialogPrototype, "close");
  vi.unstubAllGlobals();
  document.documentElement.style.overflow = "";
});

it("opens from the toolbar entry and reports whether it is expanded", async () => {
  const onOpen = vi.fn();
  await render(<HomeSearchButton open={false} onOpen={onOpen} />);
  const button = host.querySelector<HTMLButtonElement>(
    ".ew-home-search-button",
  )!;
  expect(button.getAttribute("aria-label")).toBe("搜索菜品或店名");
  expect(button.getAttribute("aria-expanded")).toBe("false");

  await act(async () => button.click());
  expect(onOpen).toHaveBeenCalledTimes(1);

  await render(<HomeSearchButton open onOpen={onOpen} />);
  expect(
    host.querySelector(".ew-home-search-button")!.getAttribute("aria-expanded"),
  ).toBe("true");
});

it("renders nothing at all while the surface is closed", async () => {
  await render(
    <HomeSearchOverlay open={false} onClose={vi.fn()} onSearch={vi.fn()} />,
  );
  expect(host.querySelector(".ew-home-search")).toBeNull();
});

it("focuses the field and offers history above the suggestions", async () => {
  window.localStorage.setItem(
    "eatwhat-recent-searches-v1",
    JSON.stringify([{ query: "锅包肉", kind: "food" }]),
  );
  await render(<HomeSearchOverlay open onClose={vi.fn()} onSearch={vi.fn()} />);

  const input = host.querySelector<HTMLInputElement>(
    ".ew-home-search-bar input",
  )!;
  expect(document.activeElement).toBe(input);
  expect(texts(".ew-home-search-caption")).toEqual(["最近搜索", "猜你想搜"]);
  expect(texts(".ew-home-search-row span")).toEqual([
    "锅包肉",
    "云吞",
    "麻辣香锅",
    "杨枝甘露",
  ]);
  expect(host.querySelector("dialog")?.open).toBe(true);
  expect(document.documentElement.style.overflow).toBe("hidden");
});

it("filters while typing and searches the typed keyword", async () => {
  window.localStorage.setItem(
    "eatwhat-recent-searches-v1",
    JSON.stringify([{ query: "锅包肉", kind: "food" }]),
  );
  const onSearch = vi.fn();
  const onClose = vi.fn();
  await render(
    <HomeSearchOverlay open onClose={onClose} onSearch={onSearch} />,
  );
  const input = host.querySelector<HTMLInputElement>(
    ".ew-home-search-bar input",
  )!;

  await act(async () => type(input, "云"));
  expect(texts(".ew-home-search-row span")).toEqual(["云吞", "搜索“云”"]);

  await act(async () =>
    host
      .querySelector<HTMLButtonElement>(".ew-home-search-row.is-query")!
      .click(),
  );
  expect(onSearch).toHaveBeenCalledWith({ query: "云", kind: "food" });
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(window.localStorage.getItem("eatwhat-recent-searches-v1")).toContain(
    '"query":"云"',
  );
});

it("dismisses through native cancel, backdrop, and the close button", async () => {
  const onClose = vi.fn();
  await render(<HomeSearchOverlay open onClose={onClose} onSearch={vi.fn()} />);
  const dialog = host.querySelector<HTMLDialogElement>("dialog")!;

  await act(async () =>
    dialog.dispatchEvent(new Event("cancel", { cancelable: true })),
  );
  expect(onClose).toHaveBeenCalledTimes(1);

  await act(async () => dialog.click());
  expect(onClose).toHaveBeenCalledTimes(2);
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".ew-home-search-close")!.click(),
  );
  expect(onClose).toHaveBeenCalledTimes(3);
});

it("restores the trigger focus and scrollbar after closing", async () => {
  const trigger = document.createElement("button");
  document.body.appendChild(trigger);
  const props = { returnFocus: trigger, onClose: vi.fn(), onSearch: vi.fn() };
  try {
    await render(<HomeSearchOverlay open {...props} />);
    await render(<HomeSearchOverlay open={false} {...props} />);
    expect(document.activeElement).toBe(trigger);
    expect(document.documentElement.style.overflow).toBe("");
  } finally {
    trigger.remove();
  }
});

it("drops one history entry without touching the others", async () => {
  window.localStorage.setItem(
    "eatwhat-recent-searches-v1",
    JSON.stringify([
      { query: "一食堂", kind: "food" },
      { query: "一食堂", kind: "shop" },
    ]),
  );
  const onSearch = vi.fn();
  await render(
    <HomeSearchOverlay open onClose={vi.fn()} onSearch={onSearch} />,
  );

  await act(async () =>
    host
      .querySelector<HTMLButtonElement>(
        '.ew-home-search-remove[aria-label="删除菜品搜索记录“一食堂”"]',
      )!
      .click(),
  );

  expect(texts(".ew-home-search-row span")).toEqual([
    "一食堂",
    "云吞",
    "麻辣香锅",
    "杨枝甘露",
  ]);
  expect(
    JSON.parse(
      window.localStorage.getItem("eatwhat-recent-searches-v1") ?? "[]",
    ),
  ).toEqual([{ query: "一食堂", kind: "shop" }]);
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>(
        ".ew-home-search-entry .ew-home-search-row",
      )!
      .click(),
  );
  expect(onSearch).toHaveBeenCalledWith({ query: "一食堂", kind: "shop" });
});

it("clears the whole history in one tap", async () => {
  window.localStorage.setItem(
    "eatwhat-recent-searches-v1",
    JSON.stringify([
      { query: "锅包肉", kind: "food" },
      { query: "铁锅炖大鹅", kind: "shop" },
    ]),
  );
  await render(<HomeSearchOverlay open onClose={vi.fn()} onSearch={vi.fn()} />);

  await act(async () =>
    host.querySelector<HTMLButtonElement>(".ew-home-search-clear")!.click(),
  );

  expect(host.querySelector('[aria-label="最近搜索"]')).toBeNull();
  expect(texts(".ew-home-search-caption")).toEqual(["猜你想搜"]);
  expect(window.localStorage.getItem("eatwhat-recent-searches-v1")).toBeNull();
});
