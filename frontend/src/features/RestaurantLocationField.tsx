import { useEffect, useId, useRef, useState } from "react";
import type { MapPlace } from "../api/baidu-places";
import { codePoints } from "../api/content-rules";
import { DesignIcon } from "../mobile/ui";
import { FieldMark } from "./FieldMark";
import RestaurantMap from "./RestaurantMap";
import { mapPoint, type MapPoint } from "./map-geometry";
import "./restaurant-location.css";

export function requireShopLocation(value?: MapPoint) {
  const point = mapPoint(value);
  if (!point) throw new Error("请先在地图上选择店铺位置。");
  return point;
}

export default function RestaurantLocationField(props: {
  place?: MapPlace;
  point?: MapPoint;
  onPick: (point: MapPoint) => void;
  address: string;
  onAddressChange: (address: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const current = useRef(props);
  current.current = props;
  const suggested = useRef(props.place?.address);
  const [editingMap, setEditingMap] = useState(false);
  const [lookup, setLookup] = useState<"idle" | "loading" | "missing">("idle");
  const { place, point, address, disabled } = props;
  const lng = point?.gcjLng,
    lat = point?.gcjLat;

  useEffect(() => {
    if (
      lng === undefined ||
      lat === undefined ||
      (place?.address &&
        place.point.gcjLng === lng &&
        place.point.gcjLat === lat)
    ) {
      setLookup("idle");
      return;
    }
    let active = true;
    setLookup("loading");
    void import("../api/baidu-map")
      .then(({ addressForMapPoint }) =>
        addressForMapPoint({ gcjLng: lng, gcjLat: lat }),
      )
      .catch(() => undefined)
      .then((result) => {
        if (!active) return;
        setLookup(result ? "idle" : "missing");
        // A late map response must not overwrite a manually edited address.
        if (current.current.disabled || !result) return;
        if (
          !current.current.address.trim() ||
          current.current.address === suggested.current
        ) {
          suggested.current = result;
          current.current.onAddressChange(result);
        }
      });
    return () => {
      active = false;
    };
  }, [lng, lat, place]);

  const addressHint =
    codePoints(address.trim()) > 30
      ? "请将地址简化至 30 字以内，保留门牌或楼层。"
      : lookup === "loading" && !address.trim()
        ? "正在识别地址…"
        : lookup === "missing" && !address.trim()
          ? "未能识别地址，请手动填写。"
          : "";
  const showMap = !place || editingMap;

  return (
    <section className="restaurant-location-field" aria-label="店铺位置">
      <label className="restaurant-location-address">
        <span>
          详细地址
          <FieldMark required />
        </span>
        <input
          name="address"
          aria-label="详细地址"
          value={address}
          onChange={(event) => props.onAddressChange(event.target.value)}
          disabled={disabled}
          required
          maxLength={30}
          placeholder="门牌、楼层或食堂窗口"
          aria-describedby={addressHint ? `${id}-address-hint` : undefined}
        />
      </label>
      {addressHint && (
        <p
          className="restaurant-location-hint"
          id={`${id}-address-hint`}
          role="status"
        >
          {addressHint}
        </p>
      )}
      <div className="restaurant-location-heading">
        <span className="restaurant-location-status" role="status">
          <DesignIcon name="pin" size={18} />
          {point ? "已选店铺位置" : "请在地图选点"}
        </span>
        {place && (
          <button
            type="button"
            className="restaurant-location-toggle"
            aria-expanded={showMap}
            aria-controls={`${id}-map`}
            disabled={disabled}
            onClick={() => setEditingMap((open) => !open)}
          >
            {showMap ? "收起地图" : "调整位置"}
          </button>
        )}
      </div>
      <div id={`${id}-map`} className="restaurant-map-picker" hidden={!showMap}>
        {showMap && (
          <RestaurantMap
            pickedPoint={point}
            onPick={props.onPick}
            disabled={disabled}
          />
        )}
      </div>
    </section>
  );
}
