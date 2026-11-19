import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { errorMessage } from "../api/client";
import {
  mediaUrl,
  money,
  parseId,
  type Food,
  type Page,
  type Restaurant,
} from "../api/models";
import { FoodCover } from "../components/FoodCover";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { useTask } from "../components/useTask";
import { useFoodPhoto } from "../features/media";
import { visualFor } from "./catalog";
import { DesignIcon, MobileEmpty, PrimaryButton } from "./ui";
import "./mobile-library.css";

const TABS = [
  { key: "favorites", label: "菜", to: "/favorites" },
  { key: "shops", label: "店", to: "/restaurants/favorites" },
] as const;

function Thumb({
  src,
  alt,
  tile,
  crop,
  fallbackIcon,
}: {
  src?: string;
  alt: string;
  tile?: string;
  crop?: Food["coverCrop"];
  fallbackIcon: string;
}) {
  const photo = useFoodPhoto(src);
  return (
    <span
      className="mobile-library-thumb"
      style={tile && photo.unavailable ? { background: tile } : undefined}
    >
      {!photo.unavailable ? (
        crop ? (
          <FoodCover
            crop={crop}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={photo.onError}
          />
        ) : (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={photo.onError}
          />
        )
      ) : (
        <DesignIcon name={fallbackIcon} size={22} />
      )}
    </span>
  );
}

function FoodRow({ food, kind }: { food: Food; kind: "favorites" | "likes" }) {
  const { api } = useApp();
  const isLike = kind === "likes";
  const task = useTask(
    isLike ? "已取消点赞" : "已取消收藏",
    undefined,
    isLike ? ["foods"] : ["foods", "food-tags", "my-tags"],
  );
  const visual = visualFor(food, isDemo);
  const src = mediaUrl(food.pictureUrl?.[0]);
  const sub = [
    food.restaurantName || "餐厅待补充",
    food.price != null ? money(food.price) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="mobile-library-row">
      <Link className="mobile-library-row-main" to={`/foods/${food.id}`}>
        <Thumb
          src={src}
          alt={food.name ?? "菜品"}
          tile={visual.tile}
          crop={food.coverCrop}
          fallbackIcon="bowl"
        />
        <span className="mobile-library-copy">
          <strong>{food.name || "未命名菜品"}</strong>
          <span>{sub}</span>
        </span>
      </Link>
      {food.id && (
        <button
          type="button"
          className={`mobile-library-action${isLike ? " is-unlike" : ""}`}
          disabled={task.isPending}
          aria-busy={task.isPending || undefined}
          aria-label={`${isLike ? "取消点赞" : "取消收藏"}${food.name ?? "这道菜"}`}
          onClick={() =>
            task.run(() =>
              isLike ? api.like(food.id!, true) : api.favorite(food.id!, true),
            )
          }
        >
          {isLike && <DesignIcon name="heartOn" size={14} />}
          {task.isPending ? "处理中…" : isLike ? "取消赞" : "取消收藏"}
        </button>
      )}
    </li>
  );
}

function ShopRow({ shop }: { shop: Restaurant }) {
  const { api } = useApp();
  const task = useTask("已取消收藏店铺", undefined, ["restaurants"]);
  const src =
    mediaUrl(shop.coverUrl ?? shop.pictureUrl?.[0]) ??
    "/assets/restaurants/shop.svg";
  return (
    <li className="mobile-library-row">
      <Link className="mobile-library-row-main" to={`/restaurants/${shop.id}`}>
        <Thumb src={src} alt={shop.name ?? "店铺"} fallbackIcon="store" />
        <span className="mobile-library-copy">
          <strong>{shop.name || "未命名店铺"}</strong>
          <span>{shop.address || "地址待补充"}</span>
        </span>
      </Link>
      {shop.id && (
        <button
          type="button"
          className="mobile-library-action"
          disabled={task.isPending}
          aria-label={`取消收藏${shop.name ?? "这家店"}`}
          onClick={() => task.run(() => api.unfavoriteRestaurant(shop.id!))}
        >
          {task.isPending ? "处理中…" : "取消收藏"}
        </button>
      )}
    </li>
  );
}

