// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Restaurant } from "../api/models";
import type { V2Shop } from "../api/v2-vocab";
import { DesktopRestaurantFeedback } from "./DesktopRestaurantFeedback";

vi.mock("../app/state", async (original) => ({
  ...(await original<object>()),
  useApp: () => ({ session: { tokenValue: "test" } }),
}));

function review(fields: Partial<Restaurant & V2Shop>) {
  const shop = { id: 1, ratingSummaryState: "READY", ...fields } as Restaurant &
    V2Shop;
  const html = renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <DesktopRestaurantFeedback id={1} shop={shop} />
    </QueryClientProvider>,
  );
  return new DOMParser().parseFromString(html, "text/html");
}

it("labels a legacy aggregate as a shop recommendation", () => {
  const doc = review({ ratingCount: 4, recommendationRate: 75 });
  expect(doc.querySelector("h3")?.textContent).toBe("店铺推荐率");
  expect(doc.body.textContent).toContain("75%");
  expect(doc.body.textContent).toContain("4 人评价");
});

it("keeps zero percent distinct from an unknown rate in historical delivery data", () => {
  const doc = review({
    deliveryEnabled: false,
    dineIn: { count: 2, rate: 0 },
    delivery: { count: 1, rate: null },
    myRatings: { delivery: "RECOMMEND" },
  });
  const [dineIn, delivery] = doc.querySelectorAll(".pc-shop-scene");
  expect(dineIn.textContent).toContain("0%");
  expect(delivery.textContent).toContain("1 人评价");
  expect(delivery.textContent).not.toContain("%");
  expect(delivery.querySelector('[aria-pressed="true"]')?.textContent).toBe(
    "推荐",
  );
});

it("keeps a pending summary distinct from an empty one", () => {
  const pending = review({
    ratingSummaryState: "SYNC_PENDING",
    dineIn: { count: 2, rate: 1 },
  });
  expect(pending.body.textContent).toContain("评价同步中");
  expect(pending.body.textContent).not.toContain("%");
  expect(
    review({ dineIn: { count: 0, rate: null } }).body.textContent,
  ).toContain("暂无评价");
});
