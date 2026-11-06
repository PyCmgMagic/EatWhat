import { parseId } from "../api/models";
import type { FoodFilters } from "../api/service";

export type CatalogMode = "food" | "shop";

/** Only the address describes an applied filter; page-local drafts stay separate. */
export function catalogFilters(
  params: URLSearchParams,
  mode: CatalogMode,
): FoodFilters {
  const tag =
    mode === "food" ? parseId(params.get("tag") ?? undefined) : undefined;
  return {
    keyword: params.get("q")?.trim() || undefined,
    hubId: parseId(params.get("hub") ?? undefined),
    ...(mode === "food"
      ? {
          category: params.get("category") || undefined,
          minPrice: params.has("min") ? Number(params.get("min")) : undefined,
          maxPrice: params.has("max") ? Number(params.get("max")) : undefined,
          sort: params.get("sort") || undefined,
          myCustomTagIds: tag ? [tag] : undefined,
        }
      : {}),
  };
}

export function budgetError(filters: FoodFilters): string | undefined {
  if (
    [filters.minPrice, filters.maxPrice].some(
      (value) => value != null && (!Number.isFinite(value) || value < 0),
    )
  )
    return "价格需要是大于或等于 0 的数字，请调整预算";
  if (
    filters.minPrice != null &&
    filters.maxPrice != null &&
    filters.minPrice > filters.maxPrice
  )
    return "最低价格不能高于最高价格，请调整预算";
}

export function changeCatalogMode(params: URLSearchParams, mode: CatalogMode) {
  const next = new URLSearchParams();
  // Keywords and area mean the same thing for dishes and restaurants.
  for (const key of ["q", "hub"]) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  if (mode === "shop") next.set("type", "shop");
  return next;
}
