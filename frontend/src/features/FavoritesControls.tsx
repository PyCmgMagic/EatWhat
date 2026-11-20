import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Search, SlidersHorizontal } from "lucide-react";
import { Select } from "../components/Select";
import { categories } from "../api/models";
import type { FoodFilters } from "../api/service";
import { useArea } from "../app/area";
import { DesignIcon as Icon, useMobile } from "../mobile/ui";
import { DishIllustration } from "../components/DishIllustration";
import "./favorites.css";

export function FavoritesFilters({
  filters,
  apply,
  reset,
  mode = "favorites",
}: {
  filters: FoodFilters;
  apply: (patch: Record<string, string | undefined>) => void;
  reset: () => void;
  mode?: "favorites" | "food" | "shop";
}) {
  const { area } = useArea();
  const { openPanel } = useMobile();
  const favorites = mode === "favorites",
    food = mode !== "shop";
  const budgetActive = filters.minPrice != null || filters.maxPrice != null;
  const count =
    Number(food && budgetActive) +
    Number(!!filters.hubId) +
    Number(!!filters.category);
  const [expanded, setExpanded] = useState(count > 0);
  const panelId = useId();
  return (
    <form
      className={`favorites-filters${favorites ? "" : " catalog-filters"}`}
      aria-label={favorites ? "筛选收藏" : "搜索筛选"}
      onInvalidCapture={(event) => {
        const input = event.target;
        if (
          !expanded &&
          input instanceof HTMLInputElement &&
          input.closest(".favorites-advanced")
        ) {
          event.preventDefault();
          setExpanded(true);
          requestAnimationFrame(() => input.reportValidity());
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        apply({
          q: String(data.get("q") || "").trim(),
          category: food ? String(data.get("category") || "") : undefined,
          min: food ? String(data.get("min") || "") : undefined,
          max: food ? String(data.get("max") || "") : undefined,
          hub:
            data.has("region") && area?.hubId ? String(area.hubId) : undefined,
        });
      }}
    >
      <div className="favorites-search-row">
        <label className="favorites-search">
          <Search size={17} aria-hidden="true" />
          <input
            name="q"
            aria-label={
              favorites ? "搜索收藏的菜品" : food ? "搜索菜名" : "搜索店名"
            }
            defaultValue={filters.keyword}
            placeholder={
              favorites
                ? "搜索收藏菜品…"
                : food
                  ? "例如：云吞、麻辣香锅"
                  : "输入店铺名称"
            }
            maxLength={64}
          />
          {favorites && (
            <button
              type="submit"
              className="ew-button favorites-inline-submit"
              aria-label="搜索收藏"
            >
              搜索
            </button>
          )}
        </label>
        <button
          type="button"
          className="favorites-filter-toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
        >
          <SlidersHorizontal size={15} aria-hidden="true" />
          筛选{count > 0 && <span>{count}</span>}
        </button>
        {!favorites && (
          <>
            <button className="ew-button favorites-search-submit">搜索</button>
            <button
              type="button"
              className="favorites-reset catalog-reset"
              onClick={reset}
            >
              重置
            </button>
          </>
        )}
      </div>
      <div className="favorites-advanced" id={panelId} hidden={!expanded}>
        {food && (
          <label className="catalog-category">
            <span>菜品分类</span>
            <Select
              name="category"
              aria-label="菜品分类"
              defaultValue={filters.category}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.id ? category.label : "全部分类"}
                </option>
              ))}
            </Select>
          </label>
        )}
        {food && (
          <fieldset className="favorites-budget">
            <legend>价格范围</legend>
            <div>
              <label>
                <span className="favorites-sr-only">最低价格</span>
                <input
                  name="min"
                  type="number"
                  min="0"
                  max="999999.99"
                  step="0.01"
                  defaultValue={filters.minPrice}
                  placeholder="¥ 最低"
                />
              </label>
              <span aria-hidden="true">—</span>
              <label>
                <span className="favorites-sr-only">最高价格</span>
                <input
                  name="max"
                  type="number"
                  min="0"
                  max="999999.99"
                  step="0.01"
                  defaultValue={filters.maxPrice}
                  placeholder="¥ 最高"
                />
              </label>
            </div>
          </fieldset>
        )}
        <div className="favorites-region">
          <span>所在区域</span>
          <div className="ew-region-filter">
            <button type="button" onClick={() => openPanel("G-PanelPlace")}>
              <Icon name="nearby" size={16} />
              {area?.name ?? "选择区域"}
            </button>
            <label>
              <input
                type="checkbox"
                name="region"
                defaultChecked={!!filters.hubId}
                disabled={!area?.hubId}
              />
              仅所选区域
            </label>
          </div>
        </div>
        {favorites && (
          <div className="favorites-advanced-actions">
            <button type="button" className="favorites-reset" onClick={reset}>
              重置筛选
            </button>
            <button type="submit" className="ew-button favorites-apply-submit">
              应用筛选
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

export function FavoritesEmpty({
  filtered,
  reset,
}: {
  filtered: boolean;
  reset: () => void;
}) {
  return (
    <div className="favorites-empty" role="status">
      <div className="favorites-empty-copy">
        <h2>{filtered ? "没有找到这道心头好" : "把喜欢的味道，留给下一餐"}</h2>
        <p>
          {filtered
            ? "换个关键词，或放宽筛选条件，再找找看。"
            : "遇到想吃的菜，点一下收藏，下次就能在这里找到。"}
        </p>
        <div className="favorites-empty-actions">
          {filtered ? (
            <button type="button" className="ew-button" onClick={reset}>
              清除筛选
            </button>
          ) : (
            <>
              <Link className="ew-button" to="/">
                去发现好吃的
                <Icon name="chevronRight" size={16} />
              </Link>
              <Link
                className="favorites-empty-secondary"
                to="/restaurants/favorites"
              >
                看看我的餐厅收藏
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="favorites-empty-art" aria-hidden="true">
        <DishIllustration name="yangzhi" />
        <span>
          <Bookmark size={23} />
        </span>
      </div>
    </div>
  );
}
