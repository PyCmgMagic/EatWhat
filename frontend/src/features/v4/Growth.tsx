import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import {
  ProfileWorkspaceContext,
  profileLeaderboardPath,
} from "../../app/profile-workspace";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../../api/client";
import { useApp } from "../../app/state";
import { DesignIcon as Icon } from "../../mobile/ui";
import { DishIllustration } from "../../components/DishIllustration";
import {
  businessDate,
  experienceRules,
  growthPercent,
  ledgerSourceName,
  userTitle,
  validBusinessDate,
} from "../../api/growth";
import { UserTitle } from "../../components/UserTitle";
import { Card, Shell, QueryView, Pager, Field, timeText } from "./shared";
import "./growth.css";
import { useFeedbackState } from "../../components/feedback";

export default function Growth() {
  const { api, user } = useApp();
  // 个人空间里版面足够，规则和记录直接摊开，不用再点一次。
  const embedded = useContext(ProfileWorkspaceContext);
  const [page, setPage] = useState(1);
  const progress = useQuery({
    queryKey: ["growth", user?.id, "progress"],
    queryFn: () => api.growth(),
    enabled: !!user?.id,
  });
  const titles = useQuery({
    queryKey: ["growth", user?.id, "titles"],
    queryFn: () => api.myTitles(),
    enabled: !!user?.id,
  });
  const cache = useQueryClient();
  const equip = useMutation({
    mutationFn: api.setEquippedTitle,
    onSuccess: () =>
      Promise.all(
        [["growth", user?.id], ["me"], ["user"], ["comments"]].map((queryKey) =>
          cache.invalidateQueries({ queryKey }),
        ),
      ),
  });
  const ledger = useQuery({
    queryKey: ["growth", user?.id, "ledger", page],
    queryFn: () => api.growthLedger(page),
    enabled: !!user?.id,
  });
  const ownedTitles = titles.data?.filter((item) => item.acquiredAt != null) ?? [];
  const g = progress.data,
    percent = growthPercent(g),
    title = userTitle(g),
    rules = experienceRules(g);
  const rankingEntry = (
    <Link
      className="growth-leaderboard-entry"
      to={profileLeaderboardPath}
      state={embedded ? { alignTabs: "always" } : undefined}
      aria-label="等级排行榜"
    >
      <span className="growth-leaderboard-icon" aria-hidden="true">
        <Icon name="bowl" size={13} />
        <span><i /><i /><i /></span>
      </span>
      等级排行
      <Icon name="chevronRight" size={13} />
    </Link>
  );
  const progressNote = (
    <small>
      {g?.maxLevel
        ? "经验会继续累积"
        : `本级已积累 ${g?.experienceInLevel ?? "—"} 经验`}
    </small>
  );
  // 经验记录默认收进一个入口，摘要行露出标题和条数，展开后才看到明细。
  const ledgerItems = ledger.data?.items ?? [],
    ledgerCount = ledger.data?.totalItems ?? ledgerItems.length,
    ledgerMeta = ledger.isError
      ? "未能加载"
      : ledger.data
        ? ledgerCount
          ? `共 ${ledgerCount} 条`
          : "暂无记录"
        : "加载中";
  return (
    <Shell
      title="我的成长"
      detail="逛一逛、吃一顿、分享一道菜，都会攒下经验。"
      advice={false}
    >
      <Card>
        <QueryView query={progress}>
          <section className="growth-summary" aria-label="等级与经验">
            <DishIllustration name="danchaofan" className="growth-dish" />
            <div className="growth-level">
              <span>校园食友</span>
              <h2>
                Lv.{g?.level ?? "—"}
                <UserTitle title={title} />
              </h2>
              <p>累计 {g?.totalExperience ?? "—"} 经验</p>
              {embedded && rankingEntry}
            </div>
            <div className="growth-progress">
              <strong>
                {g?.maxLevel
                  ? "已达到当前最高等级"
                  : g?.experienceToNextLevel != null
                    ? `再积累 ${g.experienceToNextLevel} 经验升至下一级`
                    : "等级进度暂未提供"}
              </strong>
              <div
                className="growth-track"
                role="progressbar"
                aria-label="当前等级进度"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  percent == null ? undefined : Math.round(percent)
                }
              >
                <span style={{ width: `${percent ?? 0}%` }} />
              </div>
              {embedded ? progressNote : (
                <div className="growth-progress-meta">
                  {progressNote}
                  {rankingEntry}
                </div>
              )}
            </div>
          </section>
          {rules.length ? (
            <details className="growth-disclosure growth-rules" open={embedded}>
              <summary className="growth-disclosure-summary">
                <span className="growth-disclosure-title">怎么获得经验</span>
                <span className="growth-disclosure-meta">
                  {rules.length} 种途径
                </span>
                <span className="growth-disclosure-chevron" aria-hidden="true">
                  <Icon name="chevronDown" size={16} />
                </span>
              </summary>
              <ul>
                {rules.map((r) => (
                  <li key={r.source}>
                    <span>{r.name}</span>
                    <b>+{r.amount}</b>
                    <small>
                      {r.source === "verified"
                        ? "仅一次"
                        : `每天最多 ${r.dailyCap} 次`}
                    </small>
                  </li>
                ))}
              </ul>
              <p className="growth-rule">
                无需签到或领取，升级不扣经验；发布的内容因违规被删除时，会扣回它获得的经验。
              </p>
            </details>
          ) : (
            <p className="growth-rule">
              {g?.dailyExperience != null
                ? `每天首次使用，自动获得 ${g.dailyExperience} 经验。`
                : "每天首次使用会自动积累经验。"}
              无需签到或领取，升级也不会扣除经验。
            </p>
          )}
        </QueryView>
      </Card>
      {(ownedTitles.length > 0 || titles.isError) && (
        <Card title="我的称号">
          <QueryView query={titles}>
            <ul className="growth-ledger">
              {ownedTitles.map((item) => (
                <li key={item.code}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{timeText(item.acquiredAt)} 获得</small>
                  </div>
                  <button
                    type="button"
                    disabled={equip.isPending || user?.banned === true}
                    aria-label={`${item.equipped ? "取消佩戴" : "佩戴"}${item.name}`}
                    onClick={() =>
                      equip.mutate(item.equipped ? null : item.code)
                    }
                  >
                    {item.equipped ? "取消佩戴" : "佩戴"}
                  </button>
                </li>
              ))}
            </ul>
            {equip.isError && <p role="alert">{errorMessage(equip.error)}</p>}
          </QueryView>
        </Card>
      )}
      <section className="v4-card growth-records">
        <details className="growth-disclosure" open={embedded}>
          <summary className="growth-disclosure-summary">
            <h2>经验记录</h2>
            <span className="growth-disclosure-meta">{ledgerMeta}</span>
            <span className="growth-disclosure-chevron" aria-hidden="true">
              <Icon name="chevronDown" size={18} />
            </span>
          </summary>
          <QueryView
            query={ledger}
            empty={!ledgerItems.length}
            emptyTitle="还没有经验记录"
            emptyIllustration="baozi"
            emptyDetail="逛逛菜品和附近的店，新入账的经验会显示在这里。"
          >
            <ul className="growth-ledger">
              {ledgerItems.map((entry, i) => (
                <li key={entry.entryId ?? i}>
                  <span className="growth-ledger-icon" aria-hidden="true">
                    <Icon name="bowl" size={22} />
                  </span>
                  <div>
                    <strong>{ledgerSourceName(entry.sourceType)}</strong>
                    <span>所属日期 {entry.businessDate ?? "待确认"}</span>
                    <small>入账于 {timeText(entry.createdAt)}</small>
                  </div>
                  <b>
                    {entry.experience == null
                      ? "—"
                      : `${entry.experience >= 0 ? "+" : ""}${entry.experience}`}
                    <small>经验</small>
                  </b>
                </li>
              ))}
            </ul>
          </QueryView>
          <div className="growth-pagination">
            <Pager
              page={page}
              hasNext={
                !!ledger.data?.hasNext && !ledger.isFetching && page < 10000
              }
              onChange={setPage}
            />
          </div>
        </details>
      </section>
    </Shell>
  );
}

