// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppProvider } from "../app/context";
import { writeSession } from "../app/runtime";
import { RestaurantMoreActions } from "./RestaurantMoreActions";

let host: HTMLDivElement;
let root: Root;
let location = "";
let posts: { path: string; body: unknown }[];

function LocationProbe() {
  const loc = useLocation();
  location = loc.pathname + loc.search;
  return null;
}

const ok = (data: unknown) => new Response(JSON.stringify({ code: 0, data }));

async function render() {
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={["/restaurants/1"]}>
          <LocationProbe />
          <RestaurantMoreActions id={1} name="哀记云饺" desktop />
        </MemoryRouter>
      </AppProvider>,
    ),
  );
}

async function openMenu() {
  const summary = host.querySelector<HTMLElement>(".restaurant-more-trigger");
  expect(summary).toBeTruthy();
  await act(async () => summary!.click());
  const details = host.querySelector<HTMLDetailsElement>(
    "details.restaurant-more",
  );
  // jsdom does not toggle <details> from a click, so open it the way the browser would.
  if (details && !details.open) {
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
    });
  }
  return details!;
}

async function settle() {
  // Let the history query resolve before asserting on rendered revisions.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function clickText(text: string) {
  const button = [
    ...host.querySelectorAll<HTMLElement>(".restaurant-more-panel button"),
  ]
    .concat([...host.querySelectorAll<HTMLElement>(".restaurant-more-panel a")])
    .find((element) => element.textContent?.includes(text));
  expect(button, `menu item ${text}`).toBeTruthy();
  await act(async () => button!.click());
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  localStorage.clear();
  sessionStorage.clear();
  writeSession({ tokenName: "satoken", tokenValue: "shop-report" });
  location = "";
  posts = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const path = url.split("?")[0];
      if (init?.method === "POST") {
        posts.push({
          path,
          body:
            typeof init.body === "string" ? JSON.parse(init.body) : init.body,
        });
        return Promise.resolve(ok({ id: 7 }));
      }
      if (path.endsWith("/user/info"))
        return Promise.resolve(
          ok({ id: 11, displayName: "我自己", verified: true, banned: false }),
        );
      if (path.endsWith("/campus/list")) return Promise.resolve(ok([]));
      if (path.endsWith("/restaurant/1/history"))
        return Promise.resolve(
          ok({
            items: [
              {
                id: 21,
                action: "create",
                editor: { id: 9, displayName: "Maycry" },
                createdAt: 1763200000000,
                changes: [
                  { field: "name", to: "哀记云饺" },
                  { field: "gcjLng", to: 117.134 },
                  { field: "poi", to: "fixture-map-place-id" },
                  { field: "kind", to: "food" },
                ],
              },
            ],
            hasNext: false,
          }),
        );
      return Promise.resolve(ok({ items: [], hasNext: false }));
    }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  writeSession(null);
  vi.unstubAllGlobals();
});

it("opens the shop report in a dialog instead of navigating away", async () => {
  await render();
  await openMenu();
  await clickText("举报店铺");

  const dialog = host.querySelector<HTMLDialogElement>(
    "dialog.food-report-modal",
  );
  expect(dialog).toBeTruthy();
  expect(dialog!.querySelector(".modal-title, h2")?.textContent).toContain(
    "举报店铺",
  );
  expect(dialog!.textContent).toContain("正在举报");
  expect(dialog!.textContent).toContain("哀记云饺");
  expect(location).toBe("/restaurants/1");
});

it("offers only the reasons a shop can be reported for", async () => {
  await render();
  await openMenu();
  await clickText("举报店铺");

  const options = [
    ...host.querySelectorAll<HTMLOptionElement>(
      "dialog.food-report-modal select option",
    ),
  ].map((option) => [option.value, option.textContent]);
  expect(options).toEqual([
    ["ADVERTISING", "广告信息"],
    ["ILLEGAL_OR_UNFRIENDLY", "不友善或违规内容"],
    ["OTHER", "其他问题"],
  ]);
});

it("opens the shop history in a dialog instead of leaving the page", async () => {
  await render();
  await openMenu();
  await clickText("修改记录");
  await settle();
  await settle();

  const dialog = host.querySelector<HTMLDialogElement>(
    "dialog.shop-history-modal",
  );
  expect(dialog).toBeTruthy();
  expect(dialog!.textContent).toContain("修改记录");
  expect(dialog!.textContent).toContain("哀记云饺");
  expect(dialog!.textContent).toContain("Maycry");
  expect(dialog!.textContent).toContain("当前版本");
  expect(dialog!.textContent).toContain("经营信息");
  expect(dialog!.textContent).toContain("吃饭");
  expect(dialog!.textContent?.match(/地图位置/g)).toHaveLength(1);
  expect(dialog!.textContent).not.toContain("fixture-map-place-id");
  expect(location).toBe("/restaurants/1");
});

it("submits a RESTAURANT report and closes the dialog", async () => {
  await render();
  await openMenu();
  await clickText("举报店铺");

  const dialog = host.querySelector<HTMLDialogElement>(
    "dialog.food-report-modal",
  )!;
  const textarea = dialog.querySelector("textarea")!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    setter.call(textarea, "地址写错了");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const form = dialog.querySelector("form")!;
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });

  expect(posts).toHaveLength(1);
  expect(posts[0].path).toBe("/api/feedback/reports");
  expect(posts[0].body).toEqual({
    targetType: "RESTAURANT",
    targetId: 1,
    reason: "OTHER",
    note: "地址写错了",
  });
  expect(location).toBe("/restaurants/1");
});
