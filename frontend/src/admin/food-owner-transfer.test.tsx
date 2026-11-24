// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppContext, type AppState } from "../app/state";
import { ApiError } from "../api/client";
import type { Food } from "../api/models";
import { createApi } from "../api/service";
import { bridgeToV2 } from "../api/v2-bridge";
import { FoodOwnerTransfer } from "./modules/FoodOwnerTransfer";

vi.mock("../app/runtime", () => ({ isDemo: false }));

let host: HTMLDivElement, root: Root, cache: QueryClient;
const toast = vi.fn(),
  onClose = vi.fn(),
  transferFoodOwner = vi.fn();
const adminUsers = vi.fn(async () => ({
  items: [
    { id: 1, displayName: "原主" },
    { id: 2, displayName: "新主" },
    { id: 3, displayName: "坏人", accountStatus: { accountStatus: "BANNED" } },
  ],
  totalItems: 3,
  totalPages: 1,
}));
const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 20)));
const button = (text: string) =>
  [...host.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  )!;
const radios = () =>
  [...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')];

beforeEach(async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const app = {
    user: { id: 10, role: "admin" },
    toast,
    api: { adminUsers, transferFoodOwner },
  } as unknown as AppState;
  await act(() =>
    root.render(
      <AppContext.Provider value={app}>
        <QueryClientProvider client={cache}>
          <FoodOwnerTransfer
            food={
              { id: 7, name: "牛腩", accountId: 1, uploaderName: "原主" } as Food
            }
            onClose={onClose}
          />
        </QueryClientProvider>
      </AppContext.Provider>,
    ),
  );
  const input = host.querySelector<HTMLInputElement>('[name="keyword"]')!;
  input.value = "主";
  await act(() =>
    input.form!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
  await settle();
});
afterEach(async () => {
  await act(() => root.unmount());
  cache.clear();
  host.remove();
});
async function choose() {
  await act(() => radios()[1].click());
  await act(() => button("转移归属").click());
}

it("only offers people who can receive the dish", () => {
  expect(radios().map((r) => r.disabled)).toEqual([true, false, true]);
  expect(button("转移归属").disabled).toBe(true);
});
it("transfers only after confirmation and reports the experience", async () => {
  transferFoodOwner.mockResolvedValue({ experience: 20, droppedExperience: 1 });
  await choose();
  expect(transferFoodOwner).not.toHaveBeenCalled();
  await act(() => button("确认转移").click());
  await settle();
  expect(transferFoodOwner).toHaveBeenCalledExactlyOnceWith(7, 2, undefined);
  expect(toast.mock.calls[0][0]).toContain("20 点经验，另有 1 点不计入");
  expect(onClose).toHaveBeenCalled();
});
it("keeps the drawer open when the server refuses", async () => {
  transferFoodOwner.mockRejectedValue(new ApiError("对方账号封禁中", 40002));
  await choose();
  await act(() => button("确认转移").click());
  await settle();
  expect(onClose).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith("对方账号封禁中", { tone: "error" });
  expect(button("确认转移")).toBeUndefined();
});
it("posts through the bridge and rewords a pending account deletion", async () => {
  const live = vi.fn(async (_path: string, _options: unknown) => ({
    code: 30017,
    msg: "x",
  }));
  const api = createApi(bridgeToV2(live));
  await expect(api.transferFoodOwner(7, 2, "补录")).rejects.toThrow(
    "对方账号正在注销冷静期中",
  );
  expect(live).toHaveBeenCalledWith(
    "/admin/foods/7/owner",
    expect.objectContaining({
      method: "POST",
      body: { userId: 2, reason: "补录" },
    }),
  );
});
