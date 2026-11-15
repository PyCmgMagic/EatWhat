// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  type QueryClient as QueryClientType,
} from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VerificationResult from "./VerificationResult";
import { rememberVerificationReturn } from "../app/verification-return";

const mocks = vi.hoisted(() => ({
  verifyEmail: vi.fn(),
  ssoConfirm: vi.fn(),
  me: vi.fn(),
}));
vi.mock("../app/state", () => ({
  useApp: () => ({ api: mocks, user: { id: 11 } }),
}));

let root: Root, host: HTMLDivElement, cache: QueryClientType;
const emailToken = (letter: string) => letter.repeat(40) + "_-9";

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  sessionStorage.clear();
  mocks.verifyEmail.mockReset().mockResolvedValue(undefined);
  mocks.ssoConfirm.mockReset().mockResolvedValue(undefined);
  mocks.me.mockReset().mockResolvedValue({ id: 11, verified: true });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(async () => {
  await act(async () => root.unmount());
  cache.clear();
  host.remove();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
});

async function mount(token: string) {
  window.history.replaceState(null, "", `/#/verify?token=${token}`);
  await act(async () =>
    root.render(
      <QueryClientProvider client={cache}>
        <MemoryRouter initialEntries={[`/verify?token=${token}`]}>
          <VerificationResult
            callback={{ result: "success", code: "", token }}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}

async function spin(condition: () => boolean) {
  for (let i = 0; i < 70 && !condition(); i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  expect(condition(), "verification result condition").toBe(true);
}

it("confirms an email token and refreshes the verified account", async () => {
  const token = emailToken("A");
  await mount(token);
  await spin(() => host.textContent.includes("学生认证成功"));
  expect(mocks.verifyEmail).toHaveBeenCalledOnce();
  expect(mocks.verifyEmail).toHaveBeenCalledWith(token);
  expect(mocks.me).toHaveBeenCalled();
  expect(window.location.hash).not.toContain("token=");
});

it("shows the verification error when the email token is rejected", async () => {
  mocks.verifyEmail.mockRejectedValue(new Error("邮箱认证链接已失效"));
  mocks.me.mockResolvedValue({ id: 11, verified: false });
  await mount(emailToken("B"));
  await spin(() => host.textContent.includes("暂时无法确认认证结果"));
  expect(host.textContent).toContain("邮箱认证链接已失效");
  expect(mocks.verifyEmail).toHaveBeenCalledOnce();
  expect(mocks.me).toHaveBeenCalledOnce();
});

it("does not submit an email token after the account changes", async () => {
  rememberVerificationReturn(10, "/settings/account");
  await mount(emailToken("C"));
  await spin(() => host.textContent.includes("登录账号已变化"));
  expect(mocks.verifyEmail).not.toHaveBeenCalled();
  expect(mocks.me).toHaveBeenCalledOnce();
});
