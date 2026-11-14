// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Food } from "../api/models";
import { FoodManage } from "./Catalog";

const { user } = vi.hoisted(() => ({ user: { current: null as any } }));
vi.mock("../app/state", async (original) => ({
  ...(await original<object>()),
  useApp: () => ({ user: user.current, api: {}, toast: () => {} }),
}));
vi.mock("../mobile/ui", async (original) => ({
  ...(await original<object>()),
  useMobile: () => ({ confirm: () => {} }),
}));
vi.mock("./access", () => ({ useActionAccess: () => () => true }));

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

const someoneElses = { id: 3, accountId: 2, name: "三鲜水饺" } as Food;
async function render(anyone: boolean) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <FoodManage food={someoneElses} anyone={anyone} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  return [...host.querySelectorAll("a, button")].map((e) =>
    e.textContent?.trim(),
  );
}

it("lets any verified user edit someone else's dish from its page", async () => {
  user.current = { id: 1, verified: true, banned: false, role: "user" };
  expect(await render(true)).toEqual(["编辑菜品"]);
  // Lists keep offering it only on your own dishes.
  expect(await render(false)).toEqual([]);
});

it("offers nothing to unverified or banned users", async () => {
  user.current = { id: 1, verified: false, banned: false, role: "user" };
  expect(await render(true)).toEqual([]);
  user.current = { id: 1, verified: true, banned: true, role: "user" };
  expect(await render(true)).toEqual([]);
});

it("offers delete to admins only", async () => {
  user.current = { id: 2, verified: true, banned: false, role: "user" };
  expect(await render(false)).toEqual(["编辑菜品"]);
  user.current = { id: 9, verified: true, banned: false, role: "admin" };
  expect(await render(true)).toEqual(["编辑菜品", "删除"]);
});
