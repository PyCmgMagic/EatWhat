import {
  mealTimes,
  priceBands,
  shopCategories,
  shopKinds,
  tasteTags,
} from "../api/v2-vocab";
import "./latest.css";

/** Shop details backend v2 keeps for recommendations and filters. */
export type ShopTraits = {
  kind: string;
  priceBand: string;
  mealTimes: string[];
  categories: string[];
  tags: string[];
  deliveryEnabled: boolean;
};
export const defaultShopTraits = (): ShopTraits => ({
  kind: "food",
  priceBand: "FROM_15_TO_30",
  mealTimes: ["lunch", "dinner"],
  categories: [],
  tags: [],
  deliveryEnabled: false,
});
export function shopTraitsOf(shop: Partial<ShopTraits> | null | undefined) {
  const base = defaultShopTraits();
  return {
    kind: shop?.kind || base.kind,
    priceBand: shop?.priceBand || base.priceBand,
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
  return (
    <fieldset className="ew-shop-traits" disabled={disabled}>
      <div className="ew-meals" role="radiogroup" aria-label="店铺类型">
        <b>店铺类型</b>
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
        <b>人均价位</b>
        {priceBands.map((p) => (
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
        <b>营业饭点</b>
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
        <b>店铺分类</b>
        {shopCategories.map((c) => (
          <label key={c}>
            <input
              type="checkbox"
              checked={value.categories.includes(c)}
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
        <b>口味</b>
        {tasteTags.map((t) => (
          <label key={t}>
            <input
              type="checkbox"
              checked={value.tags.includes(t)}
              onChange={(e) =>
                set({ tags: toggle(value.tags, t, e.target.checked) })
              }
            />
            {t}
          </label>
        ))}
      </div>
      <div className="ew-meals">
        <b>外卖</b>
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
