// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useNavigate, type NavigateFunction } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../features/comments/Comments", () => ({
  CommentDestination: () => null,
  RestaurantDiscussion: () => <div data-testid="discussion" />,
}));
vi.mock("./DesktopRestaurantFeedback", () => ({
  DesktopRestaurantFeedback: ({ id }: { id: number }) => (
    <div data-testid="feedback">{id}</div>
  ),
}));
vi.mock("../app/auth-dialog", async (original) => ({
  ...(await original<typeof import("../app/auth-dialog")>()),
  LoginLink: () => null,
}));
vi.mock("../features/access", () => ({ useActionAccess: () => () => true }));
import { AppContext, type AppState } from "../app/state";
import { MobileContext, type MobileState } from "../mobile/ui";
import { DesktopRestaurant } from "./Desktop";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("replaces the previous shop's sections when switching shops", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  for (const id of [1, 2])
    cache.setQueryData(["restaurants", "detail", id], { id, name: `店铺 ${id}` });
  const app = {
    session: null,
    user: undefined,
    toast: vi.fn(),
    api: {
      restaurant: async (id: number) => ({ id, name: `店铺 ${id}` }),
      foods: async () => ({ items: [], totalItems: 0 }),
    },
  } as unknown as AppState;
  let go!: NavigateFunction;
  const Nav = () => {
    go = useNavigate();
    return null;
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/restaurants/1"]}>
        <QueryClientProvider client={cache}>
          <AppContext.Provider value={app}>
            <MobileContext.Provider value={{ shopId: 1 } as MobileState}>
              <Nav />
              <DesktopRestaurant />
            </MobileContext.Provider>
          </AppContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  for (const id of [1, 2, 1]) {
    await act(async () => {
      await go(`/restaurants/${id}`);
    });
    expect(
      [...host.querySelectorAll('[data-testid="feedback"]')].map((x) => x.textContent),
    ).toEqual([String(id)]);
    expect(host.querySelectorAll('[data-testid="discussion"]')).toHaveLength(1);
  }
  expect(
    errors.mock.calls.filter(([message]) => String(message).includes("same key")),
  ).toEqual([]);
  await act(async () => root.unmount());
  host.remove();
});
