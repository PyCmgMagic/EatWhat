import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { businessDate, validBusinessDate } from "../../api/growth";
import { Async, Columns, Notice, Panel, Segmented, num } from "../kit";
import { useActiveSeries } from "./Overview";

export default function Engagement() {
  const { api, toast } = useApp(),
    today = businessDate(),
    [date, setDate] = useState(today),
    [span, setSpan] = useState<"7" | "14" | "30" | "90">("14");
  const q = useQuery({
      queryKey: ["admin", "engagement", date],
      queryFn: () => api.engagementStats(date),
    }),
    series = useActiveSeries(Number(span), date),
    data = q.data,
    values = series.points.flatMap((p) => (p.value == null ? [] : [p.value])),
    average = values.length
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
      : undefined;
  return (
    <>
      <div className="ad-toolbar">
        <label className="ad-inline-field">
          统计日
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              const value = e.target.value || today;
              if (validBusinessDate(value, today)) setDate(value);
              else toast("请选择今天或之前的有效日期。", { tone: "error" });
            }}
          />
        </label>
        {date !== today && (
          <button className="ad-btn" onClick={() => setDate(today)}>
            回到今天
          </button>
        )}
        <span className="ad-toolbar-note">
          按北京时间统计 · {data?.timezone ?? "Asia/Shanghai"}
        </span>
      </div>
      <Async query={q} rows={2}>
        <div className="ad-stats is-three">
          <div className="ad-stat">
            <span className="ad-stat-label">当日活跃 DAU</span>
            <strong>{num(data?.dailyActiveUsers)}</strong>
            <small>{data?.date}</small>
          </div>
          <div className="ad-stat">
            <span className="ad-stat-label">自然月活跃 MAU</span>
            <strong>{num(data?.monthlyActiveUsers)}</strong>
            <small>{data?.month} 去重人数</small>
          </div>
          <div className="ad-stat">
            <span className="ad-stat-label">最近 30 天活跃</span>
            <strong>{num(data?.rolling30ActiveUsers)}</strong>
            <small>
              {data?.rolling30Start} 至 {data?.date}
            </small>
          </div>
        </div>
      </Async>
      <Panel
        title="每日活跃走势"
        hint={
          average == null
            ? "截至所选统计日"
            : `截至所选统计日 · 区间日均 ${num(average)}，峰值 ${num(Math.max(...values))}`
        }
        actions={
          <Segmented
            label="走势区间"
            value={span}
            onChange={setSpan}
            options={[
              ["7", "7 天"],
              ["14", "14 天"],
              ["30", "30 天"],
              ["90", "90 天"],
            ]}
          />
        }
      >
        <Columns data={series.points} label={`截至 ${date} 的每日活跃用户`} />
      </Panel>
      <Notice>
        月活与最近 30
        天均按用户去重，不是日活之和。仅统计仍保留的注册用户活动，注销账号的明细会清除；管理端查询不计入活跃。
      </Notice>
    </>
  );
}
