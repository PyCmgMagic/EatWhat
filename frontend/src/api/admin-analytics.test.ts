import { describe, expect, it, vi } from "vitest";
import {
  breakdownRange,
  bucketLabel,
  cernetShare,
  networkName,
  telemetryProperties,
  type BreakdownForm,
} from "./admin-analytics";
import { demoAnalytics } from "../demo/analytics";
import { spanRange } from "../admin/modules/Telemetry";
import { createApi } from "./service";
import { bridgeToV2 } from "./v2-bridge";

vi.mock("../app/runtime", () => ({ isDemo: false }));

const form = (patch: Partial<BreakdownForm> = {}): BreakdownForm => ({
  granularity: "HOUR",
  from: "2026-11-24",
  to: "2026-11-24",
  fromHour: 18,
  toHour: 21,
  ...patch,
});
const range = (patch?: Partial<BreakdownForm>) =>
  breakdownRange(form(patch), "2026-11-24");

describe("breakdownRange", () => {
  it("sends whole hours, rolling 24 over to the next day", () => {
    expect(range()).toEqual({
      from: "2026-11-24T18:00",
      to: "2026-11-24T21:00",
    });
    expect(range({ fromHour: 0, toHour: 24 })).toEqual({
      from: "2026-11-24T00:00",
      to: "2026-11-25T00:00",
    });
  });
  it("sends inclusive dates for days and months", () => {
    expect(range({ granularity: "DAY", from: "2026-11-11" })).toEqual({
      from: "2026-11-11",
      to: "2026-11-24",
    });
  });
  it("rejects future, reversed and oversized ranges", () => {
    expect(range({ to: "2026-11-25" })).toHaveProperty("error");
    expect(range({ fromHour: 21, toHour: 21 })).toHaveProperty("error");
    const week = { from: "2026-11-18", fromHour: 0, toHour: 24 };
    expect(range(week)).not.toHaveProperty("error");
    expect(range({ ...week, from: "2026-11-17" })).toHaveProperty("error");
    expect(range({ granularity: "DAY", from: "2026-08-25" })).not.toHaveProperty(
      "error",
    );
    expect(range({ granularity: "DAY", from: "2026-08-24" })).toHaveProperty(
      "error",
    );
  });
});

it("labels buckets in Beijing time whatever offset the server used", () => {
  expect(bucketLabel("2026-11-23T16:00:00Z", "HOUR")).toBe("11/24 00时");
  expect(bucketLabel("2026-11-24T00:00:00+08:00", "DAY")).toBe("11/24");
  expect(bucketLabel("2026-11-01T00:00:00+08:00", "MONTH")).toBe("2026/11");
});

it("describes whitelisted properties", () => {
  expect(
    telemetryProperties({ event: "page_view", page: "HOME", durationMs: 8200 }),
  ).toBe("页面：首页 · 停留：8.2 秒");
  expect(telemetryProperties({ event: "app_open" })).toBe("");
});

it("tells a missing share and network from zero and unknown", () => {
  expect(cernetShare(null)).toBe("—");
  expect(cernetShare(0)).toBe("0.0%");
  expect(cernetShare(0.625)).toBe("62.5%");
  expect(networkName("CERNET")).toBe("教育网");
  expect(networkName(null)).toBe("—");
  expect(networkName("NEW")).toBe("NEW");
});

it("lets the server clock set the window edges", () => {
  expect(spanRange("7")).toEqual({});
  expect(spanRange("1", Date.parse("2026-11-24T00:00:00Z"))).toEqual({
    from: "2026-11-23T00:00:00.000Z",
  });
});

it("reaches the v2 endpoints through the bridge unchanged", async () => {
  const live = vi.fn(async (_path: string, _options: unknown) => ({
    code: 0,
    data: {},
  }));
  const api = createApi(bridgeToV2(live));
  await api.engagementBreakdown({
    from: "2026-11-24T18:00",
    to: "2026-11-24T21:00",
    granularity: "HOUR",
  });
  await api.adminUserNetwork(21);
  await api.userNetworkStats({ from: "2026-11-11", to: "2026-11-24" });
  await api.adminTelemetrySummary({ platform: "WEB" });
  await api.adminTelemetryEvents({ page: 2, pageSize: 20, event: "share" });
  expect(
    live.mock.calls.map(([path, o]) => [
      path,
      (o as { query?: unknown } | undefined)?.query,
    ]),
  ).toEqual([
    [
      "/admin/engagement/stats/breakdown",
      { from: "2026-11-24T18:00", to: "2026-11-24T21:00", granularity: "HOUR" },
    ],
    ["/admin/users/21/network", undefined],
    ["/admin/stats/user-networks", { from: "2026-11-11", to: "2026-11-24" }],
    ["/admin/telemetry/summary", { platform: "WEB" }],
    ["/admin/telemetry/events", { page: 2, pageSize: 20, event: "share" }],
  ]);
});

it("demo data respects coverage and pagination", () => {
  const now = Date.parse("2026-11-24T04:00:00Z");
  expect(
    demoAnalytics(
      "/admin/engagement/stats/breakdown",
      { from: "2026-09-01", to: "2026-09-02", granularity: "DAY" },
      now,
    ),
  ).toMatchObject({ observedFrom: null, total: null, buckets: [] });
  expect(
    demoAnalytics("/admin/telemetry/events", { page: 2, event: "share" }, now),
  ).toMatchObject({ events: { currentPage: 2, hasNext: false } });
});
