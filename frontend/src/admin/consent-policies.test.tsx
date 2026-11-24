// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError, type Transport } from "../api/client";
import { createApi } from "../api/service";
import { bridgeToV2 } from "../api/v2-bridge";
import { AppContext, type AppState } from "../app/state";
import ConsentPolicies from "./modules/ConsentPolicies";

vi.mock("../app/runtime", () => ({ isDemo: false }));

const path = "/admin/consent/policies";
const existing = {
  id: 4,
  version: "v1",
  publishedAt: Date.parse("2026-11-23T09:00:00+08:00"),
};
const fields = {
  version: "v2.1",
  privacyText: "隐私政策第一段\n\n第二段\n",
  crossBorderText: "跨境说明第一段\n第二段",
};
const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 25)));
let host: HTMLDivElement, root: Root, cache: QueryClient;
let published = false;
let rejectPublish = false;
const toast = vi.fn();
const transport = vi.fn<Transport>(async (url, options) => {
  if (url === path && options.method === "POST") {
    if (rejectPublish) throw new ApiError("这个版本号已经用过了", 40004);
    published = true;
    return { code: 0, data: { id: 5, ...fields } };
  }
  if (url === `${path}/4`)
    return {
      code: 0,
      data: {
        ...existing,
        privacyText: "历史隐私政策\n第二段",
        crossBorderText: "<strong>历史跨境说明</strong>",
      },
    };
  if (url === path)
    return {
      code: 0,
      data: {
        items:
          options.query?.page === 2
            ? [{ ...existing, id: 1, version: "v0.1" }]
            : published
              ? [{ ...existing, id: 5, version: fields.version }, existing]
              : [existing],
        totalPages: 2,
        totalItems: 13,
        hasNext: options.query?.page !== 2,
      },
    };
  throw new Error(`Unexpected route ${url}`);
});

function button(label: string) {
  return [...host.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  )!;
}

function field(name: keyof typeof fields) {
  return host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${name}"]`,
  )!;
}

async function fillAndReview() {
  for (const [name, value] of Object.entries(fields))
    field(name as keyof typeof fields).value = value;
  await act(() => button("发布新版本").click());
}

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.open = true;
    },
    close(this: HTMLDialogElement) {
      this.open = false;
    },
  });
  vi.clearAllMocks();
  published = false;
  rejectPublish = false;
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const app = {
    api: createApi(bridgeToV2(transport)),
    toast,
  } as unknown as AppState;
  await act(() =>
    root.render(
      <AppContext.Provider value={app}>
        <QueryClientProvider client={cache}>
          <ConsentPolicies />
        </QueryClientProvider>
      </AppContext.Provider>,
    ),
  );
  await settle();
});

afterEach(async () => {
  await act(() => root.unmount());
  cache.clear();
  host.remove();
  vi.unstubAllGlobals();
});

it("publishes both original texts only after explicit confirmation", async () => {
  await fillAndReview();
  expect(published).toBe(false);
  await act(() => button("取消").click());
  expect(field("privacyText").value).toBe(fields.privacyText);
  expect(published).toBe(false);
  await act(() => button("发布新版本").click());
  await act(() => button("确认发布").click());
  await settle();
  expect(
    transport.mock.calls.filter(([, options]) => options.method === "POST"),
  ).toEqual([[path, expect.objectContaining({ body: fields })]]);
  expect(field("version").value).toBe("");
  expect(host.textContent).toContain(fields.version);
  expect(toast).toHaveBeenCalledWith("政策已发布。", { tone: "success" });
});

it("keeps both texts when the version is rejected", async () => {
  rejectPublish = true;
  await fillAndReview();
  await act(() => button("确认发布").click());
  await settle();
  expect(field("privacyText").value).toBe(fields.privacyText);
  expect(field("crossBorderText").value).toBe(fields.crossBorderText);
  expect(toast).toHaveBeenCalledWith("这个版本号已经用过了", { tone: "error" });
});

it("reads historical originals by ID and pages versions", async () => {
  await act(() => button("查看正文").click());
  await settle();
  const dialog = host.querySelector("dialog")!;
  expect(dialog.textContent).toContain("历史隐私政策\n第二段");
  expect(dialog.textContent).toContain("<strong>历史跨境说明</strong>");
  expect(dialog.querySelector(".ew-admin-policy-text strong")).toBeNull();
  await act(() =>
    dialog.querySelector<HTMLButtonElement>("[aria-label=关闭]")!.click(),
  );
  await act(() => button("下一页").click());
  await settle();
  expect(transport).toHaveBeenCalledWith(
    path,
    expect.objectContaining({ query: { page: 2, pageSize: 12 } }),
  );
  expect(host.textContent).toContain("v0.1");
  expect(host.textContent).not.toContain("当前版本");
});
