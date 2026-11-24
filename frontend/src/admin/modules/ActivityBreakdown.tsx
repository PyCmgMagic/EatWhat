import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select } from "../../components/Select";
import { useApp } from "../../app/state";
import { businessDate } from "../../api/growth";
import {
  beijingTime,
  breakdownRange,
  bucketLabel,
  platformNames,
  shiftDate,
  type BreakdownForm,
  type Granularity,
} from "../../api/admin-analytics";
import { Async, Columns, Notice, Panel, Segmented, num } from "../kit";

const defaults = (
  granularity: Granularity,
  today = businessDate(),
): BreakdownForm => ({
  granularity,
  from:
    granularity === "HOUR"
      ? today
      : shiftDate(today, granularity === "DAY" ? -13 : -91),
  to: today,
  fromHour: 0,
  toHour: 24,
});

/** Active users per hour, day or month, overall or for one client platform. */
export function ActivityBreakdown() {
  const { api } = useApp(),
    today = businessDate(),
    [form, setForm] = useState(() => defaults("HOUR")),
    [platform, setPlatform] = useState("ALL");
  const range = breakdownRange(form, today),
    valid = !("error" in range),
    { granularity } = form;
  const q = useQuery({
    queryKey: ["admin", "engagement", "breakdown", granularity, range],
    queryFn: () => {
      if ("error" in range) throw new Error(range.error);
      return api.engagementBreakdown({ ...range, granularity });
    },
    enabled: valid,
    staleTime: 60000,
    retry: false,
  });
  const data = q.data,
    sameDay = form.from === form.to,
    partial =
      !!data?.from &&
      !!data.observedFrom &&
      Date.parse(data.observedFrom) > Date.parse(data.from);
  const set = (patch: Partial<BreakdownForm>) =>
    setForm((f) => ({ ...f, ...patch }));
  const points = (data?.buckets ?? []).map((b) => ({
    label: bucketLabel(b.start, granularity, sameDay),
    value:
      platform === "ALL"
        ? b.counts?.activeUsers
        : b.counts?.byPlatform?.[platform],
  }));
  const dateField = (key: "from" | "to", label: string) => (
    <label className="ew-admin-inline-field">
      {label}
      <input
        type="date"
        value={form[key]}
        max={today}
        onChange={(e) => e.target.value && set({ [key]: e.target.value })}
      />
    </label>
  );
  const hourField = (key: "fromHour" | "toHour", label: string, first: number) =>
    granularity === "HOUR" && (
      <Select
        inline
        motionDuration={200}
        closeDuration={100}
        aria-label={label}
        value={String(form[key])}
        onChange={(e) => set({ [key]: Number(e.target.value) })}
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i + first}>
            {i + first} 点
          </option>
        ))}
      </Select>
    );
  return (
    <Panel
      title="分端与分时活跃"
      hint="按北京时间统计，每个时段和合计分别按账号去重"
      actions={
        <Segmented
          label="统计粒度"
          value={granularity}
          onChange={(value) => setForm(defaults(value))}
          options={[
            ["HOUR", "按小时"],
            ["DAY", "按天"],
            ["MONTH", "按月"],
          ]}
        />
      }
    >
      <div className="ew-admin-toolbar">
        {dateField("from", "从")}
        {hourField("fromHour", "开始时刻", 0)}
        {dateField("to", "到")}
        {hourField("toHour", "结束时刻", 1)}
        <Select
          inline
          motionDuration={200}
          closeDuration={100}
          aria-label="客户端"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value="ALL">全部客户端</option>
          {Object.entries(platformNames).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
      </div>
      {"error" in range ? (
        <div role="alert">
          <Notice tone="warn">{range.error}</Notice>
        </div>
      ) : (
        <Async
          query={q}
          rows={4}
          empty={!data?.total}
          emptyTitle="这个区间没有采集数据"
          emptyHint={
            data?.coverageFrom
              ? `分端和分时数据从 ${beijingTime(data.coverageFrom)} 起可查。`
              : undefined
          }
        >
          {partial && (
            <Notice tone="warn">
              {beijingTime(data?.observedFrom)}{" "}
              之前没有分端和分时数据，图表与合计只包含之后的部分。
            </Notice>
          )}
          <dl className="ew-admin-kpis is-wrap">
            <div>
              <dt>区间活跃</dt>
              <dd>{num(data?.total?.activeUsers)}</dd>
            </div>
            {Object.entries(platformNames).map(([id, name]) => (
              <div key={id}>
                <dt>{name}</dt>
                <dd>{num(data?.total?.byPlatform?.[id])}</dd>
              </div>
            ))}
          </dl>
          <div
            className="ew-admin-columns-scroll"
            role="region"
            aria-label="活跃走势图"
            tabIndex={0}
          >
            <div style={{ minWidth: points.length * 9 }}>
              <Columns
                data={points}
                label={`${platform === "ALL" ? "全部客户端" : platformNames[platform]}活跃用户走势`}
              />
            </div>
          </div>
        </Async>
      )}
      <p className="ew-admin-toolbar-note">
        同一用户可能使用多个客户端，各端人数之和可能大于区间活跃。按小时最多查
        7 天，其余最多 92 天。
      </p>
    </Panel>
  );
}
