import { useId, type ReactNode } from "react";
import {
  ConciergeBell,
  CupSoda,
  ListFilter,
  MapPin,
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
const sortIcons = {
  recommended: ListFilter,
  distance: MapPin,
  rating: ThumbsUp,
};

export function DiscoveryList({
  discovery,
  renderDishes,
}: {
  discovery: ReturnType<typeof useHomeDiscovery>;
  renderDishes: (foods: Food[]) => ReactNode;
}) {
  const { kind, setKind, feed, shops, dishes } = discovery;
  const mobile = useMobile();
  const id = useId();
  const hasResults = (shops ?? dishes).length > 0;
  const SortIcon = sortIcons[discovery.sort];
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
        {!!shops?.length && (
          <Select
            className="discovery-sort"
            popupClassName="discovery-sort-menu"
            icon={<SortIcon size={14} strokeWidth={1.75} />}
            aria-label="推荐店铺排序"
            menuLabel="本组店铺排序"
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
        )}
      </div>
      <div
        id={id}
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={id + kind}
        className="discovery-results"
        aria-busy={feed.isFetching}
      >
        {hasResults &&
          (shops ? (
            <RecommendShopList
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
        {(feed.isError || (!feed.isPending && !hasResults)) && (
          <div className="discovery-status" role="status">
            <p>
              {feed.isError
                ? errorMessage(feed.error)
                : "这个分类暂时没有推荐店铺"}
            </p>
            <button
              type="button"
              disabled={feed.isFetching}
              onClick={() => void feed.refetch()}
            >
              {feed.isError ? "重新加载" : "刷新推荐"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
