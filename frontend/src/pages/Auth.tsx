import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { classifyAuth } from "../api/service";
import { ErrorState, Icon, Intro, Loading } from "../components/ui";
import { useTask } from "../components/useTask";
export default function Auth() {
  const { api, signIn, toast, session } = useApp(),
    navigate = useNavigate(),
    [register, setRegister] = useState(false),
    [consent, setConsent] = useState<{
      proof?: string;
      message: string;
    } | null>(null);
  const task = useTask(),
    check = useTask("这个用户名可以使用");
  const [params] = useSearchParams();
  const next = params.get("next");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      d = new FormData(form),
      username = String(d.get("username") || "").trim(),
      password = String(d.get("password") || "");
    task.run(async () => {
      if (register && password !== String(d.get("confirmPassword") || ""))
        throw new Error("两次输入的密码不一致。");
      const reply = register
        ? await api.register({ username, password, device: "WEB" })
        : await api.login({ username, password, device: "WEB" });
      const outcome = classifyAuth(reply);
      if (outcome.kind === "session") {
        await signIn(outcome.session);
        form.reset();
        toast(register ? "欢迎加入校园食友圈" : "欢迎回来，记得好好吃饭");
        navigate(
          next?.startsWith("/") &&
            !next.startsWith("//") &&
            !next.startsWith("/auth")
            ? next
            : "/",
        );
      } else if (outcome.kind === "consent") {
        form.reset();
        setConsent(outcome);
      } else throw new Error(outcome.message);
    });
  }
  if (session)
    return (
      <>
        <Intro
          title="欢迎回来，记得好好吃饭。"
          subtitle="你已经登录，可以继续发现和整理好味道。"
        />
        <Link to="/me" className="btn btn-primary">
          进入我的主页
          <Icon name="arrow" />
        </Link>
      </>
    );
  return (
    <>
      <Intro
        title={
          consent ? "继续之前，了解你的授权。" : "每一顿，都想有点小期待。"
        }
        subtitle="和同校的你，一起发现、分享与收藏好味道。"
      />
      <div className="auth-layout">
        <aside className="auth-art">
          <span className="eyebrow">山软 · 今天吃什么</span>
          <h2>
            一顿好饭，
            <br />
            让日子有滋有味。
          </h2>
          <img src="/assets/dumplings.jpg" alt="热气腾腾的小笼包" />
          <span>SHANRUAN FOOD CLUB · 好好吃饭，认真生活。</span>
        </aside>
        <div className="auth-card">
          {consent ? (
            <ConsentStep
              proof={consent.proof}
              message={consent.message}
              onBack={() => setConsent(null)}
            />
          ) : (
            <>
              <div className="auth-tabs">
                <button
                  className={register ? "" : "active"}
                  onClick={() => {
                    setRegister(false);
                    task.reset();
                  }}
                >
                  欢迎回来
                </button>
                <button
                  className={register ? "active" : ""}
                  onClick={() => {
                    setRegister(true);
                    task.reset();
                  }}
                >
                  加入食友圈
                </button>
              </div>
              <h2>{register ? "注册一个新账号" : "登录，开启今日份美味"}</h2>
              <form onSubmit={submit} key={register ? "register" : "login"}>
                <div className="field-group">
                  <label className="form-label" htmlFor="auth-username">
                    {register ? "用户名" : "账号"}
                  </label>
                  <input
                    className="field"
                    id="auth-username"
                    name="username"
                    autoComplete="username"
                    minLength={3}
                    maxLength={register ? 10 : 64}
                    pattern={
                      register
                        ? "(?!.*@)(?![0-9]{11}$)[a-zA-Z0-9_]{3,10}"
                        : undefined
                    }
                    placeholder={
                      register
                        ? "3–10 位字母、数字或下划线"
                        : "用户名、邮箱或手机号"
                    }
                    required
                  />
                  {register && (
                    <button
                      type="button"
                      className="text-link"
                      disabled={check.isPending}
                      onClick={() => {
                        const input = document.getElementById(
                          "auth-username",
                        ) as HTMLInputElement;
                        if (input.reportValidity())
                          check.run(() => api.checkUsername(input.value));
                      }}
                    >
                      检查用户名是否可用
                    </button>
                  )}
                </div>
                <div className="field-group">
                  <label className="form-label" htmlFor="auth-password">
                    密码
                  </label>
                  <input
                    className="field"
                    id="auth-password"
                    name="password"
                    type="password"
                    autoComplete={
                      register ? "new-password" : "current-password"
                    }
                    minLength={register ? 6 : 1}
                    maxLength={register ? 64 : undefined}
                    placeholder={register ? "6–64 位密码" : "输入你的密码"}
                    required
                  />
                </div>
                {register && (
                  <div className="field-group">
                    <label className="form-label" htmlFor="auth-confirm">
                      确认密码
                    </label>
                    <input
                      className="field"
                      id="auth-confirm"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={6}
                      maxLength={64}
                      required
                    />
                  </div>
                )}
                {task.error && <ErrorState error={task.error} />}
                {check.error && <ErrorState error={check.error} />}
                <button
                  className="btn btn-primary full-width"
                  disabled={task.isPending}
                  type="submit"
                >
                  {task.isPending
                    ? "正在处理…"
                    : register
                      ? "加入校园食友圈"
                      : "登录"}
                  <Icon name="arrow" />
                </button>
              </form>
              <p className="auth-note">
                {register
                  ? "注册后可在账号设置里完成校内身份认证。"
                  : "暂未提供自助找回密码，请联系平台管理员。"}
              </p>
              {import.meta.env.DEV && !isDemo && (
                <a className="text-link" href="/?demo=1">
                  先看看本地演示
                  <Icon name="arrow" />
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
function ConsentStep({
  proof,
  message,
  onBack,
}: {
  proof?: string;
  message: string;
  onBack: () => void;
}) {
  const { api } = useApp(),
    [checked, setChecked] = useState(false),
    [done, setDone] = useState(false),
    q = useQuery({
      queryKey: ["consent-policy"],
      queryFn: () => api.consentPolicy(),
    }),
    task = useTask(undefined, () => setDone(true));
  const url = import.meta.env.VITE_CONSENT_POLICY_URL;
  if (done)
    return (
      <>
        <h2>授权请求已提交</h2>
        <p className="modal-description">
          授权与身份同步可能需要时间。请重新登录；只有服务端返回正式会话后，才会进入账号。
        </p>
        <button className="btn btn-primary" onClick={onBack}>
          返回登录
          <Icon name="arrow" />
        </button>
      </>
    );
  return (
    <>
      <h2>跨站同步与身份授权</h2>
      <p className="modal-description">{message}</p>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <div className="info-strip">
            <div>
              政策版本：{q.data.policyVersion}
              <br />
              站点模式：{q.data.siteMode}
              <br />
              临时授权凭证不会作为登录会话使用。
            </div>
          </div>
          {url ? (
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <span>
                我已阅读并同意
                <a href={url} target="_blank" rel="noopener noreferrer">
                  跨站同步授权政策 ↗
                </a>
              </span>
            </label>
          ) : (
            <p role="status" className="inline-error">
              平台尚未配置授权政策全文，请联系管理员完成配置后继续。
            </p>
          )}
          <button
            className="btn btn-primary"
            disabled={
              !checked ||
              !url ||
              !proof ||
              task.isPending ||
              !q.data.policyVersion
            }
            onClick={() =>
              task.run(() =>
                api.grantConsent({
                  proof,
                  policyVersion: q.data!.policyVersion!,
                }),
              )
            }
          >
            确认授权并继续
          </button>
          {!proof && (
            <p className="section-caption">
              本次响应没有临时授权凭证，请返回校园站点查看账号授权和身份同步状态。
            </p>
          )}
        </>
      )}
      {task.error && <ErrorState error={task.error} />}
      <button className="text-link" onClick={onBack}>
        返回登录
      </button>
    </>
  );
}
