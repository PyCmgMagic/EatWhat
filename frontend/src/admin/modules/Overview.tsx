import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useApp } from "../../app/state";
import { businessDate } from "../../api/growth";
import { money } from "../../api/models";
import { statusText } from "../../features/v4/shared";
import {
  Async,
  Columns,
  Icon,
  Panel,
  Pill,
  Segmented,
  Thumb,
  ago,
  num,
} from "../kit";

/** Beijing business dates ending at `end`, oldest first. */
export function recentDates(days: number, end = businessDate()) {
  const base = Date.parse(end + "T00:00:00Z");
  return Array.from({ length: days }, (_, i) =>
    new Date(base - (days - 1 - i) * 86400000).toISOString().slice(0, 10),
  );
}
/** Daily active users for the `days` days ending at `end`. */
export function useActiveSeries(days: number, end?: string) {
  const { api } = useApp(),
    dates = recentDates(days, end),
    from = dates[0],
    to = dates[dates.length - 1];
  const q = useQuery({
    queryKey: ["admin", "engagement", "range", from, to],
    queryFn: () => api.engagementRange(from, to),
    staleTime: 300000,
    retry: false,
  });
  const byDate = new Map(q.data?.days.map((d) => [d.date, d.activeUsers]));
  return {
    loading: q.isPending,
    failed: q.isError,
    points: dates.map((date) => ({
      label: date.slice(5).replace("-", "/"),
      value: byDate.get(date),
    })),
  };
}
export const percent = (rate?: number | null) =>
  rate == null
    ? "—"
    : `${(rate <= 1 ? rate * 100 : rate).toFixed(1).replace(/\.0$/, "")}%`;

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 5
    ? "夜深了"
    : hour < 11
      ? "早上好"
      : hour < 14
        ? "中午好"
        : hour < 18
          ? "下午好"
          : "晚上好";
};
const maintenance = {
  NONE: ["good", "运行正常"],
  READ_ONLY: ["warn", "只读维护中"],
  DOWN: ["bad", "已暂停服务"],
} as const;

