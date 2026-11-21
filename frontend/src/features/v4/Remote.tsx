import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { useArea } from "../../app/area";
import { buildNumber } from "../../app/version";
import { Card, Shell, QueryView, safeLink } from "./shared";
import type { Schema } from "../../api/models";
import { DesignIcon as Icon } from "../../mobile/ui";
import "../profile-activity.css";
export function recommendationBatchSize(
  config?: Schema["ClientConfigResponse"],
) {
  const value = (config?.params as Record<string, unknown> | undefined)
    ?.batchSize;
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 50
    ? value
    : 8;
}
export function useRemoteConfig() {
  const { api } = useApp(),
    { campusId } = useArea();
  return useQuery({
    queryKey: ["remote-config", campusId, buildNumber],
    queryFn: () =>
      api.remoteConfig({ platform: "web", build: buildNumber, campusId }),
    staleTime: 300_000,
    refetchInterval: 300_000,
    retry: false,
  });
}
export function RemoteBanner() {
  const q = useRemoteConfig(),
    [closed, setClosed] = useState<number[]>([]);
  const c = q.data,
    notice = c?.announcements?.find(
      (a) => a.level === "IMPORTANT" && !closed.includes(a.id!),
    );
  if (!c) return null;
  const update = c.update,
    href = safeLink(update?.storeUrl);
  return (
    <aside className="v4-global-notices" aria-label="站点通知">
      {c.maintenance?.mode && c.maintenance.mode !== "NONE" && (
        <div role="status">
          {c.maintenance?.message ||
            (c.maintenance?.mode === "READ_ONLY"
              ? "站点正在维护，部分操作暂停。"
              : "站点维护中，请稍后再试。")}
        </div>
      )}
      {update && update.decision !== "NONE" && (
        <div role="status">
          {update.decision === "FORCE"
            ? "当前版本需要更新后使用。"
            : "有新版本可用。"}{" "}
          {href && (
            <a href={href} rel="noopener noreferrer">
              查看更新
            </a>
          )}
        </div>
      )}
      {notice && (
        <div>
          <Link to="/announcements">{notice.title || notice.content} →</Link>
          <button
            aria-label="关闭这条公告"
            onClick={() => setClosed([...closed, notice.id!])}
          >
            ×
          </button>
        </div>
      )}
    </aside>
  );
}
/**
 * 「消息通知」的站点公告视图。页头与分类导航由 Messages 持有，
 * 两个视图切换时只替换这里的内容。
 */
export function AnnouncementsPanel() {
  const q = useRemoteConfig();
  return (
    <>
      <div className="profile-activity-toolbar profile-announcement-intro">
        <div>
          <h2>站点公告</h2>
          <p>查看服务安排与近期的重要提醒。</p>
        </div>
        <span className="profile-announcement-label">
          <Icon name="announce" size={17} />
          来自站点
        </span>
      </div>
      <QueryView
        query={q}
        empty={q.data?.announcements?.length === 0}
        emptyTitle="暂时没有新的公告"
        emptyDetail="站点服务安排与重要通知，会在这里告诉你。"
      >
        <div className="profile-announcement-list">
          {q.data?.announcements?.map((a) => (
            <article
              className="profile-announcement"
              data-important={a.level === "IMPORTANT" || undefined}
              key={a.id}
            >
              <div className="v4-announcement-heading">
                <span
                  className={`v4-icon-tile ${a.level === "IMPORTANT" ? "is-gold" : "is-blue"}`}
                >
                  <Icon name="announce" size={25} />
                </span>
                <div>
                  <span className="v4-kicker">
                    {a.level === "IMPORTANT" ? "重要通知" : "站点消息"}
                  </span>
                  <h2>
                    {a.title || (a.level === "IMPORTANT" ? "重要公告" : "公告")}
                  </h2>
                </div>
              </div>
              <p className="v4-announcement-body">{a.content}</p>
              {safeLink(a.linkUrl) && (
                <a
                  className="v4-announcement-link"
                  href={safeLink(a.linkUrl)}
                  rel="noopener noreferrer"
                >
                  查看详情 <Icon name="external" size={15} />
                </a>
              )}
            </article>
          ))}
        </div>
      </QueryView>
    </>
  );
}
export function FeatureAvailability({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  const q = useRemoteConfig(),
    flag = q.data?.flags?.[name];
  if (
    q.data?.update?.decision === "FORCE" &&
    ["publish", "newShop", "comment"].includes(name)
  )
    return (
      <Shell title="请先更新版本">
        <Card>
          当前版本需要更新后继续操作。
          {safeLink(q.data.update.storeUrl) && (
            <a href={safeLink(q.data.update.storeUrl)}>查看更新 →</a>
          )}
        </Card>
      </Shell>
    );
  if (
    q.data?.maintenance?.mode === "DOWN" ||
    (q.data?.maintenance?.mode === "READ_ONLY" &&
      ["publish", "newShop", "comment"].includes(name))
  )
    return (
      <Shell title="功能暂时暂停">
        <Card>
          {q.data?.maintenance?.message || "站点正在维护，请稍后再试。"}
        </Card>
      </Shell>
    );
  if (flag?.on === false)
    return (
      <Shell title="功能暂时暂停">
        <Card>{flag.reason || "这项功能暂未开放，请稍后再试。"}</Card>
      </Shell>
    );
  return children;
}
