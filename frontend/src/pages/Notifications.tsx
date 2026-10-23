import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import {
  Empty,
  ErrorState,
  Gate,
  Icon,
  Intro,
  Loading,
  Pagination,
} from "../components/ui";
import { useTask } from "../components/useTask";
export default function Notifications() {
  return (
    <>
      <Intro
        title="关于好味道的新消息。"
        subtitle="你认真分享的每一餐，都有人放在心上。"
      />
      <Gate verified={false}>
        <NotificationList />
      </Gate>
    </>
  );
}
function NotificationList() {
  const { api } = useApp(),
    [page, setPage] = useState(1),
    q = useQuery({
      queryKey: ["notifications", "list", page],
      queryFn: () => api.notifications(page),
    }),
    task = useTask(undefined, undefined, ["notifications"]);
  return (
    <>
      <div className="section-title">
        <h2>消息中心</h2>
        <button
          className="text-link"
          disabled={task.isPending}
          onClick={() => task.run(() => api.readAll())}
        >
          <Icon name="check" />
          全部标为已读
        </button>
      </div>
      {task.error && <ErrorState error={task.error} />}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : q.data.items?.length ? (
        <div className="notification-list">
          {q.data.items.map((n, i) => (
            <article
              key={n.id ?? i}
              className={`notification-item ${n.read ? "" : "unread"}`}
            >
              <span className="avatar">{n.actorName?.slice(0, 1) || "信"}</span>
              <div>
                <strong>{n.actorName || "校园食友圈"}</strong>
                <p>你的校园食友圈有了新互动。</p>
                <small>
                  {n.createdAt
                    ? new Date(n.createdAt).toLocaleString("zh-CN")
                    : ""}
                </small>
                <div className="notification-actions">
                  {!n.read && (
                    <button
                      className="text-link"
                      disabled={task.isPending || !n.id}
                      onClick={() => task.run(() => api.read(n.id!))}
                    >
                      标为已读
                    </button>
                  )}
                  {n.actorId && (
                    <Link className="text-link" to={`/users/${n.actorId}`}>
                      看看这位同学 ↗
                    </Link>
                  )}
                </div>
              </div>
              {!n.read && <span className="unread-dot" />}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="暂时没有新消息"
          action={
            <Link to="/" className="btn btn-secondary">
              去发现好味道
            </Link>
          }
        >
          有新的互动时，会在这里告诉你。
        </Empty>
      )}
      <Pagination
        page={page}
        hasNext={q.data?.hasNext}
        totalPages={q.data?.totalPages}
        onPage={setPage}
      />
    </>
  );
}
