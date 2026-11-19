import { Select } from "../components/Select";
import { SearchField } from "../components/SearchField";
import { useRef, useState, type ReactNode } from "react";
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
import { useFoodPhoto } from "./media";
import { FoodPhotoFallback } from "../components/FoodPhotoFallback";
import { FoodCover } from "../components/FoodCover";
import { useContentMotion } from "../motion/hooks";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { AccessWelcome } from "../components/AccessWelcome";
import { FavoritesEmpty, FavoritesFilters } from "./FavoritesControls";
import { ProfileCollectionsHeader } from "./ProfileSectionNav";
import { ProfilePageHead } from "./ProfilePage";
import SettingsPageHeader from "./SettingsPageHeader";
import { useTask } from "../components/useTask";
import { X } from "lucide-react";
import {
  DishIllustration,
  type DishIllustrationName,
} from "../components/DishIllustration";

export function FeaturePage({
  title,
  children,
  back = "/me",
}: {
  title: string;
  children: ReactNode;
  back?: string;
}) {
  const location = useLocation();
  return (
    <div className="ew-feature">
      {location.pathname.startsWith("/settings/") ? (
        <SettingsPageHeader title={title} back={back} />
      ) : (
        <header className="ew-head">
          <Link to={back}>
            <Icon name="back" size={18} />
            返回
          </Link>
          <h1>{title}</h1>
        </header>
      )}
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
  illustration,
}: {
  error?: unknown;
  loading?: boolean;
  empty?: string;
  retry?: () => void;
  kind?: "cards" | "rows" | "form";
  illustration?: DishIllustrationName;
}) {
  if (loading)
    return <ContentSkeleton kind={kind} count={kind === "form" ? 3 : 6} />;
  return (
    <div className="ew-state" role={error ? "alert" : "status"}>
      {illustration && !error ? (
        <DishIllustration name={illustration} />
      ) : (
        <Icon name="bowl" size={30} />
      )}
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
export function FoodManage({
  food,
  inMenu = false,
  anyone = false,
}: {
  food: Food;
  inMenu?: boolean;
  /** On the dish page any verified user may edit; lists offer it on your own. */
  anyone?: boolean;
}) {
  const { user, api, toast } = useApp(),
    m = useMobile(),
    access = useActionAccess(),
    loc = useLocation(),
    cache = useQueryClient(),
    nav = useNavigate();
  // Dishes are edited openly: any verified user may fix one. Only admins may
  // delete (backend v2 refuses everyone else).
  const canEdit =
      !!user?.verified &&
      !user.banned &&
      (anyone || user.id === food.accountId),
    canDelete = user?.role === "admin";
  if (!food.id || (!canEdit && !canDelete)) return null;
  return (
    <div className={inMenu ? "pc-dish-owner-actions" : "ew-food-manage"}>
      {canEdit && (
        <Link to={`/foods/${food.id}/edit`}>
          <Icon name="edit" size={inMenu ? 16 : 13} />
          编辑菜品
        </Link>
      )}
      {canDelete && (
        <button
          type="button"
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
          <Icon name="delete" size={inMenu ? 16 : 13} />
          {inMenu ? "删除菜品" : "删除"}
        </button>
      )}
    </div>
  );
}
const CARD_ACTIONS = {
  favorite: {
    done: "已取消收藏",
    icon: "bookmarkOn",
    status: "已收藏",
    button: "取消收藏",
    pending: "正在取消…",
    ariaPrefix: "取消收藏",
    run: (api: ReturnType<typeof useApp>["api"], id: number) =>
      api.favorite(id, true),
  },
  like: {
    done: "已取消点赞",
    icon: "heart",
    status: "已点赞",
    button: "取消点赞",
    pending: "正在取消…",
    ariaPrefix: "取消点赞",
    run: (api: ReturnType<typeof useApp>["api"], id: number) =>
      api.like(id, true),
  },
} as const;

function FoodCardAction({
  food,
  kind,
}: {
  food: Food;
  kind: keyof typeof CARD_ACTIONS;
}) {
  const { api } = useApp();
  const copy = CARD_ACTIONS[kind];
  const task = useTask(copy.done, undefined, [
    "foods",
    "food-tags",
    "my-tags",
  ]);
  return (
    <div className="favorites-card-actions">
      <span>
        <Icon name={copy.icon} size={15} />
        {copy.status}
      </span>
      <button
        type="button"
        disabled={task.isPending || !food.id}
        aria-label={`${copy.ariaPrefix}${food.name ?? "这道菜"}`}
        onClick={() => {
          if (food.id) task.run(() => copy.run(api, food.id!));
        }}
      >
        {task.isPending ? copy.pending : copy.button}
      </button>
    </div>
  );
}
export function CatalogCard({
  food,
  collection = false,
  actionKind,
  actions,
}: {
  food: Food;
  collection?: boolean;
  actionKind?: keyof typeof CARD_ACTIONS;
  /** 三态：undefined 保持原行为；true 展示管理操作（管理员「管理」模式）；false 只读。 */
  actions?: boolean;
}) {
  const v = visualFor(food, isDemo),
    src = mediaUrl(food.pictureUrl?.[0]);
  const photo = useFoodPhoto(src);
  const cardAction = actionKind ?? (collection ? "favorite" : undefined);
  return (
    <article className="ew-food-card">
      <Link to={`/foods/${food.id}`}>
        <div className="ew-food-photo" style={{ background: v.tileSurface }}>
          {!photo.unavailable ? (
            <FoodCover
              crop={food.coverCrop}
              className={v.asset ? "illustration" : "photo"}
              src={src}
              alt={food.name ?? "菜品"}
              loading="lazy"
              decoding="async"
              onError={photo.onError}
            />
          ) : (
            <FoodPhotoFallback category={food.category} failed={photo.failed} />
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
      {cardAction ? (
        <FoodCardAction food={food} kind={cardAction} />
      ) : actions === false ? null : (
        <FoodManage food={food} anyone={actions === true} />
      )}
    </article>
  );
}
export function Catalog({ favorites = false }: { favorites?: boolean }) {
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
  const showTagFilter =
    favorites &&
    !!user?.verified &&
    ((tags.data?.items?.length ?? 0) > 0 || !!tag || tags.isError);
  if (favorites && !session) return <AccessWelcome />;
  return (
    <div className={`ew-feature${favorites ? " ew-favorites" : " ew-catalog"}`}>
      {favorites ? (
        <ProfileCollectionsHeader />
      ) : (
        <>
          <header className="ew-head">
            <Link to="/">
              <Icon name="back" size={18} />
              发现
            </Link>
            <h1>搜索结果</h1>
            <SearchField
              key={filters.keyword ?? ""}
              defaultValue={filters.keyword}
              onSearch={(keyword) => set({ q: keyword })}
            />
            <p>
              {filters.keyword
                ? `“${filters.keyword}” 的${mode === "shop" ? "店铺" : "菜品"}结果`
                : `全部${mode === "shop" ? "店铺" : "菜品"}`}
            </p>
          </header>
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
        </>
      )}
      {favorites && (
        <FavoritesFilters
          key={favoritesFormKey}
          mode="favorites"
          filters={filters}
          apply={set}
          reset={resetFilters}
        />
      )}
      <div className={favorites ? "favorites-library-bar" : undefined}>
        {showTagFilter && (
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
            {filtered && (
              <button
                type="button"
                className="favorites-clear-filters"
                onClick={resetFilters}
              >
                <X size={13} aria-hidden="true" />
                清除筛选
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
            {favorites && filtered && !showTagFilter && (
              <button
                type="button"
                className="favorites-clear-inline"
                onClick={resetFilters}
              >
                <X size={12} aria-hidden="true" />
                清除筛选
              </button>
            )}
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
          <FeatureState
            illustration={mode === "food" ? "jiaozi" : undefined}
            empty="没有找到符合条件的结果，试试放宽条件"
          />
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
                  {matchedDish(s) && (
                    <p className="ew-shop-match">有 {matchedDish(s)}</p>
                  )}
                  <span>查看店铺 →</span>
                </Link>
              ))}
        </div>
      )}
      {!invalid && !q.isError && (page > 1 || q.data?.hasNext) && (
        <CatalogPager
          page={page}
          hasNext={q.data?.hasNext}
          busy={q.isFetching}
          onChange={(nextPage) => {
            const p = new URLSearchParams(params);
            p.set("page", String(nextPage));
            setParams(p);
          }}
        />
      )}
    </div>
  );
}

function CatalogPager({
  page,
  hasNext,
  busy,
  onChange,
}: {
  page: number;
  hasNext?: boolean | null;
  busy: boolean;
  onChange: (nextPage: number) => void;
}) {
  return (
    <nav className="ew-pager" aria-label="分页">
      <button disabled={page === 1 || busy} onClick={() => onChange(page - 1)}>
        上一页
      </button>
      <span>第 {page} 页</span>
      <button disabled={!hasNext || busy} onClick={() => onChange(page + 1)}>
        下一页
      </button>
    </nav>
  );
}

export function LikedFoods() {
  const { api, session } = useApp(),
    [params, setParams] = useSearchParams(),
    page = Math.max(1, Number(params.get("page")) || 1),
    results = useRef<HTMLDivElement>(null);
  const q = useQuery({
    queryKey: ["foods", "likes", page],
    queryFn: () => api.likedFoods(page),
    enabled: !!session,
    placeholderData: keepPreviousData,
  });
  useContentMotion(
    results,
    q.isPlaceholderData ? undefined : `${page}:${q.dataUpdatedAt}`,
    page,
    "opacity",
  );
  const setPage = (nextPage: number) => {
    const p = new URLSearchParams(params);
    if (nextPage <= 1) p.delete("page");
    else p.set("page", String(nextPage));
    setParams(p);
  };
  if (!session) return <AccessWelcome />;
  return (
    <div className="ew-feature ew-favorites">
      <ProfilePageHead
        title="赞过的菜"
        detail="只有你自己看得见"
        count={
          !q.isPlaceholderData && !q.isError && q.data?.totalItems != null
            ? `${q.data.totalItems} 道菜`
            : undefined
        }
      />
      {q.isPending || (q.isError && !q.data) ? (
        <FeatureState
          loading={q.isPending}
          kind="cards"
          error={q.error}
          retry={() => void q.refetch()}
        />
      ) : !q.data.items?.length ? (
        <FeatureState
          illustration="jiaozi"
          empty={
            page > 1
              ? "这一页没有更多赞过的菜了"
              : "点赞过的菜品会留在这里，去发现页面挑一挑好味道吧"
          }
        />
      ) : (
        <div
          ref={results}
          className="ew-results"
          aria-busy={q.isPlaceholderData}
        >
          {q.data.items.map((food) => (
            <CatalogCard key={food.id} food={food} actionKind="like" />
          ))}
        </div>
      )}
      {!q.isError && (page > 1 || q.data?.hasNext) && (
        <CatalogPager
          page={page}
          hasNext={q.data?.hasNext}
          busy={q.isFetching}
          onChange={setPage}
        />
      )}
    </div>
  );
}

/** Shop search also matches dish names; v2 returns the dish that matched. */
function matchedDish(shop: object) {
  const dish = (
    shop as { matchedFoods?: { name?: string; price?: number | null }[] }
  ).matchedFoods?.[0];
  if (!dish?.name) return null;
  return dish.price == null ? dish.name : `${dish.name} · ¥${dish.price}`;
}
