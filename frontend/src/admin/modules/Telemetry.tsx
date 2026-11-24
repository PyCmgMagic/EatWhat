import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select } from "../../components/Select";
import { useAdminState } from "../../app/admin-state";
import { useApp } from "../../app/state";
import {
  audienceNames,
  beijingTime,
  platformNames,
  telemetryEventNames,
  telemetryProperties,
  type TelemetryFilters,
  type TelemetryRange,
  type TelemetrySummary,
} from "../../api/admin-analytics";
import { Async, Notice, Pager, Panel, Pill, Segmented, num } from "../kit";

type Span = "1" | "3" | "7";
/**
 * Only `from` is sent, and nothing for the full 7 days: the server rejects a
 * future `to` and a span over 7 days, so its own clock must set those edges.
 */
export const spanRange = (span: Span, now = Date.now()): TelemetryRange =>
  span === "7"
    ? {}
    : { from: new Date(now - Number(span) * 86400000).toISOString() };

export default function Telemetry() {
  const { api } = useApp(),
    [span, setSpan] = useAdminState<Span>("telemetry.span", "7"),
    [filters, setFilters] = useAdminState<TelemetryFilters>(
      "telemetry.filters",
      {},
    ),
    // Later pages reuse the first page's window, so new events do not shift rows.
    [position, setPosition] = useState<{
      page: number;
      window?: TelemetryRange;
    }>({ page: 1 });
  const summary = useQuery({
      queryKey: ["admin", "telemetry", "summary", span, filters],
      queryFn: () => api.adminTelemetrySummary({ ...filters, ...spanRange(span) }),
      retry: false,
    }),
    events = useQuery({
      queryKey: ["admin", "telemetry", "events", span, filters, position],
      queryFn: () =>
        api.adminTelemetryEvents({
          ...filters,
          ...(position.window ?? spanRange(span)),
          page: position.page,
          pageSize: 20,
        }),
      retry: false,
    });
  const total = summary.data?.total,
    window = summary.data?.window,
    list = events.data?.events,
    filtered = Object.values(filters).some((v) => v !== undefined);
  const restart = () => setPosition({ page: 1 });
  const refresh = () => {
    void summary.refetch();
    if (position.window) restart();
    else void events.refetch();
  };
  const filter = (
    key: keyof TelemetryFilters,
    label: string,
    all: string,
    names: Record<string, string>,
  ) => (
    <Select
      inline
      motionDuration={200}
      closeDuration={100}
      aria-label={label}
      value={filters[key] ?? ""}
      onChange={(e) => {
        setFilters({ ...filters, [key]: e.target.value || undefined });
        restart();
      }}
    >
      <option value="">{all}</option>
      {Object.entries(names).map(([id, name]) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </Select>
  );
  return (
    <>
      <div className="ew-admin-toolbar">
        <Segmented
          label="时间范围"
          value={span}
          onChange={(value) => {
            setSpan(value);
            restart();
          }}
          options={[
            ["1", "24 小时"],
            ["3", "3 天"],
            ["7", "7 天"],
          ]}
        />
        {filter("event", "事件", "全部事件", telemetryEventNames)}
        {filter("platform", "客户端", "全部客户端", platformNames)}
        {filter("audience", "登录状态", "登录不限", audienceNames)}
        {filtered && (
          <button
            type="button"
            className="ew-admin-btn is-ghost"
            onClick={() => {
              setFilters({});
              restart();
            }}
          >
            清除筛选
          </button>
        )}
        <button
          type="button"
          className="ew-admin-btn"
          disabled={summary.isFetching || events.isFetching}
          onClick={refresh}
        >
          刷新
        </button>
      </div>
      <Async query={summary} rows={2}>
        <div className="ew-admin-stats is-three">
          <div className="ew-admin-stat">
            <span className="ew-admin-stat-label">事件数</span>
            <strong>{num(total?.events)}</strong>
            <small>截至 {beijingTime(window?.to)}</small>
          </div>
          <div className="ew-admin-stat">
            <span className="ew-admin-stat-label">登录账号</span>
            <strong>{num(total?.signedInUsers)}</strong>
            <small>按账号去重</small>
          </div>
          <div className="ew-admin-stat">
            <span className="ew-admin-stat-label">游客设备</span>
            <strong>{num(total?.guestInstalls)}</strong>
            <small>按安装去重</small>
          </div>
        </div>
      </Async>
      <div className="ew-admin-grid">
        <Groups
          title="按事件"
          query={summary}
          names={telemetryEventNames}
          rows={summary.data?.byEvent}
        />
        <Groups
          title="按客户端"
          query={summary}
          names={platformNames}
          rows={summary.data?.byPlatform}
        />
      </div>
      <Panel title="事件明细" hint="按接收时间从新到旧，北京时间" flush>
        <Async
          query={events}
          rows={8}
          empty={!list?.items?.length}
          emptyTitle={filtered ? "没有符合条件的事件" : "这段时间没有事件"}
        >
          <div className="ew-admin-table-wrap">
            <table className="ew-admin-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>事件</th>
                  <th>客户端</th>
                  <th>登录状态</th>
                  <th>属性</th>
                </tr>
              </thead>
              <tbody>
                {list?.items?.map((item, i) => (
                  <tr key={i}>
                    <td className="is-muted">{beijingTime(item.receivedAt)}</td>
                    <td>
                      <strong>
                        {telemetryEventNames[item.event ?? ""] ?? item.event}
                      </strong>
                      <small className="ew-admin-sub">{item.event}</small>
                    </td>
                    <td>{platformNames[item.platform ?? ""] ?? item.platform}</td>
                    <td>
                      <Pill
                        dot={false}
                        tone={item.audience === "GUEST" ? "neutral" : "info"}
                      >
                        {audienceNames[item.audience ?? ""] ?? item.audience}
                      </Pill>
                    </td>
                    <td className="is-wrap">
                      {telemetryProperties(item.properties) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Async>
        <Pager
          page={position.page}
          total={list?.totalItems}
          totalPages={list?.totalPages}
          hasNext={list?.hasNext}
          onChange={(page) =>
            setPosition({
              page,
              window:
                position.window ??
                (events.data?.window && {
                  from: events.data.window.from,
                  to: events.data.window.to,
                }),
            })
          }
        />
      </Panel>
      <Notice>
        仅包含用户同意收集的事件，保留 7
        天；关闭使用统计的用户，其数据会被删除。同一账号或设备可能出现在多个分组中。
      </Notice>
    </>
  );
}

function Groups({
  title,
  query,
  names,
  rows,
}: {
  title: string;
  query: Parameters<typeof Async>[0]["query"];
  names: Record<string, string>;
  rows: TelemetrySummary["byEvent"];
}) {
  const sorted = [...(rows ?? [])].sort(
    (a, b) => (b.counts?.events ?? 0) - (a.counts?.events ?? 0),
  );
  return (
    <Panel title={title} flush>
      <Async query={query} rows={4} empty={!sorted.length} emptyTitle="暂无事件">
        <div className="ew-admin-table-wrap">
          <table className="ew-admin-table">
            <thead>
              <tr>
                <th>{title.slice(1)}</th>
                <th className="is-num">事件数</th>
                <th className="is-num">登录账号</th>
                <th className="is-num">游客设备</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.value}>
                  <td>{names[row.value ?? ""] ?? row.value}</td>
                  <td className="is-num">{num(row.counts?.events)}</td>
                  <td className="is-num">{num(row.counts?.signedInUsers)}</td>
                  <td className="is-num">{num(row.counts?.guestInstalls)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Async>
    </Panel>
  );
}
