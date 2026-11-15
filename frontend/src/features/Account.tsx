import { Select } from "../components/Select";
import { BRAND_SLOGAN } from "../app/brand";
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
import { isDemo, sessionSignal } from "../app/runtime";
import { useTask } from "../components/useTask";
import { classifyAuth } from "../api/service";
import { FeaturePage, FeatureState } from "./Catalog";
import { useArea } from "../app/area";
import { useMobile } from "../mobile/ui";
import { mealOptions } from "../api/food-display";
import "./latest.css";
import { SceneToggle } from "./SceneToggle";
import { priceBands } from "../api/v2-vocab";
import { useShopOptions } from "./shop-options";
import { rememberVerificationReturn } from "../app/verification-return";

const AUTO_MEAL = "auto";
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
          menuLabel={BRAND_SLOGAN}
          icon={<Utensils size={16} />}
          value={m.mealAuto ? AUTO_MEAL : m.meal}
          onChange={(e) =>
            e.target.value === AUTO_MEAL
              ? m.setMealAuto()
              : m.setMeal(e.target.value)
          }
        >
          <option value={AUTO_MEAL}>
            {m.mealAuto ? `按现在的时间 · ${m.meal}` : "按现在的时间"}
          </option>
          {mealOptions.map((x) => (
            <option key={x.id} value={x.name}>
              {x.name}
            </option>
          ))}
        </Select>
      </label>
      <SceneToggle value={m.scene} onChange={m.setScene} />
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
}: {
  embedded?: boolean;
  compact?: boolean;
} = {}) {
  const { location: loc, finish } = useAuthFlow();
  const getSignal = useSendSignal();
  const mobileInput = useRef<HTMLInputElement>(null);
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
            if (sentTo !== mobile)
              throw new Error("请先为当前手机号获取验证码。");
            const reply = await api.phoneLogin({
              mobile,
              code,
              device: "WEB",
            });
            const result = classifyAuth(reply);
            if (result.kind === "session") {
              const registered =
                reply.data &&
                "newUser" in reply.data &&
                reply.data.newUser === true;
              await signIn(result.session);
              finish(
                "/me",
                registered ? sessionSignal(result.session) : undefined,
              );
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
              disabled={send.isPending || login.isPending || seconds > 0}
              onClick={() => {
                if (!mobileInput.current?.reportValidity()) return;
                send.run(async () => {
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
        {isDemo && (
          <p className="ew-note">本地演示不发送短信，获取后输入 123456。</p>
        )}

        <button
          className={compact ? "ew-auth-submit" : "ew-button"}
          disabled={login.isPending || !sentTo}
        >
          {login.isPending ? "正在登录…" : "登录 / 注册"}
        </button>
      </form>
      {!compact && (
        <>
          <p className="ew-note">验证码 5 分钟有效，请勿向他人透露。</p>
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
      <FeaturePage title="口味偏好" back="/settings">
        <LoginLink
          className="ew-button"
          to="/auth/password?next=%2Fsettings%2Fpreferences"
        >
          登录后设置
        </LoginLink>
      </FeaturePage>
    );
  return (
    <FeaturePage title="口味偏好" back="/settings">
      {q.isPending || q.isError ? (
        <FeatureState
          loading={q.isPending}
          error={q.error}
          retry={() => void q.refetch()}
        />
      ) : (
        <PreferencesForm
          key={q.dataUpdatedAt}
          initial={q.data as unknown as V2Preferences}
        />
      )}
      <ImplicitTaste />
    </FeaturePage>
  );
}
/** v2 also infers tastes from likes, favorites and ratings (read only). */
function ImplicitTaste() {
  const { api } = useApp(),
    q = useQuery({
      queryKey: ["preferences", "taste"],
      queryFn: () => api.implicitTaste(),
      retry: false,
    });
  const names = [
    ...(q.data?.inferredCategories ?? []),
    ...(q.data?.inferredTags ?? []),
  ];
  if (!q.data) return null;
  return (
    <div className="ew-form-panel ew-implicit-taste">
      <b>从你的点赞和收藏看出</b>
      <p className="ew-note">
        {names.length
          ? `你可能偏爱：${names.join("、")}。推荐会同时参考这里和上面的设置。`
          : "多点赞、收藏几道菜后，这里会显示推测出的口味。"}
      </p>
    </div>
  );
}
type V2Preferences = {
  likedCategories?: string[] | null;
  likedTags?: string[] | null;
  dislikedTags?: string[] | null;
  priceBand?: string | null;
  maxDistance?: number | null;
};
const distances = [
  { value: "", name: "不限" },
  { value: "1000", name: "1 公里内" },
  { value: "2000", name: "2 公里内" },
  { value: "3000", name: "3 公里内" },
  { value: "5000", name: "5 公里内" },
];
/** Backend v2 preferences: fixed choices, used by the recommendations. */
function PreferencesForm({ initial }: { initial: V2Preferences }) {
  const { api, user } = useApp(),
    [draft, setDraft, clearDraft] = useSessionDraft(
      `preferences:v2:${user?.id}`,
      {
        likedCategories: initial.likedCategories ?? [],
        likedTags: initial.likedTags ?? [],
        dislikedTags: initial.dislikedTags ?? [],
        priceBand: initial.priceBand ?? "",
        maxDistance:
          initial.maxDistance == null ? "" : String(initial.maxDistance),
      },
    ),
    task = useTask("口味偏好已更新", undefined, ["preferences", "foods"]);
  const options = useShopOptions();
  const toggle = (
    key: "likedCategories" | "likedTags" | "dislikedTags",
    value: string,
    on: boolean,
  ) =>
    setDraft((d) => ({
      ...d,
      [key]: on ? [...d[key], value] : d[key].filter((x) => x !== value),
    }));
  const empty = {
    likedCategories: [],
    likedTags: [],
    dislikedTags: [],
    priceBand: "",
    maxDistance: "",
  };
  return (
    <div className="ew-form-panel">
      <p>选择你的偏好，推荐会优先给你合口味的店。</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          task.run(async () => {
            if (draft.likedTags.some((x) => draft.dislikedTags.includes(x)))
              throw new Error("同一口味不能既喜欢又忌口。");
            await api.savePreferences({
              likedCategories: draft.likedCategories,
              likedTags: draft.likedTags,
              dislikedTags: draft.dislikedTags,
              priceBand: draft.priceBand || undefined,
              maxDistance: draft.maxDistance
                ? Number(draft.maxDistance)
                : undefined,
            } as never);
            clearDraft();
          });
        }}
      >
        <div className="ew-meals">
          <b>喜欢的店铺分类</b>
          {options.categories.map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={draft.likedCategories.includes(c)}
                onChange={(e) => toggle("likedCategories", c, e.target.checked)}
              />
              {c}
            </label>
          ))}
        </div>
        <div className="ew-meals">
          <b>喜欢的口味</b>
          {options.tags.map((t) => (
            <label key={t}>
              <input
                type="checkbox"
                checked={draft.likedTags.includes(t)}
                onChange={(e) => toggle("likedTags", t, e.target.checked)}
              />
              {t}
            </label>
          ))}
        </div>
        <div className="ew-meals">
          <b>忌口</b>
          {options.dislikableTags.map((t) => (
            <label key={t}>
              <input
                type="checkbox"
                checked={draft.dislikedTags.includes(t)}
                onChange={(e) => toggle("dislikedTags", t, e.target.checked)}
              />
              不吃{t}
            </label>
          ))}
        </div>
        <div className="ew-meals" role="radiogroup" aria-label="人均价位">
          <b>人均价位</b>
          {[{ id: "", name: "不限" }, ...priceBands].map((p) => (
            <label key={p.id}>
              <input
                type="radio"
                name="preference-price"
                checked={draft.priceBand === p.id}
                onChange={() => setDraft((d) => ({ ...d, priceBand: p.id }))}
              />
              {p.name}
            </label>
          ))}
        </div>
        <div className="ew-meals" role="radiogroup" aria-label="堂食距离">
          <b>堂食距离</b>
          {distances.map((d) => (
            <label key={d.value}>
              <input
                type="radio"
                name="preference-distance"
                checked={draft.maxDistance === d.value}
                onChange={() =>
                  setDraft((x) => ({ ...x, maxDistance: d.value }))
                }
              />
              {d.name}
            </label>
          ))}
        </div>
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
                setDraft(empty);
                clearDraft();
              })
            }
          >
            清空偏好
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
    task = useTask();
  return (
    <div className="ew-feature ew-sso">
      <button
        type="button"
        className="ew-button"
        disabled={task.isPending || isDemo}
        onClick={() =>
          task.run(async () => {
            const data = await api.ssoStart();
            if (!data.url) throw new Error("认证地址暂时不可用。");
            const next = new URL(data.url);
            if (!["https:", "http:"].includes(next.protocol))
              throw new Error("认证地址无效。");
            rememberVerificationReturn(user?.id, returnTo);
            window.location.assign(next.href);
          })
        }
      >
        {task.isPending ? "正在跳转…" : "前往学校认证页面"}
      </button>
      {isDemo && <p className="ew-note">演示模式不会发起真实学校认证。</p>}
    </div>
  );
}
