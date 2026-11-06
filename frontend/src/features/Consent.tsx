import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useAuthBusy } from "../app/auth-dialog";
import { isDemo } from "../app/runtime";
import {
  clearConsentProof,
  getConsentProof,
  getConsentReturnTo,
} from "../app/consent";
import {
  policyDocumentUrl,
  policyIdentity,
  requirePolicyAcceptance,
} from "../api/consent";
import { errorMessage } from "../api/client";
import { loadPolicyDocument } from "../api/policy-document";
import { useTask } from "../components/useTask";
import "./consent.css";

export function usePolicyConsent(enabled = true) {
  const { api } = useApp();
  const query = useQuery({
    queryKey: ["consent-policy"],
    queryFn: () => api.consentPolicy(),
    enabled,
    staleTime: 60_000,
  });
  const [accepted, setAccepted] = useState("");
  const key = policyIdentity(query.data);
  const documentUrl = policyDocumentUrl(
    query.data,
    import.meta.env.VITE_API_BASE_URL || "/api",
  );
  const documentQuery = useQuery({
    queryKey: ["consent-policy-document", key, documentUrl],
    queryFn: ({ signal }) =>
      isDemo
        ? Promise.resolve("本地演示政策")
        : loadPolicyDocument(documentUrl!, query.data?.version || "", signal),
    enabled: enabled && !!documentUrl && !!key,
    staleTime: 60_000,
    retry: false,
  });
  const ready =
    !!key && !!documentUrl && !query.isError && documentQuery.isSuccess;
  const agreed = ready && accepted === key;
  return {
    query,
    documentUrl,
    documentQuery,
    ready,
    agreed,
    canSubmit: agreed && !query.isFetching && !documentQuery.isFetching,
    setAgreed: (checked: boolean) => setAccepted(checked && ready ? key : ""),
    requireAcceptance: async () => {
      requirePolicyAcceptance(accepted, query.data);
      if (!ready) throw new Error("政策正文暂不可用，请稍后重试。");
      const fresh = await query.refetch();
      if (fresh.error) throw fresh.error;
      if (
        !policyDocumentUrl(
          fresh.data,
          import.meta.env.VITE_API_BASE_URL || "/api",
        )
      )
        throw new Error("政策正文暂不可用，请稍后重试。");
      return requirePolicyAcceptance(accepted, fresh.data);
    },
  };
}
type PolicyControl = ReturnType<typeof usePolicyConsent>;
function PolicyDocument({
  url,
  version,
  identity,
}: {
  url: string;
  version: string;
  identity: string;
}) {
  const document = useQuery({
    queryKey: ["consent-policy-document", identity, url],
    queryFn: ({ signal }) => loadPolicyDocument(url, version, signal),
    staleTime: 60_000,
    retry: false,
  });
  return (
    <section className="ew-policy-full" aria-label="政策正文阅读区">
      <h3>完整政策正文</h3>
      {document.isPending ? (
        <p className="ew-policy-loading" role="status">
          正在加载完整政策正文…
        </p>
      ) : document.isError ? (
        <div className="ew-policy-load-error" role="alert">
          <p>
            {document.error.name === "TimeoutError"
              ? "政策正文加载超时，请重试或打开原文阅读。"
              : document.error instanceof TypeError
                ? "暂时无法加载政策正文，请检查网络后重试或打开原文阅读。"
                : errorMessage(document.error)}
          </p>
          <button type="button" onClick={() => void document.refetch()}>
            重试正文
          </button>
        </div>
      ) : (
        <article
          className="ew-policy-document"
          aria-label="完整跨站同步授权政策"
          dangerouslySetInnerHTML={{ __html: document.data }}
        />
      )}
      <a href={url} target="_blank" rel="noopener noreferrer">
        在新页面阅读完整政策 ↗
      </a>
    </section>
  );
}
export function PolicyConsent({
  consent,
  busy = false,
  feedback,
  showWithdrawalLink = true,
}: {
  consent: PolicyControl;
  busy?: boolean;
  feedback?: { message: string; attempt: number; animate: boolean };
  showWithdrawalLink?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    choice = useRef<HTMLDivElement>(null),
    titleId = useId(),
    [open, setOpen] = useState(false);
  const { query, documentQuery, ready, agreed, setAgreed, documentUrl } =
    consent;
  const { session } = useApp();
  const policy = query.data;
  const feedbackAttempt = feedback?.attempt;
  const feedbackAnimate = feedback?.animate;
  useEffect(() => {
    if (!feedbackAttempt) return;
    choice.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
    if (
      !feedbackAnimate ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const animation = choice.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 300, easing: "ease-in-out" },
    );
    return () => animation?.cancel();
  }, [feedbackAttempt, feedbackAnimate]);
  return (
    <div className="ew-consent">
      <div className="ew-consent-choice" ref={choice}>
        <input
          id={titleId + "-check"}
          type="checkbox"
          aria-label="我已阅读并同意跨站同步授权政策"
          aria-invalid={feedback ? true : undefined}
          aria-describedby={feedback ? titleId + "-error" : undefined}
          checked={agreed}
          disabled={!ready || busy || query.isFetching}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <div>
          <label htmlFor={titleId + "-check"}>我已阅读并同意</label>{" "}
          <button
            type="button"
            className="ew-policy-link"
            disabled={!ready}
            onClick={() => {
              setOpen(true);
              dialog.current?.showModal();
            }}
          >
            《跨站同步授权政策》
          </button>
        </div>
      </div>
      {feedback && (
        <p className="ew-consent-feedback" id={titleId + "-error"} role="alert">
          {feedback.message}
        </p>
      )}
      {query.isPending && (
        <p className="ew-consent-note" role="status">
          正在加载政策…
        </p>
      )}
      {documentQuery.isFetching && (
        <p className="ew-consent-note" role="status">
          正在加载政策正文…
        </p>
      )}
      {documentQuery.isError && (
        <p className="ew-consent-error" role="alert">
          {errorMessage(documentQuery.error)}{" "}
          <button type="button" onClick={() => void documentQuery.refetch()}>
            重试正文
          </button>
        </p>
      )}
      {query.isError ? (
        <p className="ew-consent-error" role="alert">
          政策加载失败：{errorMessage(query.error)}{" "}
          <button type="button" onClick={() => void query.refetch()}>
            重试政策
          </button>
        </p>
      ) : (
        !query.isPending &&
        !documentQuery.isFetching &&
        !documentQuery.isError &&
        !ready && (
          <p className="ew-consent-error" role="alert">
            暂时无法加载授权政策，请稍后重试。
            <button type="button" onClick={() => void query.refetch()}>
              重试政策
            </button>
          </p>
        )
      )}
      {!session && showWithdrawalLink && (
        <p className="ew-consent-note">
          <Link to="/auth/withdraw-consent">
            无法登录？使用密码撤回同步授权
          </Link>
        </p>
      )}
      {createPortal(
        <dialog
          ref={dialog}
          className="ew-policy-dialog"
          aria-labelledby={titleId}
          onClose={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) dialog.current?.close();
          }}
        >
          <div className="ew-policy-content">
            <header>
              <div>
                <small>请在同意前阅读</small>
                <h2 id={titleId}>跨站同步授权政策</h2>
                <p>政策版本：{policy?.version}</p>
              </div>
              <button
                type="button"
                aria-label="关闭政策"
                onClick={() => dialog.current?.close()}
              >
                ×
              </button>
            </header>
            <div className="ew-policy-scroll">
              {!isDemo && documentUrl && open && (
                <PolicyDocument
                  url={documentUrl}
                  version={policy?.version || ""}
                  identity={policyIdentity(policy)}
                />
              )}
              {isDemo && (
                <p>
                  当前为本地演示政策，用于检查同意流程，不会触发真实跨站同步。
                </p>
              )}
            </div>
            <footer>
              <span>阅读后请自行勾选同意；关闭正文不会自动授权。</span>
              <button type="button" onClick={() => dialog.current?.close()}>
                关闭正文
              </button>
            </footer>
          </div>
        </dialog>,
        document.body,
      )}
    </div>
  );
}
export function ConsentRecovery() {
  const { api } = useApp(),
    consent = usePolicyConsent(),
    [done, setDone] = useState(false),
    [returnTo] = useState(getConsentReturnTo);
  const task = useTask(undefined, () => {
    clearConsentProof();
    setDone(true);
  }, ["consent"]);
  useAuthBusy(task.isPending);
  return (
    <div className="ew-consent-recovery">
      <span className="pc-secondary-badge">授权确认</span>
      <h2>{done ? "授权请求已提交" : "继续之前，确认你的授权"}</h2>
      {done ? (
        <p>
          请返回登录继续。账号同步可能需要时间；取得正式登录会话后，才能进入账号。
        </p>
      ) : (
        <>
          <p>
            你的账号需要确认当前政策。临时授权凭证仅用于本次授权，不代表已经登录。
          </p>
          <PolicyConsent consent={consent} busy={task.isPending} />
          {!getConsentProof() && (
            <p className="ew-consent-error">
              本次授权凭证已失效或账号仍在同步，请重新验证身份。
              <Link to="/auth/consent-offer">使用密码重新验证 →</Link>
            </p>
          )}
          {task.errorText && (
            <p role="alert" className="ew-consent-error">
              {task.errorText}
            </p>
          )}
          <button
            className="ew-consent-submit"
            disabled={
              !consent.canSubmit || !getConsentProof() || task.isPending
            }
            onClick={() =>
              task.run(async () => {
                const accepted = await consent.requireAcceptance();
                await api.grantConsent({
                  proof: getConsentProof(),
                  policyVersion: accepted.consentPolicyVersion,
                });
              })
            }
          >
            {task.isPending ? "正在确认…" : "同意并继续"}
          </button>
        </>
      )}
      <Link className="ew-consent-return" to={returnTo}>
        返回登录
      </Link>
    </div>
  );
}
