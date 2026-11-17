import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useArea } from "../app/area";
import type { Restaurant } from "../api/models";
import { mapPoint, type MapPoint } from "./map-geometry";
import { DesignIcon } from "../mobile/ui";
import { useDeviceLocation } from "./useDeviceLocation";
import "./restaurant-map.css";

const BaiduMap = lazy(() => import("./BaiduMap"));
const noRestaurants: Restaurant[] = [];
export type RestaurantMapProps = {
  restaurants?: Restaurant[];
  selectedId?: number;
  onSelect?: (restaurant: Restaurant) => void;
  pickedPoint?: MapPoint;
  focusPoint?: MapPoint;
  onCenterChange?: (point: MapPoint) => void;
  onPick?: (point: MapPoint) => void;
  disabled?: boolean;
};

export default function RestaurantMap({
  restaurants = noRestaurants,
  ...props
}: RestaurantMapProps) {
  const { api } = useApp();
  const { area, campusId, selectArea } = useArea();
  const campuses = useQuery({
    queryKey: ["campuses"],
    queryFn: () => api.campuses(),
    staleTime: 300_000,
  });
  const campus =
    campuses.data?.find((c) => c.id === campusId) ??
    campuses.data?.find((c) => c.isDefault) ??
    campuses.data?.[0];
  const center = mapPoint(area) ?? mapPoint(campus);
  const { locate, locating, locationError, deviceRevision } = useDeviceLocation(
    {
      area,
      selectArea,
      autoLocate: false,
      disabled: props.disabled,
    },
  );
  const missing = restaurants.filter((r) => !mapPoint(r)).length;
  return (
    <div
      className="restaurant-map"
      data-map-provider="baidu"
      aria-label={props.onPick ? "店铺位置地图" : "附近餐厅地图"}
    >
      <Suspense
        fallback={
          <div className="restaurant-map-loading" role="status">
            正在加载地图…
          </div>
        }
      >
        <BaiduMap
          {...props}
          restaurants={restaurants}
          center={center}
          deviceRevision={deviceRevision}
          devicePoint={area?.source === "device" ? mapPoint(area) : undefined}
        />
      </Suspense>
      <button
        type="button"
        className="restaurant-map-locate"
        aria-label="回到我的位置"
        disabled={locating || props.disabled}
        onClick={locate}
      >
        <DesignIcon name="locate" size={20} />
        <span>{locating ? "正在定位…" : "我的位置"}</span>
      </button>
      {missing > 0 && (
        <span className="restaurant-map-missing">
          {missing} 家店暂缺坐标，可在列表中查看
        </span>
      )}
    </div>
  );
}
