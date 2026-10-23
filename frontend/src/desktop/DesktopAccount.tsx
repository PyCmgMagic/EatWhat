import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { classifyAuth } from "../api/service";
import { useTask } from "../components/useTask";
import { DesignIcon as Icon } from "../mobile/ui";
import {
  getConsentProof,
  setConsentProof,
  clearConsentProof,
} from "../mobile/bridge";
import { MobileBinding } from "../pages/ProfileExtras";
import { ConsentSettings } from "../pages/Settings";
import {
  Avatar,
  Note,
  PageHead,
  PendingPage,
  Section,
  SettingsShell,
  State,
  TaskError,
  pendingPages,
} from "./secondary";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="pc-secondary-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Row({
  title,
  value,
  to,
  action,
}: {
  title: string;
  value: string;
  to?: string;
  action?: string;
}) {
  return (
    <div className="pc-secondary-row">
      <div>
        <b>{title}</b>
        <p>{value}</p>
      </div>
      {to && (
        <Link className="pc-secondary-text-link" to={to}>
          {action || "管理"}
          <Icon name="chevronRight" size={16} />
        </Link>
      )}
    </div>
  );
}
export function DesktopSettingsPage() {
  const path = useLocation().pathname;
  return (
    <SettingsShell>
      {pendingPages[path] ? (
        <PendingPage path={path} />
      ) : path === "/settings/account" ? (
        <Account />
      ) : path === "/settings/password" ? (
        <Password />
      ) : path === "/settings/privacy" ? (
        <Privacy />
      ) : path === "/settings/bind-phone" ? (
        <Binding />
      ) : path === "/verify" ? (
        <Verification />
      ) : (
        <About data={path === "/data-notice"} />
      )}
    </SettingsShell>
  );
}
function Account() {
  const { user } = useApp(),
    [consentOpen, setConsentOpen] = useState(false);
  return (
    <>
      <PageHead
        title="账号与安全"
        detail="账号信息、登录方式与授权，在这里管理。"
        back="/settings"
        crumb="设置"
      />
      <div className="pc-secondary-columns">
        <Section title="你的账号">
          <div className="pc-secondary-identity">
            <Avatar name={user?.userName} src={user?.avatar} />
            <div>
              <b>{user?.userName || "同学"}</b>
              <small>
                {user?.verified ? "学生身份已认证" : "学生身份待认证"}
              </small>
            </div>
            <Link className="pc-secondary-text-link" to="/me/edit">
              编辑资料
            </Link>
          </div>
          <Row
            title="学生认证"
            value={
              user?.verified ? "已完成学生身份认证" : "完成认证，解锁校园分享"
            }
            to="/verify"
            action="查看"
          />
          <Row
            title="手机号"
            value={
              user?.phone
                ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")
                : "尚未绑定"
            }
            to={user?.phone ? "/settings/phone" : "/settings/bind-phone"}
            action={user?.phone ? "换绑" : "去绑定"}
          />
          <Row
            title="登录密码"
            value="定期更新密码，保护你的账号"
            to="/settings/password"
            action="修改"
          />
          <Row
            title="登录设备"
            value="设备管理暂未开放"
            to="/settings/devices"
            action="了解"
          />
          <Row
            title="注销账号"
            value="自助注销暂未开放"
            to="/settings/delete"
            action="了解"
          />
        </Section>
        <Note title="安心分享每一顿" icon="lock">
          <p>请勿向他人透露密码或验证码。在公用电脑使用后，记得退出登录。</p>
          <Link to="/settings/privacy">管理我的公开范围 →</Link>
        </Note>
      </div>
      <Section title="跨站授权与同步" detail="查看当前授权与身份同步状态。">
        <details
          className="pc-secondary-details"
          onToggle={(e) => setConsentOpen(e.currentTarget.open)}
        >
          <summary>查看与管理授权</summary>
          {consentOpen && <ConsentSettings />}
        </details>
      </Section>
    </>
  );
}
function Password() {
  const { api } = useApp(),
    task = useTask("密码已更新");
  return (
    <>
      <PageHead
        title="修改密码"
        detail="使用一个新的密码，保护你的校园美食档案。"
        back="/settings/account"
        crumb="账号与安全"
      />
      <div className="pc-secondary-columns">
        <Section title="设置新密码">
          <form
            className="pc-secondary-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                d = new FormData(form);
              task.run(async () => {
                const oldPassword = String(d.get("old") || ""),
                  newPassword = String(d.get("password") || "");
                if (newPassword !== d.get("confirm"))
                  throw new Error("两次输入的新密码不一致。");
                if (oldPassword === newPassword)
                  throw new Error("新密码需要与当前密码不同。");
                await api.changePassword({ oldPassword, newPassword });
                form.reset();
              });
            }}
          >
            <Field label="当前密码">
              <input
                name="old"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <div className="pc-secondary-field-pair">
              <Field label="新密码" hint="6–64 个字符">
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={64}
                  required
                />
              </Field>
              <Field label="再次输入新密码">
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  maxLength={64}
                  required
                />
              </Field>
            </div>
            <TaskError error={task.error} />
            <div className="pc-secondary-form-footer">
              <Link to="/settings/account">返回账号与安全</Link>
              <button className="pc-button" disabled={task.isPending}>
                {task.isPending ? "正在更新…" : "更新密码"}
              </button>
            </div>
            {task.isSuccess && (
              <p className="pc-secondary-success" role="status">
                密码已更新。
              </p>
            )}
          </form>
        </Section>
        <Note title="记住这个新密码" icon="lock">
          <p>
            建议使用与其他网站不同的密码，不要包含学号、生日等容易猜测的信息。
          </p>
        </Note>
      </div>
    </>
  );
}
function Privacy() {
  const { api, user } = useApp(),
    q = useQuery({
      queryKey: ["user", user?.id],
      queryFn: () => api.otherUser(user!.id!),
      enabled: !!user?.id,
    });
  return (
    <>
      <PageHead
        title="隐私设置"
        detail="决定哪些关注信息可以展示给其他同学。"
        back="/settings"
        crumb="设置"
      />
      {q.isPending || q.isError ? (
        <State
          loading={q.isPending}
          error={q.error}
          retry={() => void q.refetch()}
        />
      ) : q.data.followingsVisible == null || q.data.fansVisible == null ? (
        <State
          title="暂时无法读取公开范围"
          detail="没有读取到当前设置，请重新加载后再修改。"
        >
          <button className="pc-button light" onClick={() => void q.refetch()}>
            重新加载
          </button>
        </State>
      ) : (
        <PrivacyForm
          key={`${user?.id}-${q.data.followingsVisible}-${q.data.fansVisible}`}
          following={q.data.followingsVisible}
          follower={q.data.fansVisible}
        />
      )}
    </>
  );
}
function PrivacyForm({
  following,
  follower,
}: {
  following: boolean;
  follower: boolean;
}) {
  const { api } = useApp(),
    [values, setValues] = useState({ following, follower }),
    task = useTask("隐私设置已保存", undefined, ["user"]),
    changed = values.following !== following || values.follower !== follower;
  return (
    <div className="pc-secondary-columns">
      <Section title="关注关系可见性">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            task.run(() => api.privacy(values));
          }}
        >
          {(
            [
              {
                key: "following",
                title: "公开我的关注列表",
                detail: "其他同学可以查看你关注的食友。",
              },
              {
                key: "follower",
                title: "公开我的粉丝列表",
                detail: "其他同学可以查看关注你的食友。",
              },
            ] as const
          ).map((x) => (
            <label className="pc-secondary-switch-row" key={x.key}>
              <span>
                <b>{x.title}</b>
                <small>{x.detail}</small>
              </span>
              <input
                role="switch"
                type="checkbox"
                checked={values[x.key]}
                disabled={task.isPending}
                onChange={(e) =>
                  setValues({ ...values, [x.key]: e.target.checked })
                }
              />
            </label>
          ))}
          <TaskError error={task.error} />
          <div className="pc-secondary-form-footer">
            <span>{changed ? "有尚未保存的修改" : "当前设置已保存"}</span>
            <button className="pc-button" disabled={!changed || task.isPending}>
              {task.isPending ? "正在保存…" : "保存可见性"}
            </button>
          </div>
        </form>
      </Section>
      <Note title="由你决定公开范围" icon="lock">
        <p>
          关闭后，其他同学无法查看对应列表。你依然可以在自己的主页查看和管理关注关系。
        </p>
        <Link to="/follows">管理关注与粉丝 →</Link>
      </Note>
    </div>
  );
}
function Binding() {
  return (
    <>
      <PageHead
        title="绑定手机号"
        detail="完成验证码确认，将手机号与你的账号关联。"
        back="/settings/account"
        crumb="账号与安全"
      />
      <div className="pc-secondary-columns">
        <Section title="验证你的手机号">
          <MobileBinding />
        </Section>
        <Note title="验证码只给自己看" icon="phone">
          <p>
            请使用你本人长期使用的号码。已经绑定号码时，更换号码需使用换绑流程。
          </p>
          <Link to="/settings/phone">了解换绑手机号 →</Link>
        </Note>
      </div>
    </>
  );
}
function Verification() {
  const { api, user, me, refreshMe } = useApp(),
    send = useTask("验证邮件已发送，请到邮箱完成验证"),
    url = import.meta.env.VITE_SDU_AUTH_URL;
  return (
    <>
      <PageHead
        title="学生认证"
        detail="和同校的你，一起发现、分享与收藏。"
        back="/settings/account"
        crumb="账号与安全"
      />
      <div className="pc-secondary-columns">
        <Section title="校内身份">
          <div
            className={`pc-secondary-verification ${user?.verified ? "verified" : ""}`}
          >
            <Icon name="verify" size={35} />
            <div>
              <b>{user?.verified ? "学生身份已认证" : "等待完成学生认证"}</b>
              <p>
                {user?.verified
                  ? "你可以浏览、收藏和分享喜欢的菜品。"
                  : "选择一种认证方式，完成后刷新状态。"}
              </p>
            </div>
            <span className="pc-secondary-badge">
              {user?.verified ? "已认证" : "待认证"}
            </span>
          </div>
          {user?.verified ? (
            <div className="pc-secondary-form-footer">
              <Link to="/">去发现好味道</Link>
              <Link className="pc-button" to="/me">
                回到我的主页
              </Link>
            </div>
          ) : (
            <>
              <div className="pc-secondary-row">
                <div>
                  <b>学校统一认证</b>
                  <p>
                    {url
                      ? "在学校认证页面完成身份确认。"
                      : "学校认证入口还未开放，请使用邮箱认证。"}
                  </p>
                </div>
                {url && (
                  <a
                    className="pc-button light"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    前往认证 ↗
                  </a>
                )}
              </div>
              <form
                className="pc-secondary-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget),
                    email = String(d.get("email") || "").trim();
                  send.run(async () => {
                    const domain = import.meta.env.VITE_VERIFY_EMAIL_DOMAIN;
                    if (
                      domain &&
                      !email.toLowerCase().endsWith("@" + domain.toLowerCase())
                    )
                      throw new Error(`请使用 @${domain} 邮箱。`);
                    await api.sendEmail(email);
                  });
                }}
              >
                <Field
                  label="使用邮箱认证"
                  hint={
                    isDemo
                      ? "演示模式不会发送真实邮件。"
                      : "收到验证邮件后，请按照邮件中的步骤完成认证。"
                  }
                >
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="输入你的认证邮箱"
                    required
                  />
                </Field>
                <TaskError error={send.error} />
                <button
                  className="pc-button"
                  disabled={isDemo || send.isPending}
                >
                  {send.isPending ? "正在发送…" : "发送认证邮件"}
                </button>
              </form>
            </>
          )}
          <div className="pc-secondary-row">
            <div>
              <b>已经完成认证？</b>
              <p>刷新后查看最新的认证结果。</p>
            </div>
            <button
              className="pc-button light"
              disabled={me.isFetching}
              onClick={refreshMe}
            >
              {me.isFetching ? "正在刷新…" : "刷新认证状态"}
            </button>
          </div>
          <TaskError error={me.error} />
        </Section>
        <Note title="认证后，开启更多美味" icon="verify">
          <ul>
            <li>浏览同学们分享的菜品</li>
            <li>收藏好味道并整理个人标签</li>
            <li>分享菜品，参与校园美食交流</li>
          </ul>
        </Note>
      </div>
    </>
  );
}
function About({ data }: { data: boolean }) {
  return (
    <>
      <PageHead
        title={data ? "数据存放说明" : "关于山软今天吃什么"}
        detail={
          data ? "了解账号信息与分享内容的保存方式。" : "好好吃饭，认真生活。"
        }
        back="/settings"
        crumb="设置"
      />
      {data ? (
        <div className="pc-secondary-columns">
          <Section title="你的资料与内容">
            <div className="pc-secondary-prose">
              <h3>账号信息与分享</h3>
              <p>
                正式使用时，账号资料、菜品、店铺、收藏和关注关系由平台服务保存。你可以通过个人中心管理已经开放的资料与内容。
              </p>
              <h3>本机演示数据</h3>
              <p>
                演示模式使用浏览器中的隔离数据，评论等本地演示内容保存在当前浏览器。清理浏览器数据后，这些内容可能丢失；它们不会同步成正式分享。
              </p>
              <h3>登录状态</h3>
              <p>
                正式登录凭证保存在当前标签页会话中。使用公用电脑后，请主动退出登录。
              </p>
              <h3>隐私与数据处理</h3>
              <p>
                关注与粉丝列表可以设置公开范围。需要进一步处理账号或数据时，请联系平台管理员。
              </p>
            </div>
          </Section>
          <Note title="管理你的公开范围" icon="lock">
            <p>分享美味的同时，也可以决定哪些关注信息向其他同学展示。</p>
            <Link to="/settings/privacy">前往隐私设置 →</Link>
          </Note>
        </div>
      ) : (
        <>
          <div className="pc-secondary-about">
            <div>
              <span className="pc-brand-symbol">
                <Icon name="bowl" size={34} />
              </span>
              <h2>
                山软
                <br />
                今天吃什么
              </h2>
              <p>
                把吃过的好味道分享给同学，
                <br />
                也把想吃的下一餐整理好。
              </p>
              <Link className="pc-button" to="/">
                发现今天的好味道
                <Icon name="chevronRight" size={17} />
              </Link>
            </div>
            <img src="/prototype/assets/dishes/yuntun.svg" alt="一碗鲜虾云吞" />
          </div>
          <Section title="你的校园美食小档案">
            <Row
              title="分享与推荐"
              value="记录值得一吃的菜，发现同学的私藏。"
              to="/publish"
              action="分享一道菜"
            />
            <Row
              title="收藏与分类"
              value="用个人标签整理收藏，想吃的时候更容易找到。"
              to="/favorites"
              action="我的收藏"
            />
            <Row
              title="资料与隐私"
              value="由你决定如何介绍自己，以及公开哪些关注信息。"
              to="/data-notice"
              action="数据说明"
            />
          </Section>
        </>
      )}
    </>
  );
}

