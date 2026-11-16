import {
  MAX_SHOP_CATEGORIES,
  MAX_SHOP_TAGS,
  mealTimes,
  priceBands,
  shopKinds,
} from "../api/v2-vocab";
import { FieldMark } from "./FieldMark";
import type { ReactNode } from "react";
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
};
export const defaultShopTraits = (): ShopTraits => ({
  kind: "food",
  priceBand: "",
  mealTimes: ["lunch", "dinner"],
  categories: [],
  tags: [],
});
export function shopTraitsOf(shop: Partial<ShopTraits> | null | undefined) {
  const base = defaultShopTraits();
  return {
    kind: shop?.kind || base.kind,
    priceBand: shop?.priceBand || "",
    mealTimes: shop?.mealTimes?.length ? shop.mealTimes : base.mealTimes,
    categories: shop?.categories ?? [],
    tags: shop?.tags ?? [],
  };
}

const toggle = (list: string[], value: string, on: boolean) =>
  on ? [...list, value] : list.filter((x) => x !== value);

function TraitHeading({
  children,
  compact,
  required,
  note,
}: {
  children: ReactNode;
  compact?: boolean;
  required?: boolean;
  note?: string;
}) {
  return (
    <b>
      <span>{children}</span>
      {compact ? (
        note && <small className="shop-edit-limit">{note}</small>
      ) : (
        <FieldMark required={required} note={note} />
      )}
    </b>
  );
}

export function ShopTraitsFields({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: ShopTraits;
  onChange: (next: ShopTraits) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const set = (patch: Partial<ShopTraits>) => onChange({ ...value, ...patch });
  const options = useShopOptions();
  return (
    <fieldset className="ew-shop-traits" disabled={disabled}>
      <div
        className="ew-meals"
        data-trait="kind"
        role="radiogroup"
        aria-label="店铺类型"
      >
        <TraitHeading compact={compact} required>
          店铺类型
        </TraitHeading>
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
      <div
        className="ew-meals"
        data-trait="price"
        role="radiogroup"
        aria-label="人均价位"
      >
        <TraitHeading compact={compact}>人均价位</TraitHeading>
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
      <div
        className="ew-meals shop-edit-meals"
        data-trait="meals"
        role="group"
        aria-label="营业饭点"
      >
        <TraitHeading
          compact={compact}
          required
          note={compact ? "至少选 1 项" : "至少一个"}
        >
          营业饭点
        </TraitHeading>
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
      <div
        className="ew-meals"
        data-trait="categories"
        role="group"
        aria-label="店铺分类"
      >
        <TraitHeading compact={compact} note={`最多 ${MAX_SHOP_CATEGORIES} 个`}>
          店铺分类
        </TraitHeading>
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
      <div
        className="ew-meals"
        data-trait="tags"
        role="group"
        aria-label="口味"
      >
        <TraitHeading compact={compact} note={`最多 ${MAX_SHOP_TAGS} 个`}>
          口味
        </TraitHeading>
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
      <p className="shop-edit-delivery-note">
        外卖按菜品设置：发布或编辑菜品时勾选“这道菜可以点外卖”。
      </p>
    </fieldset>
  );
}
