import { useFeedbackState } from "../components/feedback";
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
import {
  screenForPath,
  screenRoutes,
  panelScreens,
  mobileSettingsPages,
  browserTitle,
} from "./routes";
import {
  MobileContext,
  DesignRegistryContext,
  DesignIcon,
  DesignNav,
  PrimaryButton,
  useMobile,
  type Draft,
} from "./ui";
import { useApp } from "../app/state";
import { isAdminPath } from "../app/admin-routes";
import { useRememberWorkspaces } from "../app/admin-state";
const AdminApp = lazy(() => import("../admin/AdminApp"));
import { isDemo } from "../app/runtime";
import { errorMessage, resultUncertain } from "../api/client";
import { useQuery } from "@tanstack/react-query";
import { useArea } from "../app/area";
import type { RecommendScene } from "../api/v2-vocab";
import {
  mealName,
  mealOptions,
  mealSlotAt,
  mealSlotEnd,
  type MealSlot,
} from "../api/food-display";

import { isV4Path } from "../features/v4-paths";
import { boundedText, submissionPath } from "../api/content-rules";
import { RemoteBanner, FeatureAvailability } from "../features/v4/Remote";
import {
  MobileComments,
  MobileMyComments,
} from "../features/comments/Comments";
const V4Routes = lazy(() => import("../features/v4/Routes"));
const ApiV2Routes = lazy(() => import("../features/ApiV2Routes"));
const LoginPage = lazy(() => import("./Login"));
const MobileAccountSettings = lazy(() => import("./AccountSettings"));
const MobileSettingsPages = lazy(() => import("./SettingsPages"));
import { Gate } from "../components/ui";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource-variable/bricolage-grotesque";
import "./mobile.css";
import DesktopExperience from "../desktop/Desktop";
import ProfileHelp from "../features/ProfileHelp";
import { profileSection } from "../app/profile-workspace";
import { Catalog } from "../features/Catalog";
import {
  PasswordByCode,
  RecommendationControls,
} from "../features/Account";
import { EditFood } from "../features/EditFood";
import { EditRestaurant, isShopEditPath } from "../features/EditRestaurant";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { idOf } from "../api/models";
import { useContentMotion, useExitPresence } from "../motion/hooks";
import { desktopLayout, editingFlow } from "../app/layout";
import { isStandaloneLoginPath } from "../app/auth-routes";
import { NotFound } from "../app/navigation";
import { useProfileReturnTo } from "../app/profile-navigation";
import { ProfileDraftProvider } from "../app/profile-draft";
import { usePageLifetime } from "../app/drafts";
import { useVisibleViewport } from "../app/viewport";
import RestaurantLocationField, {
  requireShopLocation,
} from "../features/RestaurantLocationField";
import SheetHandle from "./SheetHandle";
import type { MapPoint } from "../features/map-geometry";
import { ShopTraitsFields, defaultShopTraits } from "../features/ShopTraits";
import {
  ProfilePeopleDialog,
  useLegacyPeopleRedirect,
} from "../features/ProfilePeople";
import { FieldMark } from "../features/FieldMark";

const SCENE_KEY = "eatwhat.recommend-scene";
/** Dine-in or delivery, remembered on this device. */
function savedScene(): RecommendScene {
  try {
    return localStorage.getItem(SCENE_KEY) === "delivery"
      ? "delivery"
      : "dine_in";
  } catch {
    return "dine_in";
  }
}

