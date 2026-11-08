import { useEffect, useId, useRef, useState } from "react";
import { DesignIcon } from "../mobile/ui";
import RestaurantMap from "./RestaurantMap";
import { mapPoint, type MapPoint } from "./map-geometry";
import type { MapPlace } from "../api/baidu-places";
import "./restaurant-location.css";

export function requireShopLocation(value?: MapPoint) {
  const point = mapPoint(value);
  if (!point) throw new Error("请先在地图上选择店铺位置。");
  return point;
}

/** Coordinates come only from the map; the address remains editable for door/floor details. */
export default function RestaurantLocationField(props: {
  point?: MapPoint;
  onPick: (point: MapPoint) => void;
  address: string;
  onAddressChange: (address: string) => void;
  name: string;
  onNameChange: (name: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const current = useRef(props);
  current.current = props;
  const suggested = useRef<string | undefined>(undefined);
  const searchCenter = useRef<MapPoint | undefined>(props.point);
  const chosenPlace = useRef<MapPlace | undefined>(undefined);
  const request = useRef<AbortController | undefined>(undefined);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const composing = useRef(false);
  const query = useRef(props.name);
  const [keyword, setKeyword] = useState(props.name);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [searchState, setSearchState] = useState<
    "idle" | "waiting" | "loading" | "ready" | "selected" | "error"
  >("idle");
  const [searchError, setSearchError] = useState("");
  const [focusPoint, setFocusPoint] = useState<MapPoint>();
  function cancelSearch() {
    clearTimeout(searchTimer.current);
    request.current?.abort();
  }
  useEffect(() => cancelSearch, []);
  useEffect(() => {
    if (!props.disabled) return;
    cancelSearch();
    setSearchState((value) =>
      value === "loading" || value === "waiting" ? "idle" : value,
    );
  }, [props.disabled]);
  function editKeyword(value: string) {
    cancelSearch();
    query.current = value;
    setKeyword(value);
    setPlaces([]);
    setSearchError("");
    const shouldSearch =
      value.trim() && !composing.current && !current.current.disabled;
    setSearchState(shouldSearch ? "waiting" : "idle");
    if (shouldSearch)
      searchTimer.current = setTimeout(() => void search(), 300);
  }
  async function search() {
    const value = query.current.trim();
    if (current.current.disabled || composing.current || !value) return;
    cancelSearch();
    const controller = new AbortController();
    request.current = controller;
    setPlaces([]);
    setSearchState("loading");
    setSearchError("");
    try {
      const { searchMapPlaces } = await import("../api/baidu-places");
      const found = await searchMapPlaces(
        value,
        searchCenter.current ?? current.current.point,
        controller.signal,
      );
      if (controller.signal.aborted || current.current.disabled) return;
      setPlaces(found);
      setSearchState("ready");
    } catch (error) {
      if (controller.signal.aborted || current.current.disabled) return;
      setSearchError(
        error instanceof Error
          ? error.message
          : "搜索暂不可用，请重试或在地图上选点。",
      );
      setSearchState("error");
    }
  }
  function selectPlace(place: MapPlace) {
    if (current.current.disabled) return;
    cancelSearch();
    chosenPlace.current = place;
    suggested.current = place.address;
    props.onNameChange(place.name);
    props.onAddressChange(place.address);
    props.onPick(place.point);
    setFocusPoint({ ...place.point });
    query.current = place.name;
    setKeyword(place.name);
    setPlaces([]);
    setSearchState("selected");
    setLookup(place.address ? "ready" : "loading");
  }
  const [lookup, setLookup] = useState<
    "idle" | "loading" | "ready" | "missing"
  >("idle");
  const lng = props.point?.gcjLng,
    lat = props.point?.gcjLat;
  useEffect(() => {
    if (lng === undefined || lat === undefined) {
      setLookup("idle");
      return;
    }
    const chosen = chosenPlace.current;
    if (
      chosen?.address &&
      chosen.point.gcjLng === lng &&
      chosen.point.gcjLat === lat
    ) {
      setLookup("ready");
      return;
    }
    let active = true;
    setLookup("loading");
    void import("../api/baidu-map")
      .then(({ addressForMapPoint }) =>
        addressForMapPoint({ gcjLng: lng, gcjLat: lat }),
      )
      .catch(() => undefined)
      .then((address) => {
        if (!active) return;
        setLookup(address ? "ready" : "missing");
        if (current.current.disabled || !address) return;
        // A late map response must not overwrite manually entered details.
        if (
          !current.current.address.trim() ||
          current.current.address === suggested.current
        ) {
          suggested.current = address;
          current.current.onAddressChange(address);
        }
      });
    return () => {
      active = false;
    };
  }, [lng, lat, focusPoint]);

  return (
    <section
      className="restaurant-location-field"
      aria-labelledby={`${id}-title`}
    >
      <div className="restaurant-location-heading">
        <h2 id={`${id}-title`}>
          <DesignIcon name="nearby" size={18} />
          店铺位置
        </h2>
        <span
          className={`restaurant-location-status${props.point ? " is-selected" : ""}`}
          role="status"
        >
          {props.point ? (
            <>
              <DesignIcon name="check" size={14} />
              已选店铺位置
            </>
          ) : (
            "请在地图选点"
          )}
        </span>
      </div>
      <p className="restaurant-location-hint">
        {props.point
          ? "位置已标记，拖动图钉可微调。"
          : "搜店名快速定位，也可以直接在地图上选点。"}
      </p>
      <div
        className="restaurant-place-search"
        role="search"
        aria-label="百度地图地点搜索"
      >
        <div className="restaurant-place-search-bar">
          <DesignIcon name="search" size={19} />
          <input
            type="search"
            aria-label="搜索店名或地址"
            placeholder="搜索店名、地址或地标"
            aria-describedby={`${id}-search-status`}
            value={keyword}
            maxLength={100}
            enterKeyHint="search"
            disabled={props.disabled}
            onChange={(event) => editKeyword(event.target.value)}
            onCompositionStart={() => {
              composing.current = true;
              cancelSearch();
              setPlaces([]);
              setSearchState("idle");
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              editKeyword(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              if (!event.nativeEvent.isComposing && event.keyCode !== 229)
                void search();
            }}
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={
              props.disabled || !keyword.trim() || searchState === "loading"
            }
          >
            {searchState === "loading" ? "搜索中…" : "搜索"}
          </button>
        </div>
        <p
          className="restaurant-location-hint"
          id={`${id}-search-status`}
          role="status"
        >
          {searchState === "waiting"
            ? "正在匹配地点…"
            : searchState === "loading"
              ? "正在搜索百度地图…"
              : searchState === "error"
                ? searchError
                : searchState === "ready" && !places.length
                  ? "没有找到这个地点，试试加上商圈或街道名，也可以在地图上选点。"
                  : searchState === "selected"
                    ? `已填入“${chosenPlace.current?.name}”的位置和店铺信息，请核对后提交。`
                    : "输入即匹配百度地图地点，选中后填入店铺信息。"}
        </p>
        {places.length > 0 && (
          <ul
            className="restaurant-place-results"
            aria-label="百度地图搜索结果"
          >
            {places.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  disabled={props.disabled}
                  onClick={() => selectPlace(place)}
                >
                  <DesignIcon name="nearby" size={18} />
                  <span>
                    <strong>{place.name}</strong>
                    <small>
                      {place.address || "地址待补充，可选中后在地图核对"}
                    </small>
                  </span>
                  <DesignIcon name="chevronRight" size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="restaurant-map-picker">
        <RestaurantMap
          pickedPoint={props.point}
          onPick={props.onPick}
          focusPoint={focusPoint}
          onCenterChange={(point) => {
            searchCenter.current = point;
          }}
          disabled={props.disabled}
        />
      </div>
      <label className="restaurant-location-address" htmlFor={`${id}-address`}>
        详细地址
        <input
          id={`${id}-address`}
          name="address"
          value={props.address}
          onChange={(e) => props.onAddressChange(e.target.value)}
          disabled={props.disabled}
          required
          maxLength={30}
          placeholder="选点后自动填入，可补充门牌、楼层或窗口"
          aria-describedby={`${id}-address-hint`}
        />
      </label>
      <p
        className="restaurant-location-hint"
        id={`${id}-address-hint`}
        aria-live="polite"
      >
        {[...props.name].length > 20 || [...props.address].length > 30
          ? "地图提供的信息较长，请将店名简化至 20 字、地址简化至 30 字，保留门牌或楼层。"
          : lookup === "loading"
            ? "正在识别所选位置的地址…"
            : lookup === "missing"
              ? "位置已保留，未能识别地址，请补充门牌、楼层或窗口。"
              : "核对地址后，可补充楼层、门牌或食堂窗口，最多 30 字。"}
      </p>
    </section>
  );
}
