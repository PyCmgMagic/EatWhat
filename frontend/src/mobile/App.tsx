import { useEffect, useState, useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { controllers } from "./generated/controllers";
import manifest from "./generated/manifest.json";
import { screenForPath, screenRoutes, panelScreens } from "./routes";
import {
  MobileContext,
  DesignRegistryContext,
  DesignIcon,
  PrimaryButton,
  type Draft,
} from "./ui";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { classifyAuth } from "../api/service";
import { errorMessage, resultUncertain } from "../api/client";
import { getConsentProof, clearConsentProof, setConsentProof } from "./bridge";
import { useQuery } from "@tanstack/react-query";
import { useArea } from "../app/area";
import Admin from "../pages/Admin";
import { ProfileExtras, MobileBinding } from "../pages/ProfileExtras";
import { Gate } from "../components/ui";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource-variable/bricolage-grotesque";
import "./mobile.css";
import DesktopExperience from "../desktop/Desktop";

const emptyDraft: Draft = {
  name: "",
  price: "",
  category: "staple",
  description: "",
  images: [],
  stage: "#F3C46E",
  tags: [],
};
export default function MobileApp() {
  const app = useApp(),
    loc = useLocation(),
    nav = useNavigate(),
    [foodId, setFoodId] = useState(1),
    [shopId, setShopId] = useState(1),
    [panel, setPanel] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [confirmation, setConfirmation] = useState<{
      message: string;
      action: () => Promise<unknown>;
    } | null>(null),
    [draft, setDraftState] = useState<Draft>(emptyDraft),
    [tagId, setTagId] = useState<number>(),
    [meal, setMeal] = useState("晚饭"),
    [width, setWidth] = useState(innerWidth),
    [scale, setScale] = useState(() => Math.min(1, innerWidth / 390)),
    [height, setHeight] = useState(() =>
      Math.max(640, innerHeight / Math.min(1, innerWidth / 390)),
    );
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const resize = () => {
      const s = Math.min(1, innerWidth / 390);
      setWidth(innerWidth);
      setScale(s);
      setHeight(Math.max(640, innerHeight / s));
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    setPanel(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [loc.pathname]);
  useEffect(() => {
    if (!panel && !message) {
      previousFocus.current?.focus();
      return;
    }
    previousFocus.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMessage("");
        setConfirmation(null);
        setPanel(null);
      }
      if (e.key === "Tab") {
        const active = document.querySelector(
          message ? ".design-notice" : ".mobile-panel-layer",
        );
        const items = active?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled])",
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          message
            ? ".design-notice button"
            : ".mobile-panel-layer button,.mobile-panel-layer a",
        )
        ?.focus({ preventScroll: true }),
    );
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, message]);
  const reference = loc.pathname.startsWith("/reference/"),
    screen = reference
      ? decodeURIComponent(loc.pathname.slice("/reference/".length))
      : screenForPath(loc.pathname);
  const Render = (controllers as any)[screen],
    Panel = panel ? (controllers as any)[panel] : null;
  const showIndex = loc.pathname === "/design";
  const desktop =
    (width >= 1024 ||
      new URLSearchParams(location.search).get("view") === "desktop") &&
    !reference &&
    !showIndex &&
    new URLSearchParams(location.search).get("view") !== "mobile";
  useEffect(() => {
    document.body.classList.toggle("desktop-mode", desktop);
    return () => document.body.classList.remove("desktop-mode");
  }, [desktop]);
  const state = {
    foodId,
    shopId,
    setFoodId,
    setShopId,
    panel,
    openPanel: (name: string) => setPanel(name),
    closePanel: () => setPanel(null),
    notice: (text: string) => {
      setConfirmation(null);
      setMessage(text);
    },
    confirm: (message: string, action: () => Promise<unknown>) => {
      setConfirmation({ message, action });
      setMessage(message);
    },
    go: (name: string) =>
      nav(reference ? "/reference/" + name : (screenRoutes[name] ?? "/")),
    draft,
    setDraft: (patch: Partial<Draft>) =>
      setDraftState((d) => ({ ...d, ...patch })),
    tagId,
    setTagId,
    meal,
    setMeal,
  };
  return (
    <DesignRegistryContext.Provider value={controllers}>
      <MobileContext.Provider value={state}>
        {isDemo && !reference && !showIndex && !desktop && (
          <aside className="mobile-demo-marker">
            <strong>移动端开发预览</strong>
            <span className="demo-explanation">
              依据 prototype 原始画板
              <br />
              当前为隔离的演示数据
            </span>
            <Link to="/design">查看全部设计画板</Link>
            <a href="/?demo=0">使用真实接口模式</a>
            <select
              aria-label="演示身份"
              value={
                new URLSearchParams(location.search).get("persona") ??
                "verified"
              }
              onChange={(e) =>
                (location.href = `/?demo=1&persona=${e.target.value}#/me`)
              }
            >
              <option value="verified">已认证同学</option>
              <option value="unverified">未认证同学</option>
              <option value="admin">管理员</option>
            </select>
            {app.user?.role === "admin" && (
              <Link to="/admin">进入管理后台</Link>
            )}
          </aside>
        )}
        <DesktopExperience
          enabled={desktop}
          fitScale={desktop && width < 1024 ? width / 1280 : 1}
          screen={screen}
          overlay={!!panel || !!message}
        >
          {loc.pathname === "/admin" ? (
            <div className="legacy-admin">
              <Link to="/me">返回我的</Link>
              <Admin />
            </div>
          ) : loc.pathname === "/me/details" ? (
            <div className="mobile-page-native">
              <Link to="/me/edit" aria-label="返回">
                <DesignIcon name="back" />
              </Link>
              <h1>更多资料</h1>
              <Gate verified={false}>
                <ProfileExtras />
              </Gate>
            </div>
          ) : loc.pathname === "/settings/bind-phone" ? (
            <div className="mobile-page-native">
              <Link to="/settings/account" aria-label="返回">
                <DesignIcon name="back" />
              </Link>
              <h1>绑定手机号</h1>
              <Gate verified={false}>
                <MobileBinding />
              </Gate>
            </div>
          ) : showIndex ? (
            <div className="reference-index">
              <h1 style={{ width: "100%" }}>移动端设计画板</h1>
              <p style={{ width: "100%" }}>
                51 张画板直接从 prototype 编译为
                React。设计对照模式使用原始样例；正式页面使用业务接口。
              </p>
              {Object.keys(manifest).map((key) => (
                <Link key={key} to={"/reference/" + key}>
                  {key}
                </Link>
              ))}
            </div>
          ) : loc.pathname === "/auth/username-register" ? (
            <UsernameRegister />
          ) : loc.pathname === "/auth/consent" ? (
            <ConsentPage />
          ) : loc.pathname === "/restaurants/new/details" ? (
            <NewShopDetails draft={draft} nameHint={draft.shopName ?? ""} />
          ) : reference && (manifest as any)[screen]?.preview?.width !== 390 ? (
            <div className="mobile-support-page">
              {Render && <Render key={screen} screen={screen} reference />}
            </div>
          ) : (
            <div
              className="mobile-viewport"
              style={{ height: height * scale, "--mobile-scale": scale } as any}
            >
              <div
                className="mobile-canvas"
                style={{ "--screen-height": height + "px" } as any}
                aria-hidden={panel || message ? true : undefined}
                inert={panel || message ? true : undefined}
              >
                {Render ? (
                  <Render
                    key={screen + loc.pathname + String(reference)}
                    screen={screen}
                    user={app.user}
                    tab={new URLSearchParams(loc.search).get("tab")}
                    draft={draft}
                    reference={reference}
                    tip={reference ? undefined : "无"}
                    start={reference ? undefined : "没输入"}
                  />
                ) : (
                  <div className="mobile-page-native">
                    <h1>还没有这张画板</h1>
                    <Link to="/">回到发现</Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </DesktopExperience>
        {Panel && (
          <div
            className="mobile-panel-layer"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPanel(null);
            }}
          >
            <div
              className="mobile-canvas"
              style={
                {
                  "--mobile-scale": scale,
                  "--screen-height": height + "px",
                } as any
              }
            >
              <Panel key={panel} screen={panel} user={app.user} draft={draft} />
            </div>
          </div>
        )}
        {message && (
          <div
            className="design-notice-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setMessage("");
                setConfirmation(null);
              }
            }}
          >
            <section
              className="design-notice"
              role="dialog"
              aria-modal="true"
              aria-label="操作提示"
            >
              <span className="handle" />
              <h2>这件事，和你说一下</h2>
              <p>{message}</p>
              {confirmation ? (
                <>
                  <PrimaryButton
                    onClick={async () => {
                      const action = confirmation.action;
                      setConfirmation(null);
                      setMessage("");
                      await action();
                    }}
                  >
                    删除分类
                  </PrimaryButton>
                  <button
                    className="mobile-inline-link"
                    onClick={() => {
                      setConfirmation(null);
                      setMessage("");
                    }}
                  >
                    先不删
                  </button>
                </>
              ) : (
                <PrimaryButton onClick={() => setMessage("")}>
                  知道了
                </PrimaryButton>
              )}
            </section>
          </div>
        )}
      </MobileContext.Provider>
    </DesignRegistryContext.Provider>
  );
}