const emptyDraft: Draft = {
  name: "",
  price: "",
  category: "staple",
  description: "",
  images: [],
  stage: "#F3C46E",
  tags: [],
  tagInput: "",
};
export default function MobileApp() {
  const { session } = useApp();
  const [workspace, setWorkspace] = useState({ owner: session, version: 0 });
  if (workspace.owner !== session) {
    // Keep guest navigation mounted through login. Once an authenticated
    // session ends, discard its draft, editor state and pending confirmations.
    setWorkspace({
      owner: session,
      version: workspace.version + (workspace.owner ? 1 : 0),
    });
  }
  const { pathname } = useLocation();
  const editingProfile = pathname === "/me/edit" || pathname === "/me/details";
  return (
    <ProfileDraftProvider key={workspace.version} editing={editingProfile}>
      <MobileWorkspace />
    </ProfileDraftProvider>
  );
}
function MobileWorkspace() {
  const profileReturnTo = useProfileReturnTo();
  useVisibleViewport();
  useLegacyPeopleRedirect();
  useRememberWorkspaces();
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
    // A manual meal pick lasts until the slot it was made in ends.
    [mealPick, setMealPick] = useState<{
      slot: MealSlot;
      until: number;
    } | null>(null),
    [servedMeal, setServedMeal] = useState<{
      slot: MealSlot;
      used: MealSlot;
    }>(),
    [clock, setClock] = useState(() => Date.now()),
    [scene, setSceneState] = useState<RecommendScene>(savedScene),
    [viewport, setViewport] = useState(() => ({
      width: innerWidth,
      height: innerHeight,
    }));
  const autoMeal = mealSlotAt(clock),
    manualMeal = mealPick && clock < mealPick.until ? mealPick.slot : undefined,
    // Automatic: what the backend said it used for this slot, else the clock.
    mealSlot =
      manualMeal ??
      (servedMeal?.slot === autoMeal ? servedMeal.used : autoMeal);
  useEffect(() => {
    // Re-render when the slot ends (a manual pick then returns to automatic),
    // and when the page comes back after timers may have been paused.
    const tick = () => setClock(Date.now());
    const timer = setTimeout(tick, mealSlotEnd(clock) - Date.now() + 1000);
    const wake = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [clock]);
  const images = useRef(draft.images);
  images.current = draft.images;
  useEffect(
    () => () => {
      for (const image of images.current) {
        if (image.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
      }
    },
    [],
  );
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
  const admin = isAdminPath(loc.pathname);
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
  const responsiveAuthPage = isStandaloneLoginPath(loc.pathname) ? (
    <LoginPage desktop={desktop} />
  ) : loc.pathname === "/auth/password-conflict/reset" ? (
    <div className={desktop ? undefined : "ew-mobile-feature"}>
      <ApiV2Routes />
    </div>
  ) : undefined;
  // Reference artboards keep their original dimensions. Mobile canvases cap
  // their width so they stay readable in wider windows.
  const scale =
    desktop || reference
      ? Math.min(1, viewport.width / 390)
      : Math.min(520, viewport.width) / 390;
  const height = Math.max(640, viewport.height / scale);
  const navigationSection =
    ["/me/edit", "/me/details"].includes(loc.pathname) ||
    (loc.pathname === "/me/shares" &&
      new URLSearchParams(loc.search).get("tab") === "comments")
      ? null
      : loc.pathname === "/" || loc.pathname === "/home-photo"
        ? "home"
        : loc.pathname === "/nearby"
          ? "nearby"
          : profileSection(loc.pathname)
            ? "me"
            : null;
  useEffect(() => {
    setPanel(null);
  }, [loc.pathname]);
  useContentMotion(
    () =>
      !admin && !desktop && !reference && !showIndex
        ? document.querySelector<HTMLElement>(
            ".mobile-viewport, .ew-mobile-feature, .mobile-page-native",
          )
        : null,
    loc.pathname,
    0,
    // Animate page content only; the shared navigation stays mounted outside it.
    "opacity",
  );
  useLayoutEffect(() => {
    document.body.classList.toggle("desktop-mode", desktop && !admin);
    document.body.classList.toggle("admin-mode", admin);
    return () => document.body.classList.remove("desktop-mode", "admin-mode");
  }, [desktop, admin]);
  useEffect(() => {
    if (!admin) document.title = browserTitle(loc.pathname);
  }, [loc.pathname, admin]);
  const state = {
    foodId,
    shopId,
    setFoodId,
    setShopId,
    panel,
    openPanel: (name: string) => setPanel(name),
    closePanel: () => setPanel(null),
    notice: (text: string) => {
      app.toast(text);
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
    meal: mealName(mealSlot) ?? "晚饭",
    mealAuto: !manualMeal,
    mealTime: manualMeal,
    mealKey: manualMeal ?? "auto:" + autoMeal,
    setMeal: (name: string) => {
      const slot = mealOptions.find(
        (x) => x.name === name || x.id === name,
      )?.id;
      if (!slot) return;
      const now = Date.now();
      setClock(now);
      setMealPick({ slot, until: mealSlotEnd(now) });
    },
    setMealAuto: () => {
      setClock(Date.now());
      setMealPick(null);
    },
    noteServedMeal: (used: string | null | undefined) => {
      const slot = mealOptions.find((x) => x.id === used)?.id;
      if (slot && !manualMeal)
        setServedMeal((last) =>
          last?.slot === autoMeal && last.used === slot
            ? last
            : { slot: autoMeal, used: slot },
        );
    },
    scene,
    setScene: (next: RecommendScene) => {
      setSceneState(next);
      try {
        localStorage.setItem(SCENE_KEY, next);
      } catch {
        // Private mode or blocked storage: the choice lasts for this visit.
      }
    },
  };
  if (
    (desktop || new URLSearchParams(loc.search).get("tab") === "comments") &&
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
  if (
    !desktop &&
    !reference &&
    loc.pathname === "/me/shares" &&
    new URLSearchParams(loc.search).get("tab") !== "comments"
  ) {
    const params = new URLSearchParams(loc.search);
    if (!params.has("tab")) params.set("tab", "uploads");
    return <Navigate replace to={"/me?" + params} state={loc.state} />;
  }
  return (
    <DesignRegistryContext.Provider value={controllers}>
      <MobileContext.Provider value={state}>
        {admin ? (
          <div inert={!!noticePresence.value || undefined}>
            <Suspense fallback={<ContentSkeleton kind="rows" count={4} />}>
              <AdminApp />
            </Suspense>
          </div>
        ) : (
          <>
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
              responsivePage={responsiveAuthPage}
            >
              <Suspense fallback={<ContentSkeleton kind="form" count={3} />}>
                {!desktop &&
                !reference &&
                ["/comments", "/comments/write"].includes(loc.pathname) ? (
                  <MobileComments />
                ) : !desktop &&
                  !reference &&
                  loc.pathname === "/me/shares" &&
                  new URLSearchParams(loc.search).get("tab") === "comments" ? (
                  <MobileMyComments />
                ) : !desktop && !reference && loc.pathname === "/help" ? (
                  <div className="ew-mobile-feature profile-mobile-page">
                    <ProfileHelp />
                  </div>
                ) : !desktop &&
                  !reference &&
                  mobileSettingsPages[loc.pathname] ? (
                  <MobileSettingsPages key={loc.pathname} />
                ) : !desktop && !reference && isV4Path(loc.pathname) ? (
                  <div className="ew-mobile-feature">
                    <V4Routes key={loc.pathname} />
                  </div>
                ) : !desktop &&
                  !reference &&
                  /^\/users\/\d+$/.test(loc.pathname) ? (
                  <div className="ew-mobile-feature">
                    <ApiV2Routes key={loc.pathname} />
                  </div>
                ) : !desktop &&
                  !reference &&
                  loc.pathname === "/settings/account" ? (
                  <MobileAccountSettings />
                ) : loc.pathname === "/follows" ? null : !desktop &&
                  !reference &&
                  (loc.pathname === "/search" ||
                    loc.pathname === "/favorites" ||
                    /^\/foods\/\d+\/edit$/.test(loc.pathname) ||
                    isShopEditPath(loc.pathname)) ? (
                  <div className="ew-mobile-feature">
                    {loc.pathname === "/search" ? (
                      <Catalog />
                    ) : loc.pathname === "/favorites" ? (
                      <Catalog favorites />
                    ) : /^\/foods\/\d+\/edit$/.test(loc.pathname) ? (
                      <EditFood />
                    ) : (
                      <EditRestaurant />
                    )}
                  </div>
                ) : loc.pathname === "/me/details" ? (
                  <Navigate
                    to="/me/edit"
                    replace
                    state={{ returnTo: profileReturnTo }}
                  />
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
                ) : ["/restaurants/new", "/restaurants/new/details"].includes(
                    loc.pathname,
                  ) ? (
                  <FeatureAvailability name="newShop">
                    <NewShopDetails
                      draft={draft}
                      nameHint={draft.shopName ?? ""}
                    />
                  </FeatureAvailability>
                ) : reference &&
                  (manifest as any)[screen]?.preview?.width !== 390 ? (
                  <div className="mobile-support-page">
                    {Render && (
                      <Render key={screen} screen={screen} reference />
                    )}
                  </div>
                ) : (
                  <div
                    className={`mobile-viewport${!reference && ["G2-Home", "G-HomePhoto"].includes(screen) ? " mobile-fluid-home" : ""}${!reference && screen === "G-Dish" ? " mobile-fluid-detail" : ""}${!reference && screen === "G-Detail" ? " mobile-fluid-restaurant" : ""}${!reference && screen === "G-EditProfile" ? " mobile-fluid-profile-edit" : ""}${!reference && screen === "G-Me" ? " mobile-fluid-profile" : ""}`}
                    style={
                      {
                        minHeight:
                          !reference &&
                          ["G-Detail", "G-EditProfile"].includes(screen)
                            ? viewport.height
                            : height * scale,
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
                            (loc.state as { userName?: string } | null)
                              ?.userName
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
            {!desktop && !reference && !showIndex && navigationSection && (
              <div
                className="mobile-main-navigation"
                aria-hidden={
                  panelPresence.value || noticePresence.value ? true : undefined
                }
                inert={
                  panelPresence.value || noticePresence.value ? true : undefined
                }
              >
                <DesignNav active={navigationSection} />
              </div>
            )}
            <ProfilePeopleDialog />
          </>
        )}
        {!admin && Panel && (
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
              <SheetHandle
                mode="dismiss"
                label="操作提示"
                disabled={confirmBusy}
                onDismiss={() => {
                  if (confirmationLock.current) return;
                  setMessage("");
                  setConfirmation(null);
                }}
              />
              <h2>{admin ? "确认操作" : "这件事，和你说一下"}</h2>
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
                        app.toast(
                          errorMessage(error) +
                            (resultUncertain(error)
                              ? " 请先刷新列表核实操作结果。"
                              : ""),
                          { tone: "error" },
                        );
                        setMessage("");
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
    [error, setError] = useFeedbackState(),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [position, setPosition] = useState<MapPoint>(),
    [name, setName] = useState(nameHint),
    [address, setAddress] = useState(""),
    [traits, setTraits] = useState(defaultShopTraits);
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
            const point = requireShopLocation(position);
            if (!traits.mealTimes.length)
              throw new Error("请至少选择一个营业饭点。");
            const created = await api.createRestaurant({
              name: boundedText(String(d.get("name")), 20, "店名"),
              address: boundedText(address, 30, "地址"),
              ...point,
              hubId: area?.hubId,
              ...traits,
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
          <span>
            店名
            <FieldMark required />
          </span>
          <input
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={20}
            disabled={busy || uncertain}
            required
          />
        </label>
        <RestaurantLocationField
          name={name}
          onNameChange={setName}
          point={position}
          onPick={(point) => {
            setPosition(point);
            setError("");
          }}
          address={address}
          onAddressChange={setAddress}
          disabled={busy || uncertain}
        />
        <ShopTraitsFields
          value={traits}
          onChange={setTraits}
          disabled={busy || uncertain}
        />
        {uncertain && (
          <p className="mobile-error">
            提交结果尚未确认，请返回列表核实，避免重复创建。
          </p>
        )}
        <PrimaryButton disabled={busy || uncertain || !position}>
          {busy ? "正在提交…" : position ? "提交新店" : "请先在地图选点"}
        </PrimaryButton>
      </form>
    </div>
  );
}
