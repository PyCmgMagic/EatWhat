import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { emptyHistoryCache, historyCacheFilters } from "./history-cache";

const foodKeys = [
  ["history", "desktop", "food", 2],
  ["history", "mobile-v2", "food", 1],
  ["history", "food", 1],
  ["history", "dish", 1],
];
const restaurantKeys = [
  ["history", "desktop", "restaurant", 2],
  ["history", "mobile-v2", "restaurant", 1],
  ["history", "restaurant", 1],
  ["history", "shop", 1],
];
const page = {
  items: [{ targetId: 7 }],
  currentPage: 2,
  totalItems: 15,
  totalPages: 2,
  hasNext: true,
};

describe("history clearing cache scope", () => {
  it.each(["food", "restaurant"] as const)(
    "only resets %s across desktop, mobile and legacy query keys",
    async (kind) => {
      const cache = new QueryClient();
      const selected = kind === "food" ? foodKeys : restaurantKeys;
      const untouched = kind === "food" ? restaurantKeys : foodKeys;
      for (const key of [...foodKeys, ...restaurantKeys])
        cache.setQueryData(key, { ...page, kind: key[2] });
      cache.setQueryData(["foods", "history", 1], page);
      cache.setQueryData(["history", "unknown", 1], page);
      const filters = historyCacheFilters(kind);
      cache.setQueriesData(filters, emptyHistoryCache);
      await cache.invalidateQueries({ ...filters, refetchType: "none" });
      for (const key of selected) {
        expect(cache.getQueryData(key)).toEqual({
          ...page,
          kind: key[2],
          items: [],
          currentPage: 1,
          totalItems: 0,
          totalPages: 0,
          hasNext: false,
        });
        expect(cache.getQueryState(key)?.isInvalidated).toBe(true);
      }
      for (const key of untouched) {
        expect(cache.getQueryData(key)).toEqual({ ...page, kind: key[2] });
        expect(cache.getQueryState(key)?.isInvalidated).toBe(false);
      }
      expect(cache.getQueryData(["foods", "history", 1])).toEqual(page);
      expect(cache.getQueryData(["history", "unknown", 1])).toEqual(page);
      cache.removeQueries({ ...filters, type: "inactive" });
      expect(
        selected.every((key) => cache.getQueryData(key) === undefined),
      ).toBe(true);
      expect(
        untouched.every((key) => cache.getQueryData(key) !== undefined),
      ).toBe(true);
      cache.clear();
    },
  );

  it("clears every history category for all scope, without touching other data", () => {
    const cache = new QueryClient();
    for (const key of [...foodKeys, ...restaurantKeys, ["history", "other", 1]])
      cache.setQueryData(key, page);
    cache.setQueryData(["foods", 7], { name: "一道菜" });
    cache.removeQueries(historyCacheFilters());
    expect(cache.getQueriesData({ queryKey: ["history"] })).toEqual([]);
    expect(cache.getQueryData(["foods", 7])).toEqual({ name: "一道菜" });
    cache.clear();
  });

  it("does not manufacture successful empty data for a query that has never loaded", () => {
    expect(emptyHistoryCache(undefined)).toBeUndefined();
    expect(emptyHistoryCache(null)).toBeUndefined();
  });
});
