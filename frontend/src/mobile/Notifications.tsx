import { BRAND_NAME } from "../app/brand";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Monitor,
  ShieldPlus,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useApp } from "../app/state";
import { useReturnTo } from "../app/navigation";
import { errorMessage } from "../api/client";
import { useTask } from "../components/useTask";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { UserAvatar } from "../components/UserAvatar";
import { AnnouncementsPanel } from "../features/v4/Remote";
import { followLabel } from "../features/profile-people";
import { historyTime } from "../desktop/history";
import { DesignIcon } from "./ui";
import {
  notificationColumns,
  notificationGroups,
  mobileNotificationTime,
  notificationView,
  type NotificationCard,
  type NotificationColumn,
} from "./notification-model";
import "./notifications.css";

function NotificationFollow({ id, name }: { id: number; name: string }) {
  const { api } = useApp();
  const profile = useQuery({
    queryKey: ["user", id],
    queryFn: () => api.otherUser(id),
  });
  const task = useTask(undefined, undefined, ["user", "social"]);
  const following = profile.data?.isFollowingHim === true;
  const known = typeof profile.data?.isFollowingHim === "boolean";
  const label = profile.isPending
    ? "加载中…"
    : !known
      ? "重试"
      : followLabel(profile.data!);
  return (
    <button
      type="button"
      className="mobile-inbox-follow"
      aria-label={
        known
          ? following
            ? `${label}，取消关注${name}`
            : `${label}${name}`
          : `重新加载${name}的关注状态`
      }
      aria-pressed={known ? following : undefined}
      aria-busy={task.isPending || profile.isFetching}
      disabled={task.isPending || profile.isFetching}
      onClick={() =>
        known
          ? task.run(() => api.follow(id, following))
          : void profile.refetch()
      }
    >
      {task.isPending ? "更新中…" : label}
    </button>
  );
}

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationCard;
  onRead: (item: NotificationCard) => void;
}) {
  const { user } = useApp();
  const view = notificationView(item);
  const actor = view.actor;
  const [expanded, setExpanded] = useState(false);
  const time = (
    <time dateTime={historyTime(item.latestAt)?.toISOString()}>
      {mobileNotificationTime(item.latestAt)}
    </time>
  );
  const title = (
    <span className="mobile-inbox-title">
      {actor && view.title.startsWith(view.who) ? (
        <>
          <strong>{view.who}</strong> {view.title.slice(view.who.length)}
        </>
      ) : (
        view.title
      )}
    </span>
  );
  const content = (
    <>
      <span className="mobile-inbox-heading">
        {title}
        {!actor && time}
      </span>
      {view.body && (
        <span className="mobile-inbox-description">{view.body}</span>
      )}
      {actor && time}
    </>
  );
  return (
    <li
      className="mobile-inbox-row"
      data-expanded={expanded || undefined}
      data-system={!actor || undefined}
    >
      {!!item.unreadMemberCount && (
        <span
          className="mobile-inbox-unread-dot"
          aria-label="未读"
          role="img"
        />
      )}
      {actor ? (
        <UserAvatar
          className="mobile-inbox-symbol"
          name={actor.name || "校园食友"}
          avatar={actor.avatar}
          profileId={actor.id}
          onClick={() => onRead(item)}
        />
      ) : (
        <span className="mobile-inbox-symbol" aria-hidden="true">
          {view.device ? (
            <ShieldPlus size={24} />
          ) : view.kind === "content_removed" ? (
            <Trash2 size={24} />
          ) : (
            <DesignIcon name={view.icon} size={24} />
          )}
        </span>
      )}
      <div className="mobile-inbox-content">
        {view.device ? (
          <>
            <div className="mobile-inbox-heading">
              {title}
              {time}
            </div>
            <Link
              className="mobile-inbox-device"
              to="/settings/devices"
              onClick={() => onRead(item)}
            >
              {view.device.desktop ? (
                <Monitor size={24} aria-hidden="true" />
              ) : (
                <Smartphone size={24} aria-hidden="true" />
              )}
              <span>
                <strong>{view.device.name}</strong>
                <span>不是本人登录时，可以让它下线</span>
              </span>
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <div className="mobile-inbox-interaction">
            {view.href ? (
              <Link
                className="mobile-inbox-action"
                to={view.href}
                onClick={() => onRead(item)}
              >
                {content}
              </Link>
            ) : (
              <button
                type="button"
                className="mobile-inbox-action"
                aria-expanded={expanded}
                onClick={() => {
                  onRead(item);
                  setExpanded(!expanded);
                }}
              >
                {content}
              </button>
            )}
            {view.kind === "follow" &&
              actor?.id &&
              actor.id !== user?.id &&
              (item.memberCount ?? 1) <= 1 && (
                <NotificationFollow
                  id={actor.id}
                  name={actor.name || "校园食友"}
                />
              )}
          </div>
        )}
      </div>
    </li>
  );
}

