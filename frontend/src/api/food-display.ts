import type { Schema } from "./models";
export const stagePalette = {
  broth: "#F3C46E",
  mango: "#FFCB45",
  bamboo: "#D8B27A",
  chili: "#D9632B",
  tomato: "#C9442B",
  redoil: "#A8321C",
  soy: "#8F5B24",
  porcelain: "#9DB8D9",
  matcha: "#9DBF7A",
} as const;
export type Stage = keyof typeof stagePalette;
export function stageCode(hex: string): Stage {
  return (
    (Object.keys(stagePalette) as Stage[]).find(
      (k) => stagePalette[k] === hex,
    ) ?? "broth"
  );
}
export const mealOptions = [
  { id: "breakfast", name: "早饭" },
  { id: "lunch", name: "午饭" },
  { id: "dinner", name: "晚饭" },
  { id: "night", name: "夜宵" },
] as const;
export function mealCode(name: string) {
  return (
    mealOptions.find((m) => m.name === name || m.id === name)?.id ?? "dinner"
  );
}
export type MealSlot = (typeof mealOptions)[number]["id"];
export function mealName(code: string | undefined) {
  return mealOptions.find((m) => m.id === code)?.name;
}
/**
 * Meal slots in Beijing time. The backend picks the slot itself when a
 * request has no mealTime (RecommendService.slotAt); these copies only label
 * the slot before its answer arrives and end a manual pick when its slot ends.
 */
export const mealHours: Record<MealSlot, string> = {
  breakfast: "05:00–10:00",
  lunch: "10:00–15:00",
  dinner: "15:00–21:00",
  night: "21:00–05:00",
};
const HOUR = 3_600_000;
export function mealSlotAt(at: number): MealSlot {
  const h = new Date(at + 8 * HOUR).getUTCHours();
  return h >= 5 && h < 10
    ? "breakfast"
    : h >= 10 && h < 15
      ? "lunch"
      : h >= 15 && h < 21
        ? "dinner"
        : "night";
}
/** When the Beijing meal slot containing `at` ends. */
export function mealSlotEnd(at: number) {
  const slot = mealSlotAt(at);
  // Beijing is a whole number of hours ahead of UTC, so slots end on the hour.
  let end = Math.floor(at / HOUR) * HOUR + HOUR;
  while (mealSlotAt(end) === slot) end += HOUR;
  return end;
}
export function guestDeviceId() {
  try {
    let id = localStorage.getItem("eatwhat-recommend-device");
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem("eatwhat-recommend-device", id);
    }
    return id;
  } catch {
    return undefined;
  }
}
/** Dishes have no meal times in backend v2; only shops do. */
export function publishDisplay(
  stage: string,
  candidates?: string[],
): Pick<Schema["CreateFoodDTORequest"], "stageColor" | "stageAlternates"> {
  const alternatives = [
    ...new Set([
      ...(candidates ?? []).map(stageCode),
      ...(Object.keys(stagePalette) as Stage[]),
    ]),
  ]
    .filter((k) => k !== stageCode(stage))
    .slice(0, 2);
  return {
    stageColor: stageCode(stage),
    stageAlternates: alternatives,
  };
}
