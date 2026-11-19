import { useEffect, useRef, useState } from "react";
import type { BaiduNamespace } from "../api/baidu-map";
import type { Restaurant } from "../api/models";
import { gcjToBaidu, mapPoint } from "./map-geometry";
import {
  groupMapMarkers,
  placeMapLabels,
  type MapRect,
  type MarkerGroup,
} from "./map-markers";
import { DesignIcon } from "../mobile/ui";

type Props = {
  instance: BMap.Map | null;
  api: BaiduNamespace | null;
  restaurants: Restaurant[];
  selectedId?: number;
  onSelect?: (restaurant: Restaurant) => void;
  disabled?: boolean;
};
const pin =
  '<svg class="restaurant-map-pin" width="24" height="30" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 29C9 25 1 18 1 12a11 11 0 1 1 22 0c0 6-8 13-11 17Z" fill="currentColor" stroke="white" stroke-width="1.5"/><path class="restaurant-map-pin-bowl" d="M6.5 10.5h11a5.5 5.5 0 0 1-11 0ZM9 18h6" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export default function RestaurantMarkers(props: Props) {
  const current = useRef(props);
  current.current = props;
  const [expanded, setExpanded] = useState<{
    key: string;
    shops: Restaurant[];
  } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const returnKey = useRef("");
  const pendingFocus = useRef<string | undefined>(undefined);
  const signature = JSON.stringify(
    props.restaurants.map((r) => [r.id, r.gcjLng, r.gcjLat, r.name, r.address]),
  );

  function restoreFocus() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = current.current.instance?.getContainer();
        const target =
          Array.from(
            container?.querySelectorAll<HTMLButtonElement>(
              ".restaurant-map-marker",
            ) ?? [],
          ).find((el) => el.dataset.markerKey === returnKey.current) ??
          container?.querySelector<HTMLButtonElement>(
            ".restaurant-map-marker.is-selected",
          );
        target?.focus({ preventScroll: true });
      });
    });
  }
  function close(restore = true) {
    setExpanded(null);
    if (restore) restoreFocus();
  }

  useEffect(() => {
    setExpanded(null);
  }, [signature, props.instance]);
  useEffect(() => {
    if (!expanded) return;
    panel.current
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => {
      if (
        e.target instanceof Element &&
        !e.target.closest(
          ".restaurant-map-cluster-list, .restaurant-map-cluster",
        )
      )
        close(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded]);

  useEffect(() => {
    const { instance, api } = props;
    if (!instance || !api) return;
    let overlays: BMap.Overlay[] = [],
      frame = 0,
      disposed = false;
    const container = instance.getContainer();
    const measurement = document.createElement("canvas").getContext("2d");
    const clear = () => {
      overlays.forEach((o) => instance.removeOverlay(o));
      overlays = [];
    };
    function selectGroup(group: MarkerGroup<Restaurant>) {
      if (current.current.disabled) return;
      if (group.members.length === 1) {
        current.current.onSelect?.(group.members[0].value);
        return;
      }
      returnKey.current = group.key;
      if (group.samePlace || instance!.getZoom() >= 20) {
        setExpanded({
          key: group.key,
          shops: group.members.map((p) => p.value),
        });
      } else {
        setExpanded(null);
        instance!.centerAndZoom(
          new api!.Point(group.lng, group.lat),
          Math.min(20, instance!.getZoom() + 2),
        );
      }
    }
    function draw() {
      if (disposed) return;
      frame = 0;
      const focused =
        (container.contains(document.activeElement)
          ? (document.activeElement as HTMLElement)?.dataset.markerKey
          : undefined) ?? pendingFocus.current;
      pendingFocus.current = undefined;
      const points = current.current.restaurants.flatMap((restaurant, i) => {
        const location = mapPoint(restaurant);
        if (!location) return [];
        const position = gcjToBaidu(location);
        const pixel = instance!.pointToPixel(
          new api!.Point(position.lng, position.lat),
        );
        return [
          {
            key: String(restaurant.id ?? `missing-${i}`),
            x: pixel.x,
            y: pixel.y,
            ...position,
            value: restaurant,
          },
        ];
      });
      const groups = groupMapMarkers(points);
      const width = container.clientWidth,
        height = container.clientHeight;
      const bounds = container.getBoundingClientRect();
      const scale = bounds.width / width || 1;
      const surface = container.closest(".restaurant-map");
      const reserved: MapRect[] = Array.from(
        surface?.querySelectorAll<HTMLElement>(
          ".restaurant-map-zoom, .restaurant-map-locate, .restaurant-map-missing, .restaurant-map-location-error",
        ) ?? [],
      ).map((el) => {
        const box = el.getBoundingClientRect();
        return {
          x: (box.x - bounds.x) / scale,
          y: (box.y - bounds.y) / scale,
          width: box.width / scale,
          height: box.height / scale,
        };
      });
      const foreground = surface
        ?.closest(".pc-map, .mobile-nearby-screen")
        ?.querySelector(".pc-map-selected, .mobile-nearby-toolbar")
        ?.getBoundingClientRect();
      if (foreground)
        reserved.push({
          x: (foreground.x - bounds.x) / scale,
          y: (foreground.y - bounds.y) / scale,
          width: foreground.width / scale,
          height: foreground.height / scale,
        });
      if (measurement)
        measurement.font = `600 12px ${getComputedStyle(container).fontFamily}`;
      const displays = groups.map((group) => {
        const selected = group.members.find(
          (p) => p.value.id === current.current.selectedId,
        );
        const name = (selected ?? group.members[0]).value.name || "餐厅";
        const textWidth =
          measurement?.measureText(name).width ?? Array.from(name).length * 12;
        const labelWidth = Math.min(
          Math.max(36, textWidth + 20),
          selected ? Math.min(240, width - 24) : 180,
        );
        const labelHeight = selected
          ? Math.ceil(textWidth / Math.max(1, labelWidth - 20)) * 18 + 12
          : 24;
        return { group, selected: !!selected, name, labelWidth, labelHeight };
      });
      const labels = placeMapLabels(
        displays
          .filter((d) => d.selected || d.group.members.length === 1)
          .map((d) => ({
            key: d.group.key,
            x: 0,
            y: 0,
            markerX: d.group.x,
            markerY: d.group.y,
            width: d.labelWidth,
            height: d.labelHeight,
            selected: d.selected,
          })),
        groups.map((g) => ({
          x: g.x - 26,
          y: g.y - 44,
          width: 52,
          height: 44,
        })),
        { width, height },
        reserved,
      );
      clear();
      for (const display of displays) {
        const { group, selected, name } = display;
        if (
          group.x < -80 ||
          group.y < -80 ||
          group.x > width + 80 ||
          group.y > height + 80
        )
          continue;
        const cluster = group.members.length > 1;
        const overlay = new api!.CustomOverlay(
          () => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `restaurant-map-marker${cluster ? " restaurant-map-cluster" : ""}${selected ? " is-selected" : ""}`;
            button.dataset.markerKey = group.key;
            button.dataset.count = String(group.members.length);
            button.disabled = !!current.current.disabled;
            button.setAttribute(
              "aria-label",
              cluster
                ? `${group.members.length} 家店铺，${group.samePlace || instance!.getZoom() >= 20 ? "展开列表" : "放大查看"}${selected ? `，已选${name}` : ""}`
                : `选择${name}`,
            );
            button.setAttribute("aria-pressed", String(selected));
            if (cluster) {
              if (group.samePlace || instance!.getZoom() >= 20)
                button.setAttribute("aria-haspopup", "dialog");
              const badge = document.createElement("span");
              badge.className = "restaurant-map-cluster-count";
              badge.textContent = `${group.members.length} 家`;
              button.append(badge);
            } else button.innerHTML = pin;
            const rect = labels.get(group.key);
            if (rect) {
              const label = document.createElement("span");
              label.className = `restaurant-map-label${selected ? " is-selected" : ""}`;
              label.textContent = name;
              label.style.width = `${rect.width}px`;
              label.style.minHeight = `${rect.height}px`;
              label.style.left = `${rect.x - group.x + (cluster ? 26 : 22)}px`;
              label.style.top = `${rect.y - group.y + 44}px`;
              button.append(label);
            }
            button.addEventListener("click", (e) => {
              e.stopPropagation();
              selectGroup(group);
            });
            return button;
          },
          {
            point: new api!.Point(group.lng, group.lat),
            anchors: [0.5, 1],
            zIndex: selected ? 1000 : cluster ? 20 : 10,
            enableDraggingMap: false,
          },
        );
        instance!.addOverlay(overlay);
        overlays.push(overlay);
      }
      if (focused) {
        const buttons = Array.from(
          container.querySelectorAll<HTMLButtonElement>(
            ".restaurant-map-marker",
          ),
        );
        const target =
          buttons.find((el) => el.dataset.markerKey === focused) ??
          buttons.find((el) =>
            el.dataset.markerKey
              ?.split(":")
              .some((id) => focused.split(":").includes(id)),
          );
        target?.focus({ preventScroll: true });
      }
    }
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    for (const event of [
      "zoomend",
      "moveend",
      "resize",
      "tilesloaded",
    ] as const)
      instance.addEventListener(event, schedule);
    schedule();
    void document.fonts?.ready.then(() => {
      if (!disposed) schedule();
    });
    return () => {
      disposed = true;
      if (container.contains(document.activeElement))
        pendingFocus.current = (document.activeElement as HTMLElement)?.dataset
          .markerKey;
      cancelAnimationFrame(frame);
      for (const event of [
        "zoomend",
        "moveend",
        "resize",
        "tilesloaded",
      ] as const)
        instance.removeEventListener(event, schedule);
      clear();
    };
  }, [props.instance, props.api, signature, props.selectedId, props.disabled]);

  if (!expanded) return null;
  return (
    <div
      ref={panel}
      className="restaurant-map-cluster-list"
      role="dialog"
      aria-label="这个位置的店铺"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <header>
        <div>
          <span>就在这一带</span>
          <h3>{expanded.shops.length} 家店，选一家看看</h3>
        </div>
        <button type="button" aria-label="关闭店铺列表" onClick={() => close()}>
          <DesignIcon name="close" size={18} />
        </button>
      </header>
      <div className="restaurant-map-cluster-rows">
        {expanded.shops.map((shop, i) => (
          <button
            type="button"
            key={shop.id ?? i}
            className="restaurant-map-cluster-row"
            aria-pressed={props.selectedId === shop.id}
            disabled={props.disabled}
            onClick={() => {
              props.onSelect?.(shop);
              close();
            }}
          >
            <DesignIcon name="store" size={20} />
            <span className="restaurant-map-cluster-info">
              <strong>{shop.name || "餐厅"}</strong>
              <small>{shop.address || "地址待补充"}</small>
            </span>
            <DesignIcon
              name={props.selectedId === shop.id ? "check" : "chevronRight"}
              size={18}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
