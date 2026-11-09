// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppContext, type AppState } from "./state";
import { ToastViewport, useToasts } from "./toast";
import { ToastError, useFeedbackState } from "../components/feedback";
import { AccessRequiredError } from "../api/client";

let host: HTMLDivElement, root: Root;
let controller: ReturnType<typeof useToasts>;
let report: (message: string) => void;
function Operation() {
  [, report] = useFeedbackState();
  return <div data-testid="form">表单内容</div>;
}
function Harness({ error }: { error?: unknown }) {
  controller = useToasts();
  return (
    <AppContext.Provider value={{ toast: controller.toast } as AppState}>
      <Operation />
      <ToastError error={error} />
      <ToastViewport items={controller.items} dismiss={controller.dismiss} />
    </AppContext.Provider>
  );
}
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.querySelectorAll("dialog").forEach((node) => node.remove());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("shows action errors outside the form and announces them assertively", async () => {
  await act(async () => report("图片未能连接上传服务"));
  expect(host.querySelector('[data-testid="form"]')?.textContent).toBe(
    "表单内容",
  );
  expect(
    document.querySelector('.app-toast[role="alert"]')?.textContent,
  ).toContain("图片未能连接上传服务");
  expect(host.querySelector(".app-toast")).toBeNull();
});

it("keeps separate simultaneous messages and allows dismissing each", async () => {
  await act(async () => {
    controller.toast("已保存", { tone: "success" });
    controller.toast("下一项操作失败", { tone: "error" });
  });
  expect(document.querySelectorAll(".app-toast")).toHaveLength(2);
  const button = document.querySelector<HTMLButtonElement>(
    '.app-toast[data-tone="success"] button',
  )!;
  await act(async () => button.click());
  expect(document.querySelectorAll(".app-toast")).toHaveLength(1);
  expect(document.querySelector(".app-toast")?.textContent).toContain(
    "下一项操作失败",
  );
});

it("renews identical retry feedback instead of letting its old timer hide it", async () => {
  await act(async () => report("保存失败"));
  const first = controller.items[0].id;
  await act(async () => vi.advanceTimersByTime(7000));
  await act(async () => report("保存失败"));
  expect(controller.items).toHaveLength(1);
  expect(controller.items[0].id).not.toBe(first);
  await act(async () => vi.advanceTimersByTime(1500));
  expect(document.querySelector(".app-toast")).not.toBeNull();
  await act(async () => vi.advanceTimersByTime(6500));
  expect(document.querySelector(".app-toast")).toBeNull();
});

it("does not duplicate one error reported by a controller and its compatibility view", async () => {
  const error = new Error("验证码发送失败");
  await act(async () => {
    controller.toast(error.message, { tone: "error" });
    root.render(<Harness error={error} />);
  });
  expect(document.querySelectorAll(".app-toast")).toHaveLength(1);
});

it("keeps feedback in the active dialog's accessible subtree and restores its host on close", async () => {
  const dialog = document.createElement("dialog");
  dialog.open = true;
  await act(async () => document.body.append(dialog));
  await act(async () => report("登录失败，请重试"));
  expect(dialog.querySelector(".app-toast")?.textContent).toContain("登录失败");
  await act(async () => {
    dialog.open = false;
  });
  expect(dialog.querySelector(".app-toast")).toBeNull();
  expect(
    document.body.querySelector(":scope > .app-toast-viewport .app-toast"),
  ).not.toBeNull();
});

it("does not announce another error for an already handled access prompt", async () => {
  await act(async () =>
    root.render(
      <Harness error={new AccessRequiredError("verification", true)} />,
    ),
  );
  expect(document.querySelector(".app-toast")).toBeNull();
});
