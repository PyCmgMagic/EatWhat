import type { Food } from "../api/models";
import { stagePalette } from "../api/food-display";
export const demoDishes = [
  {
    name: "鲜虾蟹籽云吞",
    l1: "鲜虾蟹籽",
    l2: "云吞",
    shop: "袁记云饺",
    dist: "320 m",
    price: 18,
    asset: "yuntun",
    stage: "#F3C46E",
    tile: "#F8E6C4",
    category: "staple",
    restaurantId: 1,
  },
  {
    name: "番茄牛腩饭",
    l1: "番茄",
    l2: "牛腩饭",
    shop: "小碗菜",
    dist: "450 m",
    price: 22,
    asset: "niunan",
    stage: "#C9442B",
    tile: "#F6DDD3",
    category: "staple",
    restaurantId: 2,
  },
  {
    name: "杨枝甘露",
    l1: "杨枝甘露",
    l2: "",
    shop: "一点点",
    dist: "180 m",
    price: 15,
    asset: "yangzhi",
    stage: "#FFCB45",
    tile: "#FBEFC6",
    category: "drink",
    restaurantId: 3,
  },
  {
    name: "柳州螺蛳粉",
    l1: "柳州",
    l2: "螺蛳粉",
    shop: "螺蛳粉研究所",
    dist: "600 m",
    price: 16,
    asset: "luosifen",
    stage: "#A8321C",
    tile: "#F3D6CF",
    category: "staple",
    restaurantId: 4,
  },
  {
    name: "铁锅炖大鹅",
    l1: "铁锅炖",
    l2: "大鹅",
    shop: "东北饭庄",
    dist: "750 m",
    price: 58,
    asset: "tieguodun",
    stage: "#8F5B24",
    tile: "#F2E6D6",
    category: "staple",
    restaurantId: 5,
  },
  {
    name: "麻辣香锅",
    l1: "麻辣香锅",
    l2: "",
    shop: "香锅小站",
    dist: "400 m",
    price: 32,
    asset: "xiangguo",
    stage: "#D9632B",
    tile: "#F6E0DB",
    category: "hot_pot",
    restaurantId: 6,
  },
  {
    name: "粘豆包",
    l1: "粘豆包",
    l2: "",
    shop: "老街点心",
    dist: "260 m",
    price: 8,
    asset: "niandoubao",
    stage: "#D8B27A",
    tile: "#EDDFC9",
    category: "snack",
    restaurantId: 7,
  },
  {
    name: "玉米鲜肉饺子",
    l1: "玉米鲜肉",
    l2: "饺子",
    shop: "袁记云饺",
    dist: "320 m",
    price: 16,
    asset: "jiaozi",
    stage: "#9DB8D9",
    tile: "#E2EAF3",
    category: "staple",
    restaurantId: 1,
  },
];
export const stageColors = [
  "#F3C46E",
  "#FFCB45",
  "#D8B27A",
  "#D9632B",
  "#C9442B",
  "#A8321C",
  "#8F5B24",
  "#9DB8D9",
  "#9DBF7A",
];
const categoryStage: Record<string, string> = {
  staple: stageColors[0],
  drink: stageColors[1],
  snack: stageColors[3],
  dessert: stageColors[7],
  soup: stageColors[2],
  hot_pot: stageColors[5],
  grill: stageColors[6],
  cold_dish: stageColors[8],
  side_dish: stageColors[8],
  other: stageColors[2],
};
const stageTiles: Record<string, string> = {
  ...Object.fromEntries(demoDishes.map((dish) => [dish.stage, dish.tile])),
  "#9DBF7A": "#E4ECD8",
};
function savedStage(keys?: string[] | null): string | undefined {
  try {
    const values = JSON.parse(
      localStorage.getItem("eatwhat-stage-colors") || "{}",
    );
    return keys
      ?.map((key) => values[key])
      .find((color) => stageColors.includes(color));
  } catch {
    return undefined;
  }
}
export function visualFor(food: Food, demo = false) {
  // A matching name does not make an uploaded photo a prototype illustration.
  const v = demo
    ? demoDishes.find(
        (d) =>
          d.name === food.name &&
          food.pictureUrl?.[0] === `/prototype/assets/dishes/${d.asset}.svg`,
      )
    : undefined;
  const color =
    (food.stageColor ? stagePalette[food.stageColor] : undefined) ??
    v?.stage ??
    savedStage(food.pictureUrl) ??
    categoryStage[food.category ?? "other"] ??
    stageColors[2];
  const dark = [stageColors[4], stageColors[5], stageColors[6]].includes(color);
  const name = food.name ?? "这道菜";
  return {
    stage: color,
    on: dark ? "#FFFFFF" : "#231C18",
    ghost: dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.42)",
    table: dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.22)",
    ring: dark ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.55)",
    solidShadow: dark
      ? "inset 0 -2px 0 rgba(0,0,0,0.16),0 8px 18px rgba(0,0,0,0.16)"
      : "inset 0 1px 0 rgba(255,255,255,0.16),inset 0 -2px 0 rgba(0,0,0,0.28),0 6px 14px rgba(35,28,24,0.16)",
    l1: v?.l1 ?? name.slice(0, 4),
    l2: v?.l2 ?? name.slice(4, 8),
    shop: food.restaurantName ?? "餐厅信息待补充",
    dist: v?.dist ?? "",
    price: food.price ?? "—",
    tile: v?.tile ?? stageTiles[color] ?? "#F4EFEB",
    asset: v?.asset ?? "",
  };
}
