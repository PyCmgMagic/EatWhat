import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Star } from "lucide-react";
import type { Food, Restaurant } from "../api/models";
import { mediaUrl, money } from "../api/models";
import { stagePalette } from "../api/food-display";
import {
  priceBands,
  ratingScenes,
  type DishRating,
  type RecommendScene,
  type V2Shop,
} from "../api/v2-vocab";
import { FoodCover } from "../components/FoodCover";
import { FoodPhotoFallback } from "../components/FoodPhotoFallback";
import { useFoodPhoto } from "./media";
import { ratingText } from "./FoodRating";
import "./recommend-shops.css";

/**
 * A dish on a recommendation card. The field is still called signatureFoods,
 * but v2 now sends the featured dishes: the best rated ones served in the
 * current scene and meal time, whether or not they are marked as signature.
 */
export type Signature = NonNullable<Restaurant["signatureFoods"]>[number] & {
  coverCrop?: Food["coverCrop"];
  signature?: boolean | null;
  rating?: DishRating | null;
};
/** Fields of the v2 recommendation card the v1 shop type does not declare. */
type Card = Restaurant & V2Shop;

export function distanceText(meters?: number | null) {
  if (meters == null) return "";
  return meters < 1000
    ? `${Math.round(meters)} 米`
    : `${(meters / 1000).toFixed(1)} 公里`;
}

/** "堂食推荐 85% · 12 人评价"; the rate alone would overstate a single vote. */
export function dineInText(shop: Card) {
  const count = shop.dineIn?.count ?? 0,
    rate = shop.dineIn?.rate;
  if (!count || rate == null) return "还没有堂食评价";
  return `堂食推荐 ${Math.round(rate * 100)}% · ${count} 人评价`;
}

