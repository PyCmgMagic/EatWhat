// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Restaurant } from "../api/models";
import { RecommendShopList, dineInText, distanceText } from "./RecommendShops";

vi.mock("./media", () => ({
  useFoodPhoto: (src?: string) => ({
    unavailable: !src,
    failed: false,
    onError: () => {},
  }),
}));

let root: Root, host: HTMLDivElement;
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

const shop = (patch: Record<string, unknown>) =>
  ({ id: 1, name: "店", signatureFoods: [], ...patch }) as Restaurant;

it("shows each shop with its signature dishes in one card", async () => {
  const openShop = vi.fn(),
    openFood = vi.fn();
  await act(async () =>
    root.render(
      <MemoryRouter>
        <RecommendShopList
          onOpenShop={openShop}
          onOpenFood={openFood}
          shops={[
            shop({
              id: 9,
              name: "一口面馆",
              distanceMeters: 420,
              hubName: "软件园商圈",
              priceBand: "FROM_15_TO_30",
              categories: ["粉面"],
              tags: ["辣"],
              dineIn: { rate: 0.9, count: 8 },
              signatureFoods: [
                {
                  id: 2,
                  restaurantId: 9,
                  name: "牛肉面",
                  price: 22,
                  coverUrl: "https://x/a.jpg",
                  signature: true,
                  rating: { score: 4.6, count: 12 },
                },
                {
                  id: 3,
                  restaurantId: 9,
                  name: "炸酱面",
                  price: null,
                  coverUrl: null,
                  signature: false,
                  rating: { score: null, count: 0 },
                },
                { id: 4, restaurantId: 9, name: "凉面", price: 12 },
                { id: 5, restaurantId: 9, name: "第四道", price: 10 },
              ],
            }),
            shop({ id: 10, name: "南门砂锅" }),
          ]}
        />
      </MemoryRouter>,
    ),
  );
  const [first, second] = host.querySelectorAll(".rec-shop-card");
  expect(first.querySelector("h3")?.textContent).toBe("一口面馆");
  expect(first.textContent).toContain("420 米 · 软件园商圈");
  expect(first.textContent).toContain("堂食推荐 90% · 8 人评价");
  expect(
    [...first.querySelectorAll(".rec-shop-traits li")].map(
      (li) => li.textContent,
    ),
  ).toEqual(["15–30 元", "粉面", "辣"]);
  // At most three signature dishes, linked to their dish pages.
  const dishes = [
    ...first.querySelectorAll<HTMLAnchorElement>(".rec-shop-dish"),
  ];
  expect(dishes.map((a) => a.getAttribute("href"))).toEqual([
    "/foods/2",
    "/foods/3",
    "/foods/4",
  ]);
  expect(dishes[1].textContent).toContain("价格待补充");
  // Featured dishes show their score; only marked ones carry the badge.
  expect(dishes[0].textContent).toContain("4.6 分 · 12 人评分");
  expect(dishes[0].querySelector(".rec-shop-dish-badge")?.textContent).toBe(
    "招牌",
  );
  expect(dishes[1].textContent).not.toContain("评分");
  expect(dishes[1].querySelector(".rec-shop-dish-badge")).toBeNull();
  expect(first.querySelector(".rec-shop-head")?.getAttribute("href")).toBe(
    "/restaurants/9",
  );
  // A shop with no dish to show is still listed (the backend only demotes it).
  expect(second.textContent).toContain("还没有可展示的菜");
  expect(second.textContent).toContain("还没有堂食评价");

  await act(async () => dishes[0].click());
  expect(openFood).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
  await act(async () =>
    second.querySelector<HTMLAnchorElement>(".rec-shop-head")!.click(),
  );
  expect(openShop).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
});

it("formats distance and the dine-in rate", () => {
  expect(distanceText(null)).toBe("");
  expect(distanceText(999.6)).toBe("1000 米");
  expect(distanceText(1530)).toBe("1.5 公里");
  expect(dineInText(shop({ dineIn: { rate: null, count: 0 } }))).toBe(
    "还没有堂食评价",
  );
  expect(dineInText(shop({ dineIn: { rate: 0.666, count: 3 } }))).toBe(
    "堂食推荐 67% · 3 人评价",
  );
});
