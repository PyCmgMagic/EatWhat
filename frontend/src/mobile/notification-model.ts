import type { Schema } from "../api/models";
import { historyTime } from "../desktop/history";

export type NotificationCard = Schema["CardResponse"];
export const notificationColumns = [
  ["ALL", "全部"],
  ["COMMENTS", "评论"],
  ["LIKES_AND_FAVORITES", "赞和收藏"],
  ["FOLLOWS", "关注"],
  ["SYSTEM", "系统"],
] as const;
export type NotificationColumn = (typeof notificationColumns)[number][0];

type Detail = {
  type?: string;
  title?: string;
  content?: string;
  text?: string;
  commentText?: string;
  deviceName?: string;
  device?: string;
  reason?: string;
  foodName?: string;
  foodId?: number;
  topicName?: string;
  caseId?: number;
  revisionId?: string;
  reply?: string;
  verdict?: string;
};
export function notificationView(item: NotificationCard) {
  const detail = (item.data?.detail ?? {}) as Detail;
  const kind = detail.type || item.kind || "system";
  const actors = item.actors?.map((actor) => actor.name || "校园食友") ?? [];
  const names = actors.join("、") || "校园食友";
  const who =
    (item.memberCount ?? 0) > actors.length && actors.length
      ? `${names}等 ${item.memberCount} 人`
      : names;
  let title = "系统通知",
    body = detail.content || detail.text || "",
    icon = "bell";
  let href: string | undefined;
  const target = item.target;
  const paths: Record<string, string> = {
    food: "foods",
    foods: "foods",
    restaurant: "restaurants",
    restaurants: "restaurants",
    topics: "topics",
    users: "users",
  };
  if (!target?.unavailable && target?.id && paths[target.domain ?? ""])
    href = `/${paths[target.domain ?? ""]}/${target.id}`;
  if (
    !target?.unavailable &&
    ["comment", "reply"].includes(item.kind ?? "") &&
    detail.foodId
  )
    href = `/foods/${detail.foodId}?section=comments`;
  switch (kind) {
    case "like":
      title = `${who}赞了你的分享`;
      body = detail.foodName || body;
      icon = "heart";
      break;
    case "favorite":
      title = `${who}收藏了你的分享`;
      body = detail.foodName || body;
      icon = "bookmark";
      break;
    case "follow":
      title = `${who}关注了你`;
      icon = "follow";
      if (item.actors?.[0]?.id) href = `/users/${item.actors[0].id}`;
      break;
    case "comment":
    case "reply":
      title = `${who}${kind === "reply" ? "回复了你的评论" : "评论了你的分享"}`;
      body = detail.commentText || body;
      icon = "comment";
      break;
    case "tag":
      title = `${who}为你的分享添加了标签`;
      icon = "tag";
      break;
    case "new_device_login":
      title = "你的账号已在新设备上登录";
      body = `${detail.deviceName || (detail.device === "WEB" ? "网页浏览器" : detail.device) || "新设备"}，不是你本人登录时，可以在登录设备中下线并修改密码。`;
      icon = "shield";
      href = "/settings/devices";
      break;
    case "content_removed":
      title = "你发布的内容已被删除";
      body = [detail.title, detail.reason].filter(Boolean).join("：");
      icon = "shield";
      href = undefined;
      break;
    case "account_banned":
      title = "你的账号已被限制使用";
      body = detail.reason || body;
      icon = "shield";
      href = undefined;
      break;
    case "announcement":
      title = detail.title || "系统公告";
      break;
    case "case_result":
      title = "你的反馈有了新回复";
      body = detail.reply || body;
      icon = "feedback";
      if (detail.caseId) href = `/feedback/mine/${detail.caseId}`;
      break;
    case "moderation_result":
      title = "你的分享有了审核结果";
      body =
        detail.verdict === "APPROVE" ? "审核已通过" : detail.reason || body;
      icon = "shield";
      if (detail.revisionId)
        href = `/submissions/${encodeURIComponent(detail.revisionId)}`;
      break;
    case "topic_included":
      title = "你的分享被收进了专题";
      body = [detail.foodName, detail.topicName].filter(Boolean).join(" · ");
      icon = "topic";
      break;
    default:
      title =
        detail.title || (actors.length ? `${who}与你有了新互动` : "系统通知");
  }
  return { title, body, icon, href };
}

const beijingDay = (time: number) =>
  new Date(time + 8 * 3_600_000).toISOString().slice(0, 10);
export function notificationGroups(
  items: NotificationCard[],
  now = Date.now(),
) {
  const groups = new Map<
    string,
    { key: string; label: string; items: NotificationCard[] }
  >();
  for (const item of [...items].sort(
    (a, b) => (b.latestAt ?? 0) - (a.latestAt ?? 0),
  )) {
    const time = historyTime(item.latestAt, now);
    const day =
      item.day && /^\d{4}-\d{2}-\d{2}$/.test(item.day)
        ? item.day
        : time
          ? beijingDay(time.getTime())
          : "unknown";
    const label =
      day === beijingDay(now)
        ? "今天"
        : day === beijingDay(now - 86_400_000)
          ? "昨天"
          : day === "unknown"
            ? "更早"
            : `${Number(day.slice(5, 7))}月${Number(day.slice(8, 10))}日`;
    if (!groups.has(day)) groups.set(day, { key: day, label, items: [] });
    groups.get(day)!.items.push(item);
  }
  return [...groups.values()];
}
export function notificationTime(
  value: number | null | undefined,
  now = Date.now(),
) {
  const date = historyTime(value, now);
  if (!date) return "";
  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000));
  if (!minutes) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
