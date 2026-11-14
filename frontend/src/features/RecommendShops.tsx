import { Link } from "react-router-dom";
import type { Food, Restaurant } from "../api/models";
import { mediaUrl, money } from "../api/models";
import { stagePalette } from "../api/food-display";
import { priceBands } from "../api/v2-vocab";
import { FoodCover } from "../components/FoodCover";
import { useFoodPhoto } from "./media";
import "./recommend-shops.css";

export type Signature = NonNullable<Restaurant["signatureFoods"]>[number] & {
  coverCrop?: Food["coverCrop"];
};
/** Fields of the v2 recommendation card the v1 shop type does not declare. */
type Card = Restaurant & {
  dineIn?: { rate?: number | null; count?: number | null } | null;
  categories?: string[] | null;
  tags?: string[] | null;
};

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

function DishThumb({
  dish,
  onOpen,
}: {
  dish: Signature;
  onOpen?: (dish: Signature) => void;
}) {
  const src = mediaUrl(dish.coverUrl);
  const photo = useFoodPhoto(src);
  return (
    <li>
      <Link
        to={`/foods/${dish.id}`}
        className="rec-shop-dish"
        onClick={() => onOpen?.(dish)}
      >
        <span
          className="rec-shop-dish-plate"
          style={{
            background:
              (dish.stageColor &&
                stagePalette[dish.stageColor as keyof typeof stagePalette]) ||
              "#F4EFEB",
          }}
        >
          {!photo.unavailable && (
            <FoodCover
              className="rec-shop-cover"
              src={src}
              crop={dish.coverCrop}
              alt={dish.name ?? "招牌菜"}
              loading="lazy"
              decoding="async"
              onError={photo.onError}
            />
          )}
        </span>
        <span className="rec-shop-dish-name">{dish.name}</span>
        <span className="rec-shop-dish-price">
          {dish.price == null ? "价格待补充" : money(dish.price)}
        </span>
      </Link>
    </li>
  );
}

/** One recommended shop with up to three signature dishes under it. */
export function RecommendShopCard({
  shop,
  onOpenShop,
  onOpenFood,
}: {
  shop: Restaurant;
  onOpenShop?: (shop: Restaurant) => void;
  onOpenFood?: (dish: Signature) => void;
}) {
  const card = shop as Card;
  const dishes = (shop.signatureFoods ?? [])
    .filter((dish) => dish.id != null)
    .slice(0, 3) as Signature[];
  const place = [distanceText(shop.distanceMeters), shop.hubName]
    .filter(Boolean)
    .join(" · ");
  const traits = [
    priceBands.find((band) => band.id === shop.priceBand)?.name,
    ...(card.categories ?? []),
    ...(card.tags ?? []),
  ].filter((value): value is string => !!value);
  return (
    <article className="rec-shop-card">
      <Link
        to={`/restaurants/${shop.id}`}
        className="rec-shop-head"
        onClick={() => onOpenShop?.(shop)}
      >
        <h3>{shop.name}</h3>
        {place && <p className="rec-shop-place">{place}</p>}
        <p className="rec-shop-rating">{dineInText(card)}</p>
        {traits.length > 0 && (
          <ul className="rec-shop-traits" aria-label="店铺特点">
            {traits.map((trait) => (
              <li key={trait}>{trait}</li>
            ))}
          </ul>
        )}
      </Link>
      {dishes.length ? (
        <ul className="rec-shop-dishes" aria-label={`${shop.name}的招牌菜`}>
          {dishes.map((dish) => (
            <DishThumb key={dish.id} dish={dish} onOpen={onOpenFood} />
          ))}
        </ul>
      ) : (
        <p className="rec-shop-no-dish">还没有招牌菜，进店看看菜单吧</p>
      )}
    </article>
  );
}

export function RecommendShopList({
  shops,
  onOpenShop,
  onOpenFood,
}: {
  shops: Restaurant[];
  onOpenShop?: (shop: Restaurant) => void;
  onOpenFood?: (dish: Signature) => void;
}) {
  return (
    <div className="rec-shop-list">
      {shops.map((shop) => (
        <RecommendShopCard
          key={shop.id}
          shop={shop}
          onOpenShop={onOpenShop}
          onOpenFood={onOpenFood}
        />
      ))}
    </div>
  );
}
