import {
  createContext,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Food, Restaurant } from "../api/models";
import type { RecommendScene } from "../api/v2-vocab";
import type { MealSlot } from "../api/food-display";
import { mediaUrl, money } from "../api/models";
import { useFoodPhoto } from "../features/media";
import { FoodPhotoFallback } from "../components/FoodPhotoFallback";
import { FoodCover } from "../components/FoodCover";
import { useApp } from "../app/state";
import { useLoginDialog } from "../app/auth-dialog";
import { useActionAccess } from "../features/access";
import { LiquidGlass } from "./LiquidGlass";
import { useLiquidLens } from "./useLiquidLens";
import { lensDuration, liquidReleaseEasing } from "./liquid-lens-motion";
import type { DraftPhoto, DraftPhotoEdit } from "./draft-photo-edit";
import {
  DishIllustration,
  type DishIllustrationName,
} from "../components/DishIllustration";

export type MobileState = {
  foodId: number;
  shopId: number;
  setFoodId: (id: number) => void;
  setShopId: (id: number) => void;
  panel: string | null;
  openPanel: (name: string) => void;
  closePanel: () => void;
  notice: (message: string) => void;
  confirm: (
    message: string,
    action: () => Promise<unknown>,
    label?: string,
  ) => void;
  go: (screen: string) => void;
  draft: Draft;
  setDraft: (patch: DraftPatch) => void;
  tagId?: number;
  setTagId: (id?: number) => void;
  /** Name of the meal slot in use, e.g. 晚饭. */
  meal: string;
  /** True while following the clock rather than a manual pick. */
  mealAuto: boolean;
  /** mealTime to send: the manual pick, or undefined to let the backend decide. */
  mealTime?: MealSlot;
  /** Changes when the slot in use changes; part of recommendation query keys. */
  mealKey: string;
  /** Manual pick by name (早饭…夜宵); lasts until the current slot ends. */
  setMeal: (name: string) => void;
  setMealAuto: () => void;
  /** Slot the backend used for an automatic recommendation. */
  noteServedMeal: (mealTime: string | null | undefined) => void;
  scene: RecommendScene;
  setScene: (scene: RecommendScene) => void;
};
export type Draft = {
  name: string;
  price: string;
  category: string;
  description: string;
  images: DraftPhoto[];
  photoEdit?: DraftPhotoEdit;
  /** Explicit stage choice. Without one, follow the cover's first recommendation. */
  stage?: string;
  tags: string[];
  tagInput?: string;
  systemTagIds?: number[];
  /** v2: marks the dish as the shop's signature. */
  signature?: boolean;
  /** v2: the dish's own meal times ([] or absent = follows the shop). */
  mealTimes?: string[];
  deliveryEnabled?: boolean;
  crop?: { x: number; y: number; zoom: number };
  shopName?: string;
  restaurantId?: number;
  restaurantPicked?: boolean;
  publishing?: boolean;
  publishPhase?: "uploading" | "submitting";
  publishUncertain?: boolean;
};
export type DraftPatch = Partial<Draft> | ((current: Draft) => Partial<Draft>);
export const MobileContext = createContext<MobileState | null>(null);
export const DesignRegistryContext = createContext<Record<string, any>>({});
export function useMobile() {
  const v = useContext(MobileContext);
  if (!v) throw new Error("MobileProvider missing");
  return v;
}
export function DesignIcon({
  name,
  size = 24,
}: {
  name: string;
  size?: number;
}) {
  const filename = name.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
  return (
    <span
      aria-hidden="true"
      className="design-icon"
      style={{
        width: size,
        height: size,
        maskImage: `url('/prototype/assets/icons/${filename}.svg')`,
        WebkitMaskImage: `url('/prototype/assets/icons/${filename}.svg')`,
      }}
    />
  );
}
export function DesignNav({ active }: { active: string }) {
  const nav = useNavigate();
  const { session } = useApp();
  const { openLogin } = useLoginDialog();
  const access = useActionAccess();
  return (
    <DesignNavigation
      active={active}
      action={
        <button
          className="design-fab"
          style={
            {
              "--glass-release-easing": liquidReleaseEasing,
              "--glass-release-duration": `${lensDuration}ms`,
            } as CSSProperties
          }
          onPointerDown={pressGlass}
          onPointerMove={trackGlassLight}
          onPointerLeave={resetGlassLight}
          aria-label="发布一道菜"
          onClick={() => {
            if (!session) openLogin("/auth?next=%2Fpublish");
            else if (access(true)) void nav("/publish");
          }}
        >
          <PublishButtonSurface />
        </button>
      }
    />
  );
}

export const mainDestinations = [
  { key: "home", path: "/", icon: "discover", label: "发现" },
  { key: "nearby", path: "/nearby", icon: "nearby", label: "附近" },
  { key: "me", path: "/me", icon: "me", label: "我的" },
] as const;

export function PublishButtonSurface() {
  return (
    <span className="design-fab-surface" aria-hidden="true">
      <LiquidGlass />
      <DesignIcon name="add" size={26} />
    </span>
  );
}

function pressGlass(event: PointerEvent<HTMLElement>) {
  if (
    event.button !== 0 ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  trackGlassLight(event);
  const element = event.currentTarget;
  const bounds = element.getBoundingClientRect();
  const x = Math.max(
    -1,
    Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1),
  );
  const y = Math.max(
    -1,
    Math.min(1, ((event.clientY - bounds.top) / bounds.height) * 2 - 1),
  );
  element.style.setProperty("--glass-press-x", `${x * 2}px`);
  element.style.setProperty("--glass-press-y", `${y * 1.5}px`);
}

