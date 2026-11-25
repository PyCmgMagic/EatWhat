// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppContext, type AppState } from "../app/state";
import FeedbackCaseDetail from "./modules/FeedbackCaseDetail";

vi.mock("../app/runtime", () => ({ isDemo: false }));

let host: HTMLDivElement, root: Root, cache: QueryClient;
const toast = vi.fn(),
  onClose = vi.fn(),
  resolveFeedback = vi.fn(),
  editFood = vi.fn(async () => null),
  food = vi.fn(),
  transferFoodOwner = vi.fn(),
  adminFeedbackCase = vi.fn();
const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 30)));
const button = (text: string) =>
  [...host.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  );
async function open(target: object, extra = {}) {
  adminFeedbackCase.mockResolvedValue({
    view: { id: 5, kind: "REPORT", status: "OPEN", target },
    targetName: "牛腩",
    ...extra,
  });
  await act(() =>
    root.render(
      <MemoryRouter>
        <AppContext.Provider
          value={
            {
              user: { id: 10, role: "admin" },
              toast,
              api: { adminFeedbackCase, food, editFood, resolveFeedback, transferFoodOwner },
            } as unknown as AppState
          }
        >
          <QueryClientProvider client={cache}>
            <FeedbackCaseDetail
              id={5}
              onClose={onClose}
              onReturnToQueue={vi.fn()}
            />
          </QueryClientProvider>
        </AppContext.Provider>
      </MemoryRouter>,
    ),
  );
  await settle();
}
async function click(text: string) {
  await act(() => button(text)!.click());
  await settle();
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  sessionStorage.clear();
  food.mockResolvedValue({
    id: 7,
    name: "牛腩",
    price: 12,
    category: "other",
    accountId: 1,
    user: { id: 1, displayName: "原主" },
  });
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  cache.clear();
  host.remove();
});

