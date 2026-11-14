// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EditRestaurant } from "./EditRestaurant";

const { api, toast, user } = vi.hoisted(() => ({
  api: {
    restaurant: vi.fn(),
    editRestaurant: vi.fn(),
    shopOptions: vi.fn(),
  },
  toast: vi.fn(),
  user: { current: { id: 3, verified: true, banned: false } as any },
}));
vi.mock("../app/state", async (original) => ({
  ...(await original<object>()),
  useApp: () => ({
    api,
    toast,
    session: { tokenValue: "t" },
    user: user.current,
  }),
}));
vi.mock("../app/auth-dialog", () => ({
  LoginLink: ({ children }: { children: unknown }) => children,
}));

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  api.restaurant.mockReset().mockResolvedValue({
    id: 9,
    name: "一口面馆",
    address: "舜华路 188 号",
    kind: "food",
    priceBand: "FROM_15_TO_30",
    mealTimes: ["lunch", "dinner", "night"],
    categories: ["粉面"],
    tags: [],
    deliveryEnabled: false,
  });
  api.editRestaurant.mockReset().mockResolvedValue({ id: 9 });
  api.shopOptions.mockReset().mockResolvedValue(null);
  toast.mockReset();
  user.current = { id: 3, verified: true, banned: false };
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
        <MemoryRouter initialEntries={["/restaurants/9/edit"]}>
          <Routes>
            <Route path="/restaurants/9/edit" element={<EditRestaurant />} />
            <Route path="/restaurants/9" element={<p>店铺详情</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  // Wait for the shop to load (or the verification notice).
  for (let i = 0; i < 20 && !host.querySelector("form, .ew-button"); i++)
    await act(async () => new Promise((r) => setTimeout(r, 10)));
}
const checkbox = (label: string) =>
  [...host.querySelectorAll("label")]
    .find((l) => l.textContent?.trim() === label)!
    .querySelector("input")!;

it("lets a verified user take a shop out of the night slot", async () => {
  await open();
  const save = host.querySelector<HTMLButtonElement>("button.ew-button")!;
  expect(save.disabled).toBe(true);
  await act(async () => checkbox("夜宵").click());
  expect(save.disabled).toBe(false);
  await act(async () => save.click());
  await act(async () => {});
  // Name and address did not change, so only the traits are sent.
  expect(api.editRestaurant).toHaveBeenCalledWith(9, {
    kind: "food",
    priceBand: "FROM_15_TO_30",
    mealTimes: ["lunch", "dinner"],
    categories: ["粉面"],
    tags: [],
    deliveryEnabled: false,
  });
  expect(toast).toHaveBeenCalledWith("店铺信息已更新");
  expect(host.textContent).toContain("店铺详情");
});

it("keeps at least one meal time", async () => {
  await open();
  for (const meal of ["午饭", "晚饭", "夜宵"])
    await act(async () => checkbox(meal).click());
  await act(async () =>
    host.querySelector<HTMLButtonElement>("button.ew-button")!.click(),
  );
  expect(api.editRestaurant).not.toHaveBeenCalled();
});

it("asks unverified users to verify first", async () => {
  user.current = { id: 3, verified: false, banned: false };
  await open();
  expect(host.textContent).toContain("完成学生认证后，可以修改店铺信息");
  expect(host.querySelector("form")).toBeNull();
});
