import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { Store } from "lucide-react";
import { errorMessage } from "../api/client";
import { useV2 } from "./state";

export function safeNext(value: unknown) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\#\r\n]/.test(value) &&
    !/^\/auth(?:[/?]|$)/.test(value)
    ? value
    : "/me";
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  const run = async (
    action: (signal: AbortSignal) => Promise<unknown>,
    success = "",
  ) => {
    if (active.current) return;
    const request = new AbortController();
    active.current = request;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action(request.signal);
      if (!request.signal.aborted) setMessage(success);
    } catch (cause) {
      if (!request.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (active.current === request) {
        active.current = null;
        setBusy(false);
      }
    }
  };
  return { busy, error, message, run, setError };
}

export function Notice({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  return error ? (
    <p className="v2-error" role="alert">
      {error}
    </p>
  ) : message ? (
    <p className="v2-status" role="status">
      {message}
    </p>
  ) : null;
}

export function QueryState({
  query,
  children,
  empty,
}: {
  query: { isPending: boolean; error: unknown; refetch: () => unknown };
  children: ReactNode;
  empty?: boolean;
}) {
  if (query.isPending)
    return (
      <p role="status" className="v2-state">
        正在加载…
      </p>
    );
  if (query.error)
    return (
      <div className="v2-state">
        <Notice error={errorMessage(query.error)} />
        <button type="button" onClick={() => void query.refetch()}>
          重试
        </button>
      </div>
    );
  return empty ? <p className="v2-state">暂无记录</p> : children;
}

export function Require({
  children,
  admin = false,
  edit = false,
}: {
  children: ReactNode;
  admin?: boolean;
  edit?: boolean;
}) {
  const { session, user, identityPending, identityError, refreshIdentity } =
    useV2();
  const { pathname, search } = useLocation();
  if (!session)
    return (
      <section className="v2-panel v2-state">
        <h1>请先登录</h1>
        <Link
          className="v2-primary"
          to={"/auth?next=" + encodeURIComponent(pathname + search)}
        >
          登录
        </Link>
      </section>
    );
  if (identityPending)
    return (
      <p role="status" className="v2-state">
        正在核实账号…
      </p>
    );
  if (identityError)
    return (
      <div className="v2-state">
        <Notice error={errorMessage(identityError)} />
        <button onClick={() => void refreshIdentity()}>重试</button>
      </div>
    );
  if (admin && user?.role !== "admin")
    return (
      <p role="alert" className="v2-state">
        需要管理员身份。
      </p>
    );
  if (edit && user?.verified !== true && user?.role !== "admin")
    return (
      <div className="v2-state">
        <p>发布和编辑店铺需要学生认证。</p>
        <Link to="/verify">去认证</Link>
      </div>
    );
  return children;
}

export function Form({
  submit,
  label = "保存",
  success,
  children,
}: {
  submit: (data: FormData, signal: AbortSignal) => Promise<unknown>;
  label?: string;
  success?: string;
  children: ReactNode;
}) {
  const task = useAction();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void task.run((signal) => submit(data, signal), success);
  };
  return (
    <form className="v2-form" onSubmit={onSubmit}>
      <fieldset disabled={task.busy}>
        {children}
        <button className="v2-primary" type="submit">
          {task.busy ? "处理中…" : label}
        </button>
      </fieldset>
      <Notice {...task} />
    </form>
  );
}

export function value(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

export function Picture({
  url,
  className = "",
}: {
  url?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState<string>();
  const safe =
    url &&
    /^(https?:\/\/|\/(?!\/)|data:image\/(?:jpeg|png|webp|gif);base64,)/i.test(
      url,
    );
  return (
    <div className={"v2-picture " + className}>
      {safe && url !== failed ? (
        <img src={url} alt="" onError={() => setFailed(url)} />
      ) : (
        <Store aria-hidden="true" size={38} />
      )}
    </div>
  );
}

export function PageControls({
  page,
  hasNext,
  change,
}: {
  page: number;
  hasNext?: boolean;
  change: (page: number) => void;
}) {
  if (page === 1 && !hasNext) return null;
  return (
    <div className="v2-pager" aria-label="分页">
      <button disabled={page <= 1} onClick={() => change(page - 1)}>
        上一页
      </button>
      <span>第 {page} 页</span>
      <button disabled={!hasNext} onClick={() => change(page + 1)}>
        下一页
      </button>
    </div>
  );
}

export function dateTime(value?: number | string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
    : "";
}
