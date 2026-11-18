// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LikedFoods } from "./Catalog";
import Directory from "./v4/Directory";

const { api, toast, session, user } = vi.hoisted(() => ({
  api: {
    likedFoods: vi.fn(),
    like: vi.fn(),
    browseRestaurants: vi.fn(),
    restaurantSearch: vi.fn(),
    shopOptions: vi.fn(),
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

vi.mock("../app/area", async (original) => ({
  ...(await original<object>()),
  useArea: () => ({ area: null, ready: true }),
}));

vi.mock("../app/auth-dialog", () => ({
  LoginLink: ({ children }: { children: unknown }) => children,
  useLoginDialog: () => ({ openLogin: vi.fn() }),
}));

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  session.current = { tokenValue: "t" };
  user.current = { id: 3, verified: true, banned: false };
  api.likedFoods.mockReset().mockResolvedValue({
    items: [
      {
        id: 11,
        name: "招牌牛肉面",
        category: "staple",
        price: 22,
        restaurantName: "一口面馆",
        likesCount: 15,
        pictureUrl: [],
      },
    ],
    totalItems: 1,
    hasNext: false,
  });
  api.like.mockReset().mockResolvedValue(null);
  api.browseRestaurants.mockReset().mockResolvedValue({
    items: [],
    totalItems: 0,
    hasNext: false,
  });
  api.restaurantSearch.mockReset();
  api.shopOptions.mockReset().mockResolvedValue({ categories: ["火锅麻辣烫"] });
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

it("prompts guests to sign in before showing liked dishes", async () => {
  session.current = null;
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/likes"]}>
          <Routes>
            <Route path="/likes" element={<LikedFoods />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  expect(host.textContent).toContain("登录后查看赞过的菜");
  expect(api.likedFoods).not.toHaveBeenCalled();
});

it("lists liked dishes and lets the user unlike one", async () => {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/likes"]}>
          <Routes>
            <Route path="/likes" element={<LikedFoods />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await waitForText("招牌牛肉面");
  expect(host.textContent).toContain("1 道菜");
  const button = host.querySelector<HTMLButtonElement>(
    'button[aria-label="取消点赞招牌牛肉面"]',
  )!;
  await act(async () => button.click());
  expect(api.like).toHaveBeenCalledWith(11, true);
});

it("filters the restaurant directory by buffet shop kind", async () => {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/restaurants/directory"]}>
          <Routes>
            <Route path="/restaurants/directory" element={<Directory />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  await waitForText("全部类型");
  const select = [...host.querySelectorAll("select")].find((node) =>
    [...node.options].some((opt) => opt.value === "buffet"),
  )!;
  expect([...select.options].map((opt) => opt.textContent)).toContain("自助");
  await act(async () => {
    select.value = "buffet";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  for (let i = 0; i < 20; i++) {
    if (
      api.browseRestaurants.mock.calls.some(
        ([q]) => (q as { kind?: string })?.kind === "buffet",
      )
    )
      break;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
  expect(api.browseRestaurants).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "buffet" }),
  );
});