it("edits the reported dish without closing or resolving the case", async () => {
  await open({ type: "FOOD", id: 7 });
  expect(food).not.toHaveBeenCalled();
  const reply = host.querySelector<HTMLTextAreaElement>("textarea")!;
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(reply, "已核实");
    reply.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click("编辑菜品");
  expect(food).toHaveBeenCalledWith(7);
  const name = host.querySelector<HTMLInputElement>('input[name="name"]')!;
  name.value = "番茄牛腩";
  await act(() =>
    name.form!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
  await settle();
  expect(editFood).toHaveBeenCalledExactlyOnceWith(
    7,
    expect.objectContaining({ name: "番茄牛腩" }),
  );
  expect(host.querySelector('input[name="name"]')).toBeNull();
  expect(reply.isConnected && reply.value).toBe("已核实");
  expect(adminFeedbackCase.mock.calls.length).toBeGreaterThan(1);
  expect(onClose).not.toHaveBeenCalled();
  expect(resolveFeedback).not.toHaveBeenCalled();
});
it("opens the owner transfer with the current publisher", async () => {
  await open({ type: "FOOD", id: 7 });
  await click("转移归属");
  expect(host.textContent).toContain("转移菜品归属");
  expect(host.textContent).toContain("原主");
});
const reporter = { submitterId: 2, submitterName: "举报者" };
const checkbox = () =>
  host.querySelector<HTMLInputElement>('input[type="checkbox"]');
it("transfers without closing the case when unticked", async () => {
  transferFoodOwner.mockResolvedValue({ experience: 20 });
  await open({ type: "FOOD", id: 7 }, reporter);
  await click("转给举报人");
  await act(() => checkbox()!.click());
  expect(host.textContent).toContain("由「原主」转给「举报者」（#2");
  expect(transferFoodOwner).not.toHaveBeenCalled();
  await click("确认转移");
  expect(transferFoodOwner).toHaveBeenCalledExactlyOnceWith(7, 2, undefined);
  expect(button("确认转移")).toBeUndefined();
  expect(onClose).not.toHaveBeenCalled();
  expect(resolveFeedback).not.toHaveBeenCalled();
});
it("returns to the case when the server refuses the reporter", async () => {
  transferFoodOwner.mockRejectedValue(new Error("对方账号封禁中"));
  await open({ type: "FOOD", id: 7 }, reporter);
  await click("转给举报人");
  await click("转移并结案");
  expect(toast).toHaveBeenCalledWith(expect.any(String), { tone: "error" });
  expect(resolveFeedback).not.toHaveBeenCalled();
  expect(button("转移并结案")).toBeUndefined();
  expect(button("转给举报人")).toBeDefined();
});
it("closes the case by default after the transfer", async () => {
  transferFoodOwner.mockResolvedValue({ experience: 20 });
  resolveFeedback.mockResolvedValue({ outcome: "ACCEPTED" });
  await open({ type: "FOOD", id: 7 }, reporter);
  await click("转给举报人");
  expect(checkbox()!.checked).toBe(true);
  expect(host.textContent).toContain("转移后结案（举报属实）");
  await click("转移并结案");
  expect(resolveFeedback).toHaveBeenCalledExactlyOnceWith(
    5,
    { outcome: "ACCEPTED", reply: "", internalNote: "" },
    expect.any(String),
  );
  expect(transferFoodOwner.mock.invocationCallOrder[0]).toBeLessThan(
    resolveFeedback.mock.invocationCallOrder[0],
  );
});
it("keeps the chosen outcome and leaves the case open if closing fails", async () => {
  transferFoodOwner.mockResolvedValue({ experience: 20 });
  resolveFeedback.mockRejectedValue(new Error("结案失败"));
  await open({ type: "FOOD", id: 7 }, reporter);
  await act(() =>
    host.querySelector<HTMLInputElement>('input[value="REJECTED"]')!.click(),
  );
  await click("转给举报人");
  expect(host.textContent).toContain("转移后结案（举报不成立）");
  await click("转移并结案");
  expect(resolveFeedback.mock.calls[0][1].outcome).toBe("REJECTED");
  expect(transferFoodOwner).toHaveBeenCalledOnce();
  expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(button("确认结案")).toBeDefined();
});
it("offers no closing for a case that is already closed", async () => {
  await open(
    { type: "FOOD", id: 7 },
    {
      ...reporter,
      view: {
        id: 5,
        kind: "REPORT",
        status: "CLOSED",
        target: { type: "FOOD", id: 7 },
      },
    },
  );
  await click("转给举报人");
  expect(checkbox()).toBeNull();
  expect(button("确认转移")).toBeDefined();
});
it("does not transfer a dish the reporter already owns", async () => {
  await open({ type: "FOOD", id: 7 }, { ...reporter, submitterId: 1 });
  await click("转给举报人");
  expect(host.textContent).toContain("无需转移");
  await click("知道了");
  expect(transferFoodOwner).not.toHaveBeenCalled();
});
it("needs a known reporter", async () => {
  await open({ type: "FOOD", id: 7 });
  expect(button("转给举报人")).toBeUndefined();
});
it("reports a dish that cannot be loaded and allows a retry", async () => {
  food.mockRejectedValue(new Error("菜品不存在"));
  await open({ type: "FOOD", id: 7 });
  await click("编辑菜品");
  expect(toast).toHaveBeenCalledWith(expect.any(String), { tone: "error" });
  expect(button("编辑菜品")!.disabled).toBe(false);
});
it.each([
  [{ type: "FOOD", id: 7 }, { targetUnavailable: true }],
  [{ type: "RESTAURANT", id: 7 }, {}],
  [{ type: "COMMENT", id: 7 }, {}],
])("offers no dish actions for %o %o", async (target, extra) => {
  await open(target, extra);
  expect(button("编辑菜品")).toBeUndefined();
  expect(button("转移归属")).toBeUndefined();
});
