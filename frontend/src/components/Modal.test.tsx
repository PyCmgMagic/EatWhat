// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it } from "vitest";
import { Modal } from "./ui";

let root: Root, host: HTMLDivElement;
const html = document.documentElement;

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
  // A 15px classic scrollbar, kept while locked only if a gutter is reserved.
  Object.defineProperty(html, "clientWidth", {
    configurable: true,
    get: () =>
      html.style.overflow === "hidden" &&
      html.style.scrollbarGutter !== "stable"
        ? window.innerWidth
        : window.innerWidth - 15,
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  html.style.scrollbarGutter = "";
});

async function open(trigger?: HTMLElement) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <Modal title="确认" onClose={() => {}} returnFocus={trigger}>
          <p>内容</p>
        </Modal>
      </MemoryRouter>,
    ),
  );
}

it("locks scrolling on <html> and keeps the reserved gutter, then restores", async () => {
  html.style.scrollbarGutter = "stable";
  const trigger = document.createElement("button");
  document.body.append(trigger);
  await open(trigger);
  expect(html.style.overflow).toBe("hidden");
  // The gutter stays reserved, so no padding is added and the page keeps its width.
  expect(document.body.style.paddingRight).toBe("");
  await act(async () => root.render(<></>));
  expect(html.style.overflow).toBe("");
  // Focus goes back to what opened the dialog, not to a page container.
  expect(document.activeElement).toBe(trigger);
  trigger.remove();
});

it("pads back the scrollbar width the lock removed (Safari)", async () => {
  await open();
  expect(document.body.style.paddingRight).toBe("15px");
  await act(async () => root.render(<></>));
  expect(document.body.style.paddingRight).toBe("");
});
