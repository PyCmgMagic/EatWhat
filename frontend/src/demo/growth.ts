import { businessDate, validBusinessDate } from "../api/growth";
import type { Query } from "../api/client";
import { ApiError } from "../api/client";
import type { Schema } from "../api/models";

export type DemoGrowth = { entries: Schema["ExperienceEntryResponse"][] };
function progress(state: DemoGrowth): Schema["GrowthProgressResponse"] {
  const total = state.entries.reduce((sum, e) => sum + (e.experience ?? 0), 0);
  const levels = [0, 30, 100, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const index = levels.filter((start) => total >= start).length - 1,
    next = levels[index + 1] ?? null;
  return {
    totalExperience: total,
    level: index + 1,
    levelStartExperience: levels[index],
    nextLevelExperience: next,
    experienceInLevel: total - levels[index],
    experienceToNextLevel: next == null ? 0 : next - total,
    maxLevel: next == null,
    levelRuleVersion: "growth-levels-v1",
    dailyExperience: 5,
  };
}
export function demoGrowth(
  state: DemoGrowth,
  path: string,
  query: Query,
  now = new Date(),
) {
  const today = businessDate(now);
  if (path === "/admin/engagement/stats") {
    const date = String(query.date || today);
    if (!validBusinessDate(date, today))
      throw new ApiError("统计日期不能晚于今天。", 40001);
    const month = date.slice(0, 7),
      start = new Date(date + "T00:00:00Z");
    start.setUTCDate(start.getUTCDate() - 29);
    const rolling30Start = start.toISOString().slice(0, 10);
    return {
      date,
      month,
      rolling30Start,
      timezone: "Asia/Shanghai",
      dailyActiveUsers: Number(
        state.entries.some((e) => e.businessDate === date),
      ),
      monthlyActiveUsers: Number(
        state.entries.some((e) => e.businessDate?.startsWith(month)),
      ),
      rolling30ActiveUsers: Number(
        state.entries.some(
          (e) => e.businessDate! >= rolling30Start && e.businessDate! <= date,
        ),
      ),
    };
  }
  const first = !state.entries.some((e) => e.businessDate === today);
  if (first)
    state.entries.unshift({
      entryId: crypto.randomUUID(),
      businessDate: today,
      sourceType: "DAILY_USE",
      experience: 5,
      ruleVersion: "daily-use-v1",
      createdAt: now.toISOString(),
    });
  if (path === "/user/activity")
    return {
      businessDate: today,
      firstUseToday: first,
      experienceAdded: first ? 5 : 0,
      growth: progress(state),
    };
  if (path === "/user/growth") return progress(state);
  const page = Number(query.page ?? 1),
    size = Number(query.pageSize ?? 20);
  return {
    items: state.entries.slice((page - 1) * size, page * size),
    currentPage: page,
    totalItems: state.entries.length,
    totalPages: Math.ceil(state.entries.length / size),
    hasNext: page * size < state.entries.length,
  };
}
