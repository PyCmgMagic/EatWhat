import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../app/state";
import { useReturnTo } from "../app/navigation";
import { useTask } from "../components/useTask";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { UserAvatar } from "../components/UserAvatar";
import { AnnouncementsPanel } from "../features/v4/Remote";
import { historyTime } from "../desktop/history";
import { DesignIcon } from "./ui";
import {
  notificationColumns,
  notificationCommentActor,
  notificationGroups,
  notificationTime,
  notificationView,
  type NotificationCard,
  type NotificationColumn,
} from "./notification-model";
import "./notifications.css";

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationCard;
  onRead: (item: NotificationCard) => void;
}) {
  const view = notificationView(item);
  const actor = notificationCommentActor(item);
  const [expanded, setExpanded] = useState(false);
  const content = (
    <>
      {!actor && (
        <span className="mobile-inbox-symbol" aria-hidden="true">
          <DesignIcon name={view.icon} size={23} />
        </span>
      )}
      <span className="mobile-inbox-copy">
        <span className="mobile-inbox-title">{view.title}</span>
        {view.body && (
          <span className="mobile-inbox-description">{view.body}</span>
        )}
        <time dateTime={historyTime(item.latestAt)?.toISOString()}>
          {notificationTime(item.latestAt)}
        </time>
      </span>
    </>
  );
  return (
    <li className="mobile-inbox-row" data-expanded={expanded || undefined}>
      {!!item.unreadMemberCount && (
        <span className="mobile-inbox-unread-dot" aria-label="未读" role="img" />
      )}
      {actor && (
        <UserAvatar
          className="mobile-inbox-symbol"
          name={actor.name || "校园食友"}
          avatar={actor.avatar}
          profileId={actor.id}
          onClick={() => onRead(item)}
        />
      )}
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
    </li>
  );
}

export default function MobileNotifications() {
  const { api, session } = useApp(),
    cache = useQueryClient(),
    { pathname } = useLocation(),
    isAnnouncements = pathname === "/announcements",
    back = useReturnTo("/");
  const [column, setColumn] = useState<NotificationColumn>("ALL"),
    [page, setPage] = useState(1);
  const tabs = useRef<HTMLDivElement>(null);
  const task = useTask(undefined, undefined, [
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
  useEffect(() => {
    document.title = `${isAnnouncements ? "站点公告" : "消息"} · 山软今天吃什么`;
  }, [isAnnouncements]);
  const markRead = (item: NotificationCard) => {
    if (item.unreadMemberCount && item.id)
      task.run(() => api.readCard(item.id!));
  };
  const select = (value: NotificationColumn) => {
    setColumn(value);
    setPage(1);
  };
  return (
    <main className="mobile-inbox">
      <header className="mobile-inbox-header">
        <Link to={back} aria-label="返回">
          <DesignIcon name="back" size={24} />
        </Link>
        <h1>消息</h1>
        {!isAnnouncements && session && (
          <button
            disabled={task.isPending || !unreadCount}
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
            全部已读
          </button>
        )}
      </header>
      <nav className="mobile-inbox-views" aria-label="消息栏目">
        <Link
          to="/notifications"
          aria-current={!isAnnouncements ? "page" : undefined}
        >
          互动通知
        </Link>
        <Link
          to="/announcements"
          aria-current={isAnnouncements ? "page" : undefined}
        >
          站点公告
        </Link>
      </nav>
      {isAnnouncements ? (
        <section
          className="mobile-inbox-announcements"
          aria-label="站点公告"
        >
          <AnnouncementsPanel />
        </section>
      ) : (
        <>
          <p className="mobile-inbox-count" aria-live="polite">
            {unreadCount !== undefined
              ? `${unreadCount} 条未读`
              : unread.isPending
                ? "\u00a0"
                : "未读数量暂未加载"}
          </p>
      <div
        className="mobile-inbox-tabs"
        role="tablist"
        aria-label="消息类型"
        ref={tabs}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const index = notificationColumns.findIndex(
            ([key]) => key === column,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? 4
                : (index + (event.key === "ArrowRight" ? 1 : 4)) % 5;
          select(notificationColumns[next][0]);
          tabs.current
            ?.querySelectorAll<HTMLButtonElement>("button")
            [next]?.focus();
        }}
      >
        {notificationColumns.map(([key, name]) => (
          <button
            key={key}
            role="tab"
            id={`inbox-tab-${key}`}
            aria-selected={column === key}
            aria-controls="inbox-messages"
            tabIndex={column === key ? 0 : -1}
            onClick={() => select(key)}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        className="mobile-inbox-messages"
        id="inbox-messages"
        role="tabpanel"
        aria-labelledby={`inbox-tab-${column}`}
        aria-busy={messages.isFetching}
      >
        {messages.isPending ? (
          <ContentSkeleton kind="rows" count={2} />
        ) : messages.isError && !messages.data ? (
          <div className="mobile-inbox-state" role="alert">
            <p>消息暂时无法加载</p>
            <button onClick={() => void messages.refetch()}>重新加载</button>
          </div>
        ) : messages.data?.items?.length ? (
          <>
            {notificationGroups(messages.data.items).map((group) => (
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
            ))}
          </>
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
    </main>
  );
}
