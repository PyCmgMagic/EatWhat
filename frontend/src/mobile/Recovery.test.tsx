// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HashRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppContext, type AppState } from "../app/state";
import { LoginDialogProvider, LoginLink } from "../app/auth-dialog";
import LoginPage from "./Login";

let host: HTMLDivElement, root: Root, cache: QueryClient;
let app: AppState;
const phoneCode = vi.fn(),
  phoneLogin = vi.fn(),
  signIn = vi.fn();
const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);
const next = "?next=%2Ffoods%2F7";
const locationText = () => host.querySelector("output")?.textContent;

function Screen({ modal }: { modal: boolean }) {
  const location = useLocation();
  return (
    <>
      <output>{location.pathname + location.search}</output>
      {modal ? (
        <LoginLink to={"/auth/forgot" + next}>找回密码</LoginLink>
      ) : (
        location.pathname.startsWith("/auth/") && <LoginPage desktop={false} />
      )}
    </>
  );
}

async function render(modal = false) {
  window.history.replaceState(
    null,
    "",
    "/#" + (modal ? "/foods/7" : "/auth/forgot" + next),
  );
  await act(async () =>
    root.render(
      <QueryClientProvider client={cache}>
        <AppContext.Provider value={app}>
          <HashRouter>
            <LoginDialogProvider>
              <Screen modal={modal} />
            </LoginDialogProvider>
          </HashRouter>
        </AppContext.Provider>
      </QueryClientProvider>,
    ),
  );
}

async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 40 && !condition(); i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  expect(condition()).toBe(true);
}

async function fill(label: string, value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>(
      `input[aria-label="${label}"]`,
    )!;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function finishPhoneLogin() {
  await fill("登录手机号", "13800000000");
  await act(async () =>
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent === "获取验证码")!
      .click(),
  );
  expect(phoneCode).toHaveBeenCalledWith(
    "13800000000",
    expect.any(AbortSignal),
  );
  await fill("登录验证码", "123456");
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>(".ew-auth-phone-form form > button")!
      .click(),
  );
  expect(signIn).toHaveBeenCalledWith({
    tokenName: "test",
    tokenValue: "recovery-session",
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("innerWidth", 1440);
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
  phoneCode.mockReset().mockResolvedValue(null);
  phoneLogin
    .mockReset()
    .mockResolvedValue({
      code: 0,
      data: {
        isLogin: true,
        tokenName: "test",
        tokenValue: "recovery-session",
      },
    });
  signIn.mockReset().mockResolvedValue(undefined);
  app = {
    api: { phoneCode, phoneLogin },
    session: null,
    signIn,
    toast: vi.fn(),
  } as unknown as AppState;
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  cache.clear();
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalShowModal)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "showModal",
      originalShowModal,
    );
  else
    delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)
      .showModal;
  if (originalClose)
    Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
});

it("offers the supported recovery method without obsolete email or token controls", async () => {
  await render();
  expect(host.querySelectorAll("h1")).toHaveLength(1);
  expect(host.querySelector("h1")?.textContent).toBe("找回密码");
  expect(host.querySelector("form")).toBeNull();
  for (const obsolete of [
    "密码冲突",
    "账号标识",
    "恢复令牌",
    "服务端开启",
    "发送恢复邮件",
  ])
    expect(host.textContent).not.toContain(obsolete);
  expect(host.querySelector("details")?.open).toBe(false);
  expect(
    host
      .querySelector<HTMLAnchorElement>(".ew-auth-submit")
      ?.getAttribute("href"),
  ).toBe("#/auth/register?next=%2Fsettings%2Fpassword");
});

it("returns to password login with the original destination", async () => {
  await render();
  await act(async () =>
    host.querySelector<HTMLAnchorElement>('a[aria-label="返回"]')!.click(),
  );
  expect(locationText()).toBe("/auth/password" + next);
});

it("continues to password settings after verifying the bound phone on the standalone page", async () => {
  await render();
  await act(async () =>
    host.querySelector<HTMLAnchorElement>(".ew-auth-submit")!.click(),
  );
  await finishPhoneLogin();
  expect(locationText()).toBe("/settings/password");
});

it("keeps recovery in the desktop login dialog and finishes at password settings", async () => {
  await render(true);
  await act(async () => host.querySelector<HTMLAnchorElement>("a")!.click());
  await waitFor(() => !!document.querySelector(".ew-auth-recovery"));
  expect(locationText()).toBe("/foods/7");
  expect(
    document.querySelector(".ew-login-dialog .ew-feature-page"),
  ).toBeNull();
  await act(async () =>
    document
      .querySelector<HTMLAnchorElement>(".ew-auth-recovery .ew-auth-submit")!
      .click(),
  );
  await waitFor(() => !!document.querySelector(".ew-auth-phone-form"));
  expect(locationText()).toBe("/foods/7");
  await finishPhoneLogin();
  expect(locationText()).toBe("/settings/password");
  expect(document.querySelector(".ew-login-dialog")).toBeNull();
});
