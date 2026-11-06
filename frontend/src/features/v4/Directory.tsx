import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { useReturnTo } from "../../app/navigation";
import { useArea } from "../../app/area";
import { useDebouncedSearch } from "../../app/search";
import { categories } from "../../api/models";
import { RestaurantCard } from "./Cards";
import { DesignIcon as Icon } from "../../mobile/ui";
import { Shell, Field, QueryView, Pager } from "./shared";
export default function Directory() {
  const returnTo = useReturnTo("/nearby");
  const [params, setParams] = useSearchParams();
  const setFilter = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        value ? next.set(key, value) : next.delete(key);
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  const keyword = params.get("q") ?? "",
    setKeyword = (value: string) => setFilter("q", value);
  const category = params.get("category") ?? "",
    setCategory = (value: string) => setFilter("category", value);
  const priceBand = params.get("price") ?? "",
    setPriceBand = (value: string) => setFilter("price", value);
  const recommendedOnly = params.get("recommended") === "1",
    setRecommended = (value: boolean) =>
      setFilter("recommended", value ? "1" : "");
  const favoritesOnly = params.get("favorites") === "1",
    setFavorites = (value: boolean) => setFilter("favorites", value ? "1" : "");
  const sort = params.get("sort") ?? "FOOD_COUNT",
    setSort = (value: string) => setFilter("sort", value);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const setPage = (value: number) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("page", String(value));
      return next;
    });
  const { api, session } = useApp(),
    { campusId, area } = useArea(),
    [expanded, setExpanded] = useState(false),
    search = useDebouncedSearch(keyword);
  const areaKey = JSON.stringify([campusId, area]),
    previousArea = useRef(areaKey);
  const areaChanged = previousArea.current !== areaKey;
  useEffect(() => {
    if (previousArea.current !== areaKey) {
      previousArea.current = areaKey;
      setPage(1);
    }
  }, [areaKey]);
  const query = {
    campusId,
    keyword: search || undefined,
    categories: category
      ? [category as Exclude<(typeof categories)[number]["id"], "">]
      : undefined,
    priceBand:
      (priceBand as "UNDER_15" | "FROM_15_TO_30" | "OVER_30") || undefined,
    recommendedOnly: recommendedOnly || undefined,
    favoritesOnly: favoritesOnly || undefined,
    sort: sort as "FOOD_COUNT" | "DISTANCE" | "NEWEST" | "RECOMMENDATION_RATE",
    page,
    pageSize: 12,
  };
  const q = useQuery({
    enabled: !areaChanged,
    queryKey: ["restaurants", "directory", query, area],
    queryFn: () =>
      area
        ? api.restaurantSearch({
            ...query,
            gcjLng: area.gcjLng,
            gcjLat: area.gcjLat,
          })
        : api.browseRestaurants(query),
  });
  function change(fn: () => void) {
    fn();
  }
  const active = [category, priceBand, recommendedOnly, favoritesOnly].filter(
    Boolean,
  ).length;
  return (
    <Shell
      title="找一家店"
      detail="选一份预算，挑一种心情，去找到合你口味的那一家。"
      back={returnTo}
    >
      <div className="v4-directory-layout">
        <aside
          className="v4-directory-filters"
          data-expanded={expanded || undefined}
        >
          <div className="v4-filter-heading">
            <span>
              <Icon name="filter" size={19} />
              挑一挑，更合胃口
            </span>
            <button
              type="button"
              className="v4-mobile-filter"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              筛选{active ? ` · ${active}` : ""}
              <Icon name="chevronDown" size={15} />
            </button>
          </div>
          <div className="v4-directory-search">
            <Field label="店名或招牌菜">
              <input
                aria-label="店名或招牌菜"
                value={keyword}
                onChange={(e) => change(() => setKeyword(e.target.value))}
                placeholder="店名、想吃的菜"
              />
            </Field>
            <Icon name="search" size={18} />
          </div>
          <div className="v4-filter-controls">
            <Field label="分类">
              <select
                value={category}
                onChange={(e) => change(() => setCategory(e.target.value))}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="价位">
              <select
                value={priceBand}
                onChange={(e) => change(() => setPriceBand(e.target.value))}
              >
                <option value="">全部价位</option>
                <option value="UNDER_15">15 元以下</option>
                <option value="FROM_15_TO_30">15–30 元</option>
                <option value="OVER_30">30 元以上</option>
              </select>
            </Field>
            <Field label="排序">
              <select
                value={sort}
                onChange={(e) => change(() => setSort(e.target.value))}
              >
                <option value="FOOD_COUNT">菜品多的优先</option>
                <option value="NEWEST">最新店铺</option>
                <option value="RECOMMENDATION_RATE">推荐率优先</option>
                {area && <option value="DISTANCE">距离优先</option>}
              </select>
            </Field>
            <div className="v4-filter-checks">
              <label className="v4-check">
                <input
                  type="checkbox"
                  checked={recommendedOnly}
                  onChange={(e) =>
                    change(() => setRecommended(e.target.checked))
                  }
                />
                只看推荐店铺
              </label>
              <label className="v4-check">
                <input
                  type="checkbox"
                  checked={favoritesOnly}
                  disabled={!session}
                  onChange={(e) => change(() => setFavorites(e.target.checked))}
                />
                只看我的收藏{!session && "（登录后可用）"}
              </label>
            </div>
            {!!active && (
              <button
                className="v4-filter-reset"
                onClick={() =>
                  setParams((previous) => {
                    const next = new URLSearchParams(previous);
                    for (const key of [
                      "category",
                      "price",
                      "recommended",
                      "favorites",
                      "page",
                    ])
                      next.delete(key);
                    return next;
                  })
                }
              >
                清空筛选
              </button>
            )}
            <div className="v4-filter-note">
              <Icon name="bowl" size={24} />
              <p>
                不着急，
                <br />
                好好挑一顿喜欢的。
              </p>
            </div>
          </div>
        </aside>
        <section className="v4-directory-results">
          <div className="v4-results-heading">
            <h2>值得去的一家店</h2>
            <span>
              {q.data?.totalItems != null
                ? `${q.data.totalItems} 家店铺`
                : "发现校园好味道"}
            </span>
          </div>
          <QueryView
            query={q}
            empty={!q.data?.items?.length}
            emptyTitle="这次还没找到合适的店"
            emptyDetail="换个关键词，或放宽一点分类和价位，再找找看。"
          >
            <div className="v4-restaurant-grid">
              {q.data?.items?.map((shop) => (
                <RestaurantCard shop={shop} key={shop.id} />
              ))}
            </div>
            <Pager page={page} hasNext={q.data?.hasNext} onChange={setPage} />
          </QueryView>
        </section>
      </div>
    </Shell>
  );
}
