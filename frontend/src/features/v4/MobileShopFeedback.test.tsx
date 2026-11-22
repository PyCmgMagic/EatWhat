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

async function renderFeedback() {
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

async function open() {
  await renderFeedback();
  await act(async () => host.querySelector("summary")!.click());
}

const yes = () =>
  host.querySelector<HTMLButtonElement>(".shop-voice-option.is-yes");
const no = () =>
  host.querySelector<HTMLButtonElement>(".shop-voice-option.is-no");
const switchScene = (name: string) =>
  [
    ...host.querySelectorAll<HTMLButtonElement>(".shop-voice-scenes button"),
  ].find((button) => button.textContent === name)!;

it("starts with a compact summary and toggles the vote controls without voting", async () => {
  await renderFeedback();
  const details = host.querySelector("details")!;
  const summary = details.querySelector("summary")!;
  expect(details.open).toBe(false);
  expect(summary.querySelector(".shop-voice-number strong")?.textContent).toBe(
    "86%",
  );
  expect(summary.querySelector(".shop-voice-count")?.textContent).toBe(
    "23 人评价",
  );
  expect(host.querySelector("h2")?.textContent).toBe("食友评价");
  expect(host.querySelector(".shop-voice-scenes")).toBeNull();
  expect(summary.contains(yes())).toBe(false);
  await act(async () => summary.click());
  expect(details.open).toBe(true);
  expect(yes()?.getAttribute("aria-pressed")).toBe("false");
  await act(async () => summary.click());
  expect(details.open).toBe(false);
  expect(api.rateRestaurantScene).not.toHaveBeenCalled();
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
  expect(yes()?.title).toBe("取消推荐");
  await act(async () => yes()!.click());
  expect(api.rateRestaurantScene).toHaveBeenCalledWith(1, "dine_in", null);
});

it("invites guests to sign in instead of showing the vote buttons", async () => {
  auth.signedIn = false;
  await open();
  expect(yes()).toBeNull();
  expect(host.querySelector(".shop-voice-login")?.textContent).toContain(
    "登录后评价",
  );
});

it("invites the first vote when nobody has rated the shop yet", async () => {
  api.restaurant.mockResolvedValue({
    ...baseShop,
    dineIn: { rate: null, count: 0 },
    myRatings: null,
  });
  await open();
  expect(host.querySelector(".shop-voice-empty")?.textContent).toBe("暂无评价");
  expect(host.querySelector(".shop-voice-meter")).toBeNull();
  expect(host.querySelector(".shop-voice-number")).toBeNull();
  expect(no()).not.toBeNull();
});

it("switches the displayed score and vote target together", async () => {
  api.restaurant.mockResolvedValue({
    ...baseShop,
    deliveryEnabled: true,
    delivery: { rate: 0.72, count: 9 },
    myRatings: { dineIn: null, delivery: null },
  });
  await open();
  expect(
    [...host.querySelectorAll(".shop-voice-scenes button")].map(
      (el) => el.textContent,
    ),
  ).toEqual(["堂食", "外卖"]);
  expect(switchScene("堂食").getAttribute("aria-pressed")).toBe("true");
  await act(async () => switchScene("外卖").click());
  expect(switchScene("外卖").getAttribute("aria-pressed")).toBe("true");
  expect(host.querySelector(".shop-voice-number strong")?.textContent).toBe(
    "72%",
  );
  expect(host.querySelector(".shop-voice-count")?.textContent).toBe("9 人评价");
  expect(host.querySelectorAll(".shop-voice-options")).toHaveLength(1);
  expect(
    host.querySelector(".shop-voice-options")?.getAttribute("aria-label"),
  ).toBe("我的外卖评价");
  await act(async () => no()!.click());
  expect(api.rateRestaurantScene).toHaveBeenCalledWith(
    1,
    "delivery",
    "NOT_RECOMMEND",
  );
});

it("keeps each scene's own vote when switching and cancels only the selected scene", async () => {
  api.restaurant.mockResolvedValue({
    ...baseShop,
    deliveryEnabled: true,
    delivery: { rate: 0.72, count: 9 },
    myRatings: { dineIn: "RECOMMEND", delivery: "NOT_RECOMMEND" },
  });
  await open();
  expect(yes()?.getAttribute("aria-pressed")).toBe("true");
  await act(async () => switchScene("外卖").click());
  expect(no()?.getAttribute("aria-pressed")).toBe("true");
  expect(yes()?.getAttribute("aria-pressed")).toBe("false");
  await act(async () => switchScene("堂食").click());
  expect(yes()?.getAttribute("aria-pressed")).toBe("true");
  await act(async () => switchScene("外卖").click());
  await act(async () => no()!.click());
  expect(api.rateRestaurantScene).toHaveBeenCalledWith(1, "delivery", null);
});

it("shows an empty state for delivery without hiding the dine-in result", async () => {
  auth.signedIn = false;
  api.restaurant.mockResolvedValue({
    ...baseShop,
    deliveryEnabled: true,
    delivery: { rate: null, count: 0 },
  });
  await open();
  await act(async () => switchScene("外卖").click());
  expect(host.querySelector(".shop-voice-empty")?.textContent).toBe("暂无评价");
  expect(host.querySelector(".shop-voice-number")).toBeNull();
  expect(host.querySelector(".shop-voice-login")).not.toBeNull();
  await act(async () => switchScene("堂食").click());
  expect(host.querySelector(".shop-voice-empty")).toBeNull();
  expect(host.querySelector(".shop-voice-number strong")?.textContent).toBe(
    "86%",
  );
});

it("keeps historical delivery ratings accessible after delivery is disabled", async () => {
  api.restaurant.mockResolvedValue({
    ...baseShop,
    deliveryEnabled: false,
    delivery: { rate: 0.72, count: 9 },
  });
  await open();
  await act(async () => switchScene("外卖").click());
  expect(host.querySelector(".shop-voice-number strong")?.textContent).toBe(
    "72%",
  );
});

it("distinguishes zero recommendations from no reviews", async () => {
  api.restaurant.mockResolvedValue({
    ...baseShop,
    dineIn: { rate: 0, count: 2 },
  });
  await open();
  expect(host.querySelector(".shop-voice-number strong")?.textContent).toBe(
    "0%",
  );
  expect(host.querySelector(".shop-voice-count")?.textContent).toBe("2 人评价");
  expect(host.querySelector(".shop-voice-empty")).toBeNull();
});

it("does not invent a recommendation percentage when only a count is available", async () => {
  api.restaurant.mockResolvedValue({
    ...baseShop,
    dineIn: { rate: null, count: 2 },
  });
  await open();
  expect(host.querySelector(".shop-voice-number")).toBeNull();
  expect(host.querySelector(".shop-voice-count")?.textContent).toBe("2 人评价");
  expect(host.querySelector(".shop-voice-empty")).toBeNull();
});

it("lights the vote immediately and rolls back with a toast when it fails", async () => {
  let rejectVote: (error: Error) => void = () => {};
  api.rateRestaurantScene.mockReset().mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        rejectVote = reject;
      }),
  );
  await open();
  expect(yes()?.getAttribute("aria-pressed")).toBe("false");

  await act(async () => yes()!.click());
  // 乐观态：请求还没返回，按钮就已经亮了。
  expect(yes()?.getAttribute("aria-pressed")).toBe("true");

  await act(async () => {
    rejectVote(new Error("服务开小差了"));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(yes()?.getAttribute("aria-pressed")).toBe("false");
  expect(toast).toHaveBeenCalled();
});

