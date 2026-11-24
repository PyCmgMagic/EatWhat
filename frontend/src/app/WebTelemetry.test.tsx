// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  MemoryRouter,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createApi } from "../api/service";
import { bridgeToV2 } from "../api/v2-bridge";
import type { TelemetryBatch } from "../api/v4-types";
import PrivacySettings from "../features/PrivacySettings";
import WebTelemetry from "./WebTelemetry";

let signedIn = true,
  enabled = true;
const session = { tokenName: "satoken", tokenValue: "test" };
const batches: { installId: string; events: TelemetryBatch["events"] }[] = [];
const api = createApi(
  bridgeToV2(async (path, options) => {
    if (path === "/telemetry/events") {
      batches.push(options.body as (typeof batches)[number]);
      return {
        code: 0,
        data: {
          accepted: batches.at(-1)!.events.length,
          duplicates: 0,
          enabled,
        },
      };
    }
    if (path !== "/telemetry/consent") return { code: 0, data: {} };
    if (options.method === "DELETE") enabled = false;
    if (options.method === "PUT") enabled = true;
    return { code: 0, data: { enabled, retentionDays: 90 } };
  }),
);
vi.mock("./state", async (original) => ({
  ...(await original<typeof import("./state")>()),
  useApp: () => ({
    api,
    session: signedIn ? session : null,
    user: signedIn ? { id: 1 } : undefined,
    toast: vi.fn(),
  }),
}));
let cache: QueryClient,
  root: Root,
  host: HTMLElement,
  navigate: NavigateFunction;
function Pages() {
  navigate = useNavigate();
  return (
    <>
      <WebTelemetry />
      {useLocation().pathname === "/settings/privacy" && <PrivacySettings />}
    </>
  );
}
async function mount(path: string) {
  await act(async () =>
    root.render(
      <StrictMode>
        <QueryClientProvider client={cache}>
          <MemoryRouter initialEntries={[path]}>
            <Pages />
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    ),
  );
  await settle();
}
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}
async function go(to: string | number) {
  await act(async () => {
    if (typeof to === "number") await navigate(to);
    else await navigate(to);
  });
  await settle();
}
function properties() {
  return batches.flatMap((batch) => batch.events.map((e) => e.properties));
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  signedIn = enabled = true;
  batches.length = 0;
  cache = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30000 } },
  });
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  cache.clear();
  vi.unstubAllGlobals();
});

it("excludes direct admin opens and admin navigation, then counts only the public page view", async () => {
  await mount("/admin");
  await go("/admin/v4?tab=feedback");
  await go("/admin/telemetry");
  expect(batches).toHaveLength(0);
  await go("/");
  expect(properties()).toEqual([{ event: "page_view", page: "HOME" }]);
});

it("counts a public page again on return from admin without an extra open", async () => {
  await mount("/foods/11");
  await go("/admin/telemetry");
  await go(-1);
  expect(properties()).toEqual([
    { event: "app_open" },
    { event: "page_view", page: "FOOD" },
    { event: "page_view", page: "FOOD" },
  ]);
});

it("reports one open per document and one categorized view per path, including history navigation", async () => {
  await mount("/foods/11");
  await go("/foods/22");
  await go("/search?q=private");
  await go("/search?q=another");
  await go(-2);
  expect(properties()).toEqual([
    { event: "app_open" },
    { event: "page_view", page: "FOOD" },
    { event: "page_view", page: "FOOD" },
    { event: "page_view", page: "SEARCH" },
    { event: "page_view", page: "FOOD" },
  ]);
  expect(new Set(batches.map((b) => b.installId))).toEqual(
    new Set([localStorage.getItem("eatwhat.installId")]),
  );
  const ids = batches.flatMap((b) => b.events.map((e) => e.eventId));
  expect(new Set(ids).size).toBe(ids.length);
});
it("honors the settings switch immediately and does not count the switch as an open", async () => {
  // jsdom lacks the native dialog methods used by the withdrawal confirmation.
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.open = true;
    },
    close(this: HTMLDialogElement) {
      this.open = false;
    },
  });
  enabled = false;
  await mount("/settings/privacy");
  expect(batches).toHaveLength(0);
  const toggle = () =>
    host.querySelector<HTMLInputElement>('[aria-label="分享使用统计"]')!;
  await act(async () => toggle().click());
  await settle();
  await go("/recommend");
  await go("/settings/privacy");
  await act(async () => toggle().click());
  const confirm = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "关闭并删除统计",
  )!;
  await act(async () => confirm.click());
  await settle();
  await go("/");
  expect(properties()).toEqual([
    { event: "page_view", page: "OTHER" },
    { event: "page_view", page: "RECOMMEND" },
    { event: "page_view", page: "OTHER" },
  ]);
});
it("does not send events while signed out", async () => {
  signedIn = false;
  await mount("/");
  await go("/restaurants/2");
  expect(batches).toHaveLength(0);
});

it("refreshes consent when the server reports a disable from another device", async () => {
  await mount("/");
  enabled = false;
  await go("/restaurants/2");
  await go("/notifications");
  expect(properties()).toEqual([
    { event: "app_open" },
    { event: "page_view", page: "HOME" },
    { event: "page_view", page: "RESTAURANT" },
  ]);
});
