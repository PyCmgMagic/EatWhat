import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import type { V2Schema } from "../api/backend-v2";
import { useV2 } from "./state";
import {
  Notice,
  PageControls,
  Picture,
  QueryState,
  dateTime,
  useAction,
} from "./ui";

const notificationLabels: Record<string, string> = {
  comment: "有人评论了菜品",
  reply: "有人回复了评论",
  like: "有人点赞了菜品",
  favorite: "有人收藏了菜品",
  comment_like: "有人点赞了评论",
  follow: "有了新的关注",
  case_result: "反馈已有处理结果",
  announcement: "系统公告",
};

function notificationLink(card: V2Schema["NotificationCard"]) {
  const target = card.target;
  if (target?.domain === "foods") return `/foods/${target.id}`;
  if (target?.domain === "users") return `/users/${target.id}`;
  if (
    target?.domain === "feedback" ||
    target?.domain === "catalog_error" ||
    target?.domain === "report"
  )
    return "/feedback";
  if (target?.domain === "comments") return "/comments/my";
  return "/notifications";
}

export function Notifications() {
  const { call } = useV2();
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const task = useAction();
  const query = useQuery({
    queryKey: ["v2", "notifications", page],
    queryFn: ({ signal }) =>
      call("getNotificationCards", {
        query: { page, pageSize: 20 },
        signal,
      }),
  });
  const refresh = async () => {
    await Promise.all([
      query.refetch(),
      cache.invalidateQueries({ queryKey: ["v2", "notification-unread"] }),
    ]);
  };
  return (
    <section className="v2-panel v2-narrow">
      <div className="v2-heading">
        <h1>通知</h1>
        <button
          disabled={task.busy || !query.data?.items?.length}
          onClick={() =>
            void task.run(async (signal) => {
              await call("postNotificationCardsReadAll", { signal });
              await refresh();
            })
          }
        >
          全部已读
        </button>
      </div>
      <QueryState query={query} empty={!query.data?.items?.length}>
        <ul className="v2-list v2-notification-list">
          {query.data?.items?.map((card) => (
            <li
              className={card.unreadMemberCount ? "is-unread" : ""}
              key={card.id}
            >
              <Link
                to={notificationLink(card)}
                onClick={() => {
                  if (!card.unreadMemberCount) return;
                  void call("postNotificationCardsByIdRead", {
                    path: { id: card.id! },
                  }).then(refresh);
                }}
              >
                <strong>
                  {notificationLabels[card.kind ?? ""] || "新通知"}
                </strong>
                <p>
                  {card.actors
                    ?.map((actor) => actor.displayName)
                    .filter(Boolean)
                    .join("、") ||
                    (card.data as { title?: string } | undefined)?.title ||
                    "系统消息"}
                </p>
                <time>{dateTime(card.latestAt)}</time>
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
      <PageControls
        page={page}
        hasNext={query.data?.hasNext}
        change={setPage}
      />
      <Notice {...task} />
    </section>
  );
}

export function BrowseHistory() {
  const { call } = useV2();
  const [page, setPage] = useState(1);
  const task = useAction();
  const query = useQuery({
    queryKey: ["v2", "browse-history", page],
    queryFn: ({ signal }) =>
      call("getHistoryBrowse", {
        query: { page, pageSize: 20 },
        signal,
      }),
  });
  return (
    <section className="v2-panel">
      <div className="v2-heading">
        <h1>浏览历史</h1>
        <button
          disabled={task.busy || !query.data?.items?.length}
          onClick={() =>
            confirm("清空全部浏览历史？") &&
            void task.run(async (signal) => {
              await call("deleteHistoryBrowse", { signal });
              setPage(1);
              await query.refetch();
            }, "浏览历史已清空。")
          }
        >
          清空
        </button>
      </div>
      <QueryState query={query} empty={!query.data?.items?.length}>
        <ul className="v2-history-grid">
          {query.data?.items?.map((item) => {
            const restaurant = item.restaurant;
            const food = item.food;
            const target = food ?? restaurant;
            const to =
              item.targetType === "food"
                ? `/foods/${item.targetId}`
                : `/restaurants/${item.targetId}`;
            return (
              <li key={`${item.targetType}:${item.targetId}`}>
                <Link to={to}>
                  <Picture
                    url={food?.pictureUrls?.[0] ?? restaurant?.pictureUrl}
                  />
                  <div>
                    <strong>{target?.name || "内容已删除"}</strong>
                    <time>{dateTime(item.viewedAt)}</time>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </QueryState>
      <PageControls
        page={page}
        hasNext={query.data?.hasNext}
        change={setPage}
      />
      <Notice {...task} />
    </section>
  );
}

export function MyComments() {
  const { call } = useV2();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["v2", "my-comments", page],
    queryFn: ({ signal }) =>
      call("getCommentsMy", { query: { page, pageSize: 20 }, signal }),
  });
  return (
    <section className="v2-panel v2-narrow">
      <h1>我的评论</h1>
      <QueryState query={query} empty={!query.data?.items?.length}>
        <ul className="v2-list">
          {query.data?.items?.map((comment) => (
            <li key={comment.id}>
              <Link to={`/foods/${comment.foodId}`}>
                <strong>{comment.text || "图片评论"}</strong>
                <p>{dateTime(comment.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
      <PageControls
        page={page}
        hasNext={query.data?.hasNext}
        change={setPage}
      />
    </section>
  );
}

export function Feedback() {
  const { call, upload } = useV2();
  const [page, setPage] = useState(1);
  const task = useAction();
  const files = useRef<File[]>([]);
  const mine = useQuery({
    queryKey: ["v2", "feedback", page],
    queryFn: ({ signal }) =>
      call("getFeedbackMine", { query: { page, pageSize: 20 }, signal }),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    void task.run(async (signal) => {
      const data = new FormData(form);
      const screenshotKeys = await Promise.all(
        files.current
          .slice(0, 3)
          .map((file) => upload(file, "feedback", signal)),
      );
      await call("postFeedbackMessages", {
        body: {
          text: String(data.get("text") ?? "").trim(),
          screenshotKeys,
        },
        signal,
      });
      form.reset();
      files.current = [];
      await mine.refetch();
    }, "反馈已提交。");
  };
  return (
    <>
      <section className="v2-panel v2-narrow">
        <h1>意见反馈</h1>
        <form className="v2-form" onSubmit={submit}>
          <fieldset disabled={task.busy}>
            <label>
              内容
              <textarea name="text" required maxLength={500} />
            </label>
            <label>
              截图
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) => {
                  files.current = Array.from(event.target.files ?? []).slice(
                    0,
                    3,
                  );
                }}
              />
            </label>
            <button className="v2-primary">提交</button>
          </fieldset>
        </form>
        <Notice {...task} />
      </section>
      <section className="v2-panel v2-narrow">
        <h2>提交记录</h2>
        <QueryState query={mine} empty={!mine.data?.items?.length}>
          <ul className="v2-list">
            {mine.data?.items?.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>
                    {item.kind === "REPORT"
                      ? "举报"
                      : item.kind === "CATALOG_ERROR"
                        ? "信息有误"
                        : "意见反馈"}
                  </strong>
                  <p>{item.text}</p>
                </div>
                <span>
                  {item.status === "OPEN" ? "处理中" : item.outcome || "已处理"}
                </span>
              </li>
            ))}
          </ul>
        </QueryState>
        <PageControls
          page={page}
          hasNext={mine.data?.hasNext}
          change={setPage}
        />
      </section>
    </>
  );
}

const pushLabels: Record<string, string> = {
  COMMENTS: "评论与回复",
  LIKES_AND_FAVORITES: "点赞与收藏",
  FOLLOWS: "关注",
  SYSTEM: "系统消息",
};

export function PushSettings() {
  const { call } = useV2();
  const task = useAction();
  const query = useQuery({
    queryKey: ["v2", "push-settings"],
    queryFn: ({ signal }) => call("getPushSettings", { signal }),
  });
  return (
    <section className="v2-panel v2-narrow">
      <h1>通知设置</h1>
      <QueryState query={query}>
        <ul className="v2-list">
          {Object.entries(pushLabels).map(([category, label]) => {
            const on = query.data?.categories?.[category] !== false;
            return (
              <li key={category}>
                <span>{label}</span>
                <button
                  aria-pressed={on}
                  disabled={task.busy}
                  onClick={() =>
                    void task.run(async (signal) => {
                      await call(
                        on
                          ? "postPushSettingsDisable"
                          : "postPushSettingsEnable",
                        {
                          body: { category },
                          signal,
                        },
                      );
                      await query.refetch();
                    })
                  }
                >
                  {on ? "已开启" : "已关闭"}
                </button>
              </li>
            );
          })}
        </ul>
      </QueryState>
      <Notice {...task} />
    </section>
  );
}

export function RemoteConfigBanner() {
  const { call } = useV2();
  const config = useQuery({
    queryKey: ["v2", "remote-config"],
    queryFn: ({ signal }) => call("getRemoteConfig", { public: true, signal }),
    staleTime: 60_000,
  });
  const maintenance = config.data?.maintenance;
  return (
    <>
      {maintenance?.mode && maintenance.mode !== "NONE" && (
        <aside className="v2-global-notice" role="status">
          <strong>
            {maintenance.mode === "DOWN" ? "服务维护中" : "当前为只读模式"}
          </strong>
          {maintenance.message && <span>{maintenance.message}</span>}
        </aside>
      )}
      {config.data?.announcements?.map((announcement) => (
        <aside className="v2-global-notice" key={announcement.id}>
          <strong>{announcement.title}</strong>
          <span>{announcement.content}</span>
          {announcement.linkUrl && <a href={announcement.linkUrl}>查看</a>}
        </aside>
      ))}
    </>
  );
}

const pageName = (pathname: string) => {
  if (pathname === "/") return "HOME";
  if (pathname.startsWith("/search")) return "SEARCH";
  if (pathname.startsWith("/restaurants/")) return "RESTAURANT";
  if (pathname.startsWith("/foods/")) return "FOOD";
  if (pathname.startsWith("/notifications")) return "MESSAGE";
  if (pathname.startsWith("/me") || pathname.startsWith("/users"))
    return "PROFILE";
  return "OTHER";
};

export function TelemetryReporter() {
  const { call, session } = useV2();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void call("postTelemetryEvents", {
      body: {
        events: [
          {
            eventId: crypto.randomUUID(),
            properties: { event: "page_view", page: pageName(pathname) },
          },
        ],
      },
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [call, pathname, session]);
  return null;
}
