// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  DishAvailabilityFields,
  availabilityText,
  sameMealTimes,
  type DishAvailability,
} from "./DishAvailability";

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const render = (
  value: DishAvailability,
  onChange: (v: DishAvailability) => void,
) =>
  act(async () =>
    root.render(<DishAvailabilityFields value={value} onChange={onChange} />),
  );
const box = (name: string) =>
  [...host.querySelectorAll("label")]
    .find((l) => l.textContent === name)!
    .querySelector("input")!;

it("follows the shop until a meal time is picked, and back when cleared", async () => {
  const onChange = vi.fn();
  await render({ mealTimes: [], deliveryEnabled: false }, onChange);
  expect(box("跟随店铺").checked).toBe(true);
  await act(async () => box("晚饭").click());
  expect(onChange).toHaveBeenLastCalledWith({
    mealTimes: ["dinner"],
    deliveryEnabled: false,
  });

  await render({ mealTimes: ["dinner"], deliveryEnabled: false }, onChange);
  expect(box("跟随店铺").checked).toBe(false);
  await act(async () => box("下午茶").click());
  expect(onChange).toHaveBeenLastCalledWith({
    mealTimes: ["afternoon_tea", "dinner"],
    deliveryEnabled: false,
  });
  await act(async () => box("早饭").click());
  expect(onChange).toHaveBeenLastCalledWith({
    mealTimes: ["breakfast", "dinner"],
    deliveryEnabled: false,
  });
  await act(async () => box("跟随店铺").click());
  expect(onChange).toHaveBeenLastCalledWith({
    mealTimes: [],
    deliveryEnabled: false,
  });
  await act(async () => box("这道菜可以点外卖").click());
  expect(onChange).toHaveBeenLastCalledWith({
    mealTimes: ["dinner"],
    deliveryEnabled: true,
  });
});

it("describes when a dish is served and whether it delivers", () => {
  expect(
    availabilityText({
      effectiveMealTimes: ["breakfast"],
      deliveryEnabled: true,
    }),
  ).toBe("早饭供应 · 可外卖");
  expect(
    availabilityText({
      effectiveMealTimes: ["breakfast", "lunch", "afternoon_tea", "dinner", "night"],
      deliveryEnabled: false,
    }),
  ).toBe("仅堂食");
  // Responses without the v2 fields say nothing.
  expect(availabilityText({})).toBe("");
  expect(sameMealTimes(["dinner", "lunch"], ["lunch", "dinner"])).toBe(true);
  expect(sameMealTimes([], ["lunch"])).toBe(false);
});
