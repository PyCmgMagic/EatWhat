import { Select } from "../components/Select";
import { useContext, useRef, useState, type ReactNode } from "react";
import {
  Link,
  useSearchParams,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  useQuery,
  keepPreviousData,
  useQueryClient,
} from "@tanstack/react-query";
import { useApp } from "../app/state";

import {
  categories,
  mediaUrl,
  money,
  type Food,
  type Restaurant,
  type Page,
} from "../api/models";
import {
  budgetError,
  catalogFilters,
  changeCatalogMode,
} from "./catalog-state";
import { DesignIcon as Icon, useMobile } from "../mobile/ui";
import { visualFor } from "../mobile/catalog";
import { isDemo } from "../app/runtime";
import { errorMessage } from "../api/client";
import { useActionAccess } from "./access";
import "./latest.css";
import { useFoodImageRefresh } from "./media";
import { useContentMotion } from "../motion/hooks";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { AccessWelcome } from "../components/AccessWelcome";
import { FavoritesEmpty, FavoritesFilters } from "./FavoritesControls";
import { ProfileSectionNav } from "./ProfileSectionNav";
import { ProfileWorkspaceContext } from "../app/profile-workspace";
import { useTask } from "../components/useTask";

export function FeaturePage({
  title,
  children,
  back = "/me",
}: {
  title: string;
  children: ReactNode;
  back?: string;
}) {
  return (
    <div className="ew-feature">
      <header className="ew-head">
        <Link to={back}>
          <Icon name="back" size={18} />
          返回
        </Link>
        <h1>{title}</h1>
      </header>
      {children}
    </div>
  );
}
export function FeatureState({
  error,
  loading,
  empty,
  retry,
  kind = "form",
}: {
  error?: unknown;
  loading?: boolean;
  empty?: string;
  retry?: () => void;
  kind?: "cards" | "rows" | "form";
}) {
  if (loading)
    return <ContentSkeleton kind={kind} count={kind === "form" ? 3 : 6} />;
  return (
    <div className="ew-state" role={error ? "alert" : "status"}>
      <Icon name="bowl" size={30} />
      <h2>{error ? "暂时没有加载成功" : empty || "还没有内容"}</h2>
      {!!error && <p>{errorMessage(error)}</p>}
      {!!error && retry && (
        <button className="ew-button light" onClick={retry}>
          重新加载
        </button>
      )}
    </div>
  );
}
export function FoodManage({ food }: { food: Food }) {
  const { user, api, toast } = useApp(),
    m = useMobile(),
    access = useActionAccess(),
    loc = useLocation(),
    cache = useQueryClient(),
    nav = useNavigate();
  if (!user?.verified || user.id !== food.accountId || !food.id) return null;
  return (
    <div className="ew-food-manage">
      <Link to={`/foods/${food.id}/edit`}>编辑菜品</Link>
      <button
        onClick={() => {
          if (access(true))
            m.confirm(
              `删除「${food.name ?? "这道菜"}」？删除后无法从前台恢复。`,
              async () => {
                await api.deleteMyFood(food.id!);
                toast("菜品已删除");
                if (loc.pathname === `/foods/${food.id}`) nav("/me/shares");
                cache.removeQueries({
                  queryKey: ["foods", "detail", food.id],
                  exact: true,
                });
                await Promise.all(
                  ["foods", "user", "my-tags", "history"].map((key) =>
                    cache.invalidateQueries({ queryKey: [key] }),
                  ),
                );
              },
            );
        }}
      >
        删除
      </button>
    </div>
  );
}
function CollectionAction({ food }: { food: Food }) {
  const { api } = useApp();
  const access = useActionAccess();
  const task = useTask("已取消收藏", undefined, [
    "foods",
    "food-tags",
    "my-tags",
  ]);
  return (
    <div className="favorites-card-actions">
      <span>
        <Icon name="bookmarkOn" size={15} />
        已收藏
      </span>
      <button
        type="button"
        disabled={task.isPending || !food.id}
        aria-label={`取消收藏${food.name ?? "这道菜"}`}
        onClick={() => {
          if (food.id && access()) task.run(() => api.favorite(food.id!, true));
        }}
      >
        {task.isPending ? "正在取消…" : "取消收藏"}
      </button>
      {task.errorText && <p role="alert">{task.errorText}</p>}
    </div>
  );
}
export function CatalogCard({
  food,
  collection = false,
}: {
  food: Food;
  collection?: boolean;
}) {
  const renew = useFoodImageRefresh();
  const v = visualFor(food, isDemo),
    src = mediaUrl(food.pictureUrl?.[0]);
  return (
    <article className="ew-food-card">
      <Link to={`/foods/${food.id}`}>
        <div className="ew-food-photo" style={{ background: v.tile }}>
          {src ? (
            <img
              className={v.asset ? "illustration" : "photo"}
              src={src}
              alt={food.name ?? "菜品"}
              loading="lazy"
              decoding="async"
              onError={() => renew(src)}
            />
          ) : (
            <Icon name="image" size={28} />
          )}
          <span>
            {categories.find((x) => x.id === food.category)?.label ?? "菜品"}
          </span>
        </div>
        <div className="ew-food-title">
          <h3>{food.name ?? "未命名菜品"}</h3>
          <b>{money(food.price)}</b>
        </div>
        <p>
          {food.restaurantName ?? "餐厅信息待补充"}
          <span>♡ {food.likesCount ?? "—"}</span>
        </p>
      </Link>
      {collection ? (
        <CollectionAction food={food} />
      ) : (
        <FoodManage food={food} />
      )}
    </article>
  );
}
export function Catalog({ favorites = false }: { favorites?: boolean }) {
  const embedded = useContext(ProfileWorkspaceContext);
  const { api, session, user } = useApp(),
    [params, setParams] = useSearchParams(),
    mode = favorites ? "food" : params.get("type") === "shop" ? "shop" : "food",
    page = Math.max(1, Number(params.get("page")) || 1),
    filters = catalogFilters(params, mode),
    tag = filters.myCustomTagIds?.[0],
    invalid = budgetError(filters);
  const q = useQuery<Page<Food> | Page<Restaurant>>({
    queryKey: [
      mode === "food" ? "foods" : "restaurants",
      favorites ? "favorites-filtered" : "catalog",
      page,
      filters,
    ],
    queryFn: () =>
      mode === "shop"
        ? api.browseRestaurants({
            keyword: filters.keyword,
            hubId: filters.hubId,
            page,
          })
        : favorites
          ? api.favorites(page, filters)
          : api.foods(undefined, page, filters),
    enabled: (!favorites || !!session) && !invalid,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[0] ===
        (mode === "food" ? "foods" : "restaurants") &&
      previousQuery?.queryKey[1] ===
        (favorites ? "favorites-filtered" : "catalog")
        ? keepPreviousData(previous)
        : undefined,
  });
  const [tagPage, setTagPage] = useState(1),
    tags = useQuery({
      queryKey: ["my-tags", tagPage],
      queryFn: () => api.myTags(tagPage),
      enabled: !!user?.verified && favorites,
    });
  const results = useRef<HTMLDivElement>(null);
  // Wait for the response, so placeholders do not animate a second time.
  useContentMotion(
    results,
    q.isPlaceholderData ? undefined : `${params.toString()}:${q.dataUpdatedAt}`,
    page,
    "opacity",
  );
  function set(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    next.delete("page");
    for (const [key, val] of Object.entries(patch))
      val ? next.set(key, val) : next.delete(key);
    setParams(next);
  }
  const filtered = !!(
    filters.keyword ||
    filters.category ||
    filters.hubId ||
    filters.minPrice != null ||
    filters.maxPrice != null ||
    tag
  );
  const [filterResetVersion, setFilterResetVersion] = useState(0);
  // Sorting and pagination must not discard fields the user is still editing.
  const favoritesFormKey = JSON.stringify([
    mode,
    filters.keyword,
    filters.category,
    filters.minPrice,
    filters.maxPrice,
    filters.hubId,
    tag,
    filterResetVersion,
  ]);
  function resetFilters() {
    setFilterResetVersion((version) => version + 1);
    setParams(
      mode === "shop"
        ? new URLSearchParams({ type: "shop" })
        : new URLSearchParams(),
    );
  }
  if (favorites && !session) return <AccessWelcome />;
  return (
    <div className={`ew-feature${favorites ? " ew-favorites" : " ew-catalog"}`}>
      <header className="ew-head">
        {(!favorites || !embedded) && (
          <Link to={favorites ? "/me" : "/"}>
            <Icon name="back" size={18} />
            {favorites ? "我的" : "发现"}
          </Link>
        )}
        <h1>{favorites ? "我的收藏" : "找到今天想吃的"}</h1>
        <p>
          {favorites
            ? "喜欢的，慢慢吃。把心头好留给每一个好胃口。"
            : "搜一道菜，也找一家店。"}
        </p>
      </header>
      {favorites && <ProfileSectionNav section="collections" />}
      {!favorites && (
        <nav className="ew-tabs" aria-label="搜索类型">
          <button
            aria-pressed={mode === "food"}
            onClick={() =>
              mode !== "food" && setParams(changeCatalogMode(params, "food"))
            }
          >
            搜菜品
          </button>
          <button
            aria-pressed={mode === "shop"}
            onClick={() =>
              mode !== "shop" && setParams(changeCatalogMode(params, "shop"))
            }
          >
            搜店铺
          </button>
        </nav>
      )}
      <FavoritesFilters
        key={favoritesFormKey}
        mode={favorites ? "favorites" : mode}
        filters={filters}
        apply={set}
        reset={resetFilters}
        filtered={filtered}
      />
      <div className={favorites ? "favorites-library-bar" : undefined}>
        {favorites && !!user?.verified && (
          <div className="ew-tag-filter">
            <button
              aria-pressed={!tag}
              onClick={() => {
                set({ tag: undefined });
              }}
            >
              全部收藏
            </button>
            {tags.data?.items?.map((t) => (
              <button
                key={t.id}
                aria-pressed={tag === t.id}
                onClick={() => {
                  set({ tag: String(t.id) });
                }}
              >
                {t.name}
              </button>
            ))}
            {tagPage > 1 && (
              <button onClick={() => setTagPage((p) => p - 1)}>
                上一组标签
              </button>
            )}
            {tags.data?.hasNext && (
              <button onClick={() => setTagPage((p) => p + 1)}>
                下一组标签
              </button>
            )}
            {tags.isError && (
              <button onClick={() => void tags.refetch()}>
                标签加载失败，重试
              </button>
            )}
          </div>
        )}
        <div className="ew-results-head">
          <b>
            {favorites && (
              <span className="favorites-results-label">
                {filtered ? "筛选结果" : "全部收藏"}
              </span>
            )}
            {invalid
              ? "请调整筛选条件"
              : q.isPlaceholderData || q.isError || q.data?.totalItems == null
                ? favorites
                  ? ""
                  : "查询结果"
                : `${q.data.totalItems} ${mode === "food" ? "道菜" : "家店"}`}
          </b>
          {mode === "food" ? (
            <div className="favorites-results-tools">
              {q.isFetching && <span role="status">正在查询…</span>}
              <Select
                aria-label={favorites ? "收藏排序" : "搜索结果排序"}
                value={filters.sort ?? (favorites ? "FAVORITED_AT" : "NEWEST")}
                onChange={(event) => set({ sort: event.target.value })}
              >
                {favorites && <option value="FAVORITED_AT">最近收藏</option>}
                <option value="NEWEST">最新分享</option>
                <option value="POPULAR">最多获赞</option>
                <option value="PRICE_ASC">价格从低到高</option>
                <option value="PRICE_DESC">价格从高到低</option>
              </Select>
            </div>
          ) : (
            <span>{q.isFetching ? "正在查询…" : ""}</span>
          )}
        </div>
      </div>
      {invalid ? (
        <FeatureState empty={invalid} />
      ) : q.isPending || (q.isError && !q.data) ? (
        <FeatureState
          loading={q.isPending}
          kind={mode === "food" ? "cards" : "rows"}
          error={q.error}
          retry={() => void q.refetch()}
        />
      ) : !q.data.items?.length ? (
        favorites ? (
          <FavoritesEmpty
            filtered={filtered || page > 1}
            reset={resetFilters}
          />
        ) : (
          <FeatureState empty="没有找到符合条件的结果，试试放宽条件" />
        )
      ) : (
        <div
          ref={results}
          className={`ew-results ${mode === "shop" ? "shops" : ""}`}
          aria-busy={q.isPlaceholderData}
        >
          {mode === "food"
            ? (q.data.items as Food[]).map((f) => (
                <CatalogCard key={f.id} food={f} collection={favorites} />
              ))
            : q.data.items.map((s) => (
                <Link
                  className="ew-shop-card"
                  key={s.id}
                  to={`/restaurants/${s.id}`}
                >
                  <Icon name="store" size={32} />
                  <h3>{s.name}</h3>
                  <p>
                    {"address" in s ? String(s.address ?? "地址待补充") : ""}
                  </p>
                  <span>查看店铺 →</span>
                </Link>
              ))}
        </div>
      )}
      {!invalid && !q.isError && (page > 1 || q.data?.hasNext) && (
        <nav className="ew-pager" aria-label="分页">
          <button
            disabled={page === 1 || q.isFetching}
            onClick={() => {
              const p = new URLSearchParams(params);
              p.set("page", String(page - 1));
              setParams(p);
            }}
          >
            上一页
          </button>
          <span>第 {page} 页</span>
          <button
            disabled={!q.data?.hasNext || q.isFetching}
            onClick={() => {
              const p = new URLSearchParams(params);
              p.set("page", String(page + 1));
              setParams(p);
            }}
          >
            下一页
          </button>
        </nav>
      )}
    </div>
  );
}
