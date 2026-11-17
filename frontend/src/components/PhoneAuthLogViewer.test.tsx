// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PhoneAuthLogViewer } from "./PhoneAuthLogViewer";
import { phoneAuthLogs } from "../app/phone-auth-logs";
import {
  createWebOneClickTiming,
  webOneClickToken,
} from "../app/web-one-click";

let host: HTMLDivElement, root: Root;
const writeText = vi.fn();

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("navigator", {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Safari/605.1",
    onLine: true,
    clipboard: { writeText },
  });
  writeText.mockReset().mockResolvedValue(undefined);
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
  phoneAuthLogs.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  phoneAuthLogs.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function carrierFailure() {
  const timing = createWebOneClickTiming();
  await expect(
    webOneClickToken(
      {
        webOneClickToken: async () => ({
          accessToken: "private-access",
          jwtToken: "private-jwt",
        }),
      },
      {
        closeLoginPage: () => {},
        checkLoginAvailable: (options) => options.success({ code: 600000 }),
        getLoginToken: (options) =>
          options.error({
            code: 600011,
            spToken: "private-sp-token",
            msg: "private-provider-message",
            content: [
              { vender: "CU", code: "-2", msg: "private-provider-message" },
              { vender: "CM", code: "103111", mobile: "13800000000" },
              { vender: "CT", result: -30408 },
            ],
          }),
      },
      timing,
    ),
  ).rejects.toThrow("运营商取号失败");
  return timing.trace;
}

function button(text: string) {
  return [...document.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === text,
  )!;
}

async function open() {
  await act(async () => root.render(<PhoneAuthLogViewer />));
  await act(async () => button("查看日志").click());
}

function logText() {
  return document.querySelector<HTMLTextAreaElement>("textarea")!.value;
}

it("shows the real sanitized carrier report even when the viewer opens after failure", async () => {
  const trace = await carrierFailure();
  await open();
  expect(document.querySelector("dialog")?.getAttribute("open")).toBe("");
  const text = logText();
  expect(text).toContain(trace);
  expect(text).toContain("600011");
  expect(text).toContain("CU:-2");
  expect(text).toContain("CM:103111");
  expect(text).toContain("CT:-30408");
  expect(text).toContain("phone_auth_timing");
  expect(text).not.toMatch(/private-|13800000000/);
});

it("updates while open and clearing removes old reports from viewing and copying", async () => {
  await open();
  expect(document.body.textContent).toContain("暂无日志");
  expect(button("复制日志").disabled).toBe(true);
  let trace = "";
  await act(async () => {
    trace = await carrierFailure();
  });
  expect(logText()).toContain(trace);
  await act(async () => button("清空日志").click());
  expect(phoneAuthLogs.getSnapshot()).toHaveLength(0);
  expect(document.querySelector("textarea")).toBeNull();
  expect(button("复制日志").disabled).toBe(true);
});

it("copies the same safe log text displayed on the page", async () => {
  await carrierFailure();
  await open();
  const text = logText();
  await act(async () => button("复制日志").click());
  expect(writeText).toHaveBeenCalledWith(text);
  expect(document.querySelector('[role="status"]')?.textContent).toBe(
    "日志已复制",
  );
});

it.each(["denied", "unsupported"])(
  "selects logs for long-press copying when clipboard is %s",
  async (mode) => {
    if (mode === "denied")
      writeText.mockRejectedValue(
        new DOMException("denied", "NotAllowedError"),
      );
    else vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    await carrierFailure();
    await open();
    await act(async () => button("复制日志").click());
    const content = document.querySelector("textarea")!;
    expect(document.activeElement).toBe(content);
    expect(content.selectionStart).toBe(0);
    expect(content.selectionEnd).toBe(content.value.length);
    expect(document.querySelector('[role="status"]')?.textContent).toBe(
      "请长按选中的日志复制",
    );
  },
);

it("retains the latest 100 entries across repeated attempts without persisting them", async () => {
  const first = await carrierFailure();
  let last = "";
  for (let index = 0; index < 21; index++) last = await carrierFailure();
  await open();
  expect(phoneAuthLogs.getSnapshot()).toHaveLength(100);
  expect(logText()).not.toContain(first);
  expect(logText()).toContain(last);
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
