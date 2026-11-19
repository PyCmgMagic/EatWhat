import { useSendSignal } from "../features/useSendSignal";
import { BRAND_SLOGAN } from "../app/brand";
import PrivacySettings from "../features/PrivacySettings";
import Personalization from "../theme/Personalization";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../app/state";
import { useAuthBusy, useAuthFlow } from "../app/auth-dialog";
import { localDestination } from "../app/navigation";
import { isDemo } from "../app/runtime";
import { classifyAuth } from "../api/service";
import { useTask } from "../components/useTask";
import { DesignIcon as Icon } from "../mobile/ui";
import { MobileBinding, VerificationMethods } from "../features/AccountExtras";
import { SsoStart } from "../features/Account";
import PasswordSettings from "../features/PasswordSettings";
import "../features/student-verification.css";
import {
  readVerificationCallback,
  rememberVerificationReturn,
} from "../app/verification-return";
import VerificationResult from "../features/VerificationResult";
import {
  Note,
  PageHead,
  PendingPage,
  Section,
  SettingsShell,
  TaskError,
  pendingPages,
} from "./secondary";

function Field({
  label,
  children,
  hint,
  action,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <label className="pc-secondary-field">
      <span className={action ? "ew-auth-field-heading" : undefined}>
        {label}
        {action}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Row({
  icon,
  title,
  value,
  to,
  action,
}: {
  icon: string;
  title: string;
  value?: string;
  to?: string;
  action?: string;
}) {
  return (
    <div className="pc-secondary-row">
      <span className="pc-settings-row-icon">
        <Icon name={icon} size={19} />
      </span>
      <div className="pc-settings-row-copy">
        <b>{title}</b>
        {value && <p>{value}</p>}
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
      ) : path === "/settings/personalization" ? (
        <>
          <PageHead title="个性化" back="/settings" crumb="设置" />
          <Personalization />
        </>
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
  const { user } = useApp();
  return (
    <>
      <PageHead title="账号与安全" back="/settings" crumb="设置" />
      <section
        className="pc-secondary-section pc-settings-account"
        aria-label="账号信息"
      >
        <header className="pc-settings-account-head">
          <h2>账号信息</h2>
          <p>用于登录、安全验证与身份展示</p>
        </header>
        <Row
          icon="idcard"
          title="登录名"
          value={
            user?.hasUsername === false
              ? "未设置"
              : user?.userName || "状态待确认"
          }
          to={user?.hasUsername === false ? "/settings/username" : undefined}
          action="去设置"
        />
        <Row
          icon="phone"
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
          icon="key"
          title="登录密码"
          value={
            user?.hasPassword === false
              ? "未设置"
              : user?.hasPassword === true
                ? "已设置"
                : "状态待确认"
          }
          to="/settings/password"
          action={user?.hasPassword === false ? "去设置" : "修改"}
        />
        <Row
          icon="computer"
          title="登录设备"
          to="/settings/devices"
          action="管理"
        />
        <Row
          icon="verify"
          title="学生认证"
          value={
            user?.verified === true
              ? "已认证"
              : user?.verified === false
                ? "未认证"
                : "状态待确认"
          }
          to="/verify"
          action={user?.verified === false ? "去认证" : "查看"}
        />
        <Row
          icon="logout"
          title="注销账号"
          value="了解注销流程或提交注销申请"
          to="/settings/delete"
          action="查看"
        />
      </section>
    </>
  );
}
function Password() {
  const { user } = useApp();
  return (
    <>
      <PageHead
        title={user?.hasPassword === false ? "设置密码" : "修改密码"}
        back="/settings/account"
        crumb="账号与安全"
      />
      <PasswordSettings key={user?.id} />
    </>
  );
}
function Privacy() {
  return (
    <>
      <PageHead title="隐私设置" back="/settings" crumb="设置" />
      <PrivacySettings />
    </>
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
  const callback = readVerificationCallback(useLocation().search);
  return callback ? (
    <VerificationResult callback={callback} />
  ) : (
    <VerificationForm />
  );
}
function VerificationForm() {
  const getSignal = useSendSignal();
  const location = useLocation();
  const returnTo = localDestination(
    new URLSearchParams(location.search).get("next"),
  );
  const { api, user, me, refreshMe } = useApp(),
    send = useTask("认证邮件已发送，请到学校邮箱继续完成认证");
  useEffect(() => {
    if (user?.verified) return;
    let lastRefresh = 0;
    const refresh = () => {
      if (
        document.visibilityState !== "visible" ||
        Date.now() - lastRefresh < 1000
      )
        return;
      lastRefresh = Date.now();
      refreshMe();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user?.verified, refreshMe]);
  return (
    <>
      <PageHead
        title="学生认证"
        detail={
          user?.verified
            ? "学生身份已确认，可以继续探索校园美食。"
            : "学校统一认证或学校邮箱认证，完成其中一种即可。"
        }
        back={returnTo ?? "/settings/account"}
        crumb={returnTo ? "返回原页面" : "账号与安全"}
      />
      {user?.verified ? (
        <div className="verify-done">
          <section
            className="verify-done-main"
            aria-labelledby="verify-done-title"
          >
            <div className="verify-done-hero">
              <span className="verify-done-badge" aria-hidden="true">
                <Icon name="verify" size={26} />
              </span>
              <div className="verify-done-copy">
                <h2 id="verify-done-title">学生身份已认证</h2>
                <p>收藏、喜欢和分享已开启，可以继续和同学交流校园美食。</p>
              </div>
            </div>
            <ul className="verify-done-benefits">
              <li>
                <Icon name="bookmark" size={15} />
                收藏和喜欢菜品
              </li>
              <li>
                <Icon name="tag" size={15} />
                添加标签，整理喜欢的口味
              </li>
              <li>
                <Icon name="share" size={15} />
                分享菜品，参与校园美食交流
              </li>
            </ul>
            <div className="verify-done-actions">
              <Link className="pc-button" to={returnTo ?? "/me"}>
                {returnTo ? "返回原页面" : "回到我的主页"}
              </Link>
              <Link className="verify-done-link" to="/">
                去发现好味道
                <Icon name="chevronRight" size={15} />
              </Link>
            </div>
            <TaskError error={me.error} />
          </section>
          <aside className="verify-done-aside">
            <VerificationMethods />
          </aside>
        </div>
      ) : (
        <div className="pc-secondary-columns student-verification">
          <Section title="两种方式，任选其一">
            <div className="pc-secondary-verification">
              <Icon name="verify" size={35} />
              <div>
                <b>完成一种方式即可</b>
                <p>以下两种方式任选其一，无需全部完成。</p>
              </div>
              <span className="pc-secondary-badge">未认证</span>
            </div>
            <section
              className="verification-option"
              aria-labelledby="verification-sso-title"
            >
              <h3 id="verification-sso-title">学校统一认证</h3>
              <p>使用学校统一身份账号，在学校认证页面完成登录。</p>
              <SsoStart returnTo={returnTo ?? "/settings/account"} />
            </section>
            <div className="verification-or">或，选择学校邮箱认证</div>
            <section
              className="verification-option"
              aria-labelledby="verification-email-title"
            >
              <h3 id="verification-email-title">学校邮箱认证</h3>
              <p>使用你本人的学校邮箱，收取邮件并按提示完成认证。</p>
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
                    await api.sendEmail(email, getSignal());
                    rememberVerificationReturn(
                      user?.id,
                      returnTo ?? "/settings/account",
                    );
                  });
                }}
              >
                <Field
                  label="学校邮箱地址"
                  hint={
                    isDemo
                      ? "演示模式不会发送真实邮件。"
                      : import.meta.env.VITE_VERIFY_EMAIL_DOMAIN
                        ? `请使用 @${import.meta.env.VITE_VERIFY_EMAIL_DOMAIN} 邮箱。`
                        : "请填写学校邮箱，不要使用个人邮箱。"
                  }
                >
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="输入你的学校邮箱"
                    required
                  />
                </Field>
                {send.isSuccess && (
                  <p className="verification-email-sent" role="status">
                    邮件已发送，还差最后一步：打开学校邮箱，按邮件提示完成认证，再回到这里刷新认证状态。无需再进行学校统一认证。
                  </p>
                )}
                <TaskError error={send.error} />
                <button
                  className="pc-button"
                  disabled={send.isPending || send.isSuccess}
                >
                  {send.isPending ? "正在发送…" : "发送认证邮件"}
                </button>
              </form>
            </section>
            <div className="pc-secondary-row verification-refresh">
              <div>
                <b>在学校页面或邮箱中完成后</b>
                <p>回到这里刷新认证状态，成功后即可使用收藏等功能。</p>
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
          <Note title="认证后可以" icon="verify">
            <ul>
              <li>收藏和喜欢菜品</li>
              <li>添加标签，整理喜欢的口味</li>
              <li>分享菜品，参与校园美食交流</li>
            </ul>
          </Note>
        </div>
      )}
    </>
  );
}
function About({ data }: { data: boolean }) {
  return (
    <>
      <PageHead
        title={data ? "数据存放说明" : "关于我们"}
        detail={data ? "了解账号信息与分享内容的保存方式。" : BRAND_SLOGAN}
        back={data ? "/settings/about" : "/settings"}
        crumb={data ? "关于我们" : "设置"}
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
        <div className="about-page">
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
          <Section
            title="我们在做什么"
            detail="一个帮山软同学决定「今天吃什么」的小工具。"
          >
            <div className="pc-secondary-prose">
              <h3>先定位置和饭点，再给一道菜</h3>
              <p>
                选好校区、饭点和堂食或外卖之后，首页会从同学们分享过的菜品里挑出今天值得吃的那一道，菜品背后的店、距离和推荐率也一起给出。
              </p>
              <h3>内容都来自校园里的食友</h3>
              <p>
                菜品、店铺、推荐率与评价都由同学自己分享和投票产生，不做广告位；发现信息不准，随时可以用纠错告诉我们。
              </p>
              <h3>把想吃的好味道存下来</h3>
              <p>
                收藏、口味偏好、浏览足迹和成长等级，让下一次决定快一点，也把吃过的好味道留成自己的小档案。
              </p>
            </div>
          </Section>
          <Section title="制作团队" detail="一群爱吃、也爱折腾的同学。">
            <div className="pc-secondary-prose">
              <p>
                「山软今天吃什么」由山软的同学在课余时间一起做出来：一起选题、一起设计、一起写代码，也一起去食堂试吃。
              </p>
            </div>
            <div className="pc-secondary-row">
              <div>
                <b>产品与设计</b>
                <p>想清楚「每天该吃什么」这件事，也把它做得好看。</p>
              </div>
            </div>
            <div className="pc-secondary-row">
              <div>
                <b>开发与体验</b>
                <p>把推荐、地图和分享的细节磨到顺手。</p>
              </div>
            </div>
            <div className="pc-secondary-row">
              <div>
                <b>内容与运营</b>
                <p>整理校园店铺与菜品信息，处理纠错与反馈。</p>
              </div>
            </div>
          </Section>
          <div className="pc-secondary-columns about-columns">
            <Note title="关于这份数据" icon="lock">
              <p>账号资料、分享内容与关注关系的保存方式。</p>
              <Link to="/data-notice">查看数据存放说明 →</Link>
            </Note>
            <Note title="想一起做点什么" icon="feedback">
              <p>发现问题，或者有想法想告诉团队，都可以直接留言。</p>
              <Link to="/feedback">前往意见反馈 →</Link>
            </Note>
          </div>
        </div>
      )}
    </>
  );
}

