// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FavoritesFilters } from "./FavoritesControls";

vi.mock("../app/area", () => ({
  useArea: () => ({
    area: { name: "软件园", hubId: 2 },
    openArea: vi.fn(),
  }),
}));

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("keeps category and advanced filters hidden behind the 筛选 entry by default in favorites mode", async () => {
  const apply = vi.fn();
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FavoritesFilters
          mode="favorites"
          filters={{}}
          apply={apply}
          reset={vi.fn()}
        />
      </MemoryRouter>,
    ),
  );

  const toggle = host.querySelector<HTMLButtonElement>(".favorites-filter-toggle")!;
  const panel = host.querySelector<HTMLDivElement>(".favorites-advanced")!;
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(panel.hidden).toBe(true);
  // Category selector lives inside the collapsible filter drawer rather than the main search row.
  expect(host.querySelector(".favorites-search-row .ew-select")).toBeNull();
  expect(panel.querySelector('[name="category"]')).not.toBeNull();

  await act(async () => toggle.click());
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(panel.hidden).toBe(false);
});

it("counts active category filters inside the collapsed entry badge and submits keyword searches", async () => {
  const apply = vi.fn();
  await act(async () =>
    root.render(
      <MemoryRouter>
        <FavoritesFilters
          mode="favorites"
          filters={{ category: "snack", maxPrice: 30 }}
          apply={apply}
          reset={vi.fn()}
        />
      </MemoryRouter>,
    ),
  );

  const toggle = host.querySelector<HTMLButtonElement>(".favorites-filter-toggle")!;
  expect(toggle.querySelector("span")?.textContent).toBe("2");
  expect(toggle.getAttribute("aria-expanded")).toBe("true");

  const input = host.querySelector<HTMLInputElement>('input[name="q"]')!;
  input.value = "鹅肝";
  const form = host.querySelector<HTMLFormElement>("form.favorites-filters")!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({
      q: "鹅肝",
      category: "snack",
      max: "30",
    }),
  );
});
