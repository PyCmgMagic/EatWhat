// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppContext, type AppState } from "../app/state";
import Users from "./modules/Users";

vi.mock("../app/runtime", () => ({ isDemo: false }));

let host: HTMLDivElement, root: Root, filters: HTMLStyleElement;
let cache: QueryClient;
const adminUserNetwork = vi.fn();
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  filters = document.createElement("style");
  // EasyList cosmetic rules can hide business UI even after its API succeeds.
  // https://github.com/easylist/easylist/blob/master/easylist/easylist_general_hide.txt
  filters.textContent =
    ".ad-panel, .ad-stack, .ad-link { display: none !important; }";
  document.head.append(filters);
});
afterEach(async () => {
  await act(() => root.unmount());
  cache.clear();
  host.remove();
  filters.remove();
});

function expectVisible(element: Element | null) {
  expect(element).not.toBeNull();
  for (let node = element; node; node = node.parentElement) {
    expect(
      getComputedStyle(node).display,
      node.outerHTML.slice(0, 180),
    ).not.toBe("none");
  }
}

async function renderUsers(items: Record<string, unknown>[]) {
  cache.setQueryData(["admin", "users", 1, {}], {
    items,
    totalItems: items.length,
    totalPages: 1,
    hasNext: false,
  });
  const identity = {
    user: { id: 10, role: "admin" },
    api: { adminUsers: vi.fn(), adminUserNetwork },
  } as unknown as AppState;
  await act(() =>
    root.render(
      <AppContext.Provider value={identity}>
        <QueryClientProvider client={cache}>
          <MemoryRouter>
            <Users />
          </MemoryRouter>
        </QueryClientProvider>
      </AppContext.Provider>,
    ),
  );
}

it("keeps user rows and management controls visible with cosmetic ad filters", async () => {
  await renderUsers([{ id: 21, displayName: "测试食友", role: "user" }]);
  expect(host.querySelector("tbody")?.textContent).toContain("测试食友");
  expectVisible(host.querySelector("table"));
  expectVisible(host.querySelector("tbody button"));
  expectVisible(host.querySelector('nav[aria-label="分页"]'));
});

it("keeps the empty-list explanation visible with cosmetic ad filters", async () => {
  await renderUsers([]);
  const empty = host.querySelector('[role="status"]');
  expect(empty?.textContent).toContain("暂无用户");
  expectVisible(empty);
});

it("shows the network of the opened account, and keeps controls if it fails", async () => {
  const open = async () => {
    await act(async () =>
      host.querySelector<HTMLElement>("tbody button")!.click(),
    );
    await act(async () => void (await new Promise((r) => setTimeout(r, 20))));
  };
  adminUserNetwork.mockResolvedValueOnce({
    registrationIp: "203.0.113.5",
    registrationNetwork: "OTHER",
    registrationOperator: "CHINA_UNICOM",
    lastIp: null,
    lastNetwork: "UNKNOWN",
    lastUsedAt: null,
  });
  await renderUsers([{ id: 21, displayName: "测试食友", role: "user" }]);
  await open();
  expect(adminUserNetwork).toHaveBeenCalledWith(21);
  expect(document.body.textContent).toContain("203.0.113.5");
  expect(document.body.textContent).toContain("联通");

  await act(() => root.unmount());
  root = createRoot(host);
  cache.clear();
  adminUserNetwork.mockRejectedValueOnce(new Error("offline"));
  await renderUsers([{ id: 21, displayName: "测试食友", role: "user" }]);
  await open();
  expect(document.body.textContent).toContain("加载失败");
  expect(document.body.textContent).toContain("封禁账号");
});
