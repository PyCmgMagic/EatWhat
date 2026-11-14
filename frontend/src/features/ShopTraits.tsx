import {
  MAX_SHOP_CATEGORIES,
  MAX_SHOP_TAGS,
  mealTimes,
  priceBands,
  shopKinds,
} from "../api/v2-vocab";
import { FieldMark } from "./FieldMark";
import { useShopOptions } from "./shop-options";
import "./latest.css";

/** Shop details backend v2 keeps for recommendations and filters. */
export type ShopTraits = {
  kind: string;
  /** "" = not sure (optional in v2). */
  priceBand: string;
  mealTimes: string[];
  categories: string[];
  tags: string[];
  deliveryEnabled: boolean;
};
export const defaultShopTraits = (): ShopTraits => ({
  kind: "food",
  priceBand: "",
  mealTimes: ["lunch", "dinner"],
  categories: [],
  tags: [],
  deliveryEnabled: false,
});
export function shopTraitsOf(shop: Partial<ShopTraits> | null | undefined) {
  const base = defaultShopTraits();
  return {
    kind: shop?.kind || base.kind,
    priceBand: shop?.priceBand || "",
    mealTimes: shop?.mealTimes?.length ? shop.mealTimes : base.mealTimes,
    categories: shop?.categories ?? [],
    tags: shop?.tags ?? [],
    deliveryEnabled: !!shop?.deliveryEnabled,
  };
}

const toggle = (list: string[], value: string, on: boolean) =>
  on ? [...list, value] : list.filter((x) => x !== value);

/** Uses the same checkbox rows as the dish forms (.ew-meals). */
export function ShopTraitsFields({
  value,
  onChange,
  disabled,
}: {
  value: ShopTraits;
  onChange: (next: ShopTraits) => void;
  disabled?: boolean;
}) {
  const set = (patch: Partial<ShopTraits>) => onChange({ ...value, ...patch });
  const options = useShopOptions();
  return (
    <fieldset className="ew-shop-traits" disabled={disabled}>
      <div className="ew-meals" role="radiogroup" aria-label="店铺类型">
        <b>
          店铺类型
          <FieldMark required />
        </b>
        {shopKinds.map((k) => (
          <label key={k.id}>
            <input
              type="radio"
              name="shop-kind"
              checked={value.kind === k.id}
              onChange={() => set({ kind: k.id })}
            />
            {k.name}
          </label>
        ))}
      </div>
      <div className="ew-meals" role="radiogroup" aria-label="人均价位">
        <b>
          人均价位
          <FieldMark />
        </b>
        {[...priceBands, { id: "", name: "不确定" }].map((p) => (
          <label key={p.id}>
            <input
              type="radio"
              name="shop-price"
              checked={value.priceBand === p.id}
              onChange={() => set({ priceBand: p.id })}
            />
            {p.name}
          </label>
        ))}
      </div>
      <div className="ew-meals">
        <b>
          营业饭点
          <FieldMark required note="至少一个" />
        </b>
        {mealTimes.map((m) => (
          <label key={m.id}>
            <input
              type="checkbox"
              checked={value.mealTimes.includes(m.id)}
              onChange={(e) =>
                set({
                  mealTimes: toggle(value.mealTimes, m.id, e.target.checked),
                })
              }
            />
            {m.name}
          </label>
        ))}
      </div>
      <div className="ew-meals">
        <b>
          店铺分类
          <FieldMark note={`最多 ${MAX_SHOP_CATEGORIES} 个`} />
        </b>
        {options.categories.map((c) => (
          <label key={c}>
            <input
              type="checkbox"
              checked={value.categories.includes(c)}
              disabled={
                !value.categories.includes(c) &&
                value.categories.length >= MAX_SHOP_CATEGORIES
              }
              onChange={(e) =>
                set({
                  categories: toggle(value.categories, c, e.target.checked),
                })
              }
            />
            {c}
          </label>
        ))}
      </div>
      <div className="ew-meals">
        <b>
          口味
          <FieldMark note={`最多 ${MAX_SHOP_TAGS} 个`} />
        </b>
        {options.tags.map((t) => (
          <label key={t}>
            <input
              type="checkbox"
              checked={value.tags.includes(t)}
              disabled={
                !value.tags.includes(t) && value.tags.length >= MAX_SHOP_TAGS
              }
              onChange={(e) =>
                set({ tags: toggle(value.tags, t, e.target.checked) })
              }
            />
            {t}
          </label>
        ))}
      </div>
      <div className="ew-meals">
        <b>
          外卖
          <FieldMark />
        </b>
        <label>
          <input
            type="checkbox"
            checked={value.deliveryEnabled}
            onChange={(e) => set({ deliveryEnabled: e.target.checked })}
          />
          可以点外卖
        </label>
      </div>
    </fieldset>
  );
}
