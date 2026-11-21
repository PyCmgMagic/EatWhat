import { expect, it } from "vitest";
import {
  foodEditBody,
  restaurantEditBody,
  foodPrice,
  validateFoodDraft,
  boundedText,
  normalizedTag,
} from "./content-rules";
it("counts Unicode code points and validates normalized personal tags", () => {
  expect(boundedText("  " + "🍜".repeat(12) + "  ", 12, "菜名")).toBe(
    "🍜".repeat(12),
  );
  expect(() => boundedText("🍜".repeat(13), 12, "菜名")).toThrow();
  expect(normalizedTag("  麻辣\n  鲜香 ")).toBe("麻辣 鲜香");
  expect(() =>
    validateFoodDraft({
      name: "菜",
      description: "文".repeat(301),
      price: 1,
      tags: [],
    }),
  ).toThrow();
  expect(() =>
    validateFoodDraft({
      name: "菜",
      description: "",
      price: 1,
      tags: ["字".repeat(11)],
    }),
  ).toThrow();
});
it("requires a price and accepts only the v4 effective decimal precision", () => {
  for (const v of ["", null, undefined, -1, 1000, 0.01, 12.34, "NaN"])
    expect(() => foodPrice(v)).toThrow();
  for (const v of [0, 999, 12.3, "12.300", "0.1"])
    expect(foodPrice(v)).toBe(Number(v));
});
it("keeps unchanged historical over-limit values and image references out of edit patches", () => {
  const old = {
    name: "旧".repeat(40),
    description: "长".repeat(1000),
    price: 10000.25,
    pictureUrl: ["https://old.example/1", "https://old.example/2"],
  };
  expect(foodEditBody(old, { ...old })).toEqual({});
  expect(foodEditBody(old, { description: "" })).toEqual({ description: "" });
  expect(() => foodEditBody(old, { name: "新".repeat(13) })).toThrow();
  expect(() =>
    foodEditBody(old, { pictureUrl: ["https://old.example/replacement"] }),
  ).toThrow();
  expect(
    restaurantEditBody(old, {
      name: old.name,
      address: "新地址",
      pictureUrl: old.pictureUrl,
    }),
  ).toEqual({ address: "新地址" });
  expect(() =>
    restaurantEditBody(old, { pictureUrl: ["restaurants/a", "restaurants/b"] }),
  ).toThrow();
});

it("accepts 50 address code points, rejects 51 and preserves unchanged historical values", () => {
  const address = "𠮷".repeat(50);
  expect(restaurantEditBody({}, { address })).toEqual({ address });
  const longer = address + "号";
  expect(() => restaurantEditBody({}, { address: longer })).toThrow("50");
  expect(restaurantEditBody({ address: longer }, { address: longer })).toEqual(
    {},
  );
});

it("lets a dish be shared without a price but still checks one that is given", () => {
  const draft = { name: "牛肉面", description: "", tags: [] };
  expect(() => validateFoodDraft({ ...draft, price: "" })).not.toThrow();
  expect(() => validateFoodDraft({ ...draft, price: "  " })).not.toThrow();
  expect(() => validateFoodDraft({ ...draft, price: "18.5" })).not.toThrow();
  expect(() => validateFoodDraft({ ...draft, price: "18.55" })).toThrow();
  expect(() => validateFoodDraft({ ...draft, price: "-1" })).toThrow();
});
