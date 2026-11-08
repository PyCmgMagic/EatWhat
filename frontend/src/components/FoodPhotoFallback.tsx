import {
  DishIllustration,
  type DishIllustrationName,
} from "./DishIllustration";
import "./food-photo-fallback.css";

const illustrations: Record<string, DishIllustrationName> = {
  staple: "danchaofan",
  snack: "baozi",
  dessert: "niandoubao",
  drink: "yangzhi",
  soup: "yuntun",
  hot_pot: "xiangguo",
  grill: "tieguodun",
  cold_dish: "jiaozi",
  side_dish: "niunan",
};

/** Explicitly labeled illustration, never presented as the dish's actual photo. */
export function FoodPhotoFallback({
  category,
  failed = false,
}: {
  category?: string | null;
  failed?: boolean;
}) {
  const reason = failed ? "加载失败" : "暂无实拍";
  return (
    <div
      className="food-photo-fallback"
      role="img"
      aria-label={`${failed ? "菜品图片加载失败" : "菜品暂无实拍图片"}，插画仅作示意`}
    >
      <DishIllustration name={illustrations[category ?? ""] ?? "yuntun"} />
      <div className="food-photo-fallback-label" aria-hidden="true">
        <span>示意图</span>
        <span aria-hidden="true">·</span>
        <span>{reason}</span>
      </div>
    </div>
  );
}
