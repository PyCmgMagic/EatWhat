import { useId, type ReactNode } from "react";
import { CupSoda, ConciergeBell, Soup } from "lucide-react";
import { MarkerTabs } from "../components/MarkerTabs";
import { discoveryKinds } from "../app/discovery-category";
import { errorMessage } from "../api/client";
import type { Food } from "../api/models";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { useMobile } from "../mobile/ui";
import { RecommendShopList } from "./RecommendShops";
import type { useHomeDiscovery } from "./useHomeDiscovery";
import "./discovery-list.css";

const icons = { food: Soup, drink: CupSoda, buffet: ConciergeBell };

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
  return (
    <>
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
