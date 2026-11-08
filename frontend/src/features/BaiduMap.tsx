import { useEffect, useRef, useState } from "react";
import {
  loadBaiduMap,
  acquireBaiduMap,
  releaseBaiduMap,
  type BaiduNamespace,
} from "../api/baidu-map";
import RestaurantMarkers from "./RestaurantMarkers";
import {
  mapPoint,
  gcjToBaidu,
  baiduToGcj,
  type MapPoint,
} from "./map-geometry";
import type { RestaurantMapProps } from "./RestaurantMap";

type Props = RestaurantMapProps & {
  center?: MapPoint;
  devicePoint?: MapPoint;
  deviceRevision: number;
};
function point(api: BaiduNamespace, p: MapPoint) {
  const converted = gcjToBaidu(p);
  return new api.Point(converted.lng, converted.lat);
}

export default function BaiduMap(props: Props) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<BMap.Map | null>(null),
    sdk = useRef<BaiduNamespace | null>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const [ready, setReady] = useState(0),
    [attempt, setAttempt] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [pickError, setPickError] = useState("");
  useEffect(() => {
    let active = true,
      instance: BMap.Map | undefined,
      lease: ReturnType<typeof acquireBaiduMap> | undefined,
      scale: BMap.ScaleControl | undefined,
      removeListeners: (() => void) | undefined,
      resize: ResizeObserver | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setError("");
    loadBaiduMap()
      .then((api) => {
        if (!active || !element.current) return;
        sdk.current = api;
        const initial = callbacks.current;
        const origin =
          initial.pickedPoint ??
          initial.center ??
          mapPoint(initial.restaurants?.find((r) => mapPoint(r)));
        lease = acquireBaiduMap(api, element.current);
        instance = lease.instance;
        map.current = instance;
        const loaded = () => {
          if (active) {
            clearTimeout(timer);
            setLoading(false);
            setError("");
          }
        };
        instance.addEventListener("tilesloaded", loaded);
        const styleError = () => {
          if (active) {
            clearTimeout(timer);
            setLoading(false);
            setError("百度地图暂时加载失败，店铺列表仍可使用。");
          }
        };
        instance.addEventListener("style_loaded_error", styleError);
        instance.centerAndZoom(
          origin ? point(api, origin) : new api.Point(105, 35),
          origin ? 17 : 5,
          { noAnimation: true },
        );
        instance.enableAutoResize();
        instance.enableKeyboard();
        instance.enablePinchToZoom();
        instance.disableScrollWheelZoom();
        scale = new api.ScaleControl({
          anchor: BMAP_ANCHOR_BOTTOM_LEFT,
          offset: new api.Size(80, 12),
        });
        instance.addControl(scale);
        const clicked = (event: BMap.MapMouseEvent) => {
          const current = callbacks.current;
          if (!current.onPick || current.disabled || event.overlay) return;
          const selected = baiduToGcj(event.point?.lng, event.point?.lat);
          if (!selected) {
            setPickError("请选择有效的店铺位置。");
            return;
          }
          setPickError("");
          current.onPick(selected);
        };
        instance.addEventListener("click", clicked);
        removeListeners = () => {
          instance?.removeEventListener("tilesloaded", loaded);
          instance?.removeEventListener("style_loaded_error", styleError);
          instance?.removeEventListener("click", clicked);
        };
        resize = new ResizeObserver(() => {
          if (active) instance?.checkResize();
        });
        resize.observe(element.current);
        timer = setTimeout(() => {
          if (active) {
            setLoading(false);
            setError("百度地图加载较慢，请检查网络后重试。店铺列表仍可使用。");
          }
        }, 20000);
        if (lease.ready) loaded();
        setReady((value) => value + 1);
      })
      .catch((cause) => {
        if (active) {
          setLoading(false);
          setError(
            cause instanceof Error ? cause.message : "百度地图暂时无法加载。",
          );
        }
      });
    return () => {
      active = false;
      clearTimeout(timer);
      resize?.disconnect();
      removeListeners?.();
      map.current = null;
      if (instance && scale) instance.removeControl(scale);
      if (lease) releaseBaiduMap(lease);
    };
  }, [attempt]);

  const restaurants = props.restaurants ?? [];
  const extent = JSON.stringify(
    restaurants.map((r) => [r.id, r.gcjLng, r.gcjLat]),
  );
  useEffect(() => {
    const instance = map.current,
      api = sdk.current;
    if (!instance || !api) return;
    const points = (callbacks.current.restaurants ?? [])
      .map(mapPoint)
      .filter((p): p is MapPoint => !!p)
      .map((p) => point(api, p));
    if (props.pickedPoint)
      instance.centerAndZoom(point(api, props.pickedPoint), 18);
    else if (points.length > 1) {
      const container = instance.getContainer();
      const bounds = container.getBoundingClientRect();
      const scale = bounds.width / container.clientWidth || 1;
      const desktop = element.current?.closest(".pc-map");
      const card = desktop
        ?.querySelector(".pc-map-selected")
        ?.getBoundingClientRect();
      const coveredBottom =
        card && card.top < bounds.bottom
          ? (bounds.bottom - card.top) / scale + 20
          : 0;
      instance.setViewport(points, {
        // Mobile has much less map height. Desktop also needs to reserve the
        // actual overlaid card, while tablet cards sit outside the map itself.
        margins: [desktop ? 88 : 64, 58, Math.max(60, coveredBottom), 28],
        enableAnimation: false,
      });
    } else if (points.length === 1) instance.centerAndZoom(points[0], 17);
    else if (props.center) instance.centerAndZoom(point(api, props.center), 17);
  }, [ready, extent, props.center?.gcjLng, props.center?.gcjLat]);
  const previousSelection = useRef({ id: props.selectedId, extent });
  useEffect(() => {
    const previous = previousSelection.current;
    previousSelection.current = { id: props.selectedId, extent };
    if (previous.extent !== extent || previous.id === props.selectedId) return;
    const position = mapPoint(
      restaurants.find((r) => r.id === props.selectedId),
    );
    if (position && map.current && sdk.current)
      map.current.panTo(point(sdk.current, position), { noAnimation: true });
  }, [ready, props.selectedId, extent]);
  useEffect(() => {
    const instance = map.current,
      api = sdk.current;
    if (!instance || !api || !props.devicePoint) return;
    const location = new api.CustomOverlay(
      () => {
        const dot = document.createElement("span");
        dot.className = "restaurant-map-device-dot";
        dot.setAttribute("aria-label", "你的位置");
        return dot;
      },
      { point: point(api, props.devicePoint), anchors: [0.5, 0.5], zIndex: 1 },
    );
    instance.addOverlay(location);
    instance.panTo(point(api, props.devicePoint), { noAnimation: true });
    return () => {
      instance.removeOverlay(location);
    };
  }, [
    ready,
    props.devicePoint?.gcjLng,
    props.devicePoint?.gcjLat,
    props.deviceRevision,
  ]);
  useEffect(() => {
    const instance = map.current,
      api = sdk.current;
    if (!instance || !api || !props.pickedPoint) return;
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 40C13 35 2 24 2 16a14 14 0 1 1 28 0c0 8-11 19-14 24Z" fill="#d9632b" stroke="white" stroke-width="3"/><circle cx="16" cy="16" r="5" fill="white"/></svg>';
    const marker = new api.Marker(point(api, props.pickedPoint), {
      enableDragging: !props.disabled,
      title: "店铺位置，可拖动调整",
      icon: new api.Icon(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        new api.Size(32, 42),
        { anchor: new api.Size(16, 40) },
      ),
    });
    instance.addOverlay(marker);
    marker.addEventListener("dragend", () => {
      const p = marker.getPosition(),
        selected = baiduToGcj(p.lng, p.lat);
      if (!selected) {
        marker.setPosition(point(api, props.pickedPoint!));
        setPickError("请选择有效的店铺位置。");
        return;
      }
      setPickError("");
      callbacks.current.onPick?.(selected);
    });
    return () => {
      instance.removeOverlay(marker);
    };
  }, [
    ready,
    props.pickedPoint?.gcjLng,
    props.pickedPoint?.gcjLat,
    props.disabled,
  ]);
  return (
    <>
      <div
        ref={element}
        className="restaurant-map-canvas"
        role="region"
        aria-label="百度地图，支持拖动和缩放"
        aria-busy={loading}
        data-map-state={error ? "error" : loading ? "loading" : "ready"}
      />
      <RestaurantMarkers
        instance={map.current}
        api={sdk.current}
        restaurants={restaurants}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
        disabled={props.disabled}
      />
      <div className="restaurant-map-zoom" aria-label="地图缩放">
        <button
          type="button"
          aria-label="放大地图"
          disabled={!ready || !!error}
          onClick={() => map.current?.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          aria-label="缩小地图"
          disabled={!ready || !!error}
          onClick={() => map.current?.zoomOut()}
        >
          −
        </button>
      </div>
      {loading && !error && (
        <span className="restaurant-map-progress" role="status">
          正在加载百度地图…
        </span>
      )}
      {error && (
        <div className="restaurant-map-error" role="status">
          <strong>地图暂时无法显示</strong>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            重新加载地图
          </button>
        </div>
      )}
      {pickError && (
        <span className="restaurant-map-location-error" role="status">
          {pickError}
        </span>
      )}
    </>
  );
}
