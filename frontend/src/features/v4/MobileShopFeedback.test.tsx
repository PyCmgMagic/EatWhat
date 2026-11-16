// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MobileShopFeedback } from "./MobileShopFeedback";

const { api, toast, auth } = vi.hoisted(() => ({
  api: { restaurant: vi.fn(), rateRestaurantScene: vi.fn() },
  toast: vi.fn(),
  auth: { signedIn: true },
}));
vi.mock("../../app/state", async (original) => ({
  ...(await original<object>()),
  useApp: () => ({
    api,
    toast,
    session: auth.signedIn ? { tokenValue: "t" } : null,
    user: { id: 3 },
  }),
}));
vi.mock("../../app/auth-dialog", () => ({
  LoginLink: ({
    to,
    className,
    children,
  }: {
    to: string;
    className?: string;
    children: unknown;
  }) => (
    <a href={to} className={className}>
      {children as never}
    </a>
  ),
}));

const baseShop = {
  id: 1,
  name: "哀记云饺",
  priceBand: "FROM_15_TO_30",
  categories: ["米饭炒菜"],
  tags: ["辣"],
  deliveryEnabled: false,
  dineIn: { rate: 0.86, count: 23 },
  myRatings: { dineIn: null },
};

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  auth.signedIn = true;
  api.restaurant.mockReset().mockResolvedValue(baseShop);
  api.rateRestaurantScene.mockReset().mockResolvedValue(null);
  toast.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function open() {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <MobileShopFeedback id={1} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  for (let i = 0; i < 20 && !host.querySelector(".shop-voice-score"); i++)
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
}

const yes = () =>
  host.querySelector<HTMLButtonElement>(".shop-voice-option.is-yes");
const no = () =>
  host.querySelector<HTMLButtonElement>(".shop-voice-option.is-no");
const hint = () => host.querySelector(".shop-voice-hint")?.textContent;

it("shows the friend score, the count and the shop traits", async () => {
  await open();
  expect(host.querySelector(".shop-voice-number strong")?.textContent).toBe(
    "86%",
  );
  expect(host.querySelector(".shop-voice-count")?.textContent).toBe(
    "23 位食友投过票",
  );
  expect(
    [...host.querySelectorAll(".shop-voice-chips li")].map((li) =>
      li.textContent?.trim(),
    ),
  ).toEqual(["米饭炒菜", "15–30 元", "仅堂食", "口味：辣"]);
  expect(yes()?.getAttribute("aria-pressed")).toBe("false");
  expect(hint()).toBe("点一下，帮后面的食友少踩一次雷");
});

it("records a recommendation for the dine-in scene", async () => {
  await open();
  await act(async () => yes()!.click());
  expect(api.rateRestaurantScene).toHaveBeenCalledWith(
    1,
    "dine_in",
    "RECOMMEND",
  );
});

it("shows my vote and clears it on a second tap", async () => {
  api.restaurant.mockResolvedValue({
    ...baseShop,
    myRatings: { dineIn: "RECOMMEND" },
  });
  await open();
  expect(yes()?.getAttribute("aria-pressed")).toBe("true");
  expect(hint()).toBe("已记下你的评价，再点一次可以取消");
  await act(async () => yes()!.click());
  expect(api.rateRestaurantScene).toHaveBeenCalledWith(1, "dine_in", null);
});

it("invites guests to sign in instead of showing the vote buttons", async () => {
  auth.signedIn = false;
  await open();
  expect(yes()).toBeNull();
  expect(host.querySelector(".shop-voice-login")?.textContent).toContain(
    "登录后给这家店投票",
  );
  expect(hint()).toBe("登录后就能投票，也会记住你的口味");
});

it("invites the first vote when nobody has rated the shop yet", async () => {
  api.restaurant.mockResolvedValue({
    ...baseShop,
    dineIn: { rate: null, count: 0 },
    myRatings: null,
  });
  await open();
  expect(host.querySelector(".shop-voice-empty")?.textContent).toBe(
    "还没有食友投过票",
  );
  expect(host.querySelector(".shop-voice-meter")).toBeNull();
  expect(host.querySelector(".shop-voice-caption")?.textContent).toBe(
    "你的这一票，会是这家店的第一条评价",
  );
  expect(no()).not.toBeNull();
});

it("votes per scene and shows the delivery score when the shop delivers", async () => {
  api.restaurant.mockResolvedValue({
    ...baseShop,
    deliveryEnabled: true,
    delivery: { rate: 0.72, count: 9 },
    myRatings: { dineIn: null, delivery: null },
  });
  await open();
  expect(
    [...host.querySelectorAll(".shop-voice-scene")].map((el) => el.textContent),
  ).toEqual(["堂食", "外卖"]);
  expect(host.querySelector(".shop-voice-other")?.textContent).toBe(
    "外卖 72% · 9 人",
  );
  const groups = host.querySelectorAll(".shop-voice-options");
  await act(async () =>
    groups[1]
      .querySelector<HTMLButtonElement>(".shop-voice-option.is-no")!
      .click(),
  );
  expect(api.rateRestaurantScene).toHaveBeenCalledWith(
    1,
    "delivery",
    "NOT_RECOMMEND",
  );
});
