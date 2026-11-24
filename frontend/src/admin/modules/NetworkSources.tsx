import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { businessDate } from "../../api/growth";
import {
  breakdownRange,
  cernetShare,
  shiftDate,
  type NetworkCounts,
} from "../../api/admin-analytics";
import { Async, Notice, Panel, num } from "../kit";

/** How many new and active accounts came from the campus network (CERNET). */
export function NetworkSources() {
  const { api } = useApp(),
    today = businessDate(),
    [form, setForm] = useState(() => ({ from: shiftDate(today, -13), to: today }));
  const range = breakdownRange(
      { granularity: "DAY", fromHour: 0, toHour: 24, ...form },
      today,
    ),
    valid = !("error" in range);
  const q = useQuery({
    queryKey: ["admin", "engagement", "user-networks", range],
    queryFn: () => {
      if ("error" in range) throw new Error(range.error);
      return api.userNetworkStats(range);
    },
    enabled: valid,
    staleTime: 60000,
    retry: false,
  });
  const dateField = (key: "from" | "to", label: string) => (
    <label className="ew-admin-inline-field">
      {label}
      <input
        type="date"
        value={form[key]}
        max={today}
        onChange={(e) => {
          const { value } = e.target;
          if (value) setForm((f) => ({ ...f, [key]: value }));
        }}
      />
    </label>
  );
  return (
    <Panel title="网络来源" hint="按北京时间统计，最多查 92 天">
      <div className="ew-admin-toolbar">
        {dateField("from", "从")}
        {dateField("to", "到")}
      </div>
      {"error" in range ? (
        <div role="alert">
          <Notice tone="warn">{range.error}</Notice>
        </div>
      ) : (
        <Async query={q} rows={3}>
          <div className="ew-admin-table-wrap">
            <table className="ew-admin-table">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>总数</th>
                  <th>教育网</th>
                  <th>移动</th>
                  <th>联通</th>
                  <th>电信</th>
                  <th>其他</th>
                  <th>未知</th>
                  <th>教育网占比</th>
                </tr>
              </thead>
              <tbody>
                <Counts label="新增账号 · 注册网络" counts={q.data?.registered} />
                <Counts label="活跃账号 · 最近网络" counts={q.data?.active} />
              </tbody>
            </table>
          </div>
        </Async>
      )}
      <p className="ew-admin-toolbar-note">
        活跃账号按其当前最近一次使用的网络归类，不是区间内当时的网络。占比以总数（含未知）为分母。
        「其他」包括其他公网出口和归属有歧义的出口。
      </p>
    </Panel>
  );
}

function Counts({ label, counts }: { label: string; counts?: NetworkCounts }) {
  const split = counts?.otherBreakdown;
  return (
    <tr>
      <td>{label}</td>
      <td>{num(counts?.total)}</td>
      <td>{num(counts?.cernet)}</td>
      <td>{num(split?.chinaMobile)}</td>
      <td>{num(split?.chinaUnicom)}</td>
      <td>{num(split?.chinaTelecom)}</td>
      <td>{num(split ? split.remaining : counts?.other)}</td>
      <td>{num(counts?.unknown)}</td>
      <td>{cernetShare(counts?.cernetRate)}</td>
    </tr>
  );
}
