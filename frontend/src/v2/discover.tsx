import { useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Select } from "../components/Select";
import { PageSkeleton } from "../components/LoadingSkeleton";
import { DesignIcon } from "../mobile/ui";
import { useDeviceLocation } from "../features/useDeviceLocation";
import {
  dragHeroOrbit,
  heroOrbitSlots,
  heroOrbitStep,
  heroPlateTransform,
  nearestHeroPosition,
} from "../motion/hero-orbit";
import type { V2Options, V2Schema } from "../api/backend-v2";
import { errorMessage } from "../api/client";
import type { Area } from "../app/area";
import { useV2 } from "./state";
import { Notice, Picture, QueryState, useAction } from "./ui";

export const priceLabels: Record<string, string> = {
  UNDER_15: "15 元以下",
  FROM_15_TO_30: "15–30 元",
  OVER_30: "30 元以上",
};
export const meals = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  night: "夜宵",
};
export const scenes = { dine_in: "堂食", delivery: "外卖" } as const;
export type Scene = keyof typeof scenes;

function SceneTabs({
  scene,
  setScene,
  className = "",
}: {
  scene: Scene;
  setScene: (scene: Scene) => void;
  className?: string;
}) {
  return (
    <div
      className={`pc-tabs v2-scene-tabs ${className}`.trim()}
      aria-label="用餐方式"
    >
      {Object.entries(scenes).map(([key, label]) => (
        <button
          key={key}
          aria-pressed={scene === key}
          onClick={() => setScene(key as Scene)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function useCampuses() {
  const { call } = useV2();
  return useQuery({
    queryKey: ["v2", "campuses"],
    queryFn: ({ signal }) => call("campuses", { signal }),
    staleTime: 300_000,
  });
}

export function useRestaurantTags() {
  const { call } = useV2();
  return useQuery({
    queryKey: ["v2", "tags"],
    queryFn: ({ signal }) => call("tags", { signal }),
    staleTime: 300_000,
  });
}

export function distanceText(meters?: number | null) {
  if (meters == null || !Number.isFinite(meters)) return "";
  return meters < 1000
    ? Math.round(meters) + " 米"
    : (meters / 1000).toFixed(1) + " 公里";
}

export function ratingText(stat?: V2Schema["Stat"]) {
  return stat?.rate == null
    ? "暂无评价"
    : Math.round(stat.rate * 100) + "% 推荐 · " + (stat.count ?? 0) + " 条";
}

type Card = V2Schema["Card"];
type Filters = NonNullable<V2Options<"recommend">["query"]>;
const noCampus = "all";

function recommendationPicture(shop?: Card) {
  return (
    shop?.signatureFoods?.find((food) => food.pictureUrl)?.pictureUrl ??
    shop?.pictureUrl
  );
}

export function Discover({ desktop }: { desktop: boolean }) {
  const { session } = useV2();
  const campuses = useCampuses();
  const [campus, setCampus] = useState<string>();
  const [mealTime, setMealTime] = useState("");
  const [scene, setScene] = useState<Scene>("dine_in");
  const [area, setArea] = useState<Area | null>(null);
  const device = useDeviceLocation({
    area,
    selectArea: setArea,
    autoLocate: false,
  });
  const defaultCampus =
    campuses.data?.find((item) => item.isDefault) ?? campuses.data?.[0];
  const selectedCampus = campus ?? String(defaultCampus?.id ?? noCampus);
  const campusId =
    selectedCampus === noCampus ? undefined : Number(selectedCampus);
  const campusName =
    campuses.data?.find((item) => item.id === campusId)?.name ?? "所有校区";
  const filters: Filters = {
    scene,
    campusId,
    mealTime: mealTime || undefined,
    gcjLng: area?.gcjLng,
    gcjLat: area?.gcjLat,
  };
  const controls = (
    <>
      <label>
        校区
        <Select
          aria-label="推荐校区"
          value={selectedCampus}
          disabled={campuses.isPending}
          icon={<DesignIcon name="nearby" size={15} />}
          onChange={(event) => setCampus(event.target.value)}
        >
          <option value={noCampus}>所有校区</option>
          {campuses.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </label>
      <label>
        饭点
        <Select
          aria-label="推荐饭点"
          value={mealTime}
          icon={<DesignIcon name="utensils" size={15} />}
          onChange={(event) => setMealTime(event.target.value)}
        >
          <option value="">当前饭点</option>
          {Object.entries(meals).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </label>
      <button
        className="v2-home-link"
        onClick={device.locate}
        disabled={device.locating}
      >
        {device.locating ? "定位中…" : "使用当前位置"}
      </button>
      {campuses.isError && (
        <button
          className="v2-home-link"
          onClick={() => void campuses.refetch()}
        >
          重试校区
        </button>
      )}
      <Notice error={device.locationError} />
    </>
  );
  const sceneTabs = <SceneTabs {...{ scene, setScene }} />;
  const toolbar = desktop ? (
    <>
      {sceneTabs}
      {controls}
    </>
  ) : (
    <div className="v2-mobile-recommend-header">
      <header className="mobile-home-toolbar v2-mobile-toolbar">
        <details className="v2-home-location">
          <summary>
            <DesignIcon name="nearby" size={16} />
            <strong>{area?.name ?? (campusId ? campusName : "选地点")}</strong>
            <span>{meals[mealTime as keyof typeof meals] ?? "当前饭点"}</span>
            <DesignIcon name="chevronDown" size={14} />
          </summary>
          <div className="ew-recommend-controls">{controls}</div>
        </details>
        <div className="v2-home-toolbar-actions">
          <Link to="/search" aria-label="搜索店铺">
            <DesignIcon name="search" size={22} />
          </Link>
          <Link
            to={session ? "/me" : "/auth"}
            aria-label={session ? "我的主页" : "登录"}
          >
            <DesignIcon name="me" size={22} />
          </Link>
        </div>
      </header>
      <SceneTabs {...{ scene, setScene }} className="v2-mobile-scene-tabs" />
    </div>
  );
  return (
    <Wheel
      key={JSON.stringify(filters)}
      {...{ desktop, filters, scene, toolbar }}
      enabled={!campuses.isPending}
    />
  );
}

function Wheel({
  desktop,
  filters,
  scene,
  toolbar,
  enabled,
}: {
  desktop: boolean;
  filters: Filters;
  scene: Scene;
  toolbar: ReactNode;
  enabled: boolean;
}) {
  const { call, session } = useV2();
  const cache = useQueryClient();
  const [batch, setBatch] = useState({ page: 1, sequence: 0 });
  const [position, setPosition] = useState(0);
  const [picked, setPicked] = useState<Card>();
  const task = useAction();
  // Signed-in recommendation reads advance the feed. Rotating or resizing the
  // same batch must leave the current query untouched.
  const feed = useQuery({
    queryKey: ["v2", "recommend", filters, batch],
    queryFn: () =>
      call("recommend", {
        query: { ...filters, page: batch.page, pageSize: 8 },
      }),
    enabled,
    staleTime: Infinity,
    refetchOnMount: false,
  });
  const items = (feed.data?.items ?? []).filter((item) => item.id);
  const wheel = picked
    ? [picked, ...items.filter((item) => item.id !== picked.id)]
    : items;
  const index = wheel.length
    ? ((position % wheel.length) + wheel.length) % wheel.length
    : 0;
  const active = wheel[index];
  const busy = !enabled || feed.isFetching || task.busy;
  const move = (direction: number) => {
    if (wheel.length > 1) setPosition((old) => old + direction);
  };
  const nextBatch = () => {
    setPicked(undefined);
    setPosition(0);
    setBatch((old) => ({
      page: session || feed.data?.hasNext ? old.page + 1 : 1,
      sequence: old.sequence + 1,
    }));
  };
  const pick = () =>
    void task.run(async (signal) => {
      const result = await call("pick", { query: filters, signal });
      if (!result?.restaurant) throw new Error("当前条件下没有可推荐的店铺。");
      setPicked(result.restaurant);
      setPosition(0);
    });
  const dismiss = (id: number) =>
    void task.run(async (signal) => {
      await call("dismiss", { path: { id }, signal });
      if (picked?.id === id) setPicked(undefined);
      cache.setQueriesData<V2Schema["Feed"]>(
        { queryKey: ["v2", "recommend"] },
        (previous) =>
          previous && {
            ...previous,
            items: previous.items?.filter((item) => item.id !== id),
          },
      );
    }, "已减少这家店的推荐。");

  const batchButton = (
    <button
      className={desktop ? "v2-home-link" : "design-button light"}
      disabled={busy}
      onClick={nextBatch}
    >
      换一批
    </button>
  );
  const pickButton = (
    <button className="v2-home-link" onClick={pick} disabled={busy}>
      <DesignIcon name="shuffle" size={16} />
      摇一摇
    </button>
  );
  const desktopControls = desktop && (
    <div className="ew-recommend-controls">
      {toolbar}
      {batchButton}
      <Link to="/search">搜店铺 →</Link>
    </div>
  );
  if (desktop && !active) {
    return (
      <div className="pc-home v2-home">
        {desktopControls}
        {feed.isPending ? (
          <PageSkeleton kind="home" />
        ) : (
          <section className="pc-status">
            <div className="pc-status-icon">
              <DesignIcon name="bowl" size={36} />
            </div>
            <h1>{feed.error ? "推荐暂时不可用" : "暂无推荐店铺"}</h1>
            {feed.error && <p role="alert">{errorMessage(feed.error)}</p>}
            <div className="v2-home-tools">{pickButton}</div>
            <Notice {...task} />
            {feed.error ? (
              <button className="pc-button" onClick={() => void feed.refetch()}>
                再试一次
              </button>
            ) : (
              <Link className="pc-button" to="/nearby">
                逛逛附近
              </Link>
            )}
          </section>
        )}
      </div>
    );
  }
  const sheet = (
    <section
      className={
        desktop ? "pc-discovery-sheet" : "mobile-home-sheet v2-home-sheet"
      }
    >
      <div className="pc-sheet-handle" />
      <div className="pc-section-toolbar">
        <div className="v2-home-tools">
          {pickButton}
          {session && active?.id && (
            <button
              className="v2-home-link"
              disabled={busy}
              onClick={() => dismiss(active.id!)}
            >
              不感兴趣
            </button>
          )}
        </div>
      </div>
      <Notice {...task} />
      <QueryState query={feed}>
        {items.length ? (
          <div
            className={
              desktop ? "pc-food-grid" : "design-food-grid mobile-data-grid"
            }
          >
            {items.map((shop, i) => (
              <RecommendationCard
                key={shop.id}
                {...{ shop, desktop, scene }}
                shade={i % 2 ? "#F6E0DB" : "#F2E6D6"}
              />
            ))}
          </div>
        ) : (
          <p className="v2-home-empty-note">暂无推荐店铺</p>
        )}
      </QueryState>
      {!desktop && batchButton}
    </section>
  );
  const orbit = active && (
    <RestaurantOrbit {...{ desktop, wheel, position, move }} />
  );
  const dots = active && (
    <div className={desktop ? "pc-hero-dots" : "pc-hero-dots mobile-home-dots"}>
      {wheel.map((shop, i) => (
        <button
          aria-label={"查看 " + shop.name}
          aria-pressed={index === i}
          key={shop.id}
          onClick={() =>
            setPosition(nearestHeroPosition(position, i, wheel.length))
          }
        />
      ))}
    </div>
  );
  const actions = active ? (
    <div
      className={
        desktop
          ? "pc-hero-actions"
          : "mobile-home-actions v2-mobile-hero-actions"
      }
    >
      <button
        className={desktop ? "pc-hero-secondary" : "design-button light"}
        disabled={wheel.length < 2}
        onClick={() => move(1)}
      >
        <DesignIcon name="shuffle" size={19} />
        换一个
      </button>
      <Link
        className={desktop ? "pc-hero-primary" : "design-button"}
        to={"/restaurants/" + active.id}
      >
        就它了{desktop && <DesignIcon name="chevronRight" size={19} />}
      </Link>
    </div>
  ) : (
    <div
      className={desktop ? "pc-hero-actions" : "mobile-home-resting-actions"}
    >
      <Link
        className={desktop ? "pc-hero-primary" : "design-button"}
        to="/nearby"
      >
        <DesignIcon name="nearby" size={18} />
        逛逛附近
      </Link>
    </div>
  );
  const copy = (
    <div
      className={
        desktop
          ? "pc-hero-copy"
          : active
            ? "mobile-home-copy"
            : "mobile-home-resting-copy"
      }
    >
      <h1>{active?.name ?? "今天吃点什么？"}</h1>
      {active && (
        <>
          <p className={desktop ? "pc-hero-shop" : "mobile-home-shop"}>
            {active.hubName || active.address}
          </p>
          {active.distanceMeters != null && (
            <p
              className={desktop ? "pc-hero-distance" : "mobile-home-distance"}
            >
              {distanceText(active.distanceMeters)}
            </p>
          )}
          <div className="v2-home-rating">
            {ratingText(scene === "dine_in" ? active.dineIn : active.delivery)}
          </div>
          {!!active.signatureFoods?.length && (
            <ul className="v2-signature-row" aria-label="招牌菜">
              {active.signatureFoods.slice(0, 3).map((food) => (
                <li key={food.id}>{food.name}</li>
              ))}
            </ul>
          )}
          {active.priceBand && (
            <p className={desktop ? "pc-hero-price" : "mobile-home-price"}>
              {priceLabels[active.priceBand]}
            </p>
          )}
        </>
      )}
    </div>
  );

  return desktop ? (
    <div className="pc-home v2-home">
      {desktopControls}
      <section className="pc-hero" aria-label="店铺推荐">
        <div className="pc-round-table" aria-hidden="true" />
        <div className="pc-orbit-line" aria-hidden="true" />
        {active && (
          <div className="pc-hero-counter">
            <span>{String(index + 1).padStart(2, "0")}</span>
            <span>/ {String(wheel.length).padStart(2, "0")}</span>
          </div>
        )}
        {copy}
        {orbit}
        {actions}
        {dots}
      </section>
      {sheet}
    </div>
  ) : (
    <div
      className={
        "mobile-home-screen v2-home" +
        (active ? "" : " mobile-home-unavailable")
      }
    >
      <section className="mobile-home-hero" aria-label="店铺推荐">
        <div className="mobile-home-art" aria-hidden="true">
          <div className="v2-home-table" />
          <div className="v2-home-ring" />
          {!active && (
            <span className="mobile-home-empty-plate">
              <DesignIcon name="bowl" size={66} />
            </span>
          )}
        </div>
        {orbit}
        {toolbar}
        {copy}
        {dots}
        {actions}
      </section>
      {sheet}
    </div>
  );
}

function RestaurantOrbit({
  desktop,
  wheel,
  position,
  move,
}: {
  desktop: boolean;
  wheel: Card[];
  position: number;
  move: (direction: number) => void;
}) {
  const pointer = useRef<{ id: number; x: number; radius: number } | null>(
    null,
  );
  const tilt = desktop ? 0 : 55;
  const slots = heroOrbitSlots(position, Math.min(wheel.length, 4)).map(
    (slot) => {
      const offset = slot - position;
      const shop = wheel[((slot % wheel.length) + wheel.length) % wheel.length];
      const plate = desktop
        ? "pc-plate is-photo " +
          (offset === 0
            ? "pc-current-plate"
            : offset === 1
              ? "pc-next-plate"
              : "")
        : "mobile-home-plate";
      return (
        <div
          key={slot + ":" + shop.id}
          className={plate}
          data-orbit-offset={offset}
          aria-hidden="true"
          style={{
            transform: heroPlateTransform(offset * heroOrbitStep, tilt),
          }}
        >
          <Picture
            url={recommendationPicture(shop)}
            className={desktop ? "" : "is-food-photo"}
          />
        </div>
      );
    },
  );
  const reset = (element: HTMLElement) => {
    pointer.current = null;
    delete element.dataset.dragging;
    dragHeroOrbit(element, 0, tilt);
  };
  return (
    <div
      className={desktop ? "pc-hero-food" : "v2-mobile-home-gesture"}
      role="group"
      aria-label="推荐转盘，左右滑动换店"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0 || wheel.length < 2) return;
        const plate = event.currentTarget.querySelector<HTMLElement>(
          '[data-orbit-offset="0"]',
        );
        pointer.current = {
          id: event.pointerId,
          x: event.clientX,
          radius: (plate?.offsetWidth ?? 250) * (desktop ? 1.03 : 1.34),
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = pointer.current;
        if (
          !start ||
          start.id !== event.pointerId ||
          matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return;
        event.currentTarget.dataset.dragging = "true";
        const angle =
          heroOrbitStep *
          Math.tanh(
            (event.clientX - start.x) /
              ((start.radius * heroOrbitStep * Math.PI) / 180),
          );
        dragHeroOrbit(event.currentTarget, angle, tilt);
      }}
      onPointerUp={(event) => {
        if (pointer.current?.id !== event.pointerId) return;
        const distance = event.clientX - pointer.current.x;
        reset(event.currentTarget);
        if (Math.abs(distance) > 30) move(distance < 0 ? 1 : -1);
      }}
      onPointerCancel={(event) => reset(event.currentTarget)}
      onLostPointerCapture={(event) => {
        if (pointer.current) reset(event.currentTarget);
      }}
    >
      {desktop ? slots : <div className="mobile-home-orbit">{slots}</div>}
    </div>
  );
}

function RecommendationCard({
  shop,
  desktop,
  scene,
  shade,
}: {
  shop: Card;
  desktop: boolean;
  scene: Scene;
  shade: string;
}) {
  const price = priceLabels[shop.priceBand ?? ""];
  const stat = scene === "dine_in" ? shop.dineIn : shop.delivery;
  const signature = shop.signatureFoods?.[0];
  return (
    <Link
      className={desktop ? "pc-food-card" : "design-food-tile"}
      to={"/restaurants/" + shop.id}
    >
      <div
        className={desktop ? "pc-food-card-image" : "design-tile-image"}
        style={{ background: shade }}
      >
        {desktop ? (
          <div className="pc-plate is-photo">
            <Picture url={recommendationPicture(shop)} />
          </div>
        ) : (
          <Picture
            url={recommendationPicture(shop)}
            className="is-food-photo"
          />
        )}
        {desktop && (signature?.name || shop.categories?.[0]) && (
          <span className="pc-card-category">
            {signature?.name || shop.categories?.[0]}
          </span>
        )}
      </div>
      <div className={desktop ? "pc-food-card-title" : undefined}>
        <h3>{shop.name}</h3>
        {desktop && price && <span>{price}</span>}
      </div>
      <div className={desktop ? "pc-food-card-meta" : undefined}>
        <span>{signature?.name || shop.hubName || shop.address}</span>
        {desktop && stat?.rate != null && (
          <span>{Math.round(stat.rate * 100)}% 推荐</span>
        )}
      </div>
    </Link>
  );
}
