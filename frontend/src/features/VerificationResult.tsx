import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import {
  claimVerificationReturn,
  verificationFailureMessage,
  verificationReturn,
  type VerificationCallback,
} from "../app/verification-return";
import { DesignIcon as Icon } from "../mobile/ui";
import { PageHead, Section } from "../desktop/secondary";
import { errorMessage } from "../api/client";
import "./student-verification.css";

export default function VerificationResult({
  callback,
}: {
  callback: VerificationCallback;
}) {
  const { api, user } = useApp(),
    cache = useQueryClient();
  const origin = useMemo(() => verificationReturn(user?.id), [user?.id]);
  const returnTo = origin.intent?.returnTo ?? "/settings/account";
  const query = useQuery({
    queryKey: [
      "verification-result",
      user?.id,
      callback.result,
      callback.code,
      callback.ticket,
      callback.token,
    ],
    queryFn: async () => {
      if (callback.token && !origin.accountChanged) {
        const token = callback.token;
        forgetCallbackParameter("token");
        try {
          await confirmed(`email:${token}`, () => api.verifyEmail(token));
        } catch (error) {
          const me = await api.me();
          if (me?.verified) return me;
          throw error;
        }
      }
      if (callback.ticket && !origin.accountChanged) {
        const ticket = callback.ticket;
        // The ticket works once; drop it so a refresh does not resend it.
        forgetCallbackParameter("ticket");
        try {
          await confirmed(`sso:${ticket}`, () => api.ssoConfirm(ticket));
        } catch (error) {
          const me = await api.me();
          // Already bound (e.g. confirmed in another tab): show the result.
          if (me?.verified) return me;
          throw error;
        }
      }
      return api.me();
    },
    staleTime: 0,
    retry: false,
    refetchOnMount: "always",
  });
  useEffect(() => {
    if (origin.intent) claimVerificationReturn(origin.intent);
  }, [origin.intent]);
  useEffect(() => {
    if (query.data) {
      cache.setQueryData(["me"], query.data);
      void cache.invalidateQueries({ queryKey: ["verification-methods"] });
    }
  }, [query.data, cache]);
  const busy = query.isPending || query.isFetching;
  const success =
    !busy &&
    !query.isError &&
    !origin.accountChanged &&
    query.data?.verified === true;
  const title = busy
    ? "正在确认认证结果"
    : origin.accountChanged
      ? "登录账号已变化"
      : query.isError
        ? "暂时无法确认认证结果"
        : success
          ? "学生认证成功"
          : callback.result === "failure"
            ? "本次认证未完成"
            : "暂未确认认证完成";
  const detail = busy
    ? "正在查询当前账号的最新认证状态，请稍候。"
    : origin.accountChanged
      ? "当前登录账号与发起认证时不同，请切换回原账号后确认结果。"
      : query.isError
        ? errorMessage(query.error)
        : success
          ? "学生身份已确认，可以返回刚才的页面继续使用收藏、喜欢等功能。"
          : callback.result === "failure"
            ? verificationFailureMessage(callback.code)
            : "账号目前仍显示未认证。可以刷新确认，或返回认证页重新发起认证。";
  const restart = "/verify?next=" + encodeURIComponent(returnTo);
  return (
    <>
      <PageHead
        title="学生认证"
        detail="确认本次认证结果，继续刚才的操作。"
        back={returnTo}
        crumb="返回原页面"
      />
      <div className="student-verification verification-result">
        <Section title="认证结果">
          <div
            className={`pc-secondary-verification ${success ? "verified" : ""}`}
            role="status"
            aria-live="polite"
          >
            <Icon name={success ? "verify" : "shield"} size={35} />
            <div>
              <h3>{title}</h3>
              <p>{detail}</p>
            </div>
          </div>
          <div className="verification-result-actions">
            {success ? (
              <Link className="pc-button" to={returnTo}>
                {origin.intent ? "返回原页面" : "返回账号与安全"}
              </Link>
            ) : (
              <>
                <button
                  className="pc-button"
                  disabled={busy}
                  onClick={() => void query.refetch()}
                >
                  {busy ? "正在确认…" : "刷新认证状态"}
                </button>
                {!origin.accountChanged && (
                  <Link className="pc-button light" to={restart}>
                    返回认证页
                  </Link>
                )}
              </>
            )}
            <Link className="pc-secondary-text-link" to="/settings/account">
              查看账号与安全
            </Link>
          </div>
        </Section>
      </div>
    </>
  );
}

/** One request per credential even if React runs the query twice. */
const confirming = new Map<string, Promise<unknown>>();
function confirmed(key: string, send: () => Promise<unknown>) {
  let pending = confirming.get(key);
  if (!pending) confirming.set(key, (pending = send()));
  return pending;
}
function forgetCallbackParameter(name: "ticket" | "token") {
  const hash = window.location.hash,
    at = hash.indexOf("?");
  if (at < 0) return;
  const params = new URLSearchParams(hash.slice(at + 1));
  if (!params.has(name)) return;
  params.delete(name);
  window.history.replaceState(
    window.history.state,
    "",
    window.location.pathname +
      window.location.search +
      hash.slice(0, at) +
      "?" +
      params,
  );
}
