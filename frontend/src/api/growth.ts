import type { Schema } from "./models";

export function businessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validBusinessDate(value: string, today = businessDate()) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value &&
    value <= today
  );
}
export function growthPercent(value?: Schema["GrowthProgressResponse"]) {
  if (value?.maxLevel === true) return 100;
  if (
    value?.experienceInLevel == null ||
    value.nextLevelExperience == null ||
    value.levelStartExperience == null
  )
    return undefined;
  const span = value.nextLevelExperience - value.levelStartExperience;
  return span > 0 && Number.isFinite(value.experienceInLevel)
    ? Math.max(0, Math.min(100, (value.experienceInLevel / span) * 100))
    : undefined;
}
/** 经验记录的来源名：后端 v2 直接返回中文名（sourceName），旧的枚举值兜底。 */
export function ledgerSourceName(source?: string | null) {
  const name = source?.trim();
  if (!name) return "经验奖励";
  if (name === "DAILY_USE" || name === "daily_use") return "每日使用";
  return name;
}
