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
/** Backend order: breakfast, lunch, dinner, night. */
const ordered = (ids: string[]) =>
  mealTimeNames.filter((m) => ids.includes(m.id)).map((m) => m.id);
export const sameMealTimes = (a: string[], b: string[]) =>
  ordered(a).join() === ordered(b).join();

/** "早饭供应 · 可外卖"; all four meal times are not worth a mention. */
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
export function DishAvailabilityFields({
  value,
  onChange,
  disabled,
  variant = "form",
}: {
  value: DishAvailability;
  onChange: (next: DishAvailability) => void;
  disabled?: boolean;
  /** "chips": the mobile publish sheet's toggle buttons. */
  variant?: "form" | "chips";
}) {
  const toggleMeal = (id: string) =>
    onChange({
      ...value,
      mealTimes: ordered(
        value.mealTimes.includes(id)
          ? value.mealTimes.filter((x) => x !== id)
          : [...value.mealTimes, id],
      ),
    });
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
      set: () => toggleMeal(m.id),
    })),
  ];
  const setDelivery = (deliveryEnabled: boolean) =>
    onChange({ ...value, deliveryEnabled });
  if (variant === "chips")
    return (
      <>
        <fieldset className="mobile-publish-tags" disabled={disabled}>
          <legend>供应饭点</legend>
          <div>
            {meals.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={m.on}
                onClick={m.set}
              >
                {m.name}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mobile-publish-tags" disabled={disabled}>
          <legend>外卖</legend>
          <div>
            <button
              type="button"
              aria-pressed={value.deliveryEnabled}
              onClick={() => setDelivery(!value.deliveryEnabled)}
            >
              这道菜可以点外卖
            </button>
          </div>
        </fieldset>
      </>
    );
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