function FeaturedDish({
  dish,
  onOpen,
}: {
  dish: Signature;
  onOpen?: (dish: Signature) => void;
}) {
  const src = mediaUrl(dish.coverUrl);
  const photo = useFoodPhoto(src);
  const score = ratingText(dish.rating);
  return (
    <li>
      <Link
        to={`/foods/${dish.id}`}
        className="rec-shop-dish"
        onClick={() => onOpen?.(dish)}
      >
        <span
          className="rec-shop-dish-photo"
          style={{
            background:
              (dish.stageColor &&
                `color-mix(in srgb, ${stagePalette[dish.stageColor as keyof typeof stagePalette] ?? "var(--night-layer, #F4EFEB)"} 16%, var(--night-layer, white))`) ||
              "var(--night-layer, #F4EFEB)",
          }}
        >
          {photo.unavailable ? (
            <FoodPhotoFallback failed={photo.failed} />
          ) : (
            <span className="rec-shop-dish-image">
              <FoodCover
                className="rec-shop-cover"
                src={src}
                crop={dish.coverCrop}
                alt={dish.name ?? "代表菜"}
                loading="lazy"
                decoding="async"
                onError={photo.onError}
              />
            </span>
          )}
          {dish.signature && <span className="rec-shop-dish-badge">招牌</span>}
        </span>
        <span className="rec-shop-dish-info">
          <span className="rec-shop-dish-name">{dish.name}</span>
          <span className="rec-shop-dish-meta">
            <span
              className={`rec-shop-dish-price${dish.price == null ? " is-missing" : ""}`}
            >
              {dish.price == null ? (
                "价格待补充"
              ) : (
                <>
                  <span>¥</span>
                  <strong>{money(dish.price).slice(1)}</strong>
                </>
              )}
            </span>
            {score && (
              <span
                className="rec-shop-dish-score"
                role="img"
                aria-label={score}
                title={score}
              >
                <Star size={12} aria-hidden="true" />
                <strong>{dish.rating!.score!.toFixed(1)}</strong>
                <span>· {dish.rating!.count} 人</span>
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** One recommended shop with up to three featured dishes under it. */
export function RecommendShopCard({
  shop,
  rank,
  scene = "dine_in",
  onOpenShop,
  onOpenFood,
}: {
  shop: Restaurant;
  rank?: number;
  scene?: RecommendScene;
  onOpenShop?: (shop: Restaurant) => void;
  onOpenFood?: (dish: Signature) => void;
}) {
  const card = shop as Card;
  const dishes = (shop.signatureFoods ?? [])
    .filter((dish) => dish.id != null)
    .slice(0, 3) as Signature[];
  const distance = distanceText(shop.distanceMeters);
  const identity = /^(.*?)\s*[（(]([^）)]+)[）)]$/.exec(shop.name ?? "");
  const name = identity?.[1]?.trim() || shop.name;
  const branch = identity?.[2]?.trim();
  const place = branch || shop.hubName;
  const currentScene =
    ratingScenes.find((item) => item.id === scene) ?? ratingScenes[0];
  const stat = card[currentScene.key];
  const count = stat?.count ?? 0;
  const traits = [
    priceBands.find((band) => band.id === shop.priceBand)?.name,
    ...(card.categories ?? []).slice(0, 1),
    ...(card.tags ?? []).slice(0, 1),
  ].filter((value): value is string => !!value);
  return (
    <article className="rec-shop-card">
      <Link
        to={`/restaurants/${shop.id}`}
        className="rec-shop-head"
        data-rank={rank == null ? undefined : String(rank).padStart(2, "0")}
        aria-label={`查看${shop.name ?? "店铺"}`}
        onClick={() => onOpenShop?.(shop)}
      >
        <div className="rec-shop-identity">
          <h3>{name}</h3>
          {place && <span className="rec-shop-place">{place}</span>}
        </div>
        <span className="rec-shop-direction">
          <ArrowUpRight size={18} aria-hidden="true" />
          {distance && <span className="rec-shop-distance">{distance}</span>}
        </span>
        {traits.length > 0 && (
          <ul className="rec-shop-traits" aria-label="店铺特点">
            {traits.map((trait) => (
              <li key={trait}>{trait}</li>
            ))}
          </ul>
        )}
      </Link>
      {dishes.length ? (
        <ul
          className="rec-shop-dishes"
          data-count={dishes.length}
          aria-label={`${shop.name}的代表菜`}
        >
          {dishes.map((dish) => (
            <FeaturedDish key={dish.id} dish={dish} onOpen={onOpenFood} />
          ))}
        </ul>
      ) : (
        <Link
          className="rec-shop-no-dish"
          to={`/restaurants/${shop.id}`}
          onClick={() => onOpenShop?.(shop)}
        >
          <span>暂无菜品</span>
          <span>
            查看店铺 <ArrowUpRight size={15} aria-hidden="true" />
          </span>
        </Link>
      )}
      <p className="rec-shop-rating">
        {count > 0 ? (
          <>
            <span>
              {currentScene.name}
              {stat?.rate == null ? (
                ""
              ) : (
                <>
                  推荐 <strong>{Math.round(stat.rate * 100)}%</strong>
                </>
              )}
            </span>
            <span className="rec-shop-rating-count"> · {count} 人评价</span>
          </>
        ) : (
          <span className="rec-shop-unrated">暂无{currentScene.name}评价</span>
        )}
      </p>
    </article>
  );
}

export function RecommendShopList({
  shops,
  masonry = false,
  scene = "dine_in",
  onOpenShop,
  onOpenFood,
}: {
  shops: Restaurant[];
  masonry?: boolean;
  scene?: RecommendScene;
  onOpenShop?: (shop: Restaurant) => void;
  onOpenFood?: (dish: Signature) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const shopIds = shops.map((shop) => shop.id).join(",");
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !masonry || typeof ResizeObserver === "undefined") return;
    const styles = getComputedStyle(list);
    const track = parseFloat(styles.getPropertyValue("--rec-track"));
    const gap = parseFloat(styles.columnGap);
    // Span small grid tracks by the card's natural height. The browser packs
    // cards in source order, which also preserves the order of links for Tab.
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const card = entry.target as HTMLElement;
        const height = entry.borderBoxSize?.[0]?.blockSize ?? card.offsetHeight;
        card.style.setProperty(
          "--rec-span",
          String(Math.ceil((height + gap) / track)),
        );
      }
      list.dataset.measured = "true";
    });
    for (const card of list.children)
      observer.observe(card, { box: "border-box" });
    return () => {
      observer.disconnect();
      delete list.dataset.measured;
    };
  }, [masonry, shopIds]);
  return (
    <div
      ref={listRef}
      className={`rec-shop-list${masonry ? " is-masonry" : ""}`}
    >
      {shops.map((shop, i) => (
        <RecommendShopCard
          key={shop.id}
          shop={shop}
          rank={i + 1}
          scene={scene}
          onOpenShop={onOpenShop}
          onOpenFood={onOpenFood}
        />
      ))}
    </div>
  );
}