export default function MobileNotifications() {
  const { api, session, toast } = useApp();
  const cache = useQueryClient();
  const { pathname } = useLocation();
  const isAnnouncements = pathname === "/announcements";
  const back = useReturnTo(
    isAnnouncements ? "/notifications?column=SYSTEM" : "/me",
  );
  const [params, setParams] = useSearchParams();
  const column: NotificationColumn =
    notificationColumns.find(([key]) => key === params.get("column"))?.[0] ??
    "ALL";
  const requestedPage = Number(params.get("page") ?? 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const tabs = useRef<HTMLDivElement>(null);
  const reading = useRef(new Set<string>());
  const task = useTask("全部通知已标为已读", undefined, [
    "notification-cards",
    "notifications",
  ]);
  const messages = useQuery({
    queryKey: ["notification-cards", "mobile", column, page],
    queryFn: () => api.notificationCards({ column, page, pageSize: 20 }),
    enabled: !isAnnouncements && !!session,
  });
  const unread = useQuery({
    queryKey: ["notification-cards", "unread"],
    queryFn: () => api.unreadCards(),
    enabled: !isAnnouncements && !!session,
  });
  const unreadCount =
    typeof unread.data?.members === "number"
      ? Math.max(0, unread.data.members)
      : undefined;
  const hasUnread =
    unreadCount !== undefined
      ? unreadCount > 0
    : messages.data?.items?.some((item) => (item.unreadMemberCount ?? 0) > 0);
  const read = useMutation({
    mutationFn: (id: string) => api.readCard(id),
    onSuccess: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: ["notification-cards"] }),
        cache.invalidateQueries({ queryKey: ["notifications", "unread"] }),
      ]),
    onError: (error) => toast(errorMessage(error), { tone: "error" }),
    onSettled: (_data, _error, id) => {
      reading.current.delete(id);
    },
  });
  const markRead = (item: NotificationCard) => {
    if (!item.unreadMemberCount || !item.id || reading.current.has(item.id))
      return;
    reading.current.add(item.id);
    read.mutate(item.id);
  };
  useEffect(() => {
    document.title = `${isAnnouncements ? "站点公告" : "消息"} · ${BRAND_NAME}`;
  }, [isAnnouncements]);
  const select = (value: NotificationColumn) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === "ALL") next.delete("column");
        else next.set("column", value);
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  const setPage = (value: number) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === 1) next.delete("page");
        else next.set("page", String(value));
        return next;
      },
      { replace: true },
    );

  return (
    <section
      className="mobile-inbox"
      data-announcements={isAnnouncements || undefined}
    >
      <div className="mobile-inbox-top">
        <header className="mobile-inbox-header">
          <Link to={back} aria-label="返回">
            <ChevronLeft size={28} aria-hidden="true" />
          </Link>
          <h1>{isAnnouncements ? "站点公告" : "消息"}</h1>
          {!isAnnouncements && session && (
            <button
              type="button"
              disabled={task.isPending || !hasUnread}
              aria-busy={task.isPending}
              onClick={() =>
                task.run(async () => {
                  await api.readAll();
                  cache.setQueryData(["notification-cards", "unread"], {
                    ...unread.data,
                    members: 0,
                    cards: 0,
                  });
                  cache.setQueryData(["notifications", "unread"], 0);
                })
              }
            >
              {task.isPending ? "标记中…" : "全部已读"}
            </button>
          )}
        </header>
        {!isAnnouncements && (
          <div
            className="mobile-inbox-tabs"
            role="tablist"
            aria-label="消息类型"
            ref={tabs}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const count = notificationColumns.length;
              const index = notificationColumns.findIndex(
                ([key]) => key === column,
              );
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? count - 1
                    : (index + (event.key === "ArrowRight" ? 1 : count - 1)) %
                      count;
              select(notificationColumns[next][0]);
              tabs.current
                ?.querySelectorAll<HTMLButtonElement>("button")
                [next]?.focus();
            }}
          >
            {notificationColumns.map(([key, name]) => (
              <button
                type="button"
                key={key}
                role="tab"
                id={`inbox-tab-${key}`}
                aria-selected={column === key}
                aria-controls="inbox-messages"
                tabIndex={column === key ? 0 : -1}
                onClick={() => select(key)}
              >
                <span>{name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {isAnnouncements ? (
        <section className="mobile-inbox-announcements" aria-label="站点公告">
          <AnnouncementsPanel />
        </section>
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {unreadCount !== undefined ? `${unreadCount} 条未读` : ""}
          </p>
          <div
            className="mobile-inbox-messages"
            id="inbox-messages"
            role="tabpanel"
            aria-labelledby={`inbox-tab-${column}`}
            aria-busy={messages.isFetching}
          >
            {column === "SYSTEM" && (
              <Link
                to="/announcements"
                className="mobile-inbox-announcement-link"
              >
                <DesignIcon name="bell" size={20} />
                <span>站点公告</span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            )}
            {messages.isError && messages.data && (
              <div className="mobile-inbox-refresh-error" role="alert">
                刷新失败，正在显示上次的消息。
                <button onClick={() => void messages.refetch()}>重试</button>
              </div>
            )}
            {messages.isPending ? (
              <ContentSkeleton kind="rows" count={3} />
            ) : messages.isError && !messages.data ? (
              <div className="mobile-inbox-state" role="alert">
                <p>消息暂时无法加载</p>
                <button onClick={() => void messages.refetch()}>
                  重新加载
                </button>
              </div>
            ) : messages.data?.items?.length ? (
              notificationGroups(messages.data.items).map((group) => (
                <section key={group.key} aria-label={group.label}>
                  <h2>{group.label}</h2>
                  <ul>
                    {group.items.map((item) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        onRead={markRead}
                      />
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <p className="mobile-inbox-state" role="status">
                {column === "ALL" ? "暂时没有新消息" : "这个分类还没有消息"}
              </p>
            )}
            {messages.data && (page > 1 || messages.data.hasNext) && (
              <nav className="mobile-inbox-pages" aria-label="消息分页">
                <button
                  disabled={page === 1 || messages.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </button>
                <span>{page}</span>
                <button
                  disabled={!messages.data.hasNext || messages.isFetching}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </button>
              </nav>
            )}
          </div>
        </>
      )}
    </section>
  );
}