export default function Overview() {
  const { api, user } = useApp();
  const summary = useQuery({
      queryKey: ["admin", "summary"],
      queryFn: () => api.summary(),
    }),
    counts = useQuery({
      queryKey: ["admin", "feedback", "counts"],
      queryFn: () => api.feedbackCounts(),
      staleTime: 60000,
      retry: false,
    }),
    today = useQuery({
      queryKey: ["admin", "engagement", businessDate()],
      queryFn: () => api.engagementStats(businessDate()),
      staleTime: 300000,
      retry: false,
    }),
    users = useQuery({
      queryKey: ["admin", "summary-trend", 14],
      queryFn: () => api.summaryTrend(14),
      staleTime: 300000,
      retry: false,
    }),
    content = useQuery({
      queryKey: ["admin", "content-stats", 14],
      queryFn: () => api.contentStats(14),
      staleTime: 300000,
      retry: false,
    }),
    [series, setSeries] = useState<"users" | "foods" | "restaurants">("users"),
    cases = useQuery({
      queryKey: ["admin", "feedback", 1, "OPEN", "ALL"],
      queryFn: () =>
        api.adminFeedbackCases({ page: 1, pageSize: 12, status: "OPEN" }),
      retry: false,
    }),
    foods = useQuery({
      queryKey: ["foods", "admin", "latest"],
      queryFn: () => api.adminFoods(undefined, 1, { sort: "NEWEST" }),
    }),
    config = useQuery({
      queryKey: ["admin", "remote-config"],
      queryFn: () => api.adminRemoteConfig(),
      retry: false,
    }),
    ai = useQuery({
      queryKey: ["admin", "ai-settings"],
      queryFn: () => api.adminAiSettings(),
      retry: false,
    }),
    active = useActiveSeries(7);
  const s = summary.data,
    mode = config.data?.settings?.maintenance?.mode ?? "NONE",
    flags = Object.entries(config.data?.settings?.flags ?? {}).filter(
      ([, flag]) => flag?.on === false,
    ),
    openCount =
      counts.data?.total ?? cases.data?.totalItems ?? cases.data?.items?.length,
    growth = (series === "users" ? users.data?.days : content.data?.days)?.map(
      (d) => ({
        label: d.date.slice(5).replace("-", "/"),
        value:
          series === "users"
            ? (d as { newUsers: number }).newUsers
            : (d as { foods: number; restaurants: number })[series],
      }),
    );
  const stats = [
    {
      label: "注册用户",
      icon: "me",
      total: s?.totalUsers,
      today: s?.todayUsers,
      to: "/admin/users",
    },
    {
      label: "菜品",
      icon: "bowl",
      total: s?.totalFoods,
      today: s?.todayFoods,
      to: "/admin/foods",
    },
    {
      label: "餐厅与窗口",
      icon: "store",
      total: s?.totalRestaurants,
      today: s?.todayRestaurants,
      to: "/admin/restaurants",
    },
  ];
  return (
    <div className="ew-admin-overview">
      <header className="ew-admin-hello">
        <div>
          <h2>
            {greeting()}，{user?.displayName || "管理员"}
          </h2>
          <p>
            {new Date().toLocaleDateString("zh-CN", {
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
            {openCount ? ` · 有 ${openCount} 条反馈等待处理` : ""}
          </p>
        </div>
        {config.data && (
          <Pill tone={maintenance[mode][0]}>{maintenance[mode][1]}</Pill>
        )}
      </header>

      <Async query={summary} rows={2}>
        <div className="ew-admin-stats">
          {stats.map((item) => (
            <Link key={item.label} to={item.to} className="ew-admin-stat">
              <span className="ew-admin-stat-icon">
                <Icon name={item.icon} size={20} />
              </span>
              <span className="ew-admin-stat-label">{item.label}</span>
              <strong>{num(item.total)}</strong>
              <small data-up={!!item.today || undefined}>
                今日 +{num(item.today)}
              </small>
            </Link>
          ))}
          <div className="ew-admin-stat">
            <span className="ew-admin-stat-icon">
              <Icon name="verify" size={20} />
            </span>
            <span className="ew-admin-stat-label">学生认证率</span>
            <strong>{percent(s?.verifiedRate)}</strong>
            <span className="ew-admin-meter" aria-hidden="true">
              <i
                style={{
                  width: `${Math.min(100, (s?.verifiedRate ?? 0) * ((s?.verifiedRate ?? 0) <= 1 ? 100 : 1))}%`,
                }}
              />
            </span>
          </div>
        </div>
      </Async>

      <div className="ew-admin-grid">
        <Panel
          title="近 7 日活跃"
          hint="每日使用过的去重用户，北京时间"
          actions={
            <Link className="ew-admin-link" to="/admin/engagement">
              活跃统计
              <Icon name="chevronRight" size={14} />
            </Link>
          }
        >
          {active.failed ? (
            <div className="ew-admin-state">
              <Icon name="wifiOff" size={28} />
              <strong>活跃数据暂时无法读取</strong>
            </div>
          ) : (
            <>
              <div className="ew-admin-kpis">
                <div>
                  <span>今日活跃</span>
                  <strong>{num(today.data?.dailyActiveUsers)}</strong>
                </div>
                <div>
                  <span>近 30 天</span>
                  <strong>{num(today.data?.rolling30ActiveUsers)}</strong>
                </div>
                <div>
                  <span>{today.data?.month ?? "本月"} 月活</span>
                  <strong>{num(today.data?.monthlyActiveUsers)}</strong>
                </div>
              </div>
              <Columns data={active.points} label="近 7 日每日活跃用户" />
            </>
          )}
        </Panel>

        <Panel
          title="近 14 日新增"
          hint="按北京时间自然日统计"
          actions={
            <Segmented
              label="新增类型"
              value={series}
              onChange={setSeries}
              options={[
                ["users", "用户"],
                ["foods", "菜品"],
                ["restaurants", "餐厅"],
              ]}
            />
          }
        >
          <Async query={series === "users" ? users : content} rows={3}>
            <Columns
              data={growth ?? []}
              label={`近 14 日每日新增${series === "users" ? "用户" : series === "foods" ? "菜品" : "餐厅"}`}
            />
          </Async>
        </Panel>

        <Panel
          title={
            <>
              待处理反馈
              {!!openCount && <em className="ew-admin-count">{openCount}</em>}
            </>
          }
          flush
          actions={
            <Link className="ew-admin-link" to="/admin/feedback">
              全部
              <Icon name="chevronRight" size={14} />
            </Link>
          }
        >
          <Async
            query={cases}
            empty={!cases.data?.items?.length}
            emptyTitle="没有待处理的反馈"
            emptyHint="新的反馈、纠错和举报会出现在这里。"
          >
            <ul className="ew-admin-list">
              {cases.data?.items?.slice(0, 5).map((item) => (
                <li key={item.view?.id}>
                  <Link
                    to={item.view?.id ? `/admin/feedback?case=${item.view.id}` : "/admin/feedback"}
                  >
                    <Pill
                      tone={item.view?.kind === "REPORT" ? "bad" : "info"}
                      dot={false}
                    >
                      {statusText(item.view?.kind)}
                    </Pill>
                    <span className="ew-admin-list-main">
                      {item.targetName || item.view?.text || "查看详情"}
                    </span>
                    <time>{ago(item.view?.createdAt)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          </Async>
        </Panel>

        <Panel
          title="最新菜品"
          flush
          actions={
            <Link className="ew-admin-link" to="/admin/foods">
              菜品管理
              <Icon name="chevronRight" size={14} />
            </Link>
          }
        >
          <Async
            query={foods}
            empty={!foods.data?.items?.length}
            emptyTitle="还没有菜品"
          >
            <ul className="ew-admin-list">
              {foods.data?.items?.slice(0, 5).map((food) => (
                <li key={food.id}>
                  <Link to={`/foods/${food.id}`}>
                    <Thumb src={food.pictureUrl?.[0]} />
                    <span className="ew-admin-list-main">
                      {food.name}
                      <small>{food.restaurantName || "未关联餐厅"}</small>
                    </span>
                    <span className="ew-admin-list-side">
                      {money(food.price)}
                      <small>{ago(food.createdAt)}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Async>
        </Panel>

        <Panel title="系统状态" flush>
          <ul className="ew-admin-list is-status">
            <li>
              <Link to="/admin/config">
                <Icon name="settings" size={18} />
                <span className="ew-admin-list-main">
                  站点运行
                  <small>
                    {config.data
                      ? `配置版本 ${config.data.configVersion} · ${config.data.siteMode}`
                      : "远程配置未读取"}
                  </small>
                </span>
                {config.data && (
                  <Pill tone={maintenance[mode][0]}>
                    {maintenance[mode][1]}
                  </Pill>
                )}
              </Link>
            </li>
            <li>
              <Link to="/admin/config">
                <Icon name="filter" size={18} />
                <span className="ew-admin-list-main">
                  功能开关
                  <small>
                    {flags.length
                      ? `已关闭：${flags.map(([key]) => key).join("、")}`
                      : "全部功能已开启"}
                  </small>
                </span>
                {config.data && (
                  <Pill tone={flags.length ? "warn" : "good"}>
                    {flags.length ? `${flags.length} 项关闭` : "正常"}
                  </Pill>
                )}
              </Link>
            </li>
            <li>
              <Link to="/admin/ai">
                <Icon name="computer" size={18} />
                <span className="ew-admin-list-main">
                  AI 建议
                  <small>{ai.data?.model || "未配置模型"}</small>
                </span>
                {ai.data && (
                  <Pill
                    tone={
                      !ai.data.configured
                        ? "neutral"
                        : ai.data.enabled
                          ? "good"
                          : "warn"
                    }
                  >
                    {!ai.data.configured
                      ? "未配置"
                      : ai.data.enabled
                        ? "已启用"
                        : "已停用"}
                  </Pill>
                )}
              </Link>
            </li>
            <li>
              <Link to="/admin/versions">
                <Icon name="download" size={18} />
                <span className="ew-admin-list-main">
                  客户端版本
                  <small>
                    {config.data?.versions?.length
                      ? config.data.versions
                          .map(
                            (line) =>
                              `${line.platform} ${line.latestVersionName || line.latestBuild}`,
                          )
                          .join(" · ")
                      : "暂无版本线"}
                  </small>
                </span>
                <Icon name="chevronRight" size={15} />
              </Link>
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
