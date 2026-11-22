import { useSearchParams } from "react-router-dom";
import type { Restaurant } from "../api/models";
import { shopKinds, type RecommendScene, type V2Shop } from "../api/v2-vocab";
export const discoveryKinds = shopKinds;
export type DiscoveryKind = (typeof discoveryKinds)[number]["id"];
export type DiscoverySort = "recommended" | "distance" | "rating";

/** Reorder the current batch without consuming another recommendation or changing the hero. */
export function sortRecommendedShops(
  shops: (Restaurant & V2Shop)[],
  sort: DiscoverySort,
  scene: RecommendScene,
) {
  if (sort === "recommended") return shops;
  if (sort === "distance") {
    return [...shops].sort(
      (a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
    );
  }
  const key = scene === "delivery" ? "delivery" : "dineIn";
  return [...shops].sort((a, b) => {
    const left = a[key],
      right = b[key];
    const leftRate = left?.count ? (left.rate ?? -1) : -1;
    const rightRate = right?.count ? (right.rate ?? -1) : -1;
    return rightRate - leftRate || (right?.count ?? 0) - (left?.count ?? 0);
  });
}

/** Keep the selected feed in the return address when discovery unmounts. */
export function useDiscoveryFilters() {
  const [params, setParams] = useSearchParams();
  const value = params.get("category");
  const kind = discoveryKinds.find(({ id }) => id === value)?.id ?? "food";
  const rawSort = params.get("sort");
  const sort =
    rawSort === "distance" || rawSort === "rating" ? rawSort : "recommended";
  function setFilter(key: string, value: string | null) {
    if (params.get(key) === value) return;
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (value) updated.set(key, value);
        else updated.delete(key);
        return updated;
      },
      { replace: true, state: { preserveScroll: true } },
    );
  }
  return {
    kind,
    setKind: (next: DiscoveryKind) =>
      setFilter("category", next === "food" ? null : next),
    sort,
    setSort: (next: DiscoverySort) =>
      setFilter("sort", next === "recommended" ? null : next),
  } as const;
}