export function DesktopAuth() {
  const path = useLocation().pathname;
  return (
    <div className="pc-secondary-auth" data-pc-secondary="auth">
      <aside className="pc-secondary-auth-art">
        <Link to="/" className="pc-secondary-back">
          <Icon name="back" size={17} />
          回到发现
        </Link>
        <span className="pc-eyebrow">山软 · 今天吃什么</span>
        <h1>
          同校的你，
          <br />
          一起好好吃饭。
        </h1>
        <p>
          发现一份好味道，
          <br />
          也分享你的私藏。
        </p>
        <img src="/prototype/assets/dishes/yuntun.svg" alt="一碗鲜虾云吞" />
        <small>好好吃饭，认真生活。</small>
      </aside>
      <section className="pc-secondary-auth-content" key={path}>
        {pendingPages[path] ? (
          <PendingPage path={path} />
        ) : path === "/auth/consent" ? (
          <Consent />
        ) : (
          <AuthForm register={path === "/auth/username-register"} />
        )}
      </section>
    </div>
  );
}
function AuthForm({ register }: { register: boolean }) {
  const { api, signIn, session } = useApp(),
    nav = useNavigate(),
    loc = useLocation(),
    task = useTask(),
    check = useTask("这个用户名可以使用"),
    [checked, setChecked] = useState(false);
  const next = new URLSearchParams(loc.search).get("next"),
    suffix = next ? "?next=" + encodeURIComponent(next) : "";
  async function authenticate(username: string, password: string) {
    const reply = register
      ? await api.register({ username, password, device: "WEB" })
      : await api.login({ username, password, device: "WEB" });
    const result = classifyAuth(reply);
    if (result.kind === "session") {
      await signIn(result.session);
      nav(
        next?.startsWith("/") &&
          !next.startsWith("//") &&
          !next.startsWith("/auth")
          ? next
          : register
            ? "/verify"
            : "/",
      );
    } else if (result.kind === "consent") {
      setConsentProof(result.proof);
      nav("/auth/consent");
    } else throw new Error(result.message);
  }
  if (session)
    return (
      <>
        <span className="pc-secondary-badge">已登录</span>
        <h2>
          欢迎回来，
          <br />
          记得好好吃饭。
        </h2>
        <p className="pc-secondary-copy">你已经登录，可以继续浏览和分享。</p>
        <Link className="pc-button" to="/me">
          进入我的主页
        </Link>
      </>
    );
  return (
    <>
      <nav className="pc-secondary-auth-tabs" aria-label="登录与注册">
        <Link
          aria-current={!register ? "page" : undefined}
          to={"/auth/password" + suffix}
        >
          欢迎回来
        </Link>
        <Link
          aria-current={register ? "page" : undefined}
          to={"/auth/username-register" + suffix}
        >
          加入食友圈
        </Link>
      </nav>
      <h2>{register ? "创建你的账号" : "登录，开启今日份美味"}</h2>
      <p className="pc-secondary-copy">
        {register
          ? "注册后，完成学生认证就能参与分享。"
          : "用用户名、邮箱或手机号与密码登录。"}
      </p>
      <form
        className="pc-secondary-form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget),
            username = String(d.get("username") || "").trim(),
            password = String(d.get("password") || "");
          task.run(async () => {
            if (register) {
              if (password !== d.get("confirm"))
                throw new Error("两次输入的密码不一致。");
              await api.checkUsername(username);
            }
            await authenticate(username, password);
          });
        }}
      >
        <Field
          label={register ? "用户名" : "账号"}
          hint={register ? "3–10 位字母、数字或下划线" : undefined}
        >
          <input
            id="pc-auth-username"
            name="username"
            autoComplete="username"
            minLength={register ? 3 : 1}
            maxLength={register ? 10 : 64}
            pattern={
              register ? "(?!.*@)(?![0-9]{11}$)[a-zA-Z0-9_]{3,10}" : undefined
            }
            required
            onChange={() => setChecked(false)}
            placeholder={
              register ? "为自己起个账号名" : "用户名 / 邮箱 / 手机号"
            }
          />
        </Field>
        {register && (
          <button
            type="button"
            className="pc-secondary-text-link"
            disabled={check.isPending || task.isPending}
            onClick={() => {
              const input = document.getElementById(
                "pc-auth-username",
              ) as HTMLInputElement;
              if (input.reportValidity())
                check.run(async () => {
                  await api.checkUsername(input.value.trim());
                  setChecked(true);
                });
            }}
          >
            {checked ? "用户名可用" : "检查用户名是否可用"}
          </button>
        )}
        <Field label="密码" hint={register ? "6–64 个字符" : undefined}>
          <input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 6 : 1}
            maxLength={register ? 64 : undefined}
            required
          />
        </Field>
        {register ? (
          <Field label="再次输入密码">
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={6}
              maxLength={64}
              required
            />
          </Field>
        ) : (
          <Link
            className="pc-secondary-text-link pc-secondary-auth-forgot"
            to="/auth/forgot"
          >
            忘记密码？
          </Link>
        )}
        <TaskError error={task.error || check.error} />
        <button className="pc-button" disabled={task.isPending}>
          {task.isPending ? "正在处理…" : register ? "注册账号" : "登录"}
          <Icon name="chevronRight" size={17} />
        </button>
      </form>
      {isDemo && !register && (
        <button
          className="pc-button light pc-secondary-demo-login"
          disabled={task.isPending}
          onClick={() =>
            task.run(() => authenticate("mock_student", "mock-password"))
          }
        >
          使用演示账号登录
        </button>
      )}
      <p className="pc-secondary-auth-footnote">
        {register ? (
          <>
            手机验证码注册暂未开放。
            <Link to="/auth/password">已有账号，去登录</Link>
          </>
        ) : (
          <>
            还没有账号？
            <Link to={"/auth/username-register" + suffix}>注册一个</Link>
          </>
        )}
      </p>
    </>
  );
}
function Consent() {
  const { api } = useApp(),
    [agreed, setAgreed] = useState(false),
    [done, setDone] = useState(false),
    task = useTask(undefined, () => {
      clearConsentProof();
      setDone(true);
    }),
    q = useQuery({
      queryKey: ["consent-policy"],
      queryFn: () => api.consentPolicy(),
    }),
    url = import.meta.env.VITE_CONSENT_POLICY_URL;
  useEffect(() => {
    setAgreed(false);
  }, [q.data?.policyVersion]);
  return (
    <>
      <span className="pc-secondary-badge">授权确认</span>
      <h2>
        继续之前，
        <br />
        再确认一次。
      </h2>
      <p className="pc-secondary-copy">
        了解当前的跨站同步政策，确认后继续完成登录。
      </p>
      {q.isPending || q.isError ? (
        <State
          loading={q.isPending}
          error={q.error}
          retry={() => void q.refetch()}
        />
      ) : done ? (
        <State title="授权请求已提交" detail="请重新登录，查看最新的账号状态。">
          <Link className="pc-button" to="/auth/password">
            返回登录
          </Link>
        </State>
      ) : (
        <>
          <div className="pc-secondary-policy">
            <b>当前政策版本</b>
            <span>{q.data.policyVersion || "暂未提供"}</span>
          </div>
          {url ? (
            <a
              className="pc-secondary-text-link"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              阅读完整政策 ↗
            </a>
          ) : (
            <p className="pc-secondary-copy">
              政策全文暂未开放，当前无法提交同意。
            </p>
          )}
          <label className="pc-secondary-checkbox">
            <input
              type="checkbox"
              checked={agreed}
              disabled={task.isPending}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            我已阅读并同意当前政策
          </label>
          {!getConsentProof() && (
            <p className="pc-secondary-copy">
              请先返回登录，获取本次授权确认信息。
            </p>
          )}
          <TaskError error={task.error} />
          <button
            className="pc-button"
            disabled={
              !agreed ||
              !url ||
              !getConsentProof() ||
              !q.data.policyVersion ||
              task.isPending
            }
            onClick={() =>
              task.run(() =>
                api.grantConsent({
                  proof: getConsentProof(),
                  policyVersion: q.data!.policyVersion!,
                }),
              )
            }
          >
            {task.isPending ? "正在确认…" : "同意并继续"}
          </button>
        </>
      )}
      <Link className="pc-secondary-text-link" to="/auth/password">
        返回登录
      </Link>
    </>
  );
}