function trackGlassLight(event: PointerEvent<HTMLElement>) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const element = event.currentTarget;
  const bounds = element.getBoundingClientRect();
  element.style.setProperty(
    "--glass-light-x",
    `${((event.clientX - bounds.left) / bounds.width) * 100}%`,
  );
  element.style.setProperty(
    "--glass-light-y",
    `${((event.clientY - bounds.top) / bounds.height) * 100}%`,
  );
}

function resetGlassLight(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.removeProperty("--glass-light-x");
  event.currentTarget.style.removeProperty("--glass-light-y");
}

export function DesignNavigation({
  active,
  action,
}: {
  active: string;
  action: ReactNode;
}) {
  const [instant, setInstant] = useState(false);
  const selected = Math.max(
    0,
    mainDestinations.findIndex(({ key }) => key === active),
  );
  const lens = useLiquidLens(selected, instant, mainDestinations.length);
  return (
    <div className="design-navigation">
      <nav
        aria-label="主导航"
        data-motion={instant ? "instant" : undefined}
        onClickCapture={(event) => setInstant(event.detail === 0)}
        onPointerMove={trackGlassLight}
        onPointerLeave={resetGlassLight}
      >
        <LiquidGlass />
        <span
          ref={lens}
          className="design-nav-lens"
          aria-hidden="true"
          style={{
            transform: `translateX(calc(${selected * 100}% + ${selected * 2}px))`,
          }}
        />
        {mainDestinations.map((n) => (
          <Link
            key={n.key}
            to={n.path}
            aria-current={active === n.key ? "page" : undefined}
          >
            <DesignIcon
              name={
                active === n.key && n.key !== "nearby"
                  ? n.icon + "Selected"
                  : n.icon
              }
              size={22}
            />
            {n.label}
          </Link>
        ))}
      </nav>
      {action}
    </div>
  );
}
export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  light = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  light?: boolean;
}) {
  return (
    <button
      className={`design-button ${light ? "light" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Pending({ name = "敬请期待" }: { name?: string }) {
  return <span className="design-pending">{name}</span>;
}
export function MobileEmpty({
  title,
  detail,
  action,
  illustration,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  illustration?: DishIllustrationName;
}) {
  return (
    <div className="mobile-empty">
      {illustration ? (
        <span className="mobile-empty-art">
          <DishIllustration name={illustration} />
        </span>
      ) : (
        <DesignIcon name="bowl" size={32} />
      )}
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
      {action}
    </div>
  );
}
export function FoodTile({
  food,
  visual,
  meta = "shop",
}: {
  food: Food;
  visual?: { asset: string; tileSurface: string };
  meta?: "shop" | "price" | "likes" | "profile";
}) {
  const m = useMobile();
  const src = mediaUrl(food.pictureUrl?.[0]);
  const photo = useFoodPhoto(src);
  return (
    <Link
      className={`design-food-tile design-food-meta-${meta}`}
      to={`/foods/${food.id}`}
      onClick={() => food.id && m.setFoodId(food.id)}
    >
      <div
        className="design-tile-image"
        style={{ background: visual?.tileSurface ?? "var(--mist)" }}
      >
        {!photo.unavailable ? (
          <FoodCover
            crop={food.coverCrop}
            src={src}
            loading="lazy"
            decoding="async"
            onError={photo.onError}
            alt={food.name ?? "菜品"}
            className={visual?.asset ? "is-food-illustration" : "is-food-photo"}
            style={
              visual?.asset
                ? {
                    position: "absolute",
                    width: 150,
                    height: 150,
                    left:
                      visual.asset === "xiangguo"
                        ? -16
                        : visual.asset === "jiaozi"
                          ? -18
                          : visual.asset === "yuntun"
                            ? 28
                            : 30,
                    top:
                      visual.asset === "xiangguo"
                        ? 24
                        : visual.asset === "jiaozi"
                          ? 22
                          : 18,
                  }
                : undefined
            }
          />
        ) : (
          <FoodPhotoFallback category={food.category} failed={photo.failed} />
        )}
      </div>
      <div>
        <h3>{food.name || "未命名菜品"}</h3>
        {meta === "profile" && food.price != null && (
          <strong>{money(food.price)}</strong>
        )}
        <span className={meta === "profile" ? "profile-food-likes" : undefined}>
          {meta === "shop" ? (
            food.restaurantName || "餐厅信息待补充"
          ) : meta === "price" ? (
            money(food.price)
          ) : (
            <>
              <DesignIcon name="heart" size={14} />
              {meta === "profile" && <span className="sr-only">获赞</span>}
              {food.likesCount ?? "—"}
            </>
          )}
        </span>
      </div>
    </Link>
  );
}
export function ShopRow({
  shop,
  selected = false,
  onSelect,
}: {
  shop: Restaurant;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const m = useMobile(),
    content = (
      <>
        <span className="design-shop-image">
          {mediaUrl(shop.pictureUrl?.[0]) ? (
            <img
              src={mediaUrl(shop.pictureUrl?.[0])}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <DesignIcon name="store" size={24} />
          )}
        </span>
        <span className="design-shop-copy">
          <strong>{shop.name}</strong>
          <small>{shop.address || "地址待补充"}</small>
        </span>
        {onSelect ? (
          <span className={`design-radio ${selected ? "selected" : ""}`}>
            {selected && <DesignIcon name="check" size={14} />}
          </span>
        ) : (
          <DesignIcon name="chevronRight" size={20} />
        )}
      </>
    );
  return onSelect ? (
    <button
      className="design-shop-row"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{ background: selected ? "var(--night-raised, #f8f3ee)" : "transparent" }}
    >
      {content}
    </button>
  ) : (
    <Link
      className="design-shop-row"
      to={`/restaurants/${shop.id}`}
      onClick={() => shop.id && m.setShopId(shop.id)}
    >
      {content}
    </Link>
  );
}