function UsernameRegister() {
  const { api, signIn } = useApp(),
    nav = useNavigate(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="mobile-page-native">
      <Link to="/auth/register" aria-label="返回">
        <DesignIcon name="back" />
      </Link>
      <h1>注册</h1>
      <p>当前支持用户名和密码注册。手机号验证码注册待接入。</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const d = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            if (d.get("password") !== d.get("confirm"))
              throw new Error("两次密码不一样，再确认一下。");
            await api.checkUsername(String(d.get("username")).trim());
            const reply = await api.register({
              username: String(d.get("username")),
              password: String(d.get("password")),
              device: "WEB",
            });
            const result = classifyAuth(reply);
            if (result.kind === "session") {
              await signIn(result.session);
              nav("/verify");
            } else if (result.kind === "consent") {
              setConsentProof(result.proof);
              nav("/auth/consent");
            } else throw new Error(result.message);
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          用户名
          <input
            name="username"
            autoComplete="username"
            pattern="(?!.*@)(?![0-9]{11}$)[a-zA-Z0-9_]{3,10}"
            minLength={3}
            maxLength={10}
            placeholder="3–10 位字母、数字或下划线"
            required
          />
        </label>
        <label>
          密码
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            minLength={6}
            maxLength={64}
            required
          />
        </label>
        <label>
          再输入一次密码
          <input
            type="password"
            name="confirm"
            autoComplete="new-password"
            minLength={6}
            maxLength={64}
            required
          />
        </label>
        {error && (
          <p className="mobile-error" role="alert">
            {error}
          </p>
        )}
        <PrimaryButton disabled={busy}>
          {busy ? "正在注册" : "注册"}
        </PrimaryButton>
      </form>
    </div>
  );
}
function ConsentPage() {
  const { api } = useApp(),
    nav = useNavigate(),
    [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const policy = useQuery({
    queryKey: ["consent-policy"],
    queryFn: () => api.consentPolicy(),
  });
  return (
    <div className="mobile-page-native">
      <Link to="/auth/password" aria-label="返回">
        <DesignIcon name="back" />
      </Link>
      <h1>再确认一次</h1>
      <p>账号需要你确认当前版本的跨站同步政策。临时授权凭证不作为登录会话。</p>
      {policy.data && <p>当前政策：{policy.data.policyVersion}</p>}
      {import.meta.env.VITE_CONSENT_POLICY_URL ? (
        <a
          href={import.meta.env.VITE_CONSENT_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          阅读完整政策
        </a>
      ) : (
        <p className="mobile-error">政策全文尚待配置，当前不能提交同意。</p>
      )}
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="checkbox"
          style={{ width: 20, height: 20 }}
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        我已阅读并同意当前政策
      </label>
      {error && <p className="mobile-error">{error}</p>}
      {done ? (
        <>
          <p>授权请求已提交，请重新登录，等待服务端确认身份就绪。</p>
          <PrimaryButton onClick={() => nav("/auth/password")}>
            返回登录
          </PrimaryButton>
        </>
      ) : (
        <PrimaryButton
          disabled={
            !agreed ||
            !import.meta.env.VITE_CONSENT_POLICY_URL ||
            !getConsentProof() ||
            busy ||
            !policy.data?.policyVersion
          }
          onClick={async () => {
            setBusy(true);
            try {
              await api.grantConsent({
                proof: getConsentProof(),
                policyVersion: policy.data!.policyVersion!,
              });
              clearConsentProof();
              setDone(true);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          同意并继续
        </PrimaryButton>
      )}
    </div>
  );
}
function NewShopDetails({
  draft,
  nameHint,
}: {
  draft: Draft;
  nameHint: string;
}) {
  return (
    <Gate>
      <NewShopDetailsForm draft={draft} nameHint={nameHint} />
    </Gate>
  );
}
function NewShopDetailsForm({
  draft,
  nameHint,
}: {
  draft: Draft;
  nameHint: string;
}) {
  const { api } = useApp(),
    nav = useNavigate(),
    { area } = useArea(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [done, setDone] = useState(false);
  return (
    <div className="mobile-page-native">
      <Link to="/restaurants/new" aria-label="返回">
        <DesignIcon name="back" />
      </Link>
      <h1>{done ? "店已提交" : "补充店的位置"}</h1>
      {done ? (
        <>
          <p>
            创建接口尚未返回新店编号。回到选店列表，查找并选择准确餐厅，再加菜。
          </p>
          <PrimaryButton onClick={() => nav("/publish")}>
            回到选店
          </PrimaryButton>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy || uncertain) return;
            const d = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await api.createRestaurant({
                name: String(d.get("name")).trim(),
                address: String(d.get("address")).trim(),
                gcjLng: Number(d.get("lng")),
                gcjLat: Number(d.get("lat")),
                hubId: area?.hubId,
              });
              setDone(true);
            } catch (e) {
              setError(errorMessage(e));
              if (resultUncertain(e)) setUncertain(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            店名
            <input name="name" defaultValue={nameHint} required />
          </label>
          <label>
            详细地址
            <input name="address" required />
          </label>
          <label>
            GCJ02 经度
            <input
              name="lng"
              type="number"
              min="72.004"
              max="137.8347"
              step="any"
              required
            />
          </label>
          <label>
            GCJ02 纬度
            <input
              name="lat"
              type="number"
              min="0.8293"
              max="55.8271"
              step="any"
              required
            />
          </label>
          <p>填写餐厅准确位置，所选区域中心不代表餐厅位置。</p>
          {error && <p className="mobile-error">{error}</p>}
          {uncertain && (
            <p className="mobile-error">
              提交结果尚未确认，请返回列表核实，避免重复创建。
            </p>
          )}
          <PrimaryButton disabled={busy || uncertain}>提交新店</PrimaryButton>
        </form>
      )}
    </div>
  );
}
