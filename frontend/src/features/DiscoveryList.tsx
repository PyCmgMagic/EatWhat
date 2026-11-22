import { useId, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ListFilter,
  MapPin,
  ChevronRight,
  Shuffle,
  ThumbsUp,
} from "lucide-react";
import { MarkerTabs } from "../components/MarkerTabs";
import { ShopKindIcon } from "../components/ShopKindIcon";
import { Select } from "../components/Select";
import { discoveryKinds } from "../app/discovery-category";
import { errorMessage } from "../api/client";
import type { Food } from "../api/models";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { useMobile } from "../mobile/ui";
import { RecommendShopList } from "./RecommendShops";
import type { useHomeDiscovery } from "./useHomeDiscovery";
import "./discovery-list.css";

const sortButtons = {
  recommended: { icon: ListFilter, shortLabel: "排序" },
  distance: { icon: MapPin, shortLabel: "距离" },
  rating: { icon: ThumbsUp, shortLabel: "推荐率" },
};

export function DiscoveryList({
  discovery,
  masonry = false,
  renderDishes,
}: {
  discovery: ReturnType<typeof useHomeDiscovery>;
  masonry?: boolean;
  renderDishes: (foods: Food[]) => ReactNode;
}) {
  const { kind, setKind, feed, shops, dishes } = discovery;
  const mobile = useMobile();
  const location = useLocation();
  const tea = (discovery.pickMeal ?? mobile.mealTime) === "afternoon_tea" || (!discovery.pickMeal && mobile.meal === "下午茶");
  const drawParams = new URLSearchParams({ scene: mobile.scene });
  if (kind !== "food") drawParams.set("kind", kind);
  if (discovery.pickMeal) drawParams.set("mealTime", discovery.pickMeal);
  const id = useId();
  const hasResults = (shops ?? dishes).length > 0;
  const { icon: SortIcon, shortLabel } = sortButtons[discovery.sort];
  return (
    <>
      <div className="discovery-toolbar">
        <MarkerTabs
          items={discoveryKinds.map(({ id, name }) => ({
            id,
            name: tea && id === "food" ? "下午茶" : name,
            icon: <ShopKindIcon kind={id} />,
          }))}
          value={kind}
          onChange={setKind}
          panelId={id}
          label="店铺分类"
          className="discovery-tabs"
        />
        <Select
          className="discovery-sort"
          popupClassName="discovery-sort-menu"
          compactLabel={shortLabel}
          icon={<SortIcon size={14} strokeWidth={1.75} />}
          aria-label="推荐店铺排序"
          menuLabel="本组店铺排序"
          disabled={!shops?.length}
          value={discovery.sort}
          onChange={(event) => {
            const value = event.target.value;
            if (
              value === "recommended" ||
              value === "distance" ||
              value === "rating"
            )
              discovery.setSort(value);
          }}
        >
          <option value="recommended">默认排序</option>
          <option
            value="distance"
            disabled={!discovery.canSortByDistance}
            data-description={
              discovery.canSortByDistance ? undefined : "暂无店铺距离"
            }
          >
            距离最近
          </option>
          <option value="rating">推荐率最高</option>
        </Select>
      </div>
      <div
        id={id}
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={id + kind}
        className="discovery-results"
        aria-busy={feed.isFetching}
      >
        <Link
          hidden
          className="discovery-draw-link"
          to={"/recommend/pick?" + drawParams}
          state={{ discoveryFrom: location.pathname + location.search }}
        >
          <Shuffle size={16} aria-hidden="true" />
          随机选一家
          <ChevronRight size={15} aria-hidden="true" />
        </Link>
        {hasResults &&
          (shops ? (
            <RecommendShopList
              masonry={masonry}
              shops={shops}
              scene={mobile.scene}
              onOpenShop={(shop) => shop.id && mobile.setShopId(shop.id)}
              onOpenFood={(dish) => {
                if (dish.id) mobile.setFoodId(dish.id);
                if (dish.restaurantId) mobile.setShopId(dish.restaurantId);
              }}
            />
          ) : (
            renderDishes(dishes)
          ))}
        {feed.isPending && !hasResults && <ContentSkeleton count={2} />}
        {(hasResults || feed.hasNextPage) && (
          <div className="discovery-status discovery-pagination">
            {feed.isFetchNextPageError && (
              <p role="status">{errorMessage(feed.error)}</p>
            )}
            {feed.hasNextPage ? (
              <button
                type="button"
                disabled={feed.isFetching}
                onClick={() =>
                  void feed.fetchNextPage({ cancelRefetch: false })
                }
              >
                {feed.isFetchingNextPage
                  ? "正在加载…"
                  : feed.isFetchNextPageError
                    ? "重试加载更多"
                    : "加载更多店铺"}
              </button>
            ) : (
              <>
                {(feed.data?.pages.length ?? 0) > 1 && (
                  <span role="status">已看完本轮推荐</span>
                )}
                {!masonry && (
                  <button
                    type="button"
                    disabled={feed.isFetching}
                    onClick={() => void discovery.refresh()}
                  >
                    换一批推荐
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {!hasResults && !feed.hasNextPage && !feed.isPending && (
          <div className="discovery-status" role="status">
            <p>
              {feed.isError
                ? errorMessage(feed.error)
                : "这个分类暂时没有推荐店铺"}
            </p>
            <button
              type="button"
              disabled={feed.isFetching}
              onClick={() => void discovery.refresh()}
            >
              {feed.isError ? "重新加载" : "刷新推荐"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
