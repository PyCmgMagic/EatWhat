// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createApi } from "../api/service";
import { bridgeToV2 } from "../api/v2-bridge";
import type { Food } from "../api/models";
import DishDetail from "./DishDetail";
import { DEFAULT_AVATAR_SRC } from "../components/AvatarImage";

vi.mock("../features/SupplementPrice", () => ({ SupplementPrice: () => null }));
vi.mock("../features/FoodRating", () => ({ FoodRating: () => null }));
vi.mock("../features/comments/Comments", () => ({
  FoodCommentPreview: () => null,
}));
vi.mock("./DishMoreActions", () => ({ DishMoreActions: () => null }));

const avatar = "https://cdn.example.com/avatar/maycry.webp";
let host: HTMLDivElement, root: Root;
let client: QueryClient;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient();
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  vi.unstubAllGlobals();
});

async function render(
  food: Food,
  handlers: {
    likeDisabled?: boolean;
    favoriteDisabled?: boolean;
    onLike?: () => unknown;
    onFavorite?: () => unknown;
  } = {},
) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DishDetail
            food={food}
            back="/"
            demo={false}
            sharedAt="8 小时前"
            likeDisabled={handlers.likeDisabled ?? true}
            favoriteDisabled={handlers.favoriteDisabled ?? true}
            onLike={handlers.onLike ?? vi.fn()}
            onFavorite={handlers.onFavorite ?? vi.fn()}
            onShare={vi.fn()}
            onTags={vi.fn()}
            onRestaurant={vi.fn()}
            management={null}
            footer={null}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}

it("only opens a preview from an available cover, including after URL renewal", async () => {
  const trigger = () =>
    host.querySelector('.dish-plate button[aria-haspopup="dialog"]');
  const food = { id: 71, pictureUrl: ["/assets/rice.jpg"] };
  await render({ ...food, pictureUrl: [] });
  expect(trigger()).toBeNull();
  await render(food);
  expect(trigger()).not.toBeNull();
  await act(async () =>
    host.querySelector(".dish-plate img")!.dispatchEvent(new Event("error")),
  );
  expect(trigger()).toBeNull();
  await render({ ...food, pictureUrl: ["/assets/rice.jpg?renewed"] });
  expect(trigger()).not.toBeNull();
});

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
  expect(host.querySelector(".mobile-avatar img")?.getAttribute("src")).toBe(DEFAULT_AVATAR_SRC);
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
  "uses the default avatar for an absent or invalid avatar (%s)",
  async (avatar) => {
    await render({ id: 71, user: { id: 21, displayName: "🍜食友", avatar } });
    expect(host.querySelector(".mobile-avatar img")?.getAttribute("src")).toBe(DEFAULT_AVATAR_SRC);
  },
);

it("keeps an unavailable author's fallback unlinked", async () => {
  await render({ id: 71, accountId: 21, user: null });
  expect(host.querySelector(".mobile-avatar img")?.getAttribute("src")).toBe(DEFAULT_AVATAR_SRC);
  expect(host.querySelector("a.mobile-contributor")).toBeNull();
});

it("animates and updates like and favorite immediately before network responses resolve", async () => {
  let resolveLike!: () => void;
  let resolveFav!: () => void;
  const onLike = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveLike = resolve;
      }),
  );
  const onFavorite = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveFav = resolve;
      }),
  );
  await render(
    { id: 71, isLiked: false, likesCount: 1, isFavorite: false },
    { likeDisabled: false, favoriteDisabled: false, onLike, onFavorite },
  );

  const favButton = host.querySelector<HTMLButtonElement>(".dish-favorite")!;
  const likeButton = host.querySelector<HTMLButtonElement>(".dish-like")!;

  await act(async () => {
    favButton.click();
    likeButton.click();
  });

  expect(onFavorite).toHaveBeenCalledTimes(1);
  expect(onLike).toHaveBeenCalledTimes(1);
  expect(favButton.getAttribute("aria-pressed")).toBe("true");
  expect(favButton.getAttribute("aria-label")).toBe("取消收藏");
  expect(favButton.classList.contains("is-celebrating")).toBe(true);
  expect(favButton.disabled).toBe(false);

  expect(likeButton.getAttribute("aria-pressed")).toBe("true");
  expect(likeButton.getAttribute("aria-label")).toBe("取消喜欢这道菜");
  expect(likeButton.classList.contains("is-celebrating")).toBe(true);
  expect(likeButton.querySelector("b")?.textContent).toBe("2");
  expect(likeButton.disabled).toBe(false);

  await act(async () => {
    resolveLike();
    resolveFav();
  });
});

it("rolls back optimistic like and favorite state if the standalone handler rejects", async () => {
  let rejectLike!: (error: Error) => void;
  let rejectFav!: (error: Error) => void;
  await render(
    { id: 71, isLiked: false, likesCount: 3, isFavorite: false },
    {
      likeDisabled: false,
      favoriteDisabled: false,
      onLike: () =>
        new Promise<void>((_, reject) => {
          rejectLike = reject;
        }),
      onFavorite: () =>
        new Promise<void>((_, reject) => {
          rejectFav = reject;
        }),
    },
  );

  const favButton = host.querySelector<HTMLButtonElement>(".dish-favorite")!;
  const likeButton = host.querySelector<HTMLButtonElement>(".dish-like")!;

  await act(async () => {
    favButton.click();
    likeButton.click();
  });

  expect(favButton.getAttribute("aria-pressed")).toBe("true");
  expect(likeButton.querySelector("b")?.textContent).toBe("4");

  await act(async () => {
    rejectLike(new Error("network down"));
    rejectFav(new Error("network down"));
  });

  expect(favButton.getAttribute("aria-pressed")).toBe("false");
  expect(favButton.classList.contains("is-celebrating")).toBe(false);
  expect(likeButton.getAttribute("aria-pressed")).toBe("false");
  expect(likeButton.classList.contains("is-celebrating")).toBe(false);
  expect(likeButton.querySelector("b")?.textContent).toBe("3");
});
