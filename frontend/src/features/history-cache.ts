import type { QueryFilters } from "@tanstack/react-query";

type HistoryKind = "food" | "restaurant";

function historyQueryKind(key: readonly unknown[]): HistoryKind | undefined {
  const value =
    key[1] === "desktop" || key[1] === "mobile-v2" ? key[2] : key[1];
  if (value === "food" || value === "dish") return "food";
  if (value === "restaurant" || value === "shop") return "restaurant";
  return undefined;
}

/** Keep category-specific clearing aligned with the server's targetType. */
export function historyCacheFilters(kind?: HistoryKind): QueryFilters {
  return {
    queryKey: ["history"],
    ...(kind
      ? { predicate: (query) => historyQueryKind(query.queryKey) === kind }
      : {}),
  };
}

export function emptyHistoryCache(previous: unknown) {
  if (!previous || typeof previous !== "object" || Array.isArray(previous))
    return undefined;
  return {
    ...previous,
    items: [],
    currentPage: 1,
    totalItems: 0,
    totalPages: 0,
    hasNext: false,
  };
}
