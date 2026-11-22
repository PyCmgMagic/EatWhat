/**
 * Fixed vocabularies of backend v2 (FoodTraits / RestaurantTraits).
 *
 * Dish categories keep the old ids the pages already pass around; the v2
 * bridge maps each id to exactly one v2 category name and back.
 */
import type { Category } from "./models";

export const foodCategories: { id: Category; name: string; icon: string }[] = [
  { id: "staple", name: "主食", icon: "bowl" },
  { id: "side_dish", name: "菜", icon: "leaf" },
  { id: "snack", name: "小吃", icon: "snack" },
  { id: "soup", name: "汤", icon: "bowl" },
  { id: "drink", name: "饮品甜品", icon: "cup" },
  { id: "other", name: "特色", icon: "bowl" },
];
export function foodCategoryName(id: string | null | undefined) {
  return foodCategories.find((c) => c.id === id)?.name ?? "特色";
}

/** Taste tags shared by dishes and shops; a dish has at most three. */
export const tasteTags = ["辣", "麻", "甜", "酸", "清淡"];
export const MAX_DISH_TAGS = 3;
/** Only these may be marked as "don't want" in taste preferences. */
export const dislikableTags = ["辣", "麻"];

export const shopKinds = [
  { id: "food", name: "吃饭" },
  { id: "drink", name: "饮品" },
  { id: "buffet", name: "自助" },
];
/** Fallback only: pages read the live list with useShopOptions(). */
export const shopCategories = [
  "米饭炒菜",
  "粉面",
  "火锅麻辣烫",
  "烧烤炸串",
  "汤粥",
  "面点快餐",
  "日韩料理",
];
export const MAX_SHOP_CATEGORIES = 2;
export const MAX_SHOP_TAGS = 3;
export const mealTimes = [
  { id: "breakfast", name: "早饭" },
  { id: "lunch", name: "午饭" },
  { id: "dinner", name: "晚饭" },
  { id: "night", name: "夜宵" },
];
export const priceBands = [
  { id: "UNDER_15", name: "15 元以下" },
  { id: "FROM_15_TO_30", name: "15–30 元" },
  { id: "OVER_30", name: "30 元以上" },
];
export const ratingScenes = [
  { id: "dine_in", key: "dineIn", name: "堂食" },
  { id: "delivery", key: "delivery", name: "外卖" },
] as const;
/** Recommendation scenes, in the order the toggle shows them. */
export type RecommendScene = (typeof ratingScenes)[number]["id"];
export const recommendScenes = ratingScenes.map(({ id, name }) => ({
  id,
  name,
}));
export type RatingValue = "RECOMMEND" | "NOT_RECOMMEND";
export type SceneStat = { rate?: number | null; count?: number | null };

/** v2 fields the bridge passes through next to the APIv7 shapes. */
export type V2Food = {
  tags?: string[] | null;
  signature?: boolean | null;
  favoriteCount?: number | null;
  /** The dish's own meal times; [] = it follows the shop's. */
  mealTimes?: string[] | null;
  /** When the dish is actually served (the shop's when it follows the shop). */
  effectiveMealTimes?: string[] | null;
  deliveryEnabled?: boolean | null;
  rating?: DishRating | null;
  /** The viewer's own score (1-5); null for guests or when not rated. */
  myRating?: number | null;
};
/** score: average of 1-5 to one decimal, null while nobody has rated. */
export type DishRating = { score?: number | null; count?: number | null };
/** Reply of rating a dish or taking the rating back. */
export type FoodRated = { myRating: number | null; rating: DishRating };
export type V2Shop = {
  kind?: string | null;
  mealTimes?: string[] | null;
  categories?: string[] | null;
  tags?: string[] | null;
  deliveryEnabled?: boolean | null;
  dineIn?: SceneStat | null;
  delivery?: SceneStat | null;
  myRatings?: { dineIn?: string | null; delivery?: string | null } | null;
  poi?: string | null;
};
export function shopRatingScenes(shop?: V2Shop) {
  return ratingScenes.filter(
    (scene) =>
      scene.id === "dine_in" ||
      shop?.deliveryEnabled ||
      (shop?.delivery?.count ?? 0) > 0 ||
      Boolean(shop?.myRatings?.delivery),
  );
}

export function shopFactLabels(shop: V2Shop & { priceBand?: string | null }) {
  return [
    shopKinds.find((kind) => kind.id === shop.kind)?.name,
    ...(shop.categories ?? []),
    priceBands.find((band) => band.id === shop.priceBand)?.name,
    shop.deliveryEnabled ? "可外卖" : "仅堂食",
    ...(shop.tags?.length ? [`口味：${shop.tags.join("、")}`] : []),
  ].filter((fact): fact is string => Boolean(fact));
}

export function rateText(stat: SceneStat | null | undefined) {
  if (!stat?.count) return "还没有评价";
  return stat.rate == null
    ? `${stat.count} 人评价`
    : `${Math.round(stat.rate * 100)}% 推荐 · ${stat.count} 人评价`;
}
