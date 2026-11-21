// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Food } from "../api/models";
import type { FoodRated } from "../api/v2-vocab";
import { FoodRating } from "./FoodRating";

const { api, toast, access } = vi.hoisted(() => ({
  api: {
    rateFood: vi.fn(),
    unrateFood: vi.fn(),
  },
  toast: vi.fn(),
  access: vi.fn(),
}));

vi.mock("../app/state", async (original) => ({
  ...(await original<object>()),
  useApp: () => ({ api, toast }),
}));

vi.mock("./access", () => ({
  useActionAccess: () => access,
}));

let root: Root;
let host: HTMLDivElement;
let cache: QueryClient;
const detailKey = ["foods", "detail", 7];

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
  access.mockReset().mockReturnValue(true);
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  cache = new QueryClient();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  cache.clear();
  host.remove();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

function renderDetail() {
  return act(async () =>
    root.render(
      <QueryClientProvider client={cache}>
        <FoodRating food={cache.getQueryData<Food>(detailKey)!} />
      </QueryClientProvider>,
    ),
  );
}

function star(score: number) {
  return host.querySelector<HTMLButtonElement>(
    `button[aria-label="打 ${score} 分"]`,
  )!;
}

function entry() {
  return host.querySelector<HTMLButtonElement>(
    'button[aria-haspopup="dialog"]',
  )!;
}

it("rates, changes a rating using a filled star, and clears it using that same star", async () => {
  cache.setQueryData(detailKey, { id: 7, name: "鲜虾云吞" });
  await renderDetail();
  expect(host.textContent).toContain("暂无评分");
  expect(host.querySelectorAll("button")).toHaveLength(1);
  await act(async () => entry().click());
  expect(host.querySelector("dialog[open]")).not.toBeNull();
  expect(api.rateFood).not.toHaveBeenCalled();
  await act(async () => star(5).click());
  expect(api.rateFood).toHaveBeenCalledWith(7, 5);
  await renderDetail();
  expect(entry().textContent).toContain("我的 5 分");
  expect(host.textContent).toContain("2 人已评");
  expect(host.querySelectorAll('[role="group"] button')).toHaveLength(5);

  api.rateFood.mockResolvedValueOnce({
    rating: { score: 4, count: 2 },
    myRating: 3,
  });
  await act(async () => star(3).click());
  expect(api.rateFood).toHaveBeenLastCalledWith(7, 3);
  expect(api.unrateFood).not.toHaveBeenCalled();
  await renderDetail();
  expect(star(3).getAttribute("aria-pressed")).toBe("true");
  expect(host.textContent).toContain("再点第 3 颗星可撤销");
  await act(async () =>
    host.querySelector<HTMLButtonElement>('[aria-label="关闭弹窗"]')!.click(),
  );
  expect(entry().getAttribute("aria-expanded")).toBe("false");
  expect(host.querySelector("dialog")).toBeNull();
  expect(document.activeElement).toBe(entry());
  await act(async () => entry().click());
  expect(star(3).getAttribute("aria-pressed")).toBe("true");
  await act(async () => star(3).click());
  expect(api.unrateFood).toHaveBeenCalledWith(7);
  await renderDetail();
  expect(host.querySelector('button[aria-pressed="true"]')).toBeNull();
  expect(host.textContent).toContain("已撤销评分");
  expect(host.textContent).toContain("1 人已评");
  expect(toast).not.toHaveBeenCalled();
});

it("previews a pending change, ignores repeat taps, and restores the saved score on error", async () => {
  cache.setQueryData(detailKey, {
    id: 7,
    rating: { score: 4, count: 1 },
    myRating: 4,
  });
  await renderDetail();
  await act(async () => entry().click());
  let fail!: (error: Error) => void;
  api.unrateFood.mockReturnValueOnce(
    new Promise<FoodRated>((_, reject) => {
      fail = reject;
    }),
  );
  await act(async () => star(4).click());
  expect(access).toHaveBeenCalledWith({
    path: "/foods/7/rating",
    options: { method: "DELETE" },
  });
  expect(host.querySelector('[role="status"]')?.textContent).toBe("正在撤销…");
  expect(host.querySelectorAll(".is-on")).toHaveLength(0);
  await act(async () => star(2).click());
  expect(api.rateFood).not.toHaveBeenCalled();
  await act(async () => fail(new Error("保存失败")));
  expect(host.querySelectorAll(".is-on")).toHaveLength(4);
  expect(star(4).getAttribute("aria-pressed")).toBe("true");
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("保存失败");
});

it("opens the picker freely and checks verification before submitting a score", async () => {
  cache.setQueryData(detailKey, { id: 7 });
  access.mockReturnValue(false);
  await renderDetail();
  await act(async () => entry().click());
  expect(access).not.toHaveBeenCalled();
  await act(async () => star(3).click());
  expect(access).toHaveBeenCalledWith({
    path: "/foods/7/rating",
    options: { method: "PUT" },
  });
  expect(host.querySelector('button[aria-pressed="true"]')).toBeNull();
  expect(api.rateFood).not.toHaveBeenCalled();
});
