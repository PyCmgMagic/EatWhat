import {
  useRef,
  useContext,
  useState,
  useEffect,
  useId,
  isValidElement,
  cloneElement,
  type ReactNode,
  type ReactElement,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { DesignIcon as Icon } from "../../mobile/ui";
import { ContentSkeleton } from "../../components/LoadingSkeleton";
import { errorMessage, resultUncertain, unavailable } from "../../api/client";
import { ProfileWorkspaceContext } from "../../app/profile-workspace";
import "./v4.css";
import "./design.css";
export const labels: Record<string, string> = {
  PENDING: "处理中",
  COMMITTED: "已受理",
  FACT_READY: "已受理，等待设备恢复",
  DRAFT: "草稿",
  APPROVE: "已通过",
  REJECT: "已驳回",
  TOKEN_REFRESHED: "连接已更新",
  ENABLED: "已开启",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  SUPERSEDED: "已被新提交替代",
  HIDDEN: "已隐藏",
  DELETED: "已删除",
  READY: "已就绪",
  APPLIED: "已生效",
  REGISTERED: "已登记",
  PUBLISHED: "已发布",
  ALREADY_PUBLISHED: "已发布",
  OPEN: "待处理",
  CLOSED: "已关闭",
  WITHDRAWN: "已撤回",
  NOT_GRANTED: "未授权",
  GRANTED: "已授权",
  SYNC_PENDING: "同步中",
  NOT_LOGGED_IN: "未登录",
  UNKNOWN: "待确认",
  ACTIVE: "正常",
  PREPARING: "正在准备",
  FINALIZED: "已完成注销",
  COMPLETED: "已完成",
  REAUTHENTICATION_REQUIRED: "请重新登录",
  EXPIRED: "已过期",
  FOOD: "菜品",
  RESTAURANT: "餐厅",
  FEEDBACK: "意见反馈",
  REPORT: "举报",
  CATALOG_ERROR: "店铺纠错",
  ACCEPTED: "已采纳",
  RESOLVED: "已处理",
  RECOMMEND: "推荐",
  GOOD: "不错",
  AVERAGE: "一般",
  NOT_RECOMMEND: "不推荐",
};
export const statusText = (value?: string | null) =>
  value ? (labels[value] ?? value) : "待确认";
export function timeText(value?: string | number | null) {
  if (value == null) return "暂未记录";
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? d.toLocaleString("zh-CN")
    : "时间待确认";
}
export function Shell({
  title,
  detail,
  children,
  back = "/me",
  advice = true,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
  back?: string;
  advice?: boolean;
}) {
  const location = useLocation();
  const embedded = useContext(ProfileWorkspaceContext);
  const path = location.pathname;
  const featuresReturnTo =
    typeof location.state?.featuresReturnTo === "string" &&
    /^\/features(?:\?|$)/.test(location.state.featuresReturnTo)
      ? location.state.featuresReturnTo
      : undefined;
  const workspaceSectionPage = [
    "/features",
    "/announcements",
    "/feedback",
    "/feedback/mine",
    "/submissions",
    "/restaurants/favorites",
  ].includes(path);
  const showBreadcrumb =
    !embedded || !!featuresReturnTo || !workspaceSectionPage;
  const section = path.startsWith("/admin/")
    ? "admin"
    : path.startsWith("/settings/") || path.startsWith("/auth/")
      ? "account"
      : path.startsWith("/feedback") ||
          path.startsWith("/reports") ||
          path.includes("correction")
        ? "feedback"
        : path.startsWith("/topics")
          ? "topics"
          : path.startsWith("/restaurants")
            ? "restaurants"
            : path.startsWith("/submissions")
              ? "submissions"
              : path === "/notifications"
                ? "notifications"
                : path === "/announcements"
                  ? "announcements"
                  : path.startsWith("/me/tags/")
                    ? "tags"
                    : "hub";
  const meta: Record<string, { name: string; icon: string; detail: string }> = {
    hub: {
      name: "个人中心",
      icon: "tool",
      detail: "找餐厅、查进度、管账号，都在这里。",
    },
    account: {
      name: "账号与偏好",
      icon: "shield",
      detail: "把账号照顾好，安心记录每一顿。",
    },
    feedback: {
      name: "反馈与帮助",
      icon: "feedback",
      detail: "认真对待你的每一条建议。",
    },
    topics: {
      name: "校园专题",
      icon: "topic",
      detail: "跟着校园专题，发现下一口好味道。",
    },
    restaurants: {
      name: "发现好店",
      icon: "store",
      detail: "喜欢的味道，留给下一次好胃口。",
    },
    submissions: {
      name: "我的分享",
      icon: "document",
      detail: "每一份分享，都能在这里找到后续。",
    },
    notifications: {
      name: "消息与互动",
      icon: "bell",
      detail: "看看校园食友和你的分享有了哪些新动态。",
    },
    announcements: {
      name: "站点消息",
      icon: "announce",
      detail: "及时了解站点公告与服务安排。",
    },
    tags: {
      name: "我的标签",
      icon: "tag",
      detail: "用自己的方式，收好喜欢的味道。",
    },
    admin: {
      name: "管理工作台",
      icon: "tool",
      detail: "认真维护内容，让校园的好味道被看见。",
    },
  };
  const aside =
    advice &&
    !embedded &&
    ((section === "feedback" && !path.startsWith("/feedback/mine")) ||
      section === "account");
  useEffect(() => {
    document.title = title + " · 山软今天吃什么";
  }, [title]);
  return (
    <div className="v4-page" data-section={section} data-route={path}>
      <header className="v4-heading">
        {showBreadcrumb && (
          <div className="v4-breadcrumb">
            <Link to={featuresReturnTo ?? back}>
              <Icon name="back" size={15} />
              返回
            </Link>
            <span />
            <span>{meta[section].name}</span>
          </div>
        )}
        <div className="v4-page-title">
          <span className="v4-page-symbol">
            <Icon name={meta[section].icon} size={28} />
          </span>
          <div>
            <h1>{title}</h1>
            <p>{detail || meta[section].detail}</p>
          </div>
          {!embedded && path !== "/features" && featuresReturnTo && (
            <Link to={featuresReturnTo} className="v4-heading-home">
              返回功能搜索
              <Icon name="chevronRight" size={16} />
            </Link>
          )}
        </div>
      </header>
      <div className={aside ? "v4-workspace" : undefined}>
        <div className="v4-page-content">{children}</div>
        {aside && <PageAdvice section={section} path={path} />}
      </div>
    </div>
  );
}
function PageAdvice({ section, path }: { section: string; path: string }) {
  const feedback = section === "feedback",
    danger = path.endsWith("delete"),
    privacy = path.endsWith("telemetry"),
    phone = path.endsWith("phone");
  return (
    <aside className={`v4-advice ${feedback ? "is-feedback" : "is-account"}`}>
      <div className="v4-advice-art" aria-hidden="true">
        <span />
        <Icon
          name={
            feedback
              ? "mailSend"
              : danger
                ? "document"
                : privacy
                  ? "lock"
                  : phone
                    ? "phone"
                    : "shield"
          }
          size={68}
        />
        <i>
          <Icon name={feedback ? "comment" : "check"} size={20} />
        </i>
      </div>
      <span className="v4-kicker">
        {feedback ? "每一条建议，都有回音" : "安心分享每一顿"}
      </span>
      <h2>
        {feedback
          ? "把想法，认真留下。"
          : danger
            ? "决定离开前，先了解清楚。"
            : privacy
              ? "你的偏好，由你做主。"
              : "重要的操作，多一份安心。"}
      </h2>
      <p>
        {feedback
          ? "描述遇到的问题或你的建议，附上清晰截图，会更方便我们了解情况。"
          : danger
            ? "申请后请留意页面显示的处理阶段与撤销期限，也可以保存本次恢复信息。"
            : privacy
              ? "是否开启使用统计，由你自主选择。你也可以随时回到这里关闭。"
              : "请确认是本人操作，按页面提示完成验证，并留意最终处理结果。"}
      </p>
      <div className="v4-advice-tip">
        <Icon name="info" size={19} />
        <p>
          {feedback
            ? "提交后，处理进度与回复会保存在「我的反馈记录」。"
            : "请勿向他人透露密码、验证码或恢复文件。"}
        </p>
      </div>
      {feedback && (
        <Link to="/feedback/mine">
          查看反馈记录
          <Icon name="chevronRight" size={16} />
        </Link>
      )}
    </aside>
  );
}
export function Card({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="v4-card">
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}
export function QueryView({
  query,
  children,
  empty = false,
  emptyTitle = "这里暂时没有记录。",
  emptyDetail = "新的记录会出现在这里，先去看看校园里有什么好味道。",
}: {
  query: {
    isPending: boolean;
    error: unknown;
    data?: unknown;
    refetch: () => unknown;
  };
  children: ReactNode;
  empty?: boolean;
  emptyTitle?: string;
  emptyDetail?: string;
}) {
  if (query.isPending) return <ContentSkeleton kind="rows" count={3} />;
  if (query.error && !query.data)
    return (
      <div className="v4-state" role="alert">
        <span className="v4-state-art">
          <Icon name="wifiOff" size={34} />
        </span>
        <h2>
          {unavailable(query.error) ? "这项功能暂未开放" : "内容暂时未能加载"}
        </h2>
        <p>
          {unavailable(query.error)
            ? "当前服务暂未提供这项功能，请稍后再试。"
            : errorMessage(query.error)}
        </p>
        <button onClick={() => void query.refetch()}>重新加载</button>
      </div>
    );
  if (empty)
    return (
      <div className="v4-state" role="status">
        <span className="v4-state-art">
          <Icon name="bowl" size={37} />
          <i />
        </span>
        <h3>{emptyTitle}</h3>
        <p>{emptyDetail}</p>
      </div>
    );
  return (
    <>
      {query.error && (
        <p role="alert">
          刷新失败，正在显示上次读取的内容。
          <button onClick={() => void query.refetch()}>重试</button>
        </p>
      )}
      {children}
    </>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId(),
    labelId = id + "-label";
  const control =
    isValidElement(children) &&
    typeof children.type === "string" &&
    ["input", "select", "textarea"].includes(children.type)
      ? cloneElement(
          children as ReactElement<{ id?: string; "aria-labelledby"?: string }>,
          { id, "aria-labelledby": labelId },
        )
      : children;
  return (
    <label className="v4-field" htmlFor={id}>
      <span id={labelId}>{label}</span>
      {control}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Badge({ value }: { value?: string | null }) {
  const tone = [
    "APPROVED",
    "PUBLISHED",
    "APPLIED",
    "READY",
    "GRANTED",
    "ENABLED",
    "ACTIVE",
    "REGISTERED",
  ].includes(value ?? "")
    ? "positive"
    : ["REJECTED", "HIDDEN", "DELETED", "EXPIRED", "FINALIZED"].includes(
          value ?? "",
        )
      ? "negative"
      : [
            "PENDING",
            "PREPARING",
            "SYNC_PENDING",
            "COMMITTED",
            "FACT_READY",
          ].includes(value ?? "")
        ? "pending"
        : "neutral";
  return (
    <span className="v4-badge" data-tone={tone}>
      <i />
      {statusText(value)}
    </span>
  );
}
export function Pager({
  page,
  hasNext,
  onChange,
}: {
  page: number;
  hasNext?: boolean | null;
  onChange: (page: number) => void;
}) {
  return page > 1 || hasNext ? (
    <nav className="v4-pager" aria-label="分页">
      <button disabled={page === 1} onClick={() => onChange(page - 1)}>
        上一页
      </button>
      <span>第 {page} 页</span>
      <button disabled={!hasNext} onClick={() => onChange(page + 1)}>
        下一页
      </button>
    </nav>
  ) : null;
}
export function useCommand(readOnly = false) {
  const lock = useRef(false),
    id = useRef<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [uncertain, setUncertain] = useState(false),
    [message, setMessage] = useState("");
  return {
    busy,
    error,
    uncertain,
    message,
    run: async <T,>(
      action: (commandId: string) => Promise<T>,
      after?: (result: T) => void | Promise<void>,
    ) => {
      if (lock.current || uncertain) return;
      lock.current = true;
      setBusy(true);
      setError("");
      setMessage("");
      id.current ??= crypto.randomUUID();
      try {
        const result = await action(id.current);
        await after?.(result);
        id.current = null;
        return result;
      } catch (e) {
        setError(
          unavailable(e)
            ? "当前服务暂未开放这项操作，请稍后再试。"
            : errorMessage(e),
        );
        if (!readOnly && !unavailable(e) && resultUncertain(e)) {
          setUncertain(true);
          setMessage(
            "本次结果尚未确认，请先查看记录或查询处理进度，避免重复提交。",
          );
        } else id.current = null;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    say: setMessage,
  };
}
export function CommandState({
  task,
}: {
  task: { error: string; message: string };
}) {
  return (
    <>
      {task.error && (
        <p className="v4-error" role="alert">
          {task.error}
        </p>
      )}
      {task.message && (
        <p className="v4-message" role="status">
          {task.message}
        </p>
      )}
    </>
  );
}
export function capability() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export function safeLink(value?: string | null) {
  if (!value) return undefined;
  try {
    const u = new URL(value, location.origin);
    return ["http:", "https:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
