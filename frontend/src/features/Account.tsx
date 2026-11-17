import { Select } from "../components/Select";
import { BRAND_SLOGAN } from "../app/brand";
import { Utensils } from "lucide-react";
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
import {
  createWebOneClickTiming,
  webOneClickTimingHeaders,
  webOneClickToken,
  webOneClickAvailable,
  looksLikePhone,
  webOneClickLog,
} from "../app/web-one-click";
import { WebOneClickConsole } from "../app/WebOneClickConsole";
import "../app/web-one-click.css";
import { FeaturePage, FeatureState } from "./Catalog";
import { DesignIcon as Icon, useMobile } from "../mobile/ui";
import { mealOptions } from "../api/food-display";
import "./latest.css";
import "./preferences.css";
import { SceneToggle } from "./SceneToggle";
import { LocationControl } from "./LocationControl";
import { priceBands } from "../api/v2-vocab";
import { useShopOptions } from "./shop-options";
import { rememberVerificationReturn } from "../app/verification-return";
import { PhoneAuthLogViewer } from "../components/PhoneAuthLogViewer";

const AUTO_MEAL = "auto";
export function RecommendationControls() {
  const cache = useQueryClient(),
    fetching = useIsFetching({ queryKey: ["foods", "mobile-recommend"] });
  const m = useMobile();
  return (
    <div className="ew-recommend-controls">
      <LocationControl />
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
  const webOneClick = useQuery({
    queryKey: ["auth", "web-one-click-availability"],
    queryFn: async () => {
      const config = await api.webOneClickConfig().catch((error: unknown) => {
        webOneClickLog.add(
          "config_failed",
          {
            error: (error instanceof Error
              ? error.message
              : String(error)
            ).slice(0, 200),
          },
          "warn",
        );
        throw error;
      });
      webOneClickLog.add(
        "config",
        { enabled: config.enabled === true },
        config.enabled ? "info" : "warn",
      );
      return config.enabled ? webOneClickAvailable(api) : false;
    },
    enabled: looksLikePhone(),
    gcTime: 0,
    retry: false,
  });
  const signInWith = async (
    reply: Awaited<ReturnType<typeof api.phoneLogin>>,
  ) => {
    const result = classifyAuth(reply);
    if (result.kind !== "session") throw new Error(result.message);
    const registered =
      reply.data && "newUser" in reply.data && reply.data.newUser === true;
    await signIn(result.session);
    finish("/me", registered ? sessionSignal(result.session) : undefined);
  };
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
            await signInWith(
              await api.phoneLogin({ mobile, code, device: "WEB" }),
            );
          });
        }}
      >
        {webOneClick.data === true && (
          <button
            type="button"
            className="ew-web-one-click"
            disabled={login.isPending || send.isPending}
            onClick={() => {
              login.run(async () => {
                const timing = createWebOneClickTiming();
                try {
                  const spToken = await webOneClickToken(
                    api,
                    undefined,
                    timing,
                  );
                  await signInWith(
                    await api.webOneClickLogin(
                      { spToken },
                      webOneClickTimingHeaders(timing),
                    ),
                  );
                  webOneClickLog.add("login_ok", { trace: timing.trace });
                } catch (error) {
                  webOneClickLog.add(
                    "login_failed",
                    {
                      trace: timing.trace,
                      error: (error instanceof Error
                        ? error.message
                        : String(error)
                      ).slice(0, 200),
                    },
                    "warn",
                  );
                  throw error;
                }
              });
            }}
          >
            本机号码一键登录
            <small>开启移动数据，在授权页补全号码中间 4 位</small>
          </button>
        )}
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
      <WebOneClickConsole
        status={
          !looksLikePhone()
            ? "未检测（非手机浏览器）"
            : webOneClick.isFetching
              ? "检测中"
              : webOneClick.isError
                ? "检测出错"
                : webOneClick.data
                  ? "可用"
                  : "不可用"
        }
      />
      <PhoneAuthLogViewer />
      {!compact && (
        <>
          <p className="ew-note">验证码 5 分钟有效，请勿向他人透露。</p>
          <Link
            className={embedded ? "pc-secondary-text-link" : undefined}
            to={"/auth/password" + loc.search}
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
    <div className="ew-feature ew-form-panel ew-password-panel">
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
    <aside className="ew-prefs-note">
      <Icon name="info" size={18} />
      <div>
        <b>从你的点赞和收藏看出</b>
        <p>
          {names.length
            ? `你可能偏爱：${names.join("、")}。推荐会同时参考这里和上面的设置。`
            : "多点赞、收藏几道菜后，这里会显示推测出的口味。"}
        </p>
      </div>
    </aside>
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
type PreferencePayload = {
  likedCategories: string[];
  likedTags: string[];
  dislikedTags: string[];
  priceBand?: string;
  maxDistance?: number;
};
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
  const saved = {
    likedCategories: initial.likedCategories ?? [],
    likedTags: initial.likedTags ?? [],
    dislikedTags: initial.dislikedTags ?? [],
    priceBand: initial.priceBand ?? "",
    maxDistance: initial.maxDistance == null ? "" : String(initial.maxDistance),
  };
  const same = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const left = [...a].sort(),
      right = [...b].sort();
    return left.every((value, index) => value === right[index]);
  };
  const dirty =
    !same(draft.likedCategories, saved.likedCategories) ||
    !same(draft.likedTags, saved.likedTags) ||
    !same(draft.dislikedTags, saved.dislikedTags) ||
    draft.priceBand !== saved.priceBand ||
    draft.maxDistance !== saved.maxDistance;
  const priceChoices = [{ id: "", name: "不限" }, ...priceBands];
  const priceName =
    priceChoices.find((band) => band.id === draft.priceBand)?.name ?? "不限";
  const distanceName =
    distances.find((choice) => choice.value === draft.maxDistance)?.name ??
    "不限";
  const chosen =
    draft.likedCategories.length +
    draft.likedTags.length +
    draft.dislikedTags.length;
  const save = () => {
    if (draft.likedTags.some((tag) => draft.dislikedTags.includes(tag)))
      return Promise.reject(new Error("同一口味不能既喜欢又忌口。"));
    // 生成类型落后于 v2 接口（缺 likedCategories / priceBand / maxDistance），
    // 这里按后端契约声明一次，避免再写 `as never`。
    const payload: PreferencePayload = {
      likedCategories: draft.likedCategories,
      likedTags: draft.likedTags,
      dislikedTags: draft.dislikedTags,
      priceBand: draft.priceBand || undefined,
      maxDistance: draft.maxDistance ? Number(draft.maxDistance) : undefined,
    };
    return api
      .savePreferences(
        payload as unknown as Parameters<typeof api.savePreferences>[0],
      )
      .then(() => clearDraft());
  };
  return (
    <form
      className="ew-prefs-shell"
      onSubmit={(event) => {
        event.preventDefault();
        task.run(save);
      }}
    >
      <fieldset className="ew-prefs" disabled={task.isPending}>
        <section className="ew-prefs-card" aria-labelledby="prefs-category">
          <header className="ew-prefs-head">
            <div>
              <h2 id="prefs-category">喜欢的店铺分类</h2>
              <p>选中的菜系，推荐店时会优先出现。</p>
            </div>
            <span className="ew-prefs-count">
              {draft.likedCategories.length}
              <small>/{options.categories.length}</small>
            </span>
          </header>
          <div
            className="ew-prefs-options"
            role="group"
            aria-labelledby="prefs-category"
          >
            {options.categories.map((category) => {
              const on = draft.likedCategories.includes(category);
              return (
                <label key={category} className="ew-chip">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(event) =>
                      toggle("likedCategories", category, event.target.checked)
                    }
                  />
                  {on && <Icon name="check" size={13} />}
                  <span>{category}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="ew-prefs-card" aria-labelledby="prefs-taste">
          <header className="ew-prefs-head">
            <div>
              <h2 id="prefs-taste">口味与忌口</h2>
              <p>同一个口味只能二选一：喜欢，或者不吃。</p>
            </div>
            <span className="ew-prefs-count">
              {draft.likedTags.length + draft.dislikedTags.length}
              <small>项</small>
            </span>
          </header>
          <div className="ew-prefs-field is-inline">
            <span className="ew-prefs-label">喜欢的口味</span>
            <div
              className="ew-prefs-options"
              role="group"
              aria-label="喜欢的口味"
            >
              {options.tags.map((tag) => {
                const on = draft.likedTags.includes(tag);
                return (
                  <label key={tag} className="ew-chip">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(event) =>
                        toggle("likedTags", tag, event.target.checked)
                      }
                    />
                    {on && <Icon name="check" size={13} />}
                    <span>{tag}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="ew-prefs-field is-inline">
            <span className="ew-prefs-label">忌口</span>
            <div className="ew-prefs-options" role="group" aria-label="忌口">
              {options.dislikableTags.map((tag) => {
                const on = draft.dislikedTags.includes(tag);
                return (
                  <label key={tag} className="ew-chip is-avoid">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(event) =>
                        toggle("dislikedTags", tag, event.target.checked)
                      }
                    />
                    {on && <Icon name="check" size={13} />}
                    <span>不吃{tag}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </section>

        <section className="ew-prefs-card" aria-labelledby="prefs-range">
          <header className="ew-prefs-head">
            <div>
              <h2 id="prefs-range">推荐范围</h2>
              <p>价位和距离会直接影响推荐结果。</p>
            </div>
          </header>
          <div className="ew-prefs-field is-inline">
            <span className="ew-prefs-label">人均价位</span>
            <div
              className="ew-prefs-options"
              role="radiogroup"
              aria-label="人均价位"
            >
              {priceChoices.map((band) => {
                const on = draft.priceBand === band.id;
                return (
                  <label key={band.id} className="ew-chip">
                    <input
                      type="radio"
                      name="preference-price"
                      checked={on}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          priceBand: band.id,
                        }))
                      }
                    />
                    {on && <Icon name="check" size={13} />}
                    <span>{band.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="ew-prefs-field is-inline">
            <span className="ew-prefs-label">堂食距离</span>
            <div
              className="ew-prefs-options"
              role="radiogroup"
              aria-label="堂食距离"
            >
              {distances.map((choice) => {
                const on = draft.maxDistance === choice.value;
                return (
                  <label key={choice.value} className="ew-chip">
                    <input
                      type="radio"
                      name="preference-distance"
                      checked={on}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          maxDistance: choice.value,
                        }))
                      }
                    />
                    {on && <Icon name="check" size={13} />}
                    <span>{choice.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </section>
      </fieldset>

      <aside className="ew-prefs-side">
        <section className="ew-prefs-summary" aria-label="你的偏好概览">
          <header>
            <b>你的口味档案</b>
            <span>{chosen ? `已选 ${chosen} 项` : "还没选"}</span>
          </header>
          <dl>
            <div>
              <dt>店铺分类</dt>
              <dd>
                {draft.likedCategories.length
                  ? draft.likedCategories.join("、")
                  : "未选择"}
              </dd>
            </div>
            <div>
              <dt>喜欢的口味</dt>
              <dd>
                {draft.likedTags.length ? draft.likedTags.join("、") : "未选择"}
              </dd>
            </div>
            <div>
              <dt>忌口</dt>
              <dd>
                {draft.dislikedTags.length
                  ? draft.dislikedTags.map((tag) => `不吃${tag}`).join("、")
                  : "未设置"}
              </dd>
            </div>
            <div>
              <dt>人均价位</dt>
              <dd>{priceName}</dd>
            </div>
            <div>
              <dt>堂食距离</dt>
              <dd>{distanceName}</dd>
            </div>
          </dl>
          <div className="ew-prefs-actions">
            <button
              className="ew-button"
              type="submit"
              disabled={task.isPending || !dirty}
            >
              {task.isPending ? "正在保存…" : dirty ? "保存口味偏好" : "已保存"}
            </button>
            <button
              className="ew-prefs-clear"
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
              清空所有偏好
            </button>
          </div>
          <p className="ew-prefs-hint">保存后立刻用于首页推荐。</p>
        </section>
      </aside>
    </form>
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
