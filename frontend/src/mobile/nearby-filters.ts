import { useQuery } from "@tanstack/react-query";
import { useArea } from "../app/area";
import { useApp } from "../app/state";
import { discoveryKinds } from "../app/discovery-category";
import { priceBands } from "../api/v2-vocab";

export type NearbyFilters = {
  kind: string;
  categories: string[];
  priceBand: string;
  recommendedOnly: boolean;
  favoritesOnly: boolean;
};

export const allShops: NearbyFilters = {
  kind: "",
  categories: [],
  priceBand: "",
  recommendedOnly: false,
  favoritesOnly: false,
};

export function readNearbyFilters(
  params: URLSearchParams,
  signedIn: boolean,
): NearbyFilters {
  return {
    kind: discoveryKinds.find((k) => k.id === params.get("kind"))?.id ?? "",
    categories: [...new Set(params.getAll("category").filter(Boolean))].sort(),
    priceBand: priceBands.find((p) => p.id === params.get("price"))?.id ?? "",
    recommendedOnly: params.get("recommended") === "1",
    favoritesOnly: signedIn && params.get("favorites") === "1",
  };
}

export function writeNearbyFilters(
  params: URLSearchParams,
  filters: NearbyFilters,
) {
  const next = new URLSearchParams(params);
  for (const key of [
    "filter",
    "kind",
    "category",
    "price",
    "recommended",
    "favorites",
  ])
    next.delete(key);
  if (filters.kind) next.set("kind", filters.kind);
  for (const category of filters.categories) next.append("category", category);
  if (filters.priceBand) next.set("price", filters.priceBand);
  if (filters.recommendedOnly) next.set("recommended", "1");
  if (filters.favoritesOnly) next.set("favorites", "1");
  return next;
}

export function hasNearbyFilters(filters: NearbyFilters) {
  return !!(
    filters.kind ||
    filters.categories.length ||
    filters.priceBand ||
    filters.recommendedOnly ||
    filters.favoritesOnly
  );
}

// The sheet previews the first page of the same search the map and list consume.
export function useNearbyShops(
  keyword: string,
  filters: NearbyFilters,
  page: number,
) {
  const { api, user, session } = useApp();
  const { area, ready } = useArea();
  const query = {
    keyword: keyword.trim() || undefined,
    kind: filters.kind || undefined,
    categories: filters.categories.length ? filters.categories : undefined,
    priceBand: filters.priceBand || undefined,
    recommendedOnly: filters.recommendedOnly || undefined,
    favoritesOnly: (!!session && filters.favoritesOnly) || undefined,
    sort: area ? "DISTANCE" : "NEWEST",
    hubId: area?.hubId,
    page,
    pageSize: 12,
  };
  return useQuery({
    queryKey: ["restaurants", "mobile-nearby", area, query, user?.id],
    queryFn: () =>
      area
        ? api.restaurantSearch({
            ...query,
            gcjLng: area.gcjLng,
            gcjLat: area.gcjLat,
          })
        : api.browseRestaurants(query),
    enabled: ready,
  });
}
