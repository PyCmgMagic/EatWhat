import type { components } from "./schema";
import type { V2Schema } from "./backend-v2";
import type { MealSlot } from "./food-display";
import { demoEnabled } from "../app/mode";
// Readers tolerate nullable historical data; write DTOs follow the current contract.
type ReadModel<T> = T extends (infer U)[]
  ? ReadModel<U>[]
  : T extends object
    ? { [K in keyof T]?: ReadModel<T[K]> | null }
    : T;
export type Schema = {
  [K in keyof components["schemas"]]: K extends `${string}Response`
    ? ReadModel<components["schemas"][K]>
    : components["schemas"][K];
};
export type Food = Omit<
  Schema["FoodVOResponse"],
  | "mealTimes"
  | "restaurantAddress"
  | "restaurantGcjLng"
  | "restaurantGcjLat"
  | "hubId"
  | "hubName"
  | "user"
> &
  Pick<
    Schema["FoodRecommendationVOResponse"],
    | "restaurantAddress"
    | "restaurantGcjLng"
    | "restaurantGcjLat"
    | "hubId"
    | "hubName"
  > & {
    mealTimes?: MealSlot[] | null;
    /** v2 dish details enrich the author with their public profile avatar and title. */
    user?:
      | (NonNullable<Schema["FoodVOResponse"]["user"]> & {
          avatar?: string | null;
          title?: string | null;
        })
      | null;
  };
export type Restaurant = Schema["RestaurantResponse"] & {
  description?: string | null;
};
/** Explicit null means no displayable profile; only old responses omit user. */
export function foodAuthor(
  food: Pick<Food, "user" | "accountId" | "uploaderName">,
) {
  return {
    id:
      food.user === undefined
        ? parseId(String(food.accountId))
        : food.user
          ? parseId(String(food.user.id))
          : undefined,
    name:
      food.user?.displayName?.trim() || food.uploaderName?.trim() || "校园食友",
  };
}
export type Hub = Schema["HubResponse"];
export type User = Omit<Schema["UserInfoDTOResponse"], "birthday"> & {
  birthday?: string | number | null;
  coverFoodId?: number | null;
};
export type ProfileUpdate = Schema["UpdateUserInfoDTORequest"] & Pick<V2Schema["UpdateInfo"], "coverFoodId">;
export type CustomTag = Schema["MyCustomTagVOResponse"];
export type Notification = Schema["NotificationDTOResponse"];
export type Page<T> = {
  items?: T[] | null;
  currentPage?: number | null;
  totalItems?: number | null;
  totalPages?: number | null;
  hasNext?: boolean | null;
};
export type Category = NonNullable<Schema["CreateFoodDTORequest"]["category"]>;
// Backend v2 has six dish categories; ids stay the old ones (see v2-vocab).
export const categories: { id: Category | ""; label: string; icon: string }[] =
  [
    { id: "", label: "全部", icon: "discover" },
    { id: "staple", label: "主食", icon: "bowl" },
    { id: "side_dish", label: "菜", icon: "leaf" },
    { id: "snack", label: "小吃", icon: "snack" },
    { id: "soup", label: "汤", icon: "bowl" },
    { id: "drink", label: "饮品甜品", icon: "cup" },
    { id: "other", label: "特色", icon: "bowl" },
  ];
export function idOf(id: number | null | undefined): number {
  if (!Number.isSafeInteger(id) || (id ?? 0) < 1)
    throw new Error("条目编号无效，请刷新列表。");
  return id as number;
}
export function parseId(raw: string | undefined) {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}
export function money(value: number | null | undefined) {
  return value == null
    ? "价格待补充"
    : `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}
export function mediaUrl(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  if (
    demoEnabled(
      location.search,
      import.meta.env.DEV,
      import.meta.env.VITE_ENABLE_DEMO === "true",
    ) &&
    /^(foods|restaurants|avatar|feedback|comments|activity)\//.test(key)
  ) {
    try {
      const saved = localStorage.getItem(`eatwhat-demo-media-v4:${key}`);
      if (saved && /^data:image\/(jpeg|png|webp);base64,/.test(saved))
        return saved;
    } catch {
      /* optional demo media */
    }
  }
  if (/^https?:\/\//i.test(key)) return key;
  if (key.startsWith("/assets/")) return key;
  if (key.startsWith("/prototype/assets/")) return key;
  // data URLs are generated only by the isolated demo image uploader.
  if (
    demoEnabled(
      location.search,
      import.meta.env.DEV,
      import.meta.env.VITE_ENABLE_DEMO === "true",
    ) &&
    /^data:image\/(jpeg|png|webp);base64,/.test(key)
  )
    return key;
  const base = import.meta.env.VITE_MEDIA_BASE_URL;
  if (!base || key.startsWith("//") || /^(?:javascript|data|blob):/i.test(key))
    return undefined;
  return `${base.replace(/\/$/, "")}/${key.replace(/^\//, "").split("/").map(encodeURIComponent).join("/")}`;
}
export function hasCoordinates(value: {
  gcjLng?: number | null;
  gcjLat?: number | null;
}) {
  return (
    Number.isFinite(value.gcjLng) &&
    Number.isFinite(value.gcjLat) &&
    value.gcjLng! >= 72.004 &&
    value.gcjLng! <= 137.8347 &&
    value.gcjLat! >= 0.8293 &&
    value.gcjLat! <= 55.8271
  );
}
// Browser geolocation returns WGS84; backend search explicitly requires GCJ02.
export function wgsToGcj(lng: number, lat: number) {
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271)
    throw new Error("暂不支持该定位范围，请手动选择区域。");
  const x = lng - 105,
    y = lat - 35,
    pi = Math.PI;
  let dLat =
    -100 +
    2 * x +
    3 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  dLat += ((20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2) / 3;
  dLat += ((20 * Math.sin(y * pi) + 40 * Math.sin((y / 3) * pi)) * 2) / 3;
  dLat +=
    ((160 * Math.sin((y / 12) * pi) + 320 * Math.sin((y * pi) / 30)) * 2) / 3;
  let dLng =
    300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  dLng += ((20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2) / 3;
  dLng += ((20 * Math.sin(x * pi) + 40 * Math.sin((x / 3) * pi)) * 2) / 3;
  dLng +=
    ((150 * Math.sin((x / 12) * pi) + 300 * Math.sin((x / 30) * pi)) * 2) / 3;
  const rad = (lat / 180) * pi,
    magic = 1 - 0.006693421622965943 * Math.sin(rad) ** 2,
    root = Math.sqrt(magic);
  return {
    gcjLng: lng + (dLng * 180) / ((6378245 / root) * Math.cos(rad) * pi),
    gcjLat:
      lat +
      (dLat * 180) /
        (((6378245 * (1 - 0.006693421622965943)) / (magic * root)) * pi),
  };
}
