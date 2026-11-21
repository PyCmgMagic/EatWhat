import { useState } from "react";
import { Link } from "react-router-dom";
import { useArea } from "../app/area";
import { errorMessage } from "../api/client";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { NearbySearchInput } from "../features/NearbySearchInput";
import RestaurantMap from "../features/RestaurantMap";
import {
  DesignIcon,
  MobileEmpty,
  PrimaryButton,
  ShopRow,
  useMobile,
} from "./ui";
import SheetHandle from "./SheetHandle";
import NearbyFilterSheet, {
  NearbyFilterTrigger,
} from "../features/NearbyFilterSheet";
import { hasNearbyFilters, useNearbyBrowse } from "../features/nearby-filters";

export default function MobileNearby() {
  const { area } = useArea();
  const mobile = useMobile();
  const {
    shops,
    filters,
    page,
    setPage,
    keyword,
    changeKeyword,
    open,
    openFilters,
    closeFilters,
    apply,
  } = useNearbyBrowse();
  const filtered = hasNearbyFilters(filters);
  const restaurants = shops.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<number | null>();
  const selected =
    restaurants.find((shop) => shop.id === selectedId) ?? restaurants[0];

  return (
    <>
      <header className="mobile-nearby-toolbar">
        <div className="mobile-nearby-search" role="search">
          <DesignIcon name="search" size={20} />
          <NearbySearchInput
            type="search"
            label="搜店名或地址"
            placeholder="搜店名或地址"
            value={keyword}
            onCommit={changeKeyword}
          />
          <NearbyFilterTrigger
            active={filtered}
            open={open}
            onClick={openFilters}
          />
        </div>
        <button
          type="button"
          className="mobile-nearby-area"
          onClick={() => mobile.openPanel("G-PanelPlace")}
        >
          <DesignIcon name="nearby" size={16} />
          {area?.name ?? "选择查询区域"}
          <DesignIcon name="chevronDown" size={14} />
        </button>
      </header>
      <div className="mobile-nearby-map">
        <RestaurantMap
          restaurants={restaurants}
          selectedId={selected?.id ?? undefined}
          onSelect={(shop) => {
            setSelectedId(shop.id);
            document
              .getElementById(`mobile-restaurant-${shop.id}`)
              ?.scrollIntoView({ block: "nearest" });
          }}
        />
      </div>
      <section className="mobile-nearby-sheet" aria-label="附近店铺列表">
        <SheetHandle
          label="附近店铺列表"
          expandedBelow=".mobile-nearby-toolbar"
          coveredSiblings=".mobile-nearby-map"
        />
        <div className="mobile-nearby-heading">
          <h1>
            附近 <span>{shops.data?.totalItems ?? "—"}</span>
          </h1>
        </div>
        <div className="mobile-nearby-results">
          {shops.isPending ? (
            <ContentSkeleton kind="rows" count={4} />
          ) : shops.isError && !restaurants.length ? (
            <MobileEmpty
              title="附近的店暂时没加载成功"
              detail={errorMessage(shops.error)}
              action={
                <button
                  type="button"
                  className="mobile-inline-link"
                  onClick={() => void shops.refetch()}
                >
                  重新加载店铺
                </button>
              }
            />
          ) : !restaurants.length ? (
            <MobileEmpty
              title="没有符合条件的店铺"
              detail={keyword ? "试试其他店名或地址。" : undefined}
              action={
                filtered && (
                  <button
                    type="button"
                    className="mobile-inline-link"
                    onClick={openFilters}
                  >
                    调整筛选
                  </button>
                )
              }
            />
          ) : (
            restaurants.map((shop) => (
              <div
                key={shop.id}
                id={`mobile-restaurant-${shop.id}`}
                className={`mobile-nearby-shop${selected?.id === shop.id ? " is-selected" : ""}`}
              >
                <ShopRow
                  shop={shop}
                  selected={selected?.id === shop.id}
                  onSelect={() => setSelectedId(shop.id)}
                />
                <Link
                  to={`/restaurants/${shop.id}`}
                  aria-label={`查看${shop.name ?? "店铺"}`}
                  onClick={() => shop.id && mobile.setShopId(shop.id)}
                >
                  看菜单
                </Link>
              </div>
            ))
          )}
          {(page > 1 || shops.data?.hasNext) && (
            <div className="mobile-page-more">
              {page > 1 && (
                <PrimaryButton
                  light
                  disabled={shops.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </PrimaryButton>
              )}
              {shops.data?.hasNext && (
                <PrimaryButton
                  light
                  disabled={shops.isFetching}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </PrimaryButton>
              )}
            </div>
          )}
        </div>
      </section>
      {open && (
        <NearbyFilterSheet
          filters={filters}
          keyword={keyword}
          onApply={apply}
          onClose={closeFilters}
        />
      )}
    </>
  );
}