export function EngagementStats() {
  const { api } = useApp();
  const [input, setInput] = useState(""),
    [date, setDate] = useState<string>(),
    [error, setError] = useFeedbackState();
  const q = useQuery({
    queryKey: ["admin", "engagement", date],
    queryFn: () => api.engagementStats(date),
  });
  const data = q.data;
  return (
    <Card title="用户活跃统计">
      <form
        className="growth-stats-filter"
        onSubmit={(e) => {
          e.preventDefault();
          if (input && !validBusinessDate(input)) {
            setError("请选择今天或之前的有效日期。");
            return;
          }
          setError("");
          if ((input || undefined) === date) void q.refetch();
          else setDate(input || undefined);
        }}
      >
        <Field label="统计日期" hint="留空查询服务端当天，按北京时间统计。">
          <input
            type="date"
            value={input}
            max={businessDate()}
            onChange={(e) => setInput(e.target.value)}
          />
        </Field>
        <button type="submit" disabled={q.isFetching}>
          查询统计
        </button>
      </form>
      <QueryView query={q}>
        <p className="growth-stats-date">
          统计日：{data?.date ?? "—"} · 北京时间
        </p>
        <dl className="growth-stats">
          <div>
            <dt>当日活跃</dt>
            <dd>{data?.dailyActiveUsers ?? "—"}</dd>
            <small>{data?.date ?? "—"} 使用过的用户</small>
          </div>
          <div>
            <dt>自然月活跃</dt>
            <dd>{data?.monthlyActiveUsers ?? "—"}</dd>
            <small>{data?.month ?? "—"} 完整自然月去重人数</small>
          </div>
          <div>
            <dt>最近 30 天活跃</dt>
            <dd>{data?.rolling30ActiveUsers ?? "—"}</dd>
            <small>
              {data?.rolling30Start ?? "—"} 至 {data?.date ?? "—"}
            </small>
          </div>
        </dl>
        <p className="growth-rule">
          月活与最近 30
          天均按用户去重，不是日活之和。仅统计仍保留的注册用户活动，注销账号的关联明细会清除；管理端查询不计入活跃。
        </p>
      </QueryView>
    </Card>
  );
}
