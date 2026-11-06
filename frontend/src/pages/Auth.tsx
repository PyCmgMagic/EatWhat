import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { classifyAuth } from "../api/service";
import { ErrorState, Icon, Intro } from "../components/ui";
import { useTask } from "../components/useTask";
import {
  PolicyConsent,
  usePolicyConsent,
  ConsentRecovery,
} from "../features/Consent";
import { setConsentProof, clearConsentProof } from "../app/consent";
export default function Auth() {
  const policyConsent = usePolicyConsent();
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
      const accepted = await policyConsent.requireAcceptance();
      if (register && password !== String(d.get("confirmPassword") || ""))
        throw new Error("两次输入的密码不一致。");
      clearConsentProof();
      const reply = register
        ? await api.register({
            userName: username,
            password,
            device: "WEB",
            ...accepted,
          })
        : await api.login({ userName: username, password, device: "WEB" });
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
        setConsentProof(outcome.proof);
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
                    policyConsent.setAgreed(false);
                    task.reset();
                  }}
                >
                  欢迎回来
                </button>
                <button
                  className={register ? "active" : ""}
                  onClick={() => {
                    setRegister(true);
                    policyConsent.setAgreed(false);
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
                <PolicyConsent consent={policyConsent} busy={task.isPending} />
                {task.error && <ErrorState error={task.error} />}
                {check.error && <ErrorState error={check.error} />}
                <button
                  className="btn btn-primary full-width"
                  disabled={task.isPending || !policyConsent.canSubmit}
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
                  : "找回密码功能正在准备中；如需帮助，请联系平台管理员。"}
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
function ConsentStep(_props: {
  proof?: string;
  message: string;
  onBack: () => void;
}) {
  return <ConsentRecovery />;
}
