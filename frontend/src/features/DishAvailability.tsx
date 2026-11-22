import { useId } from "react";
import { mealTimes as mealTimeNames, type V2Food } from "../api/v2-vocab";
import "./dish-availability.css";

/** mealTimes [] = the dish follows its shop's meal times. */
export type DishAvailability = {
  mealTimes: string[];
  deliveryEnabled: boolean;
};
export const defaultDishAvailability = (): DishAvailability => ({
  mealTimes: [],
  deliveryEnabled: false,
});
export const dishAvailabilityOf = (food: V2Food): DishAvailability => ({
  mealTimes: food.mealTimes ?? [],
  deliveryEnabled: !!food.deliveryEnabled,
});
/** Display meal times in chronological order. */
const ordered = (ids: string[]) =>
  mealTimeNames.filter((m) => ids.includes(m.id)).map((m) => m.id);
export const sameMealTimes = (a: string[], b: string[]) =>
  ordered(a).join() === ordered(b).join();

/** "早饭供应 · 可外卖"; all meal times are not worth a mention. */
export function availabilityText(food: V2Food) {
  const meals = ordered(food.effectiveMealTimes ?? []);
  const when =
    meals.length && meals.length < mealTimeNames.length
      ? `${meals.map((id) => mealTimeNames.find((m) => m.id === id)!.name).join("、")}供应`
      : "";
  const delivery =
    food.deliveryEnabled == null
      ? ""
      : food.deliveryEnabled
        ? "可外卖"
        : "仅堂食";
  return [when, delivery].filter(Boolean).join(" · ");
}

/**
 * When the dish is served and whether it can be ordered for delivery. v2 keeps
 * both on the dish; the shop's delivery flag is only a summary of its dishes.
 */
type AvailabilityProps = {
  value: DishAvailability;
  onChange: (next: DishAvailability) => void;
  disabled?: boolean;
};

function toggleMeal(selected: string[], id: string) {
  return ordered(
    selected.includes(id)
      ? selected.filter((meal) => meal !== id)
      : [...selected, id],
  );
}

function DishSwitch({
  label,
  detail,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const detailId = useId();
  return (
    <label className="dish-option-switch">
      <span>
        {label}
        {detail && <small id={detailId}>{detail}</small>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        aria-describedby={detail ? detailId : undefined}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

export function MobileDishOptions({
  value,
  onChange,
  disabled,
  shopMeals,
  signature,
  onSignatureChange,
}: AvailabilityProps & {
  shopMeals?: string[] | null;
  signature: boolean;
  onSignatureChange: (checked: boolean) => void;
}) {
  const mealLabel = useId();
  const inheritedMeals = mealTimeNames
    .filter((meal) => shopMeals?.includes(meal.id))
    .map((meal) => meal.name);
  return (
    <>
      <div
        className="mobile-publish-tags"
        role="group"
        aria-labelledby={mealLabel}
      >
        <p className="dish-meal-heading">
          <span id={mealLabel}>适合哪顿，选填</span>
          {value.mealTimes.length ? (
            <button
              type="button"
              className="dish-meal-reset"
              disabled={disabled}
              onClick={() => onChange({ ...value, mealTimes: [] })}
            >
              恢复跟随店铺
            </button>
          ) : (
            <span>
              跟店里一样
              {inheritedMeals.length > 0 && `，${inheritedMeals.join("、")}`}
            </span>
          )}
        </p>
        <div>
          {mealTimeNames.map((meal) => (
            <button
              key={meal.id}
              type="button"
              disabled={disabled}
              aria-pressed={value.mealTimes.includes(meal.id)}
              onClick={() =>
                onChange({
                  ...value,
                  mealTimes: toggleMeal(value.mealTimes, meal.id),
                })
              }
            >
              {meal.name}
            </button>
          ))}
        </div>
      </div>
      <div className="dish-option-switches">
        <DishSwitch
          label="能点外卖"
          checked={value.deliveryEnabled}
          disabled={disabled}
          onChange={(deliveryEnabled) =>
            onChange({ ...value, deliveryEnabled })
          }
        />
        <DishSwitch
          label="招牌菜"
          detail="每家店最多 3 道招牌菜"
          checked={signature}
          disabled={disabled}
          onChange={onSignatureChange}
        />
      </div>
    </>
  );
}

export function DishAvailabilityFields({
  value,
  onChange,
  disabled,
}: AvailabilityProps) {
  const inherit = !value.mealTimes.length;
  const meals = [
    {
      id: "",
      name: "跟随店铺",
      on: inherit,
      set: () => onChange({ ...value, mealTimes: [] }),
    },
    ...mealTimeNames.map((m) => ({
      id: m.id,
      name: m.name,
      on: value.mealTimes.includes(m.id),
      set: () =>
        onChange({ ...value, mealTimes: toggleMeal(value.mealTimes, m.id) }),
    })),
  ];
  const setDelivery = (deliveryEnabled: boolean) =>
    onChange({ ...value, deliveryEnabled });
  return (
    <fieldset className="dish-availability" disabled={disabled}>
      <div className="ew-meals" role="group" aria-label="供应饭点">
        <b>供应饭点</b>
        {meals.map((m) => (
          <label key={m.id}>
            <input type="checkbox" checked={m.on} onChange={m.set} />
            {m.name}
          </label>
        ))}
      </div>
      <div className="ew-meals" role="group" aria-label="外卖">
        <b>外卖</b>
        <label>
          <input
            type="checkbox"
            checked={value.deliveryEnabled}
            onChange={(e) => setDelivery(e.target.checked)}
          />
          这道菜可以点外卖
        </label>
      </div>
    </fieldset>
  );
}
