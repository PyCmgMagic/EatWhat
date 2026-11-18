// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MobileLibrary from "./MobileLibrary";

const { api, toast, session, user } = vi.hoisted(() => ({
  api: {
    favorites: vi.fn(),
    favoriteRestaurants: vi.fn(),
    likedFoods: vi.fn(),
    favorite: vi.fn(),
    unfavoriteRestaurant: vi.fn(),
    like: vi.fn(),
  },
  toast: vi.fn(),
  session: { current: { tokenValue: "t" } as { tokenValue: string } | null },
  user: { current: { id: 3, verified: true, banned: false } as any },
}));

vi.mock("../app/state", async (original) => ({
  ...(await original<object>()),
  useApp: () => ({
    api,
    toast,
    session: session.current,
    user: user.current,
  }),
}));

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  session.current = { tokenValue: "t" };
  user.current = { id: 3, verified: true, banned: false };
  api.favorites.mockReset().mockResolvedValue({
    items: [
      {
        id: 11,
        name: "招牌牛筋面",
        price: 18.9,
        restaurantName: "渝见17码头江湖面",
        pictureUrl: [],
      },
    ],
    hasNext: false,
  });
  api.favoriteRestaurants.mockReset().mockResolvedValue({
    items: [
      {
        id: 21,
        name: "滨寿司",
        address: "济南高新万达广场店",
        pictureUrl: [],
      },
    ],
    hasNext: false,
  });
  api.likedFoods.mockReset().mockResolvedValue({
    items: [
      {
        id: 31,
        name: "大切鹅肝",
        price: 15,
        restaurantName: "滨寿司",
        pictureUrl: [],
      },
    ],
    hasNext: false,
  });
  api.favorite.mockReset().mockResolvedValue(null);
  api.unfavoriteRestaurant.mockReset().mockResolvedValue(null);
  api.like.mockReset().mockResolvedValue(null);
  toast.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function waitForText(text: string) {
  for (let i = 0; i < 30 && !host.textContent?.includes(text); i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  expect(host.textContent).toContain(text);
}

function renderAt(path: string) {
  return act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/favorites" element={<MobileLibrary />} />
            <Route path="/restaurants/favorites" element={<MobileLibrary />} />
            <Route path="/likes" element={<MobileLibrary />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}

it("renders history-style collections and switches cleanly across dish, shop, and liked tabs", async () => {
  await renderAt("/favorites");
  await waitForText("招牌牛筋面");
  expect(host.querySelector(".mobile-library-header h1")?.textContent).toBe(
    "收藏夹",
  );
  expect(host.textContent).toContain("只有你自己看得见");

  const tabs = host.querySelectorAll<HTMLButtonElement>(
    '.mobile-library-tabs button[role="tab"]',
  );
  expect(tabs[0].getAttribute("aria-selected")).toBe("true");

  await act(async () => tabs[1].click());
  await waitForText("滨寿司");
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>('button[aria-label="取消收藏滨寿司"]')!
      .click(),
  );
  expect(api.unfavoriteRestaurant).toHaveBeenCalledWith(21);

  await act(async () =>
    host
      .querySelectorAll<HTMLButtonElement>(
        '.mobile-library-tabs button[role="tab"]',
      )[2]
      .click(),
  );
  await waitForText("大切鹅肝");
  expect(host.querySelector(".mobile-library-header h1")?.textContent).toBe(
    "赞过的菜",
  );
  await act(async () =>
    host
      .querySelector<HTMLButtonElement>(
        'button[aria-label="取消点赞大切鹅肝"]',
      )!
      .click(),
  );
  expect(api.like).toHaveBeenCalledWith(31, true);
});

it("shows login prompt inside the unified mobile library when signed out", async () => {
  session.current = null;
  await renderAt("/likes");
  expect(host.textContent).toContain("登录后查看赞过的菜");
  expect(api.likedFoods).not.toHaveBeenCalled();
});
