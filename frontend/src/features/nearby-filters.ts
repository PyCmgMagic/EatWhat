import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useArea } from "../app/area";
import { useDebouncedSearch } from "../app/search";
import { useApp } from "../app/state";
import { discoveryKinds } from "../app/discovery-category";
import { priceBands } from "../api/v2-vocab";

export type NearbyFilters = {
  kind: string;
  categories: string[];
  priceBand: string;
  newestFirst: boolean;
  recommendedOnly: boolean;
  favoritesOnly: boolean;
};

export const allShops: NearbyFilters = {
  kind: "",
  categories: [],
  priceBand: "",
  newestFirst: false,
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
    newestFirst: params.get("sort") === "NEWEST",
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
    "sort",
    "recommended",
    "favorites",
  ])
    next.delete(key);
  if (filters.kind) next.set("kind", filters.kind);
  for (const category of filters.categories) next.append("category", category);
  if (filters.priceBand) next.set("price", filters.priceBand);
  if (filters.newestFirst) next.set("sort", "NEWEST");
  if (filters.recommendedOnly) next.set("recommended", "1");
  if (filters.favoritesOnly) next.set("favorites", "1");
  return next;
}

export function hasNearbyFilters(filters: NearbyFilters) {
  return !!(
    filters.kind ||
    filters.categories.length ||
    filters.priceBand ||
    filters.newestFirst ||
    filters.recommendedOnly ||
    filters.favoritesOnly
  );
}

// The sheet previews the first page of the same search the map and list consume.
export function useNearbyShops(
  keyword: string,
  filters: NearbyFilters,
  page: number,
  pageSize = 12,
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
    sort: area && !filters.newestFirst ? "DISTANCE" : "NEWEST",
    hubId: area?.hubId,
    page,
    pageSize,
  };
  return useQuery({
    queryKey: ["restaurants", "nearby", area, query, user?.id],
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

export function useNearbyBrowse(pageSize = 12) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useApp();
  const { area } = useArea();
  const areaKey = JSON.stringify(area);
  const previousArea = useRef(areaKey);
  const keyword = params.get("q") ?? "";
  const committedKeyword = useDebouncedSearch(keyword);
  const filters = readNearbyFilters(params, !!session);
  const requestedPage = Number(params.get("page"));
  const page =
    areaKey === previousArea.current && Number.isSafeInteger(requestedPage)
      ? Math.max(1, requestedPage)
      : 1;
  const shops = useNearbyShops(committedKeyword, filters, page, pageSize);
  function update(next: URLSearchParams) {
    setParams(next, {
      replace: true,
      state: { ...location.state, preserveScroll: true },
    });
  }
  useEffect(() => {
    if (areaKey === previousArea.current) return;
    previousArea.current = areaKey;
    if (params.has("page") || params.has("selected")) {
      const next = new URLSearchParams(params);
      next.delete("page");
      next.delete("selected");
      update(next);
    }
  }, [areaKey]);
  function changeKeyword(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    next.delete("page");
    update(next);
  }
  function setPage(value: number) {
    const next = new URLSearchParams(params);
    if (value > 1) next.set("page", String(value));
    else next.delete("page");
    update(next);
  }
  function openFilters() {
    const next = new URLSearchParams(params);
    next.set("filter", "1");
    setParams(next, {
      state: {
        ...location.state,
        nearbyFilterEntry: true,
        preserveScroll: true,
      },
    });
  }
  function closeFilters() {
    if (location.state?.nearbyFilterEntry) {
      navigate(-1);
    } else {
      const next = new URLSearchParams(params);
      next.delete("filter");
      update(next);
    }
  }
  function apply(draft: NearbyFilters) {
    const next = writeNearbyFilters(params, draft);
    if (next.toString() === writeNearbyFilters(params, filters).toString()) {
      closeFilters();
      return;
    }
    next.delete("page");
    setParams(next, {
      replace: true,
      state: {
        ...location.state,
        nearbyFilterEntry: false,
        preserveScroll: true,
      },
    });
  }
  return {
    shops,
    keyword,
    committedKeyword,
    filters,
    page,
    setPage,
    changeKeyword,
    open: params.get("filter") === "1",
    openFilters,
    closeFilters,
    apply,
  };
}