it("updates recommendation rate, count, and meter immediately on vote and animates without disabling buttons", async () => {
  api.restaurant.mockResolvedValue({
    ...baseShop,
    dineIn: { rate: null, count: 0 },
    myRatings: { dineIn: null },
  });
  let resolveVote!: () => void;
  api.rateRestaurantScene.mockReset().mockImplementation(
    () =>
      new Promise<null>((resolve) => {
        resolveVote = () => resolve(null);
      }),
  );
  await open();
  expect(host.querySelector(".shop-voice-empty")?.textContent).toBe("暂无评价");

  await act(async () => yes()!.click());
  expect(yes()?.getAttribute("aria-pressed")).toBe("true");
  expect(yes()?.classList.contains("is-celebrating")).toBe(true);
  expect(yes()?.disabled).toBe(false);
  expect(no()?.disabled).toBe(false);
  expect(host.querySelector(".shop-voice-number strong")?.textContent).toBe(
    "100%",
  );
  expect(host.querySelector(".shop-voice-count")?.textContent).toBe("1 人评价");
  expect(host.querySelector(".shop-voice-meter > span")?.getAttribute("style")).toContain(
    "width: 100%",
  );

  // Switching to 不推荐 while the first request is still pending stays responsive and serializes.
  await act(async () => no()!.click());
  expect(no()?.getAttribute("aria-pressed")).toBe("true");
  expect(no()?.classList.contains("is-celebrating")).toBe(true);
  expect(host.querySelector(".shop-voice-number strong")?.textContent).toBe(
    "0%",
  );
  expect(api.rateRestaurantScene).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolveVote();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(api.rateRestaurantScene).toHaveBeenCalledTimes(2);
  expect(api.rateRestaurantScene).toHaveBeenNthCalledWith(
    2,
    1,
    "dine_in",
    "NOT_RECOMMEND",
  );
});
