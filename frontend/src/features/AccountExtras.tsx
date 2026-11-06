import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useAuthBusy } from "../app/auth-dialog";
import { ApiError, errorMessage } from "../api/client";
import type { Schema } from "../api/models";
import { clearConsentProof } from "../app/consent";
import "./account-extras.css";

export function VerificationMethods() {
  const { api, session } = useApp();
  const query = useQuery({
    queryKey: ["verification-methods"],
    queryFn: () => api.verified(),
    enabled: !!session,
  });
  return (
    <div className="ew-verification-methods">
      <strong>认证方式</strong>
      {query.isPending ? (
        <span role="status">正在读取认证方式…</span>
      ) : query.isError ? (
        <div role="alert">
          <span>{errorMessage(query.error)}</span>
          <button type="button" onClick={() => void query.refetch()}>
            重试认证方式
          </button>
        </div>
      ) : (
        <div>
          {query.data.length ? (
            query.data.map((method) => (
              <span key={method} className="ew-method-badge">
                {method === "verify:sso"
                  ? "山东大学统一认证"
                  : method === "verify:school_email"
                    ? "学校邮箱认证"
                    : "其他认证方式"}
              </span>
            ))
          ) : (
            <span>暂未记录已完成的认证方式</span>
          )}
        </div>
      )}
      {!query.isPending && !query.isError && (
        <button
          type="button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          刷新认证方式
        </button>
      )}
    </div>
  );
}

export function PasswordConsentWithdrawal() {
  const { api } = useApp();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false),
    [acknowledged, setAcknowledged] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<{
    view: Schema["ConsentViewResponse"] | null;
  } | null>(null);
  useAuthBusy(busy);
  return (
    <div className="ew-withdrawal">
      <Link to="/auth/password" className="ew-withdrawal-back">
        ← 返回登录
      </Link>
      <span className="pc-secondary-badge">跨站授权</span>
      <h2>{result ? "撤回请求已提交" : "使用密码撤回同步授权"}</h2>
      {result ? (
        <div role="status">
          <p>
            撤回将停止后续跨站同步，并限制新加坡站普通账号功能。对端数据清理可能需要时间，请以服务端处理状态为准。
          </p>
          <dl>
            <dt>授权状态</dt>
            <dd>{result.view?.status || "服务端已受理"}</dd>
            <dt>清理状态</dt>
            <dd>{result.view?.cleanupStatus || "暂未返回清理进度"}</dd>
          </dl>
          <p>校内本地数据继续保留。需要继续使用账号时，请返回登录。</p>
        </div>
      ) : (
        <>
          <p>
            无需先同意政策或登录。使用账号密码验证身份后，可以申请撤回跨站及跨境数据同步授权。
          </p>
          <aside>
            撤回后，境外业务数据会进入清理流程，校内本地数据保留。此操作不会注销账号。
          </aside>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (locked.current || !acknowledged) return;
              const form = event.currentTarget,
                data = new FormData(form);
              locked.current = true;
              setBusy(true);
              setError("");
              try {
                const view = await api.withdrawConsentWithPassword({
                  userName: String(data.get("username")).trim(),
                  password: String(data.get("password")),
                });
                clearConsentProof();
                form.reset();
                setResult({ view });
              } catch (cause) {
                setError(
                  cause instanceof ApiError &&
                    [404, 405, 501].includes(cause.status ?? 0)
                    ? "暂时无法通过密码撤回授权，请联系平台管理员处理。"
                    : errorMessage(cause),
                );
              } finally {
                locked.current = false;
                setBusy(false);
              }
            }}
          >
            <label>
              用户名
              <input
                name="username"
                autoComplete="username"
                minLength={3}
                maxLength={64}
                required
                disabled={busy}
              />
            </label>
            <label>
              登录密码
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={busy}
              />
            </label>
            <label className="ew-withdrawal-ack">
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={busy}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span>我了解撤回会停止后续同步，并限制境外账号功能。</span>
            </label>
            {error && (
              <p className="ew-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="ew-withdrawal-submit"
              disabled={busy || !acknowledged}
            >
              {busy ? "正在提交…" : "验证身份并撤回授权"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