function MobileLibraryPage({
  title,
  page,
  query,
  emptyTitle,
  emptyPath = "/",
  emptyAction = "去发现",
  manageTags = false,
  controls,
  children,
}: {
  title: string;
  page: number;
  query: UseQueryResult<Page<unknown>>;
  emptyTitle: string;
  emptyPath?: string;
  emptyAction?: string;
  manageTags?: boolean;
  controls?: ReactNode;
  children: ReactNode;
}) {
  const { session, user } = useApp();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const nextHref = `/auth?next=${encodeURIComponent(loc.pathname + loc.search)}`;
  const setPage = (nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    setParams(next);
  };

  return (
    <div className="mobile-library">
      <header className="mobile-library-topbar">
        <Link className="mobile-library-back" to="/me" aria-label="返回">
          <DesignIcon name="back" size={24} />
        </Link>
        {manageTags && session && user?.verified && (
          <Link className="mobile-library-tags-link" to="/me/tags">
            我的标签
          </Link>
        )}
      </header>

      <section className="mobile-library-header">
        <h1>{title}</h1>
        <span className="mobile-library-lock">
          <DesignIcon name="lock" size={16} />
          只有你自己看得见
        </span>
      </section>

      {controls}

      {!session ? (
        <div className="mobile-library-state">
          <MobileEmpty
            illustration="yangzhi"
            title={`登录后查看${title}`}
            action={
              <Link className="design-button" to={nextHref}>
                去登录
              </Link>
            }
          />
        </div>
      ) : query.isPending ? (
        <div className="mobile-library-state">
          <ContentSkeleton kind="rows" count={5} />
        </div>
      ) : query.isError && !query.data ? (
        <div className="mobile-library-state">
          <MobileEmpty
            title="暂时没有加载成功"
            detail={errorMessage(query.error)}
            action={
              <PrimaryButton light onClick={() => void query.refetch()}>
                重新加载
              </PrimaryButton>
            }
          />
        </div>
      ) : !query.data?.items?.length ? (
        <div className="mobile-library-state">
          <MobileEmpty
            illustration={emptyPath === "/nearby" ? "jiaozi" : "yangzhi"}
            title={emptyTitle}
            action={
              <Link className="design-button light" to={emptyPath}>
                {emptyAction}
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mobile-library-list" aria-busy={query.isPlaceholderData}>
          {children}
        </ul>
      )}

      {session && !query.isError && (page > 1 || query.data?.hasNext) && (
        <div className="mobile-page-more">
          {page > 1 && (
            <PrimaryButton
              light
              disabled={query.isFetching}
              onClick={() => setPage(page - 1)}
            >
              上一页
            </PrimaryButton>
          )}
          {query.data?.hasNext && (
            <PrimaryButton
              light
              disabled={query.isFetching}
              onClick={() => setPage(page + 1)}
            >
              下一页
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  );
}

export function MobileLikedFoods() {
  const { api, session } = useApp();
  const [params] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const likes = useQuery({
    queryKey: ["foods", "likes", page],
    queryFn: () => api.likedFoods(page),
    enabled: !!session,
    placeholderData: keepPreviousData,
  });

  return (
    <MobileLibraryPage
      title="赞过的菜"
      page={page}
      query={likes}
      emptyTitle="还没有赞过的菜"
    >
      {likes.data?.items?.map((food) => (
        <FoodRow key={food.id} food={food} kind="likes" />
      ))}
    </MobileLibraryPage>
  );
}

export default function MobileLibrary() {
  const { api, session } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const shops = loc.pathname.replace(/\/+$/, "") === "/restaurants/favorites";
  const tab = shops ? "shops" : "favorites";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const tagId = shops ? undefined : parseId(params.get("tag") ?? undefined);
  const favoriteFoods = useQuery({
    queryKey: ["foods", "favorites", page, tagId ?? null],
    queryFn: () =>
      api.favorites(page, tagId ? { myCustomTagIds: [tagId] } : undefined),
    enabled: !!session && !shops,
    placeholderData: keepPreviousData,
  });
  const favoriteShops = useQuery({
    queryKey: ["restaurants", "favorites", page],
    queryFn: () => api.favoriteRestaurants({ page, pageSize: 12 }),
    enabled: !!session && shops,
    placeholderData: keepPreviousData,
  });
  return (
    <MobileLibraryPage
      title="收藏夹"
      page={page}
      query={shops ? favoriteShops : favoriteFoods}
      manageTags={!shops}
      emptyTitle={shops ? "还没有收藏的店" : "还没有收藏的菜"}
      emptyPath={shops ? "/nearby" : "/"}
      emptyAction={shops ? "去附近逛逛" : "去发现"}
      controls={
        <>
          <div
            className="mobile-library-tabs"
            role="tablist"
            aria-label="收藏分类"
          >
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => nav(item.to, { replace: true })}
              >
                {item.label}
              </button>
            ))}
          </div>
          {tagId && (
            <div className="mobile-library-tag-chip">
              <span>正在按标签筛选收藏</span>
              <button
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.delete("tag");
                  next.delete("page");
                  setParams(next, { replace: true });
                }}
              >
                显示全部
              </button>
            </div>
          )}
        </>
      }
    >
      {shops
        ? favoriteShops.data?.items?.map((shop) => (
            <ShopRow key={shop.id} shop={shop} />
          ))
        : favoriteFoods.data?.items?.map((food) => (
            <FoodRow key={food.id} food={food} kind="favorites" />
          ))}
    </MobileLibraryPage>
  );
}
