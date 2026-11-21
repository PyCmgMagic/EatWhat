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
  it.each(["pointerup", "pointercancel"])(
    "settles a short pull on %s without following the browse link",
    async (end) => {
      const link = container.querySelector<HTMLAnchorElement>(
        ".auth-landing-browse",
      )!;
      const paper = link.querySelector<SVGGElement>(".auth-page-curl-paper")!;
      vi.spyOn(link, "getBoundingClientRect").mockReturnValue(
        new DOMRect(150, 0, 240, 190),
      );
      link.setPointerCapture = vi.fn();
      const pointer = (type: string, x: number, y: number) =>
        link.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            pointerId: 1,
            isPrimary: true,
            pointerType: "mouse",
            clientX: x,
            clientY: y,
          }),
        );
      pointer("pointerdown", 300, 60);
      pointer("pointermove", 280, 76);
      expect(paper.style.transform).toContain("scale(");
      pointer(end, 280, 76);
      expect(paper.style.transform).toBe("");
      const click = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        detail: 1,
      });
      await act(async () => {
        link.dispatchEvent(click);
      });
      expect(click.defaultPrevented).toBe(true);
      expect(window.location.hash).toBe("#/auth");
      await act(async () => link.click());
      expect(window.location.hash).toBe("#/");
    },
  );

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