export function AuthForm({ compact = false }: { compact?: boolean }) {
  const { location: loc, finish } = useAuthFlow();
  const { api, signIn, session } = useApp(),
    task = useTask(),
    [showPassword, setShowPassword] = useState(false);
  useAuthBusy(task.isPending);
  const next = new URLSearchParams(loc.search).get("next"),
    suffix = next ? "?next=" + encodeURIComponent(next) : "";
  async function authenticate(username: string, password: string) {
    const reply = await api.login({
      userName: username,
      password,
      device: "WEB",
    });
    const result = classifyAuth(reply);
    if (result.kind === "session") {
      await signIn(result.session);
      finish("/");
    } else throw new Error(result.message);
  }
  if (session)
    return (
      <>
        <span className="pc-secondary-badge">已登录</span>
        <h2>欢迎回来</h2>
        <p className="pc-secondary-copy">你已经登录，可以继续浏览和分享。</p>
        <Link className="pc-button" to="/me">
          进入我的主页
        </Link>
      </>
    );
  return (
    <>
      {!compact && (
        <>
          <nav className="pc-secondary-auth-tabs" aria-label="登录与注册">
            <Link aria-current="page" to={"/auth" + suffix}>
              欢迎回来
            </Link>
            <Link to={"/auth/register" + suffix}>加入食友圈</Link>
          </nav>
          <h2>登录，开启今日份美味</h2>
          <p className="pc-secondary-copy">
            用用户名、邮箱或手机号与密码登录。
          </p>
        </>
      )}
      <form
        className="pc-secondary-form"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget),
            username = String(d.get("username") || "").trim(),
            password = String(d.get("password") || "");
          task.run(async () => {
            await authenticate(username, password);
          });
        }}
      >
        <Field label="账号">
          <input
            id="pc-auth-username"
            name="username"
            defaultValue={
              (loc.state as { userName?: string } | null)?.userName ?? ""
            }
            autoComplete="username"
            minLength={1}
            maxLength={64}
            required
            placeholder="用户名 / 邮箱 / 手机号"
          />
        </Field>
        <Field
          label="密码"
          action={
            compact ? (
              <Link to={"/auth/forgot" + suffix}>忘记密码？</Link>
            ) : undefined
          }
        >
          <span className="pc-auth-password">
            <input
              name="password"
              aria-label="密码"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              minLength={1}
              required
              placeholder={compact ? "输入登录密码" : undefined}
            />
            <button
              type="button"
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              <Icon name={showPassword ? "eye" : "eyeOff"} size={19} />
            </button>
          </span>
        </Field>
        {!compact && (
          <Link
            className="pc-secondary-text-link pc-secondary-auth-forgot"
            to={"/auth/forgot" + suffix}
          >
            忘记密码？
          </Link>
        )}
        <TaskError error={task.error} />
        <button
          className={compact ? "ew-auth-submit" : "pc-button"}
          disabled={task.isPending}
        >
          {task.isPending ? "正在处理…" : "登录"}
          <Icon name="chevronRight" size={17} />
        </button>
      </form>
      {isDemo && (
        <button
          className={
            compact
              ? "ew-auth-demo-login"
              : "pc-button light pc-secondary-demo-login"
          }
          disabled={task.isPending}
          onClick={() =>
            task.run(() => authenticate("mock_student", "mock-password"))
          }
        >
          使用演示账号登录
        </button>
      )}
      {!compact && (
        <>
          <Link
            className="pc-secondary-text-link"
            to={"/auth/register" + suffix}
          >
            使用手机验证码登录 / 注册 →
          </Link>
          <p className="pc-secondary-auth-footnote">
            还没有账号？
            <Link to={"/auth/register" + suffix}>手机号注册</Link>
          </p>
        </>
      )}
    </>
  );
}
