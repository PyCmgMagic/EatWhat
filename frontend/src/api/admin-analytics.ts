import type { components } from "./backend-v2-schema";
import { businessDate, validBusinessDate } from "./growth";

type V2 = components["schemas"];
export type EngagementBreakdown = V2["EngagementBreakdown"];
export type TelemetrySummary = V2["TelemetrySummary"];
export type TelemetryEventPage = V2["TelemetryEventPage"];
export type UserNetworks = V2["UserNetworks"];
export type NetworkCounts = V2["NetworkCounts"];
export type NetworkSummary = V2["NetworkSummary"];
export type Granularity = "HOUR" | "DAY" | "MONTH";
export type TelemetryFilters = {
  event?: string;
  platform?: string;
  audience?: string;
};
export type TelemetryRange = { from?: string; to?: string };

/** Backend limits: hourly detail at most 7 days, everything else 92. */
export const breakdownLimit = (granularity: Granularity) =>
  granularity === "HOUR" ? 7 : 92;

export const platformNames: Record<string, string> = {
  WEB: "网页",
  IOS: "iOS",
  ANDROID: "Android",
  APP: "移动端（系统未识别）",
  UNKNOWN: "未知",
};
const networkNames: Record<string, string> = {
  CERNET: "教育网",
  CHINA_MOBILE: "移动",
  CHINA_UNICOM: "联通",
  CHINA_TELECOM: "电信",
  OTHER: "其他网络",
  UNKNOWN: "未知",
};
export const networkName = (network?: string | null) =>
  network ? (networkNames[network] ?? network) : "—";
/** `rate` is 0–1, or null when there are no accounts to divide by. */
export const cernetShare = (rate?: number | null) =>
  rate == null ? "—" : `${(rate * 100).toFixed(1)}%`;
export const audienceNames: Record<string, string> = {
  SIGNED_IN: "已登录",
  GUEST: "游客",
};
/** Whitelist of the backend's TelemetryService. */
export const telemetryEventNames: Record<string, string> = {
  app_open: "打开应用",
  page_view: "浏览页面",
  dish_shuffle: "换一道菜",
  dish_decide: "就吃这个",
  navigate_shop: "导航到店",
  publish_success: "发布成功",
  comment_success: "评论成功",
  verify_success: "认证成功",
  share: "分享",
  load_failed: "加载失败",
};
const pageNames: Record<string, string> = {
  HOME: "首页",
  RECOMMEND: "推荐",
  SEARCH: "搜索",
  RESTAURANT: "店铺",
  FOOD: "菜品",
  MESSAGE: "消息",
  PROFILE: "个人",
  OTHER: "其他",
};
const propertyNames: Record<string, string> = {
  page: "页面",
  durationMs: "停留",
  restaurantId: "店铺",
  foodId: "菜品",
  kind: "类型",
  method: "方式",
  targetType: "对象",
  targetId: "对象 ID",
  code: "错误码",
};

/** `event` is already its own column. */
export function telemetryProperties(properties?: Record<string, unknown>) {
  return Object.entries(properties ?? {})
    .filter(([key, value]) => key !== "event" && value != null)
    .map(([key, value]) => {
      const shown =
        key === "page"
          ? (pageNames[String(value)] ?? String(value))
          : key === "durationMs" && typeof value === "number"
            ? `${(value / 1000).toFixed(1)} 秒`
            : /^(restaurantId|foodId)$/.test(key)
              ? `#${value}`
              : typeof value === "object"
                ? JSON.stringify(value)
                : String(value);
      return `${propertyNames[key] ?? key}：${shown}`;
    })
    .join(" · ");
}

export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export type BreakdownForm = {
  granularity: Granularity;
  from: string;
  to: string;
  /** Hours of the day, HOUR only: 0–23 and 1–24. */
  fromHour: number;
  toHour: number;
};
const hour = (n: number) => String(n).padStart(2, "0");

/** Days are inclusive; hours become a half-open whole-hour range. */
export function breakdownRange(
  form: BreakdownForm,
  today = businessDate(),
): { from: string; to: string } | { error: string } {
  const { granularity, from, to, fromHour, toHour } = form;
  if (!validBusinessDate(from, today) || !validBusinessDate(to, today))
    return { error: "请选择今天或之前的有效日期。" };
  const hourly = granularity === "HOUR";
  const start = Date.parse(from) + (hourly ? fromHour * 3600000 : 0);
  const end = Date.parse(to) + (hourly ? toHour : 24) * 3600000;
  if (start >= end) return { error: "开始时间必须早于结束时间。" };
  const limit = breakdownLimit(granularity);
  if (end - start > limit * 86400000)
    return {
      error: `${hourly ? "按小时" : ""}一次最多查询 ${limit} 天。`,
    };
  if (!hourly) return { from, to };
  return {
    from: `${from}T${hour(fromHour)}:00`,
    to:
      toHour === 24
        ? `${shiftDate(to, 1)}T00:00`
        : `${to}T${hour(toHour)}:00`,
  };
}

function beijingParts(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}
export function beijingTime(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  const p = beijingParts(value);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
export function bucketLabel(
  start: string | undefined,
  granularity: Granularity,
  sameDay = false,
) {
  if (!start || !Number.isFinite(Date.parse(start))) return "—";
  const p = beijingParts(start);
  if (granularity === "MONTH") return `${p.year}/${p.month}`;
  const day = `${p.month}/${p.day}`;
  return granularity === "DAY"
    ? day
    : sameDay
      ? `${p.hour}时`
      : `${day} ${p.hour}时`;
}
