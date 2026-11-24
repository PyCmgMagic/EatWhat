import { reportWebUsage } from "../app/web-usage";
import { Select } from "../components/Select";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  RotateCcw,
  Layers,
  Sparkle,
  Store,
  Utensils,
} from "lucide-react";
import { useApp } from "../app/state";
import { useArea } from "../app/area";
import { discoveryKinds, type DiscoveryKind } from "../app/discovery-category";
import { errorMessage } from "../api/client";
import { mediaUrl } from "../api/models";
import { FoodCover } from "../components/FoodCover";
import { useFoodPhoto } from "./media";
import type { V2Schema } from "../api/backend-v2";
import { mealOptions, mealSlotAt, type MealSlot } from "../api/food-display";
import { recommendScenes, type RecommendScene } from "../api/v2-vocab";
import { useMobile } from "../mobile/ui";
import { instantMotion, trackMotion } from "../motion/runtime";
import "./shop-draw.css";

const cards = [
  { position: "左侧", art: "niunan" },
  { position: "中间", art: "jiaozi" },
  { position: "右侧", art: "yangzhi" },
] as const;
const flipDuration = 570;
type Filters = {
  kind?: DiscoveryKind;
  scene: RecommendScene;
  mealTime?: MealSlot;
};
type Picked = NonNullable<V2Schema["Pick"]["restaurant"]>;

