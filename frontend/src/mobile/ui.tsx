import { createContext, useContext, useState, type ReactNode } from "react";
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
  setDraft: (patch: Partial<Draft>) => void;
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
  images: {
    file: File;
    url: string;
    key?: string;
    original?: File;
    framing?: { x: number; y: number; zoom: number };
  }[];
  stage: string;
  tags: string[];
  tagInput?: string;
  systemTagIds?: number[];
  /** v2: marks the dish as the shop's signature. */
  signature?: boolean;
  crop?: { x: number; y: number; zoom: number };
  candidates?: string[];
  shopName?: string;
  restaurantId?: number;
  publishing?: boolean;
  publishUncertain?: boolean;
};
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
          aria-label="发布一道菜"
          onClick={() => {
            if (!session) openLogin("/auth?next=%2Fpublish");
            else if (access(true)) void nav("/publish");
          }}
        >
          <DesignIcon name="add" size={26} />
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
  return (
    <div className="design-navigation">
      <nav
        aria-label="主导航"
        data-motion={instant ? "instant" : undefined}
        onClickCapture={(event) => setInstant(event.detail === 0)}
      >
        <span
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
            <DesignIcon name={n.icon} size={22} />
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
        <DishIllustration name={illustration} />
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
  visual?: { asset: string; tile: string };
  meta?: "shop" | "price" | "likes";
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
        style={{ background: visual?.tile ?? "#F4EFEB" }}
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
        <span>
          {meta === "shop" ? (
            food.restaurantName || "餐厅信息待补充"
          ) : meta === "price" ? (
            money(food.price)
          ) : (
            <>
              <DesignIcon name="heart" size={14} />
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
      style={{ background: selected ? "#F8F3EE" : "transparent" }}
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
