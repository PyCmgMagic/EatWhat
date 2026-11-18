// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NewShopSearch } from "./NewShopSearch";

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("../api/baidu-places", () => ({ searchMapPlaces: search }));
vi.mock("../app/area", () => ({ useArea: () => ({ area: null }) }));
vi.mock("../mobile/ui", () => ({ DesignIcon: () => null }));

const place = {
  id: "1",
  name: "三江源牛肉面",
  address: "舜华路1号",
  point: { gcjLng: 117.14, gcjLat: 36.667 },
};
const select = vi.fn();
let host: HTMLDivElement, root: Root, client: QueryClient;

function Example() {
  const [keyword, setKeyword] = useState("");
  return (
    <NewShopSearch
      keyword={keyword}
      onKeywordChange={setKeyword}
      onSelect={select}
    />
  );
}

beforeEach(async () => {
  vi.useFakeTimers();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  search.mockReset();
  select.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Example />
      </QueryClientProvider>,
    ),
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.useRealTimers();
});

function input() {
  return host.querySelector<HTMLInputElement>('input[type="search"]')!;
}

async function type(value: string) {
  await act(async () => {
    const element = input();
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function tick(ms: number) {
  await act(async () => vi.advanceTimersByTimeAsync(ms));
}

it("searches only after typing pauses and clears pending matches when the keyword is removed", async () => {
  search.mockResolvedValue([]);
  await type("三");
  await tick(200);
  await type("三江源");
  await tick(200);
  expect(search).not.toHaveBeenCalled();
  await tick(100);
  expect(search).toHaveBeenCalledExactlyOnceWith(
    "三江源",
    undefined,
    expect.any(AbortSignal),
  );
  await type("三江源牛肉面");
  await type("");
  await tick(1000);
  expect(search).toHaveBeenCalledTimes(1);
  expect(host.querySelector(".restaurant-place-results")).toBeNull();
});

it("waits for Chinese input and hands the full selected POI to the next step", async () => {
  search.mockResolvedValue([place]);
  await act(async () =>
    input().dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    ),
  );
  await type("sanjiangyuan");
  await tick(1000);
  expect(search).not.toHaveBeenCalled();
  await type("三江源");
  await act(async () =>
    input().dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true }),
    ),
  );
  await act(async () =>
    input().dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
  await tick(1000);
  expect(search).toHaveBeenCalledExactlyOnceWith(
    "三江源",
    undefined,
    expect.any(AbortSignal),
  );
  const result = host.querySelector<HTMLButtonElement>(
    ".restaurant-place-results button",
  )!;
  expect(result.textContent).toContain(place.address);
  await act(async () => result.click());
  expect(select).toHaveBeenCalledExactlyOnceWith(place);
});

it("ignores obsolete responses and leaves manual entry available when a search is empty", async () => {
  let finishOld!: (result: unknown) => void;
  search
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finishOld = resolve;
      }),
    )
    .mockResolvedValueOnce([]);
  await type("三江源");
  await tick(300);
  const signal: AbortSignal = search.mock.calls[0][2];
  await type("另一家店");
  await tick(300);
  await act(async () => finishOld([place]));
  await tick(100);
  expect(signal.aborted).toBe(true);
  expect(host.textContent).toContain("没找到这家店");
  expect(host.textContent).not.toContain(place.name);
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".new-shop-search-manual")!.click(),
  );
  expect(select).toHaveBeenCalledExactlyOnceWith();
});
