import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";
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

type LibraryTab = "favorites" | "shops" | "likes";

const TABS: { key: LibraryTab; label: string; to: string }[] = [
  { key: "favorites", label: "菜", to: "/favorites" },
  { key: "shops", label: "店", to: "/restaurants/favorites" },
  { key: "likes", label: "赞过", to: "/likes" },
];

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

function FoodRow({
  food,
  kind,
}: {
  food: Food;
  kind: "favorites" | "likes";
}) {
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
          className="mobile-library-action"
          disabled={task.isPending}
          aria-label={`${isLike ? "取消点赞" : "取消收藏"}${food.name ?? "这道菜"}`}
          onClick={() =>
            task.run(() =>
              isLike ? api.like(food.id!, true) : api.favorite(food.id!, true),
            )
          }
        >
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

export default function MobileLibrary() {
  const { api, session, user } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const path = loc.pathname.replace(/\/+$/, "");
  const tab: LibraryTab =
    path === "/restaurants/favorites"
      ? "shops"
      : path === "/likes"
        ? "likes"
        : "favorites";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const tagId =
    tab === "favorites" ? parseId(params.get("tag") ?? undefined) : undefined;

  const foodsFavorites = useQuery({
    queryKey: ["foods", "favorites", page, tagId ?? null],
    queryFn: () =>
      api.favorites(page, tagId ? { myCustomTagIds: [tagId] } : undefined),
    enabled: !!session && tab === "favorites",
    placeholderData: keepPreviousData,
  });
  const likedFoods = useQuery({
    queryKey: ["foods", "likes", page],
    queryFn: () => api.likedFoods(page),
    enabled: !!session && tab === "likes",
    placeholderData: keepPreviousData,
  });
  const shopFavorites = useQuery({
    queryKey: ["restaurants", "favorites", page],
    queryFn: () => api.favoriteRestaurants({ page, pageSize: 12 }),
    enabled: !!session && tab === "shops",
    placeholderData: keepPreviousData,
  });

  const activeQuery: UseQueryResult<Page<Food> | Page<Restaurant>> =
    tab === "shops"
      ? shopFavorites
      : tab === "likes"
        ? likedFoods
        : foodsFavorites;

  const setPage = (nextPage: number) => {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete("page");
    else next.set("page", String(nextPage));
    setParams(next);
  };

  const title = tab === "likes" ? "赞过的菜" : "收藏夹";
  const nextHref = `/auth?next=${encodeURIComponent(loc.pathname + loc.search)}`;

  return (
    <div className="mobile-library">
      <header className="mobile-library-topbar">
        <Link className="mobile-library-back" to="/me" aria-label="返回">
          <DesignIcon name="back" size={24} />
        </Link>
        {!!session && user?.verified && tab === "favorites" && (
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

      <div
        className="mobile-library-tabs"
        role="tablist"
        aria-label="收藏与喜欢分类"
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

      {!session ? (
        <div className="mobile-library-state">
          <MobileEmpty
            illustration="yangzhi"
            title={tab === "likes" ? "登录后查看赞过的菜" : "登录后查看收藏夹"}
            detail="你的收藏和点赞会保存在账号中。"
            action={
              <Link className="design-button" to={nextHref}>
                去登录
              </Link>
            }
          />
        </div>
      ) : activeQuery.isPending ? (
        <div className="mobile-library-state">
          <ContentSkeleton kind="rows" count={5} />
        </div>
      ) : activeQuery.isError && !activeQuery.data ? (
        <div className="mobile-library-state">
          <MobileEmpty
            title="暂时没有加载成功"
            detail={errorMessage(activeQuery.error)}
            action={
              <PrimaryButton light onClick={() => void activeQuery.refetch()}>
                重新加载
              </PrimaryButton>
            }
          />
        </div>
      ) : !activeQuery.data?.items?.length ? (
        <div className="mobile-library-state">
          <MobileEmpty
            illustration={tab === "shops" ? "jiaozi" : "yangzhi"}
            title={
              tab === "likes"
                ? "还没有赞过的菜"
                : tab === "shops"
                  ? "还没有收藏的店"
                  : "还没有收藏的菜"
            }
            detail={
              tab === "likes"
                ? "给喜欢的菜品点个赞，以后可以随时来这里找回。"
                : tab === "shops"
                  ? "去逛逛喜欢的店铺，收进这里方便下次找。"
                  : "去发现逛逛，收下想吃的菜品。"
            }
            action={
              <Link
                className="design-button light"
                to={tab === "shops" ? "/nearby" : "/"}
              >
                {tab === "shops" ? "去附近逛逛" : "去发现"}
              </Link>
            }
          />
        </div>
      ) : (
        <ul
          className="mobile-library-list"
          aria-busy={activeQuery.isPlaceholderData}
        >
          {tab === "shops"
            ? (activeQuery.data.items as Restaurant[]).map((shop) => (
                <ShopRow key={shop.id} shop={shop} />
              ))
            : (activeQuery.data.items as Food[]).map((food) => (
                <FoodRow key={food.id} food={food} kind={tab} />
              ))}
        </ul>
      )}

      {session &&
        !activeQuery.isError &&
        (page > 1 || activeQuery.data?.hasNext) && (
          <div className="mobile-page-more">
            {page > 1 && (
              <PrimaryButton
                light
                disabled={activeQuery.isFetching}
                onClick={() => setPage(Math.max(1, page - 1))}
              >
                上一页
              </PrimaryButton>
            )}
            {activeQuery.data?.hasNext && (
              <PrimaryButton
                light
                disabled={activeQuery.isFetching}
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
