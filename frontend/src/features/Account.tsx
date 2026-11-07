import { Select } from "../components/Select";
import { MapPin, Utensils } from "lucide-react";
import { useSendSignal } from "./useSendSignal";
import { PasswordConflictRequest } from "./ApiV2";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { authNext } from "../app/navigation";
import { useQuery, useQueryClient, useIsFetching } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useSessionDraft } from "../app/drafts";
import { LoginLink, useAuthBusy, useAuthFlow } from "../app/auth-dialog";
import { isDemo } from "../app/runtime";
import { useTask } from "../components/useTask";
import { classifyAuth } from "../api/service";
import { setConsentProof, clearConsentProof } from "../app/consent";
import { PolicyConsent, usePolicyConsent, type PolicyControl } from "./Consent";
import { FeaturePage, FeatureState } from "./Catalog";
import { useArea } from "../app/area";
import { useMobile } from "../mobile/ui";
import { mealOptions } from "../api/food-display";
import "./latest.css";
import { rememberVerificationReturn } from "../app/verification-return";

export function RecommendationControls() {
  const cache = useQueryClient(),
    fetching = useIsFetching({ queryKey: ["foods", "mobile-recommend"] });
  const { api } = useApp(),
    { campusId, selectCampus } = useArea(),
    m = useMobile(),
    q = useQuery({
      queryKey: ["campuses"],
      queryFn: () => api.campuses(),
      staleTime: 300000,
    });
  return (
    <div className="ew-recommend-controls">
      <label>
        校区
        <Select
          aria-label="推荐校区"
          menuLabel="今天在哪个校区吃？"
          icon={<MapPin size={16} />}
          value={campusId ?? ""}
          disabled={q.isPending || q.isError}
          onChange={(e) => selectCampus(Number(e.target.value))}
        >
          <option value="" disabled hidden={!!campusId}>
            {q.isPending
              ? "加载校区…"
              : q.isError
                ? "校区加载失败"
                : "选择校区"}
          </option>
          {q.data
            ?.filter((c) => c.open !== false)
            .map((c) => (
              <option key={c.id} value={c.id!}>
                {c.name}
              </option>
            ))}
        </Select>
      </label>
      <label>
        饭点
        <Select
          aria-label="推荐饭点"
          menuLabel="好好吃饭，按时开饭"
          icon={<Utensils size={16} />}
          value={m.meal}
          onChange={(e) => m.setMeal(e.target.value)}
        >
          {mealOptions.map((x) => (
            <option key={x.id} value={x.name}>
              {x.name}
            </option>
          ))}
        </Select>
      </label>
      {q.isError && <button onClick={() => void q.refetch()}>重试校区</button>}
      <button
        disabled={fetching > 0}
        onClick={() =>
          void cache.invalidateQueries({
            queryKey: ["foods", "mobile-recommend"],
          })
        }
      >
        换一批推荐
      </button>
      <Link to="/search">搜菜品 / 店铺 →</Link>
    </div>
  );
}
export function PhoneLoginForm({
  embedded = false,
  compact = false,
  policyConsent,
}: {
  embedded?: boolean;
  compact?: boolean;
  policyConsent?: PolicyControl;
} = {}) {
  const { navigate: nav, location: loc, finish } = useAuthFlow();
  const localConsent = usePolicyConsent(!policyConsent);
  const consent = policyConsent ?? localConsent;
  const getSignal = useSendSignal();
  const mobileInput = useRef<HTMLInputElement>(null);
  const [consentFeedback, setConsentFeedback] = useState<{
    attempt: number;
    animate: boolean;
  } | null>(null);
  const { api, signIn } = useApp(),
    [mobile, setMobile] = useState(""),
    [code, setCode] = useState(""),
    [sentTo, setSentTo] = useState(""),
    [until, setUntil] = useState(0),
    [now, setNow] = useState(Date.now()),
    send = useTask(),
    login = useTask();
  useAuthBusy(send.isPending || login.isPending);
  useEffect(() => {
    if (consent.agreed) setConsentFeedback(null);
  }, [consent.agreed]);
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  const seconds = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <div
      className={`ew-feature ew-form-panel${embedded ? " ew-auth-phone-form" : ""}`}
    >
      {!compact && (
        <>
          <h2>手机登录 / 注册</h2>
          <p>新号码自动注册，已有号码直接登录。</p>
        </>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login.run(async () => {
            const accepted = await consent.requireAcceptance();
            if (sentTo !== mobile)
              throw new Error("请先为当前手机号获取验证码。");
            clearConsentProof();
            const reply = await api.phoneLogin({
              mobile,
              code,
              device: "WEB",
              ...accepted,
            });
            const result = classifyAuth(reply);
            if (result.kind === "session") {
              await signIn(result.session);
              finish(
                reply.data && "newUser" in reply.data && reply.data.newUser
                  ? "/settings/username?first=1"
                  : "/me",
              );
            } else if (result.kind === "consent") {
              setConsentProof(result.proof, "/auth/register" + loc.search);
              nav("/auth/consent");
            } else throw new Error(result.message);
          });
        }}
      >
        <label>
          手机号
          <input
            ref={mobileInput}
            aria-label="登录手机号"
            type="tel"
            autoComplete="tel"
            pattern="1[3-9][0-9]{9}"
            maxLength={11}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
            placeholder={compact ? "输入你的手机号" : undefined}
          />
        </label>
        <label>
          6 位验证码
          <div className="ew-code-row">
            <input
              aria-label="登录验证码"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder={compact ? "6 位验证码" : undefined}
            />
            <button
              type="button"
              disabled={
                send.isPending ||
                login.isPending ||
                seconds > 0 ||
                !consent.ready ||
                consent.query.isFetching
              }
              onClick={(e) => {
                if (!consent.agreed) {
                  setConsentFeedback((previous) => ({
                    attempt: (previous?.attempt ?? 0) + 1,
                    animate: e.detail > 0,
                  }));
                  return;
                }
                if (!mobileInput.current?.reportValidity()) return;
                send.run(async () => {
                  await consent.requireAcceptance();
                  await api.phoneCode(mobile, getSignal());
                  setSentTo(mobile);
                  setNow(Date.now());
                  setUntil(Date.now() + 60000);
                });
              }}
            >
              {seconds
                ? `${seconds}s 后重发`
                : send.isPending
                  ? "正在发送…"
                  : "获取验证码"}
            </button>
          </div>
        </label>
        <PolicyConsent
          consent={consent}
          busy={login.isPending || send.isPending}
          showWithdrawalLink={!compact}
          feedback={
            consentFeedback && consent.ready && !consent.agreed
              ? {
                  ...consentFeedback,
                  message: "请先阅读并勾选授权政策，再获取验证码。",
                }
              : undefined
          }
        />
        {isDemo && (
          <p className="ew-note">本地演示不发送短信，获取后输入 123456。</p>
        )}
        {(send.errorText || login.errorText) && (
          <p className="ew-error" role="alert">
            {send.errorText || login.errorText}
          </p>
        )}
        <button
          className={compact ? "ew-auth-submit" : "ew-button"}
          disabled={login.isPending || !sentTo || !consent.canSubmit}
        >
          {login.isPending ? "正在登录…" : "登录 / 注册"}
        </button>
      </form>
      {!compact && (
        <>
          <p className="ew-note">
            验证码 5 分钟有效，请在获取验证码的站点使用。
          </p>
          <Link
            className={embedded ? "pc-secondary-text-link" : undefined}
            to={"/auth" + loc.search}
          >
            使用密码登录
          </Link>
        </>
      )}
    </div>
  );
}
export function RecoverPassword() {
  const loc = useLocation();
  const suffix = authNext(loc.search);
  return (
    <FeaturePage title="找回密码" back={"/auth/password" + suffix}>
      <div className="ew-form-panel">
        <h2>先用手机验证码登录</h2>
        <p>
          如果账号已绑定可用手机号，可以先登录，再设置新密码。没有可用绑定手机号时，请联系管理员协助。
        </p>
        <Link
          className="ew-button"
          to="/auth/register?next=%2Fsettings%2Fpassword"
        >
          手机登录后设置密码
        </Link>
      </div>
      <PasswordConflictRequest />
    </FeaturePage>
  );
}
export function PasswordByCode() {
  const getSignal = useSendSignal();
  const { api, user, refreshMe } = useApp(),
    [until, setUntil] = useState(0),
    [seconds, setSeconds] = useState(0),
    send = useTask("验证码已发送"),
    save = useTask("密码已设置", refreshMe);
  useEffect(() => {
    const tick = () =>
      setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    if (until <= Date.now()) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [until]);
  return (
    <div className="ew-feature ew-form-panel">
      <h2>
        {user?.hasPassword === false ? "设置登录密码" : "用短信验证码设置密码"}
      </h2>
      <p>
        {user?.phone
          ? `验证码将发送到 ${user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2")}`
          : "请先绑定手机号，或使用原密码修改方式。"}
      </p>
      {!user?.phone ? (
        <Link to="/settings/bind-phone">绑定手机号 →</Link>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget,
              d = new FormData(form);
            save.run(async () => {
              if (d.get("password") !== d.get("confirm"))
                throw new Error("两次输入的新密码不一致。");
              await api.resetPassword({
                code: String(d.get("code")),
                newPassword: String(d.get("password")),
              });
              form.reset();
              setUntil(0);
            });
          }}
        >
          <label>
            6 位验证码
            <div className="ew-code-row">
              <input
                name="code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                required
              />
              <button
                type="button"
                disabled={send.isPending || seconds > 0}
                onClick={() =>
                  send.run(async () => {
                    await api.passwordCode(getSignal());
                    setUntil(Date.now() + 60000);
                  })
                }
              >
                {seconds ? `${seconds}s 后重发` : "获取验证码"}
              </button>
            </div>
          </label>
          <label>
            新密码
            <input
              name="password"
              type="password"
              minLength={6}
              maxLength={64}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            再次输入新密码
            <input
              name="confirm"
              type="password"
              minLength={6}
              maxLength={64}
              autoComplete="new-password"
              required
            />
          </label>
          {(send.errorText || save.errorText) && (
            <p className="ew-error" role="alert">
              {send.errorText || save.errorText}
            </p>
          )}
          <button className="ew-button" disabled={save.isPending}>
            {save.isPending ? "正在保存…" : "保存新密码"}
          </button>
          {isDemo && (
            <p className="ew-note">演示验证码为 123456，不发送真实短信。</p>
          )}
          {save.isSuccess && <p role="status">密码已设置。</p>}
        </form>
      )}
    </div>
  );
}
export function Preferences() {
  const { api, session } = useApp(),
    q = useQuery({
      queryKey: ["preferences"],
      queryFn: () => api.preferences(),
      enabled: !!session,
    });
  if (!session)
    return (
      <FeaturePage title="口味偏好">
        <LoginLink
          className="ew-button"
          to="/auth/password?next=%2Fsettings%2Fpreferences"
        >
          登录后设置
        </LoginLink>
      </FeaturePage>
    );
  return (
    <FeaturePage title="我的口味偏好" back="/settings">
      {q.isPending || q.isError ? (
        <FeatureState
          loading={q.isPending}
          error={q.error}
          retry={() => void q.refetch()}
        />
      ) : (
        <PreferencesForm
          key={q.dataUpdatedAt}
          liked={q.data.likedTags ?? []}
          disliked={q.data.dislikedTags ?? []}
        />
      )}
    </FeaturePage>
  );
}
function PreferencesForm({
  liked,
  disliked,
}: {
  liked: string[];
  disliked: string[];
}) {
  const { api, user } = useApp(),
    [draft, setDraft, clearDraft] = useSessionDraft(`preferences:${user?.id}`, {
      likes: liked.join("、"),
      dislikes: disliked.join("、"),
    }),
    task = useTask("口味偏好已更新", undefined, ["preferences", "foods"]);
  const { likes, dislikes } = draft;
  const setLikes = (likes: string) => setDraft((d) => ({ ...d, likes }));
  const setDislikes = (dislikes: string) =>
    setDraft((d) => ({ ...d, dislikes }));
  const parse = (v: string) => [
    ...new Set(
      v
        .split(/[,，、\n]/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
  return (
    <div className="ew-form-panel">
      <p>
        填写你喜欢或不喜欢的口味，帮助推荐更懂你。每组最多 20 项，用逗号分隔。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          task.run(async () => {
            const likedTags = parse(likes),
              dislikedTags = parse(dislikes);
            if (likedTags.length > 20 || dislikedTags.length > 20)
              throw new Error("每组最多填写 20 个标签。");
            if (likedTags.some((x) => dislikedTags.includes(x)))
              throw new Error("同一口味不能同时出现在喜欢和不喜欢中。");
            await api.savePreferences({ likedTags, dislikedTags });
            clearDraft();
          });
        }}
      >
        <label>
          喜欢的口味
          <textarea
            value={likes}
            onChange={(e) => setLikes(e.target.value)}
            placeholder="例如：清淡、鲜香"
          />
        </label>
        <label>
          不喜欢的口味
          <textarea
            value={dislikes}
            onChange={(e) => setDislikes(e.target.value)}
            placeholder="例如：太甜、重油"
          />
        </label>
        {task.errorText && (
          <p className="ew-error" role="alert">
            {task.errorText}
          </p>
        )}
        <div className="ew-inline">
          <button className="ew-button" disabled={task.isPending}>
            保存口味偏好
          </button>
          <button
            className="ew-button light"
            type="button"
            disabled={task.isPending}
            onClick={() =>
              task.run(async () => {
                await api.clearPreferences();
                setDraft({ likes: "", dislikes: "" });
                clearDraft();
              })
            }
          >
            清空手动偏好
          </button>
        </div>
      </form>
    </div>
  );
}
export function SsoStart({
  returnTo = "/settings/account",
}: {
  returnTo?: string;
}) {
  const { api, user } = useApp(),
    [url, setUrl] = useState(""),
    [expires, setExpires] = useState(0),
    task = useTask();
  return (
    <div className="ew-feature ew-sso">
      <button
        className={`ew-button${url ? " light" : ""}`}
        disabled={task.isPending || isDemo}
        onClick={() =>
          task.run(async () => {
            const data = await api.ssoStart();
            if (!data.url) throw new Error("认证地址暂时不可用。");
            const next = new URL(data.url);
            if (!["https:", "http:"].includes(next.protocol))
              throw new Error("认证地址无效。");
            setUrl(next.href);
            setExpires(Date.now() + Number(data.expiresIn ?? 300) * 1000);
          })
        }
      >
        {task.isPending
          ? "正在获取认证入口…"
          : url
            ? "重新获取认证入口"
            : "获取学校认证入口"}
      </button>
      {url && (
        <a
          className="ew-button"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (Date.now() >= expires) {
              e.preventDefault();
              setUrl("");
            } else rememberVerificationReturn(user?.id, returnTo);
          }}
        >
          前往学校认证页面 ↗
        </a>
      )}
      {task.errorText && (
        <p className="ew-error" role="alert">
          {task.errorText}
        </p>
      )}
      <p className="ew-note">
        {isDemo
          ? "演示模式不会发起真实学校认证。"
          : url
            ? "入口已准备好。将在新页面完成学校认证，结束后显示认证结果，并提供返回原页面的入口。"
            : "先获取入口，再前往学校页面；每次获取的入口仅可使用一次。"}
      </p>
    </div>
  );
}
