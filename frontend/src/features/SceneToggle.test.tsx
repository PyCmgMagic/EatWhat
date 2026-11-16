// @vitest-environment jsdom
import { useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SceneToggle } from "./SceneToggle";
import type { RecommendScene } from "../api/v2-vocab";

let root: Root, host: HTMLDivElement;
const onChange = vi.fn();

function Harness({ initial }: { initial: RecommendScene }) {
  const [value, setValue] = useState<RecommendScene>(initial);
  return (
    <SceneToggle
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

const radios = () => [
  ...host.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
];
const thumb = () => host.querySelector<HTMLElement>(".ew-scene-thumb");
const key = (target: HTMLElement, name: string) =>
  act(async () =>
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: name, bubbles: true }),
    ),
  );

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no layout, and no ResizeObserver to re-measure on resizes.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  onChange.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function render(initial: RecommendScene) {
  await act(async () => root.render(<Harness initial={initial} />));
}

it("exposes a radiogroup with only the selected option in the tab order", async () => {
  await render("dine_in");
  const group = host.querySelector('[role="radiogroup"]');
  expect(group?.getAttribute("aria-label")).toBe("堂食还是外卖");
  const [dineIn, delivery] = radios();
  expect([dineIn.textContent, delivery.textContent]).toEqual(["堂食", "外卖"]);
  expect(dineIn.getAttribute("aria-checked")).toBe("true");
  expect(delivery.getAttribute("aria-checked")).toBe("false");
  expect(dineIn.tabIndex).toBe(0);
  expect(delivery.tabIndex).toBe(-1);
  // The moving pill is decoration; screen readers only hear the options.
  expect(thumb()?.getAttribute("aria-hidden")).toBe("true");
  expect(
    host.querySelector(".ew-scene-toggle")?.getAttribute("data-thumb-ready"),
  ).toBe("true");
});

it("switches scene with the arrow keys and wraps around", async () => {
  await render("dine_in");
  const [dineIn, delivery] = radios();
  dineIn.focus();
  await key(dineIn, "ArrowRight");
  expect(onChange).toHaveBeenLastCalledWith("delivery");
  expect(document.activeElement).toBe(delivery);
  expect(delivery.getAttribute("aria-checked")).toBe("true");
  await key(delivery, "ArrowRight");
  expect(onChange).toHaveBeenLastCalledWith("dine_in");
  expect(document.activeElement).toBe(dineIn);
  await key(dineIn, "End");
  expect(onChange).toHaveBeenLastCalledWith("delivery");
  await key(delivery, "Home");
  expect(onChange).toHaveBeenLastCalledWith("dine_in");
  await key(dineIn, "ArrowUp");
  expect(onChange).toHaveBeenLastCalledWith("delivery");
});

it("ignores keys and clicks that would not change the scene", async () => {
  await render("dine_in");
  const [dineIn] = radios();
  await act(async () => dineIn.click());
  expect(onChange).not.toHaveBeenCalled();
  await key(dineIn, "Home");
  expect(onChange).not.toHaveBeenCalled();
  expect(dineIn.getAttribute("aria-checked")).toBe("true");
});

it("notifies once when the other option is clicked", async () => {
  await render("dine_in");
  const [, delivery] = radios();
  await act(async () => delivery.click());
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith("delivery");
  expect(delivery.getAttribute("aria-checked")).toBe("true");
});
