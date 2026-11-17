// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createApi } from "../api/service";
import { bridgeToV2 } from "../api/v2-bridge";
import type { Food } from "../api/models";
import DishDetail from "./DishDetail";

vi.mock("../features/media", () => ({ useFoodImageRefresh: () => vi.fn() }));
vi.mock("../features/SupplementPrice", () => ({ SupplementPrice: () => null }));
vi.mock("../features/FoodRating", () => ({ FoodRating: () => null }));
vi.mock("../features/comments/Comments", () => ({
  FoodCommentPreview: () => null,
}));
vi.mock("./DishMoreActions", () => ({ DishMoreActions: () => null }));

const avatar = "https://cdn.example.com/avatar/maycry.webp";
let host: HTMLDivElement, root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function render(food: Food) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <DishDetail
          food={food}
          back="/"
          demo={false}
          sharedAt="8 小时前"
          likeDisabled
          favoriteDisabled
          onLike={vi.fn()}
          onFavorite={vi.fn()}
          onShare={vi.fn()}
          onTags={vi.fn()}
          onRestaurant={vi.fn()}
          management={null}
          footer={null}
        />
      </MemoryRouter>,
    ),
  );
}

it("shows the share author's avatar returned by the v2 profile API", async () => {
  const api = createApi(
    bridgeToV2(async (path) => ({
      code: 0,
      data:
        path === "/user/userInfo"
          ? { id: 21, displayName: "Maycry", avatar }
          : { id: 71, accountId: 21, name: "甜品", description: "秀色可餐啊" },
    })),
  );
  await render(await api.food(71));
  expect(host.querySelector(".dish-author-copy strong")?.textContent).toBe(
    "Maycry",
  );
  expect(
    host.querySelector(".dish-story .mobile-avatar img")?.getAttribute("src"),
  ).toBe(avatar);
  expect(host.querySelector(".mobile-contributor")?.getAttribute("href")).toBe(
    "/users/21",
  );
});

it("recovers from a failed avatar when a refreshed URL arrives", async () => {
  const food: Food = {
    id: 71,
    user: { id: 21, displayName: "Maycry", avatar },
  };
  await render(food);
  const image = host.querySelector(".mobile-avatar img")!;
  expect(image).not.toBeNull();
  await act(async () => image.dispatchEvent(new Event("error")));
  expect(host.querySelector(".mobile-avatar img")).toBeNull();
  expect(host.querySelector(".mobile-avatar")?.textContent).toBe("M");
  expect(host.querySelector(".mobile-contributor")?.getAttribute("href")).toBe(
    "/users/21",
  );
  const renewed = `${avatar}?renewed=1`;
  await render({ ...food, user: { ...food.user, avatar: renewed } });
  expect(host.querySelector(".mobile-avatar img")?.getAttribute("src")).toBe(
    renewed,
  );
});

it.each([null, "javascript:alert(1)"])(
  "uses the complete initial for an absent or invalid avatar (%s)",
  async (avatar) => {
    await render({ id: 71, user: { id: 21, displayName: "🍜食友", avatar } });
    expect(host.querySelector(".mobile-avatar img")).toBeNull();
    expect(host.querySelector(".mobile-avatar")?.textContent).toBe("🍜");
  },
);

it("keeps an unavailable author's fallback unlinked", async () => {
  await render({ id: 71, accountId: 21, user: null });
  expect(host.querySelector(".mobile-avatar img")).toBeNull();
  expect(host.querySelector(".mobile-avatar")?.textContent).toBe("校");
  expect(host.querySelector("a.mobile-contributor")).toBeNull();
});
