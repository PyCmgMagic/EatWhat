import type {
  EngagementBreakdown,
  Granularity,
  TelemetryEventPage,
  TelemetrySummary,
} from "../api/admin-analytics";
import { shiftDate } from "../api/admin-analytics";
import type { Query } from "../api/client";
import { ApiError } from "../api/client";
import { businessDate } from "../api/growth";

const HOUR = 3600000;
const DAY = 24 * HOUR;
const platforms = ["WEB", "IOS", "ANDROID", "APP", "UNKNOWN"] as const;
export const isAnalyticsPath = (path: string) =>
  path === "/admin/engagement/stats/breakdown" ||
  path === "/admin/telemetry/summary" ||
  path === "/admin/telemetry/events";

const beijing = (ms: number) =>
  new Date(ms + 8 * HOUR).toISOString().slice(0, 19) + "+08:00";
function bound(value: string, end: boolean) {
  const full = value.length === 10 ? `${value}T00:00` : value;
  return Date.parse(full + ":00+08:00") + (end && value.length === 10 ? DAY : 0);
}

function breakdown(q: Query, now: number): EngagementBreakdown {
  const today = businessDate(new Date(now));
  const granularity = String(q.granularity ?? "DAY") as Granularity;
  const limit = granularity === "HOUR" ? 7 : 92;
  const to = bound(String(q.to ?? today), true);
  const from = bound(
    String(q.from ?? shiftDate(today, 1 - Math.min(14, limit))),
    false,
  );
  if (!(from < to) || to - from > limit * DAY)
    throw new ApiError(`一次最多查询 ${limit} 天`, 10001);
  // The demo started collecting 20 days ago.
  const coverage = bound(shiftDate(today, -20), false);
  const observedFrom = Math.max(from, coverage);
  const observedTo = Math.min(to, now);
  const base = {
    from: beijing(from),
    to: beijing(to),
    granularity,
    timezone: "Asia/Shanghai",
    coverageFrom: beijing(coverage),
  };
  if (observedFrom >= observedTo)
    return { ...base, observedFrom: null, observedTo: null, total: null, buckets: [] };
  const counts = (n: number) => ({
    activeUsers: n,
    byPlatform: {
      WEB: Math.ceil(n * 0.6),
      IOS: Math.floor(n * 0.3),
      ANDROID: Math.floor(n * 0.25),
      APP: 0,
      UNKNOWN: 0,
    },
  });
  const buckets: NonNullable<EngagementBreakdown["buckets"]> = [];
  let cursor = observedFrom;
  while (cursor < observedTo) {
    const local = new Date(cursor + 8 * HOUR);
    const next =
      granularity === "HOUR"
        ? cursor + HOUR
        : granularity === "DAY"
          ? cursor + DAY
          : Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) -
            8 * HOUR;
    const h = local.getUTCHours();
    const n =
      granularity === "HOUR"
        ? h < 6 ? 0 : h === 12 || h === 18 ? 14 : 5
        : granularity === "DAY"
          ? 18 + (local.getUTCDate() % 7)
          : 40;
    buckets.push({
      start: beijing(cursor),
      end: beijing(Math.min(next, to)),
      counts: counts(n),
    });
    cursor = next;
  }
  return {
    ...base,
    observedFrom: beijing(observedFrom),
    observedTo: beijing(observedTo),
    total: counts(
      Math.max(...buckets.map((b) => b.counts?.activeUsers ?? 0)) + 6,
    ),
    buckets,
  };
}

const samples = [
  { event: "app_open" },
  { event: "page_view", page: "HOME", durationMs: 8200 },
  { event: "dish_decide", restaurantId: 1, foodId: 2 },
  { event: "share", targetType: "FOOD", targetId: 2 },
  { event: "load_failed", page: "SEARCH", code: 503 },
];
function telemetry(q: Query, now: number) {
  const to = q.to ? Date.parse(String(q.to)) : now;
  const from = q.from ? Date.parse(String(q.from)) : to - 7 * DAY;
  if (!(from < to) || to - from > 7 * DAY)
    throw new ApiError("一次最多查询 7 天", 10001);
  const window = {
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    retainedFrom: new Date(now - 7 * DAY).toISOString(),
    observedFrom: new Date(Math.max(from, now - 7 * DAY)).toISOString(),
  };
  // Anchored to the hour, so events keep their place between requests.
  const anchor = Math.floor(now / HOUR) * HOUR;
  const rows = Array.from({ length: 120 }, (_, i) => ({
    at: anchor - i * 80 * 60000,
    sample: samples[i % samples.length],
    platform: platforms[i % 3],
    audience: i % 4 === 0 ? ("GUEST" as const) : ("SIGNED_IN" as const),
    who: i % 7,
  })).filter(
    (r) =>
      r.at >= from &&
      r.at < to &&
      (!q.event || q.event === r.sample.event) &&
      (!q.platform || q.platform === r.platform) &&
      (!q.audience || q.audience === r.audience),
  );
  return { window, rows };
}

export function demoAnalytics(
  path: string,
  q: Query,
  now = Date.now(),
): EngagementBreakdown | TelemetrySummary | TelemetryEventPage {
  if (path === "/admin/engagement/stats/breakdown") return breakdown(q, now);
  const { window, rows } = telemetry(q, now);
  if (path === "/admin/telemetry/summary") {
    const counts = (list: typeof rows) => {
      const people = (audience: string) =>
        new Set(list.filter((r) => r.audience === audience).map((r) => r.who))
          .size;
      return {
        events: list.length,
        signedInUsers: people("SIGNED_IN"),
        guestInstalls: people("GUEST"),
      };
    };
    const group = (key: (row: (typeof rows)[number]) => string) =>
      [...new Set(rows.map(key))].sort().map((value) => ({
        value,
        counts: counts(rows.filter((r) => key(r) === value)),
      }));
    return {
      window,
      total: counts(rows),
      byEvent: group((r) => r.sample.event),
      byPlatform: group((r) => r.platform),
    };
  }
  const page = Math.max(1, Number(q.page) || 1);
  const size = Math.min(100, Math.max(1, Number(q.pageSize) || 20));
  const totalPages = Math.ceil(rows.length / size);
  return {
    window,
    events: {
      currentPage: page,
      totalItems: rows.length,
      totalPages,
      hasNext: page < totalPages,
      items: rows.slice((page - 1) * size, page * size).map((r) => ({
        receivedAt: new Date(r.at).toISOString(),
        event: r.sample.event,
        platform: r.platform,
        audience: r.audience,
        properties: r.sample,
      })),
    },
  };
}
