import {
  businessDate,
  validBusinessDate,
  type ExperienceRule,
} from "../api/growth";
import type { Query } from "../api/client";
import { ApiError } from "../api/client";
import type { Schema } from "../api/models";

export type DemoGrowth = {
  entries: Schema["ExperienceEntryResponse"][];
  titleAcquiredAt?: number;
  titleEquipped?: boolean;
};
/** 后端 v2 /user/level 的 rules，演示模式与真实接口保持同一套经验来源。 */
const DEMO_RULES: ExperienceRule[] = [
  { source: "daily_use", name: "每日使用", amount: 5, dailyCap: 1 },
  { source: "verified", name: "完成学生认证", amount: 50, dailyCap: 1 },
  { source: "food_published", name: "发布菜品", amount: 15, dailyCap: 3 },
  { source: "restaurant_created", name: "新建店铺", amount: 10, dailyCap: 2 },
  { source: "content_edited", name: "完善店铺或菜品", amount: 3, dailyCap: 5 },
  { source: "restaurant_rated", name: "评价店铺", amount: 3, dailyCap: 3 },
  { source: "comment_posted", name: "发表评论", amount: 3, dailyCap: 3 },
  { source: "food_liked", name: "菜品被赞", amount: 2, dailyCap: 20 },
  { source: "comment_liked", name: "评论被赞", amount: 1, dailyCap: 10 },
];
function progress(
  state: DemoGrowth,
): Schema["GrowthProgressResponse"] & { rules: ExperienceRule[]; title: string | null } {
  const total = state.entries.reduce((sum, e) => sum + (e.experience ?? 0), 0);
  const levels = [0, 30, 100, 250, 500, 1000, 2000, 3500, 6000, 10000];
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
    rules: DEMO_RULES,
    title: state.titleEquipped ? "老吃家" : null,
  };
}
export function demoGrowth(
  state: DemoGrowth,
  path: string,
  query: Query,
  now = new Date(),
) {
  const today = businessDate(now);
  if (path === "/admin/engagement/stats/range") {
    const to = String(query.to || today),
      days: { date: string; activeUsers: number }[] = [];
    for (
      let d = new Date(String(query.from || to) + "T00:00:00Z");
      d.toISOString().slice(0, 10) <= to && days.length < 92;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const date = d.toISOString().slice(0, 10);
      days.push({
        date,
        activeUsers: Number(state.entries.some((e) => e.businessDate === date)),
      });
    }
    return { from: days[0]?.date, to, timezone: "Asia/Shanghai", days };
  }
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
  if (!state.titleAcquiredAt && progress(state).maxLevel) {
    state.titleAcquiredAt = now.getTime();
    state.titleEquipped = true;
  }
  if (path === "/user/titles") {
    if (state.titleAcquiredAt == null) return [];
    return [
      {
        code: "veteran_foodie",
        name: "老吃家",
        requiredExperience: 10000,
        acquiredAt: state.titleAcquiredAt,
        equipped: state.titleEquipped ?? false,
      },
    ];
  }
  if (path === "/user/titles/equipped") {
    state.titleEquipped = false;
    return null;
  }
  if (path.startsWith("/user/titles/equipped/")) {
    if (
      !state.titleAcquiredAt ||
      path !== "/user/titles/equipped/veteran_foodie"
    )
      throw new ApiError("尚未获得该称号", 10001);
    state.titleEquipped = true;
    return null;
  }
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

export { progress as demoGrowthProgress };
