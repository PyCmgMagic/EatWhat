import { Select } from "../components/Select";
import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { controllers } from "./generated/controllers";
import manifest from "./generated/manifest.json";
import { screenForPath, screenRoutes, panelScreens } from "./routes";
import {
  MobileContext,
  DesignRegistryContext,
  DesignIcon,
  PrimaryButton,
  useMobile,
  type Draft,
} from "./ui";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { errorMessage, resultUncertain } from "../api/client";
import { ConsentRecovery } from "../features/Consent";
import { useQuery } from "@tanstack/react-query";
import { useArea } from "../app/area";
import { isV4Path } from "../features/v4-paths";
import { boundedText, submissionPath } from "../api/content-rules";
const DetailExtras = lazy(() => import("../features/v4/DetailExtras"));
import { RemoteBanner, FeatureAvailability } from "../features/v4/Remote";
const V4Routes = lazy(() => import("../features/v4/Routes"));
const ApiV2Routes = lazy(() => import("../features/ApiV2Routes"));
const Admin = lazy(() => import("../pages/Admin"));
const MobileLogin = lazy(() => import("./Login"));
const SettingsHome = lazy(() => import("../features/SettingsHome"));
import { ProfileExtras, MobileBinding } from "../pages/ProfileExtras";
import { Gate } from "../components/ui";
import { PasswordConsentWithdrawal } from "../features/AccountExtras";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource-variable/bricolage-grotesque";
import "./mobile.css";
import DesktopExperience from "../desktop/Desktop";
import { DesktopShares } from "../desktop/Desktop";
import ProfileOverview from "../features/ProfileOverview";
import ProfileHelp from "../features/ProfileHelp";
import { profileSection } from "../app/profile-workspace";
const DesktopTags = lazy(() =>
  import("../desktop/DesktopLibrary").then((m) => ({ default: m.DesktopTags })),
);
import { Catalog, FeaturePage } from "../features/Catalog";
import {
  PasswordByCode,
  Preferences,
  RecommendationControls,
  RecoverPassword,
} from "../features/Account";
import { EditFood } from "../features/EditFood";
const DesktopSettingsPage = lazy(() =>
  import("../desktop/DesktopAccount").then((m) => ({
    default: m.DesktopSettingsPage,
  })),
);
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { idOf } from "../api/models";
import { useContentMotion, useExitPresence } from "../motion/hooks";
import { desktopLayout, editingFlow } from "../app/layout";
import { NotFound } from "../app/navigation";
import { usePageLifetime } from "../app/drafts";
import { useVisibleViewport } from "../app/viewport";
import RestaurantMap from "../features/RestaurantMap";
import { mapPoint } from "../features/map-geometry";
import {
  ProfilePeopleDialog,
  useLegacyPeopleRedirect,
} from "../features/ProfilePeople";

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
  useVisibleViewport();
  useLegacyPeopleRedirect();
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
      label: string;
    } | null>(null),
    [draft, setDraftState] = useState<Draft>(emptyDraft),
    [tagId, setTagId] = useState<number>(),
    [meal, setMeal] = useState("晚饭"),
    [viewport, setViewport] = useState(() => ({
      width: innerWidth,
      height: innerHeight,
    }));
  const previousFocus = useRef<HTMLElement | null>(null);
  const confirmationLock = useRef(false),
    [confirmBusy, setConfirmBusy] = useState(false);
  const panelPresence = useExitPresence(panel);
  const noticePresence = useExitPresence(message || null);
  useEffect(() => {
    const resize = () => {
      // Breakpoint changes must reach routing immediately; defer only the CSS
      // viewport bookkeeping, never a phone-to-desktop controller switch.
      setViewport((previous) =>
        previous.width === innerWidth && previous.height === innerHeight
          ? previous
          : { width: innerWidth, height: innerHeight },
      );
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);
  useEffect(() => {
    if (!panelPresence.value && !noticePresence.value) {
      previousFocus.current?.focus({ preventScroll: true });
      return;
    }
    previousFocus.current = document.activeElement as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmationLock.current) return;
        setMessage("");
        setConfirmation(null);
        setPanel(null);
      }
      if (e.key === "Tab") {
        const active = document.querySelector(
          noticePresence.value ? ".design-notice" : ".mobile-panel-layer",
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
          noticePresence.value
            ? ".design-notice button"
            : ".mobile-panel-layer button,.mobile-panel-layer a",
        )
        ?.focus({ preventScroll: true }),
    );
    return () => window.removeEventListener("keydown", onKey);
  }, [panelPresence.value, noticePresence.value]);
  useEffect(() => {
    if (!panelPresence.value && !noticePresence.value) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [!!panelPresence.value, !!noticePresence.value]);
  const reference = loc.pathname.startsWith("/reference/"),
    screen = reference
      ? decodeURIComponent(loc.pathname.slice("/reference/".length))
      : screenForPath(loc.pathname);
  const Render = (controllers as any)[screen],
    Panel = panelPresence.value
      ? (controllers as any)[panelPresence.value]
      : null;
  const showIndex = loc.pathname === "/design";
  const preferredDesktop = desktopLayout(
    viewport.width,
    new URLSearchParams(location.search).get("view"),
    reference,
    showIndex,
  );
  const flow = !reference && !showIndex ? editingFlow(loc.pathname) : null;
  const [flowLayout, setFlowLayout] = useState({
    flow,
    desktop: preferredDesktop,
  });
  if (flowLayout.flow !== flow)
    setFlowLayout({ flow, desktop: preferredDesktop });
  const desktop =
    flow && flowLayout.flow === flow ? flowLayout.desktop : preferredDesktop;
  // Keep reference artboards at their original size. Phone canvases fill the
  // screen; tablet and desktop layouts reflow through CSS instead of zooming.
  const scale =
    desktop || reference
      ? Math.min(1, viewport.width / 390)
      : Math.min(520, viewport.width) / 390;
  const height = Math.max(640, viewport.height / scale);
  useEffect(() => {
    setPanel(null);
  }, [loc.pathname]);
  useContentMotion(
    () =>
      !desktop && !reference && !showIndex
        ? document.querySelector<HTMLElement>(
            ".mobile-viewport, .ew-mobile-feature, .mobile-page-native",
          )
        : null,
    loc.pathname,
    0,
    // Prototype canvases contain fixed navigation; opacity preserves its position.
    "opacity",
  );
  useLayoutEffect(() => {
    document.body.classList.toggle("desktop-mode", desktop);
    return () => document.body.classList.remove("desktop-mode");
  }, [desktop]);
  useEffect(() => {
    if (desktop || reference) return;
    const titles: Record<string, string> = {
      "/me": "个人总览",
      "/me/shares": "我的分享",
      "/favorites": "我的收藏",
      "/me/tags": "标签管理",
      "/history": "浏览足迹",
      "/help": "帮助与反馈",
    };
    if (titles[loc.pathname])
      document.title = titles[loc.pathname] + " · 山软今天吃什么";
  }, [desktop, reference, loc.pathname]);
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
    confirm: (
      message: string,
      action: () => Promise<unknown>,
      label = "确认",
    ) => {
      setConfirmation({ message, action, label });
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
  if (
    loc.pathname === "/me" &&
    !new URLSearchParams(loc.search).has("people")
  ) {
    const legacy = new URLSearchParams(loc.search);
    const tab = legacy.get("tab");
    if (["uploads", "comments", "favorites"].includes(tab ?? "")) {
      if (tab !== "comments") legacy.delete("tab");
      return (
        <Navigate
          replace
          to={
            (tab === "favorites" ? "/favorites" : "/me/shares") +
            (legacy.size ? "?" + legacy : "")
          }
          state={loc.state}
        />
      );
    }
  }
  if (loc.pathname === "/auth/password")
    return (
      <Navigate
        replace
        to={{ pathname: "/auth", search: loc.search }}
        state={loc.state}
      />
    );
  return (
    <DesignRegistryContext.Provider value={controllers}>
      <MobileContext.Provider value={state}>
        {!reference && !showIndex && <RemoteBanner />}
        {isDemo && !reference && !showIndex && !desktop && (
          <aside className="mobile-demo-marker">
            <strong>移动端开发预览</strong>
            <span className="demo-explanation">
              依据 prototype 原始画板
              <br />
              当前为隔离的演示数据
            </span>
            <Link to="/me">个人中心</Link>
            <Link to="/design">查看全部设计画板</Link>
            <a href="/?demo=0">使用真实接口模式</a>
            <Select
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
            </Select>
            {app.user?.role === "admin" && (
              <Link to="/admin">进入管理后台</Link>
            )}
          </aside>
        )}
        <DesktopExperience
          enabled={desktop}
          screen={screen}
          overlay={!!panelPresence.value || !!noticePresence.value}
        >
          <Suspense fallback={<ContentSkeleton kind="form" count={3} />}>
            {!desktop &&
            !reference &&
            ["/me", "/me/shares", "/help", "/me/tags"].includes(
              loc.pathname,
            ) ? (
              <div className="ew-mobile-feature profile-mobile-page">
                {loc.pathname === "/help" ? (
                  <ProfileHelp />
                ) : (
                  <Gate verified={loc.pathname === "/me/tags"}>
                    {loc.pathname === "/me" ? (
                      <ProfileOverview />
                    ) : loc.pathname === "/me/shares" ? (
                      <DesktopShares />
                    ) : (
                      <DesktopTags />
                    )}
                  </Gate>
                )}
              </div>
            ) : !desktop && !reference && loc.pathname === "/settings" ? (
              <div className="ew-mobile-feature">
                <Gate verified={false}>
                  <SettingsHome />
                </Gate>
              </div>
            ) : !desktop && !reference && isV4Path(loc.pathname) ? (
              <div className="ew-mobile-feature">
                <V4Routes key={loc.pathname} />
              </div>
            ) : !desktop &&
              !reference &&
              [
                "/auth",
                "/auth/register",
                "/auth/register/confirm",
                "/auth/username-register",
              ].includes(loc.pathname) ? (
              <MobileLogin />
            ) : !desktop &&
              !reference &&
              ([
                "/settings/username",
                "/settings/blocked",
                "/history",
                "/auth/password-conflict/reset",
              ].includes(loc.pathname) ||
                /^\/users\/\d+$/.test(loc.pathname)) ? (
              <div className="ew-mobile-feature">
                <ApiV2Routes key={loc.pathname} />
              </div>
            ) : !desktop &&
              !reference &&
              ["/settings/privacy", "/settings/account"].includes(
                loc.pathname,
              ) ? (
              <div className="ew-mobile-feature">
                <Gate verified={false}>
                  <DesktopSettingsPage />
                </Gate>
              </div>
            ) : loc.pathname === "/follows" ? null : !desktop &&
              !reference &&
              (loc.pathname === "/search" ||
                loc.pathname === "/favorites" ||
                /^\/foods\/\d+\/edit$/.test(loc.pathname) ||
                [
                  "/auth/forgot",
                  "/auth/withdraw-consent",
                  "/settings/preferences",
                  "/settings/password",
                  "/verify",
                ].includes(loc.pathname)) ? (
              <div className="ew-mobile-feature">
                {loc.pathname === "/search" ? (
                  <Catalog />
                ) : loc.pathname === "/favorites" ? (
                  <Catalog favorites />
                ) : /^\/foods\/\d+\/edit$/.test(loc.pathname) ? (
                  <EditFood />
                ) : loc.pathname === "/auth/withdraw-consent" ? (
                  <FeaturePage title="撤回同步授权" back="/auth/password">
                    <PasswordConsentWithdrawal />
                  </FeaturePage>
                ) : loc.pathname === "/auth/forgot" ? (
                  <RecoverPassword />
                ) : loc.pathname === "/settings/preferences" ? (
                  <Preferences />
                ) : loc.pathname === "/settings/password" ? (
                  <Gate verified={false}>
                    <DesktopSettingsPage />
                  </Gate>
                ) : loc.pathname === "/verify" ? (
                  <Gate verified={false}>
                    <DesktopSettingsPage />
                  </Gate>
                ) : null}
              </div>
            ) : loc.pathname === "/admin" ? (
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
            ) : loc.pathname === "/auth/consent" ? (
              <ConsentPage />
            ) : ["/restaurants/new", "/restaurants/new/details"].includes(
                loc.pathname,
              ) ? (
              <FeatureAvailability name="newShop">
                <NewShopDetails draft={draft} nameHint={draft.shopName ?? ""} />
              </FeatureAvailability>
            ) : reference &&
              (manifest as any)[screen]?.preview?.width !== 390 ? (
              <div className="mobile-support-page">
                {Render && <Render key={screen} screen={screen} reference />}
              </div>
            ) : (
              <div
                className={`mobile-viewport${!reference && ["G2-Home", "G-HomePhoto"].includes(screen) ? " mobile-fluid-home" : ""}`}
                style={
                  {
                    minHeight: height * scale,
                    maxWidth: reference ? 390 : 520,
                    "--mobile-scale": scale,
                  } as any
                }
              >
                <div
                  className="mobile-canvas"
                  style={{ "--screen-height": height + "px" } as any}
                  aria-hidden={
                    panelPresence.value || noticePresence.value
                      ? true
                      : undefined
                  }
                  inert={
                    panelPresence.value || noticePresence.value
                      ? true
                      : undefined
                  }
                >
                  {Render ? (
                    <Render
                      key={screen + loc.pathname + String(reference)}
                      screen={screen}
                      user={app.user}
                      loginUserName={
                        (loc.state as { userName?: string } | null)?.userName
                      }
                      tab={new URLSearchParams(loc.search).get("tab")}
                      draft={draft}
                      reference={reference}
                      tip={reference ? undefined : "无"}
                      start={reference ? undefined : "没输入"}
                    />
                  ) : (
                    <NotFound />
                  )}
                </div>
              </div>
            )}
          </Suspense>
        </DesktopExperience>
        {!desktop &&
          !reference &&
          !showIndex &&
          profileSection(loc.pathname) && (
            <nav className="profile-mobile-mainnav" aria-label="主导航">
              <Link to="/">
                <DesignIcon name="discover" size={20} />
                发现
              </Link>
              <Link to="/nearby">
                <DesignIcon name="nearby" size={20} />
                附近
              </Link>
              <Link to="/me" aria-current="page">
                <DesignIcon name="me" size={20} />
                我的
              </Link>
            </nav>
          )}
        {!desktop &&
          !reference &&
          /^\/(foods|restaurants)\/\d+$/.test(loc.pathname) && (
            <Suspense fallback={<ContentSkeleton kind="rows" count={1} />}>
              <DetailExtras key={loc.pathname} path={loc.pathname} />
            </Suspense>
          )}
        <ProfilePeopleDialog />
        {Panel && (
          <div
            className="mobile-panel-layer"
            data-exiting={panelPresence.exiting || undefined}
            onClick={(e) => {
              if (e.target === e.currentTarget) setPanel(null);
            }}
          >
            <div
              className="mobile-canvas"
              inert={panelPresence.exiting || undefined}
              style={
                {
                  "--mobile-scale": scale,
                  "--screen-height": height + "px",
                } as any
              }
            >
              <Panel
                key={panelPresence.value}
                screen={panelPresence.value}
                user={app.user}
                draft={draft}
              />
            </div>
          </div>
        )}
        {noticePresence.value && (
          <div
            className="design-notice-backdrop"
            data-exiting={noticePresence.exiting || undefined}
            onClick={(e) => {
              if (e.target === e.currentTarget && !confirmationLock.current) {
                setMessage("");
                setConfirmation(null);
              }
            }}
          >
            <section
              className="design-notice"
              inert={noticePresence.exiting || undefined}
              role="dialog"
              aria-modal="true"
              aria-label="操作提示"
            >
              <span className="handle" />
              <h2>这件事，和你说一下</h2>
              <p>{noticePresence.value}</p>
              {confirmation ? (
                <>
                  <PrimaryButton
                    disabled={confirmBusy}
                    onClick={async () => {
                      if (confirmationLock.current) return;
                      confirmationLock.current = true;
                      setConfirmBusy(true);
                      const action = confirmation.action;
                      try {
                        await action();
                        setConfirmation(null);
                        setMessage("");
                      } catch (error) {
                        setConfirmation(null);
                        setMessage(
                          errorMessage(error) +
                            (resultUncertain(error)
                              ? " 请先刷新列表核实操作结果。"
                              : ""),
                        );
                      } finally {
                        confirmationLock.current = false;
                        setConfirmBusy(false);
                      }
                    }}
                  >
                    {confirmBusy ? "正在处理…" : confirmation.label}
                  </PrimaryButton>
                  <button
                    className="mobile-inline-link"
                    disabled={confirmBusy}
                    onClick={() => {
                      setConfirmation(null);
                      setMessage("");
                    }}
                  >
                    取消
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

function ConsentPage() {
  return (
    <div className="mobile-page-native">
      <ConsentRecovery />
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
  const active = usePageLifetime();
  const { api } = useApp(),
    m = useMobile(),
    nav = useNavigate(),
    { area } = useArea(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [position, setPosition] = useState({ lng: "", lat: "" });
  return (
    <div className="mobile-page-native">
      <Link to="/publish" aria-label="返回">
        <DesignIcon name="back" />
      </Link>
      <h1>添加一家店</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || uncertain) return;
          const d = new FormData(e.currentTarget);
          setBusy(true);
          try {
            const created = await api.createRestaurant({
              name: boundedText(String(d.get("name")), 20, "店名"),
              address: boundedText(String(d.get("address")), 30, "地址"),
              gcjLng: Number(d.get("lng")),
              gcjLat: Number(d.get("lat")),
              hubId: area?.hubId,
            });
            if (!active.current) return;
            if (created.revisionId) {
              nav(submissionPath(created, "/publish"));
              return;
            }
            // Continue only when no private revision needs approval.
            m.setShopId(idOf(created.id));
            m.setDraft({
              restaurantId: created.id,
              shopName: String(d.get("name")).trim(),
            });
            nav("/publish/dish");
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
        <p>在地图上点击店铺位置，或拖动标记微调。</p>
        <div className="restaurant-map-picker">
          <RestaurantMap
            pickedPoint={mapPoint({
              gcjLng: Number(position.lng),
              gcjLat: Number(position.lat),
            })}
            onPick={(point) =>
              setPosition({
                lng: point.gcjLng.toFixed(6),
                lat: point.gcjLat.toFixed(6),
              })
            }
            disabled={busy || uncertain}
          />
        </div>
        <label>
          GCJ02 经度
          <input
            name="lng"
            type="number"
            min="72.004"
            max="137.8347"
            step="any"
            value={position.lng}
            onChange={(e) =>
              setPosition((previous) => ({ ...previous, lng: e.target.value }))
            }
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
            value={position.lat}
            onChange={(e) =>
              setPosition((previous) => ({ ...previous, lat: e.target.value }))
            }
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
    </div>
  );
}
