// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HashRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PhoneLoginForm } from "../features/Account";

vi.mock("../app/state", () => ({
  useApp: () => ({ api: {}, signIn: vi.fn(), toast: vi.fn() }),
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search}
    </output>
  );
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement, root: Root;

async function render(hash: string) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  window.history.replaceState(null, "", "/" + hash);
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <HashRouter>
          <PhoneLoginForm />
          <LocationProbe />
        </HashRouter>
      </QueryClientProvider>,
    );
  });
}

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("phone login password entry", () => {
  it("shows no test console or log viewer on the phone login form", async () => {
    await render("#/auth/register");
    expect(container.querySelector(".phone-auth-log-entry")).toBeNull();
    expect(container.querySelector(".ew-one-click-console")).toBeNull();
    expect(container.textContent).not.toContain("查看日志");
  });

  it("opens the password login page instead of the login method chooser", async () => {
    await render("#/auth/register");
    const password = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent?.trim() === "使用密码登录",
    )!;
    // 曾经的缺陷：链接指向 /auth（登录方式选择页），点进去要再选一次。
    expect(password.getAttribute("href")).toBe("#/auth/password");

    await act(async () => password.click());
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/auth/password");
  });

  it("keeps the return target when switching to password login", async () => {
    await render("#/auth/register?next=%2Fme");
    const password = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent?.trim() === "使用密码登录",
    )!;
    expect(password.getAttribute("href")).toBe("#/auth/password?next=%2Fme");

    await act(async () => password.click());
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/auth/password?next=%2Fme");
  });
});
