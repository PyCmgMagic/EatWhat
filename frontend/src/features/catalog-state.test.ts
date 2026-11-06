import { describe, expect, it } from "vitest";
import {
  budgetError,
  catalogFilters,
  changeCatalogMode,
} from "./catalog-state";

describe("catalog navigation filters", () => {
  it("can search restaurants after an invalid dish budget, preserving keyword and area", () => {
    const original = new URLSearchParams(
      "q=云吞&hub=3&min=20&max=10&category=staple&sort=POPULAR&tag=101&page=4",
    );
    expect(budgetError(catalogFilters(original, "food"))).toBeTruthy();
    const next = changeCatalogMode(original, "shop");
    expect(Object.fromEntries(next)).toEqual({
      q: "云吞",
      hub: "3",
      type: "shop",
    });
    expect(catalogFilters(next, "shop")).toEqual({ keyword: "云吞", hubId: 3 });
    expect(budgetError(catalogFilters(next, "shop"))).toBeUndefined();
  });

  it("ignores inapplicable dish filters in directly opened restaurant links", () => {
    const params = new URLSearchParams(
      "type=shop&min=-2&max=NaN&tag=101&sort=POPULAR",
    );
    expect(catalogFilters(params, "shop")).toEqual({
      keyword: undefined,
      hubId: undefined,
    });
    expect(budgetError(catalogFilters(params, "shop"))).toBeUndefined();
  });

  it("a clean favorites URL always represents all tags", () => {
    expect(
      catalogFilters(new URLSearchParams("tag=101"), "food").myCustomTagIds,
    ).toEqual([101]);
    expect(
      catalogFilters(new URLSearchParams(), "food").myCustomTagIds,
    ).toBeUndefined();
    expect(
      catalogFilters(new URLSearchParams("tag=invalid"), "food").myCustomTagIds,
    ).toBeUndefined();
  });

  it("distinguishes malformed/negative prices from reversed ranges and accepts zero", () => {
    expect(budgetError({ minPrice: -1 })).toContain("大于或等于 0");
    expect(budgetError({ maxPrice: NaN })).toContain("大于或等于 0");
    expect(budgetError({ minPrice: 20, maxPrice: 10 })).toContain(
      "最低价格不能高于最高价格",
    );
    expect(budgetError({ minPrice: 0, maxPrice: 0 })).toBeUndefined();
  });
});
