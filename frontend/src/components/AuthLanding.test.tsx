// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HashRouter, useLocation } from "react-router-dom";
import AuthLanding from "./AuthLanding";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement, root: Root;
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.open = true;
});
const close = vi.fn(function (this: HTMLDialogElement) {
  this.open = false;
});

beforeEach(async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: showModal,
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: close,
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  window.history.replaceState(null, "", "/#/auth");
  await act(async () => {
    root.render(
      <HashRouter>
        <AuthLanding desktop={false} />
        <LocationProbe />
      </HashRouter>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("APP style login landing", () => {
  it("asks for consent before opening the phone login form", async () => {
    const phone = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("手机注册 / 登录"),
    )!;
    await act(async () => phone.click());
    expect(document.querySelector("dialog")?.textContent).toContain(
      "同意后继续",
    );

    const accept = Array.from(
      document.querySelectorAll<HTMLButtonElement>("dialog button"),
    ).find((button) => button.textContent === "同意并继续")!;
    await act(async () => accept.click());
    expect(
      container.querySelector('[data-testid="location"]')?.textContent,
    ).toBe("/auth/register");
  });
});
