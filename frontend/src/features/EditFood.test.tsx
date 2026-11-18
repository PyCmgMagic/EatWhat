// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EditFood } from "./EditFood";

const { api, toast, user } = vi.hoisted(() => ({
  api: {
    food: vi.fn(),
    editMyFood: vi.fn(),
    suggestDishTags: vi.fn(),
  },
  toast: vi.fn(),
  user: { current: { id: 3, verified: true, banned: false } as any },
}));

vi.mock("../app/state", async (original) => ({
  ...(await original<object>()),
  useApp: () => ({
    api,
    toast,
    uploadMany: vi.fn(),
    session: { tokenValue: "t" },
    user: user.current,
  }),
}));

vi.mock("../app/auth-dialog", () => ({
  LoginLink: ({ children }: { children: unknown }) => children,
}));

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  api.food.mockReset().mockResolvedValue({
    id: 5,
    restaurantId: 9,
    restaurantName: "滨寿司",
    name: "虾天妇罗拼盘",
    category: "snack",
    price: 15,
    description: "",
    pictureUrl: ["/assets/tempura.jpg"],
    pictureKeys: ["foods/2026/11/tempura.webp"],
    tags: [],
    signature: false,
    mealTimes: [],
    deliveryEnabled: false,
    stageColor: "broth",
  });
  api.editMyFood.mockReset().mockResolvedValue({ id: 5 });
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

async function open(mobile: boolean) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/foods/5/edit"]}>
          <Routes>
            <Route path="/foods/5/edit" element={<EditFood mobile={mobile} />} />
            <Route path="/foods/5" element={<p>菜品详情</p>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  for (let i = 0; i < 30 && !host.querySelector("form"); i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  expect(host.querySelector("form")).not.toBeNull();
}

it("renders the mobile publish-style dish editor and saves stage, category, and taste changes", async () => {
  await open(true);
  expect(host.querySelector(".mobile-edit-dish")).not.toBeNull();
  expect(host.querySelector(".mobile-edit-stage")).not.toBeNull();
  expect(host.querySelector(".mobile-publish-photo-grid")).not.toBeNull();

  const save = host.querySelector<HTMLButtonElement>(".mobile-edit-bar button")!;
  expect(save.disabled).toBe(true);

  await act(async () =>
    host.querySelector<HTMLButtonElement>('button[aria-label="抹茶"]')?.click(),
  );
  await act(async () =>
    [...host.querySelectorAll<HTMLButtonElement>(".mobile-edit-cats button")]
      .find((b) => b.textContent === "主食")
      ?.click(),
  );
  await act(async () =>
    [...host.querySelectorAll<HTMLButtonElement>(".mobile-publish-tags button")]
      .find((b) => b.textContent === "甜")
      ?.click(),
  );

  expect(save.disabled).toBe(false);
  await act(async () => save.click());
  await act(async () => {});

  expect(api.editMyFood).toHaveBeenCalledWith(
    5,
    expect.objectContaining({
      category: "staple",
      systemTagIds: [3],
      stageColor: "matcha",
    }),
  );
  expect(toast).toHaveBeenCalledWith("菜品已更新");
  expect(host.textContent).toContain("菜品详情");
});

it("keeps the desktop multi-card edit layout when mobile is false", async () => {
  await open(false);
  expect(host.querySelector(".ew-edit-form")).not.toBeNull();
  expect(host.querySelector(".mobile-edit-dish")).toBeNull();
});
