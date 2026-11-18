// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Food } from "../api/models";
import { FoodRating } from "./FoodRating";

const { api, toast } = vi.hoisted(() => ({
  api: {
    rateFood: vi.fn(),
    unrateFood: vi.fn(),
  },
  toast: vi.fn(),
}));

vi.mock("../app/state", async (original) => ({
  ...(await original<object>()),
  useApp: () => ({ api, toast }),
}));

vi.mock("./access", () => ({
  useActionAccess: () => () => true,
}));

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  api.rateFood.mockReset().mockResolvedValue({
    rating: { score: 5, count: 2 },
    myRating: 5,
  });
  api.unrateFood.mockReset().mockResolvedValue({
    rating: { score: 5, count: 1 },
    myRating: null,
  });
  toast.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function renderRating(food: Partial<Food> & { rating?: unknown; myRating?: number | null }) {
  return act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <FoodRating food={food as Food} />
      </QueryClientProvider>,
    ),
  );
}

it("renders aggregate score, personal rating pill, and undo action", async () => {
  await renderRating({
    id: 7,
    name: "鲜虾云吞",
    rating: { score: 5, count: 2 },
    myRating: 5,
  });
  expect(host.textContent).toContain("5.0");
  expect(host.textContent).toContain("2 人已评");
  expect(host.textContent).toContain("已评 5 分 · 超赞");
  const undo = host.querySelector<HTMLButtonElement>(".food-rating-undo")!;
  await act(async () => undo.click());
  expect(api.unrateFood).toHaveBeenCalledWith(7);
  expect(toast).toHaveBeenCalledWith("已撤销评分", { tone: "success" });
});

it("renders empty rating prompt and submits selected star score", async () => {
  await renderRating({
    id: 7,
    name: "鲜虾云吞",
    rating: { score: null, count: 0 },
    myRating: null,
  });
  expect(host.textContent).toContain("暂无评分");
  const star5 = host.querySelector<HTMLButtonElement>('button[aria-label="打 5 分"]')!;
  await act(async () => star5.click());
  expect(api.rateFood).toHaveBeenCalledWith(7, 5);
  expect(toast).toHaveBeenCalledWith("已打 5 分", { tone: "success" });
});
