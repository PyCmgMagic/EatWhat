import { useId, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useApp } from "../app/state";
import {
  ConciergeBell,
  CupSoda,
  ListFilter,
  MapPin,
  Shuffle,
  Soup,
  ThumbsUp,
} from "lucide-react";
import { MarkerTabs } from "../components/MarkerTabs";
import { Select } from "../components/Select";
import { discoveryKinds } from "../app/discovery-category";
import { errorMessage } from "../api/client";
import type { Food } from "../api/models";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { useMobile } from "../mobile/ui";
import { RecommendShopList } from "./RecommendShops";
import type { useHomeDiscovery } from "./useHomeDiscovery";
import "./discovery-list.css";

const icons = { food: Soup, drink: CupSoda, buffet: ConciergeBell };
function PickShop({
  filters,
}: {
  filters: ReturnType<typeof useHomeDiscovery>["pickFilters"];
}) {
  const { api } = useApp();
  const pick = useMutation({ mutationFn: () => api.pickShop(filters) });
  const shop = pick.data?.restaurant;
  return (
    <div className="discovery-pick">
      <button
        type="button"
        disabled={pick.isPending}
        onClick={() => pick.mutate()}
      >
        <Shuffle size={15} aria-hidden="true" />
        {pick.isPending ? "正在选店…" : "随机选一家"}
      </button>
      <span role="status">
        {shop ? (
          <Link to={`/restaurants/${shop.id}`}>
            {shop.name || "查看店铺"} →
          </Link>
        ) : pick.isError ? (
          errorMessage(pick.error)
        ) : pick.isSuccess ? (
          "当前条件下没有可选店铺"
        ) : (
          ""
        )}
      </span>
    </div>
  );
}
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
  const id = useId();
  const hasResults = (shops ?? dishes).length > 0;
  const { icon: SortIcon, shortLabel } = sortButtons[discovery.sort];
  return (
    <>
      <div className="discovery-toolbar">
        <MarkerTabs
          items={discoveryKinds.map(({ id, name }) => {
            const Icon = icons[id];
            return { id, name, icon: <Icon aria-hidden="true" size={18} /> };
          })}
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
        {hasResults && (
          <PickShop key={discovery.pickScope} filters={discovery.pickFilters} />
        )}
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
