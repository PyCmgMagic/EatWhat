// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DishDuplicateHint } from "./DishDuplicateHint";

const { duplicates } = vi.hoisted(() => ({ duplicates: vi.fn() }));
vi.mock("../app/state", () => ({
  useApp: () => ({ api: { foodDuplicates: duplicates } }),
}));

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  duplicates.mockReset().mockResolvedValue([]);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});

async function render(restaurantId: number | undefined, name: string) {
  // A fresh mount each time, like opening the publish page.
  await act(async () => root.unmount());
  root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter>
          <DishDuplicateHint restaurantId={restaurantId} name={name} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  // Past the typing pause, then let the query settle.
  await act(async () => vi.advanceTimersByTime(500));
  await act(async () => {});
}

it("says the shop already has a dish of the same name", async () => {
  duplicates.mockResolvedValue([
    { id: 3, name: "红烧肉", sameName: true },
    { id: 4, name: "红烧肉盖饭", sameName: false },
  ]);
  await render(9, " 红烧肉 ");
  expect(duplicates).toHaveBeenCalledWith(9, "红烧肉", expect.anything());
  const hint = host.querySelector(".dish-duplicate-hint")!;
  expect(hint.textContent).toContain("这家店已经有「红烧肉」了");
  expect(hint.querySelector("a")!.getAttribute("href")).toBe("/foods/3");
});

it("lists similar dishes when none has the same name", async () => {
  duplicates.mockResolvedValue([
    { id: 4, name: "红烧肉盖饭", sameName: false },
    { id: 5, name: "红烧肉拌面", sameName: false },
  ]);
  await render(9, "红烧肉");
  const links = [...host.querySelectorAll(".dish-duplicate-hint a")];
  expect(links.map((a) => a.textContent)).toEqual(["红烧肉盖饭", "红烧肉拌面"]);
});

it("stays quiet without a shop, for one-character names, and on errors", async () => {
  await render(undefined, "红烧肉");
  await render(9, "面");
  expect(duplicates).not.toHaveBeenCalled();
  duplicates.mockRejectedValue(new Error("down"));
  await render(9, "牛肉面");
  expect(duplicates).toHaveBeenCalled();
  expect(host.querySelector(".dish-duplicate-hint")).toBeNull();
});
