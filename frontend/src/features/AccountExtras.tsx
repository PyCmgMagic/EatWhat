import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, RotateCw } from "lucide-react";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { errorMessage } from "../api/client";
import { ErrorState, Icon } from "../components/ui";
import { useTask } from "../components/useTask";
import { useSendSignal } from "./useSendSignal";
import "./account-extras.css";

export function VerificationMethods() {
  const { api, session } = useApp();
  const query = useQuery({
    queryKey: ["verification-methods"],
    queryFn: () => api.verified(),
    enabled: !!session,
  });
  return (
    <section className="ew-verification-methods" aria-label="认证记录">
      <header className="ew-verification-methods-heading">
        <h3>认证记录</h3>
        {!query.isPending && (
          <button
            type="button"
            aria-label={query.isError ? "重新读取认证记录" : "刷新认证记录"}
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RotateCw size={14} aria-hidden="true" />
            {query.isFetching ? "刷新中…" : query.isError ? "重试" : "刷新记录"}
          </button>
        )}
      </header>
      {query.isPending ? (
        <span role="status">正在读取认证记录…</span>
      ) : query.isError ? (
        <span role="alert">{errorMessage(query.error)}</span>
      ) : (
        <div className="ew-verification-methods-list">
          {query.data.length ? (
            query.data.map((method) => (
              <span key={method} className="ew-method-badge">
                <Check size={16} aria-hidden="true" />
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
    </section>
  );
}

export function MobileBinding() {
  const { api, user, refreshMe } = useApp(),
    getSignal = useSendSignal(),
    [mobile, setMobile] = useState(""),
    [sentTo, setSentTo] = useState(""),
    [until, setUntil] = useState(0),
    [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () =>
      setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    if (until <= Date.now()) return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until]);
  const send = useTask("验证码已发送"),
    bind = useTask("手机号已绑定", refreshMe);
  return (
    <section className="settings-card">
      <div className="section-title">
        <h2>绑定手机号</h2>
        <Icon name="shield" />
      </div>
      <p className="section-caption">
        {user?.phone
          ? `当前手机号：${user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}`
          : "绑定后可在平台支持的场景中验证账号。"}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          bind.run(async () => {
            if (sentTo !== mobile)
              throw new Error("请先为当前手机号获取验证码。");
            await api.bindMobile(mobile, String(d.get("code") || ""));
            setSentTo("");
          });
        }}
      >
        <label className="form-label" htmlFor="bind-mobile">
          手机号
        </label>
        <input
          className="field"
          id="bind-mobile"
          type="tel"
          autoComplete="tel"
          pattern="1[3-9][0-9]{9}"
          maxLength={11}
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          required
        />
        <button
          type="button"
          className="text-link"
          disabled={send.isPending || (until > Date.now() && sentTo === mobile)}
          onClick={() => {
            const input = document.getElementById(
              "bind-mobile",
            ) as HTMLInputElement;
            if (input.reportValidity())
              send.run(async () => {
                await api.sendMobileCode(mobile, getSignal());
                setSentTo(mobile);
                setUntil(Date.now() + 60000);
              });
          }}
        >
          {seconds && sentTo === mobile
            ? `${seconds}s 后重发`
            : send.isPending
              ? "正在验证并发送…"
              : "发送验证码"}
        </button>
        <label className="form-label" htmlFor="bind-code">
          6 位验证码
        </label>
        <input
          className="field"
          name="code"
          id="bind-code"
          autoComplete="one-time-code"
          minLength={6}
          maxLength={6}
          required
        />
        {send.error && <ErrorState error={send.error} />}
        {bind.error && <ErrorState error={bind.error} />}
        <button
          className="btn btn-primary"
          disabled={bind.isPending || !sentTo}
        >
          确认绑定手机号
        </button>
        {isDemo && (
          <p className="section-caption">
            本地模拟验证，验证码为 123456，绑定只保存在演示数据中。
          </p>
        )}
      </form>
    </section>
  );
}