function DrawField({
  name,
  label,
  value,
  options,
  onChange,
}: {
  name: keyof Filters;
  label: string;
  value: string;
  options: ReadonlyArray<{ id: string; name: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="draw-field">
      <span className="draw-select" data-draw-field={name}>
        <Select inline motionDuration={200} closeDuration={100}
          name={name}
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>
      </span>
    </label>
  );
}

export default function ShopDraw() {
  const mobile = useMobile();
  const { area, ready } = useArea();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const section = useRef<HTMLElement>(null);
  const changedField = useRef<keyof Filters | null>(null);
  useLayoutEffect(() => {
    if (changedField.current) {
      section.current
        ?.querySelector<HTMLButtonElement>(
          `[data-draw-field="${changedField.current}"] [role="combobox"]`,
        )
        ?.focus({ preventScroll: true });
      changedField.current = null;
    }
  }, [location.search]);
  const mealTime = params.has("mealTime")
    ? mealOptions.find((item) => item.id === params.get("mealTime"))?.id
    : mobile.mealTime;
  const tea = (mealTime ?? mealSlotAt(Date.now())) === "afternoon_tea";
  const filters: Filters = {
    kind:
      discoveryKinds.find((item) => item.id === params.get("kind"))?.id ??
      (tea ? undefined : "food"),
    scene:
      recommendScenes.find((item) => item.id === params.get("scene"))?.id ??
      mobile.scene,
    mealTime,
  };
  const origin = location.state?.discoveryFrom;
  const back =
    typeof origin === "string" &&
    /^\/(?:home-photo|recommend)?(?:\?[^#]*)?$/.test(origin)
      ? origin
      : "/";
  function changeFilter(key: keyof Filters, value: string) {
    changedField.current = key;
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, {
      replace: true,
      state: location.state,
      preventScrollReset: true,
    });
  }
  const scope = JSON.stringify([
    location.key,
    filters.kind,
    filters.scene,
    filters.mealTime ?? mobile.mealKey,
    area?.gcjLng,
    area?.gcjLat,
  ]);
  return (
    <section
      ref={section}
      className="shop-draw"
      aria-labelledby="shop-draw-title"
    >
      <div className="draw-topline">
        <Link to={back}>
          <ArrowLeft size={18} aria-hidden="true" />
          返回发现
        </Link>
        {area?.name && (
          <span>
            <MapPin size={15} aria-hidden="true" />
            {area.name}
          </span>
        )}
      </div>
      <DrawCounter
        key={scope}
        scope={scope}
        filters={filters}
        ready={ready}
        lng={area?.gcjLng}
        lat={area?.gcjLat}
        changeFilter={changeFilter}
      />
    </section>
  );
}

function DrawCounter({
  filters,
  ready,
  lng,
  lat,
  scope,
  changeFilter,
}: {
  filters: Filters;
  ready: boolean;
  lng?: number;
  lat?: number;
  scope: string;
  changeFilter: (key: keyof Filters, value: string) => void;
}) {
  const { api } = useApp();
  const cache = useQueryClient();
  const [shop, setShop] = useState(() =>
    cache.getQueryData<Picked>(["shop-draw", scope]),
  );
  const [drawing, setDrawing] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef<AbortController | null>(null);
  const deck = useRef<HTMLDivElement>(null);
  const [pickedIndex, setPickedIndex] = useState(1);
  const [animateReveal, setAnimateReveal] = useState(false);
  const motion = useRef<Animation | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusResult = useRef(false);
  useEffect(
    () => () => {
      active.current?.abort();
      motion.current?.cancel();
    },
    [],
  );
  useEffect(() => {
    if (shop && !drawing && focusResult.current) {
      focusResult.current = false;
      heading.current?.focus({ preventScroll: true });
    }
  }, [shop, drawing]);

  async function draw(index = Math.floor(Math.random() * cards.length)) {
    if (active.current || !ready) return;
    reportWebUsage({ event: "dish_shuffle" });
    const controller = new AbortController();
    active.current = controller;
    setPickedIndex(index);
    setDrawing(true);
    setMessage("");
    setShop(undefined);
    cache.removeQueries({ queryKey: ["shop-draw", scope], exact: true });
    let revealTimer: number | undefined;
    try {
      const card = deck.current?.querySelectorAll("button")[index];
      let flip: Promise<void> | undefined;
      setAnimateReveal(false);
      if (card?.animate && !instantMotion()) {
        setAnimateReveal(true);
        motion.current = trackMotion(
          card.animate(
            [
              { transform: getComputedStyle(card).transform },
              {
                transform: "translateY(-12%) rotate(-5deg) scale(1.04)",
                offset: 0.55,
              },
              { transform: "perspective(800px) rotateY(78deg) scale(1.04)" },
            ],
            { duration: flipDuration, easing: "ease-in-out", fill: "forwards" },
          ),
        );
        // A background tab can suspend its animation timeline after the request returns.
        const finished = motion.current.finished;
        flip = new Promise<void>((resolve) => {
          revealTimer = window.setTimeout(resolve, flipDuration + 80);
          void finished.then(
            () => resolve(),
            () => resolve(),
          );
        });
      }
      const [result] = await Promise.all([
        api.pickShop(
          { ...filters, gcjLng: lng, gcjLat: lat },
          controller.signal,
        ),
        flip,
      ]);
      if (controller.signal.aborted) return;
      if (result.restaurant === null) {
        setMessage("这个范围暂时没有店铺，换个饭点或分类再抽。");
      } else if (!result.restaurant?.id) {
        setMessage("店铺信息不完整，请再抽一张。");
      } else {
        cache.setQueryData(["shop-draw", scope], result.restaurant);
        focusResult.current =
          document.documentElement.dataset.motionInput === "keyboard";
        setShop(result.restaurant);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        reportWebUsage({ event: "load_failed", page: "RECOMMEND" });
        setMessage(errorMessage(error));
      }
    } finally {
      window.clearTimeout(revealTimer);
      motion.current?.cancel();
      motion.current = null;
      if (!controller.signal.aborted) setDrawing(false);
      active.current = null;
    }
  }
  const state = drawing ? "drawing" : shop ? "revealed" : "ready";
  return (
    <div className="draw-counter" data-state={state}>
      <div className="draw-intro">
        <h1 id="shop-draw-title">随机选一家</h1>
        <fieldset className="draw-fields" disabled={drawing}>
          <legend className="sr-only">抽取范围</legend>
          <DrawField
            name="mealTime"
            label="饭点"
            value={filters.mealTime ?? "auto"}
            options={[{ id: "auto", name: "当前饭点" }, ...mealOptions]}
            onChange={(v) => changeFilter("mealTime", v)}
          />
          <DrawField
            name="scene"
            label="场景"
            value={filters.scene}
            options={recommendScenes}
            onChange={(v) => changeFilter("scene", v)}
          />
          <DrawField
            name="kind"
            label="分类"
            value={filters.kind ?? "auto"}
            options={(filters.mealTime ?? mealSlotAt(Date.now())) === "afternoon_tea"
              ? [{ id: "auto", name: "美食和饮品" }, ...discoveryKinds]
              : discoveryKinds}
            onChange={(v) => changeFilter("kind", v)}
          />
        </fieldset>
      </div>
      <div className="draw-table">
        <div
          className="draw-deck"
          ref={deck}
          inert={!!shop}
          aria-hidden={shop ? true : undefined}
          role="group"
          aria-label="选择一张餐牌"
        >
          {cards.map(({ position, art }, index) => (
            <button
              key={art}
              type="button"
              className="draw-card"
              data-picked={drawing && index === pickedIndex ? true : undefined}
              disabled={drawing || !ready}
              aria-label={`抽取${position}餐牌`}
              onClick={() => void draw(index)}
            >
              <span className="draw-card-print" aria-hidden="true">
                <Sparkle className="draw-mark-top" />
                <span className="draw-medallion">
                  <img
                    src={`/prototype/assets/dishes/${art}.svg`}
                    alt=""
                    draggable={false}
                  />
                </span>
                <Sparkle className="draw-mark-bottom" />
              </span>
            </button>
          ))}
        </div>
        <div
          className="draw-notice"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {drawing && <span className="sr-only">正在翻牌</span>}
          {shop && (
            <div
              className="draw-result"
              data-animate={animateReveal || undefined}
            >
              <div className="draw-result-head">
                <span>抽到了</span>
                <Sparkle size={18} aria-hidden="true" />
              </div>
              <div className="draw-result-main">
                <h2 ref={heading} tabIndex={-1}>
                  {shop.name || "抽到的店铺"}
                </h2>
                <ResultImage shop={shop} />
              </div>
              {(shop.address || shop.hubName) && (
                <p>
                  <MapPin size={15} aria-hidden="true" />
                  {shop.address || shop.hubName}
                </p>
              )}
              {shop.signatureFoods?.some((dish) => dish.name) && (
                <p>
                  <Utensils size={15} aria-hidden="true" />
                  {shop.signatureFoods
                    .map((dish) => dish.name)
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("、")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="draw-footer">
        {message && (
          <p className="draw-feedback" role="alert">
            {message}
          </p>
        )}
        <div className="draw-actions">
          {shop && (
            <Link className="draw-primary" to={`/restaurants/${shop.id}`} onClick={() => reportWebUsage({ event: "dish_decide", restaurantId: shop.id })}>
              去看店铺
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
          )}
          <button
            type="button"
            className={shop ? "draw-again" : "draw-primary"}
            disabled={drawing || !ready}
            onClick={() => void draw()}
          >
            {shop ? (
              <RotateCcw size={16} aria-hidden="true" />
            ) : (
              <Layers size={19} aria-hidden="true" />
            )}
            {drawing
              ? "正在翻牌…"
              : shop
                ? "再抽一张"
                : ready
                  ? "抽一张餐牌"
                  : "正在读取位置…"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultImage({ shop }: { shop: Picked }) {
  const dish = shop.signatureFoods?.find((item) => item.pictureUrl);
  const src = mediaUrl(dish?.pictureUrl || shop.pictureUrl);
  const photo = useFoodPhoto(src);
  return (
    <span className="draw-result-image" aria-hidden="true">
      {photo.unavailable ? (
        <Store size={30} strokeWidth={1.5} />
      ) : (
        <FoodCover
          src={src}
          crop={dish?.coverCrop}
          alt=""
          onError={photo.onError}
        />
      )}
    </span>
  );
}
