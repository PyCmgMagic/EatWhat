import type { Food, Restaurant, Schema } from "./models";

export const codePoints = (value: string) => [...value].length;
export const foodDescriptionLimit = 1000;
export const restaurantAddressLimit = 50;
export const restaurantDescriptionLimit = 200;
export const normalizedTag = (value: string) =>
  value.trim().replace(/\s+/gu, " ");
export function boundedText(
  value: string,
  max: number,
  label: string,
  min = 1,
) {
  const normalized = value.trim();
  if (codePoints(normalized) < min || codePoints(normalized) > max)
    throw new Error(`${label}需为 ${min}–${max} 个字。`);
  return normalized;
}
export function foodPrice(value: string | number | null | undefined) {
  if (value == null || String(value).trim() === "")
    throw new Error("请填写价格，免费菜品可填 0。");
  const price = Number(value);
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    price > 999 ||
    Math.abs(price * 10 - Math.round(price * 10)) > 1e-6
  )
    throw new Error("价格为 0–999 元，最多保留一位有效小数。");
  return price;
}
export function validateFoodDraft(value: {
  name: string;
  description: string;
  price: string | number;
  tags: string[];
}) {
  boundedText(value.name, 12, "菜名");
  if (codePoints(value.description) > foodDescriptionLimit)
    throw new Error(`菜品说明最多 ${foodDescriptionLimit} 个字。`);
  // Optional: whoever shares a dish may not know its price; others can add it.
  if (String(value.price ?? "").trim() !== "") foodPrice(value.price);
  if (value.tags.length > 20) throw new Error("最多添加 20 个个人标签。");
  for (const tag of value.tags) boundedText(normalizedTag(tag), 10, "个人标签");
}
export function foodEditBody<
  T extends Omit<Schema["EditFoodDTORequest"], "mealTimes">,
>(original: Food, patch: T) {
  const body = { ...patch };
  if (body.name != null) {
    if (body.name.trim() === original.name?.trim()) delete body.name;
    else body.name = boundedText(body.name, 12, "菜名");
  }
  if (body.description != null) {
    if (body.description === original.description) delete body.description;
    else if (codePoints(body.description) > foodDescriptionLimit)
      throw new Error(`修改后的说明最多 ${foodDescriptionLimit} 个字。`);
  }
  if (body.price != null) {
    if (Number(body.price) === original.price) delete body.price;
    else body.price = foodPrice(body.price);
  }
  if (body.pictureUrl) {
    const unchanged =
      JSON.stringify(body.pictureUrl) ===
      JSON.stringify(original.pictureKeys ?? original.pictureUrl);
    if (unchanged) delete body.pictureUrl;
    else if (
      !body.pictureUrl.length ||
      body.pictureUrl.length > 9 ||
      body.pictureUrl.some((key) => !/^foods\/.+/.test(key))
    )
      throw new Error("替换图片需 1–9 张有效菜品照片。");
  }
  return body;
}
export function restaurantEditBody(
  original: Restaurant,
  patch: Schema["EditRestaurantDTORequest"],
) {
  const body = { ...patch };
  for (const [field, max, label] of [
    ["name", 20, "店名"],
    ["address", restaurantAddressLimit, "地址"],
  ] as const) {
    if (body[field] != null) {
      if (body[field]!.trim() === original[field]?.trim()) delete body[field];
      else body[field] = boundedText(body[field]!, max, label);
    }
  }
  if (body.pictureUrl) {
    if (JSON.stringify(body.pictureUrl) === JSON.stringify(original.pictureUrl))
      delete body.pictureUrl;
    else if (
      body.pictureUrl.length > 1 ||
      body.pictureUrl.some((key) => !/^restaurants\/.+/.test(key))
    )
      throw new Error("替换门头照片最多 1 张，需重新选择并上传照片。");
  }
  return body;
}
