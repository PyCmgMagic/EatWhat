import { useEffect, useState } from "react";

export type SearchKind = "food" | "shop";
export type RecentSearch = { query: string; kind: SearchKind };

const recentSearchKey = "eatwhat-recent-searches-v1";
export const searchSuggestions = ["云吞", "麻辣香锅", "杨枝甘露"];

export function recentSearchId({ query, kind }: RecentSearch) {
  return `${kind}:${query}`;
}

export function readRecentSearches(fallback: RecentSearch[] = []) {
  try {
    const stored = JSON.parse(localStorage.getItem(recentSearchKey) ?? "[]");
    if (!Array.isArray(stored)) return [];
    const entries = new Map<string, RecentSearch>();
    for (const item of stored) {
      const query = typeof item?.query === "string" ? item.query.trim() : "";
      if (!query) continue;
      const entry: RecentSearch = {
        query,
        kind: item.kind === "shop" ? "shop" : "food",
      };
      const id = recentSearchId(entry);
      if (!entries.has(id)) entries.set(id, entry);
      if (entries.size === 5) break;
    }
    return [...entries.values()];
  } catch {
    return fallback;
  }
}

export function writeRecentSearches(entries: RecentSearch[]) {
  try {
    if (entries.length)
      localStorage.setItem(recentSearchKey, JSON.stringify(entries));
    else localStorage.removeItem(recentSearchKey);
  } catch {
    // Search remains available when storage is blocked.
  }
}

export function rememberSearch(entry: RecentSearch, fallback: RecentSearch[]) {
  const id = recentSearchId(entry);
  const next = [
    entry,
    ...readRecentSearches(fallback).filter(
      (item) => recentSearchId(item) !== id,
    ),
  ].slice(0, 5);
  writeRecentSearches(next);
  return next;
}

export function searchResultPath({ query, kind }: RecentSearch) {
  return `/search?q=${encodeURIComponent(query)}${kind === "shop" ? "&type=shop" : ""}`;
}

// Keep typing immediate; only the network keyword waits for a pause.
export function useDebouncedSearch(value: string, delay = 250) {
  const [committed, setCommitted] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setCommitted(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return value === "" ? "" : committed;
}
