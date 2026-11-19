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
  type Draft,
  type DraftPatch,
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
import { codePoints } from "../api/content-rules";
import { RemoteBanner, FeatureAvailability } from "../features/v4/Remote";
import { MobileComments } from "../features/comments/Comments";
const V4Routes = lazy(() => import("../features/v4/Routes"));
const ApiV2Routes = lazy(() => import("../features/ApiV2Routes"));
const LoginPage = lazy(() => import("./Login"));
const MobileAccountSettings = lazy(() => import("./AccountSettings"));
const MobileSettingsPages = lazy(() => import("./SettingsPages"));
const MobileNotifications = lazy(() => import("./Notifications"));
const MobileLibrary = lazy(() => import("./MobileLibrary"));
const MobileLikedFoods = lazy(() =>
  import("./MobileLibrary").then((module) => ({
    default: module.MobileLikedFoods,
  })),
);
import { Gate } from "../components/ui";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource-variable/bricolage-grotesque";
import "./mobile.css";
import "./new-shop.css";
import DesktopExperience from "../desktop/Desktop";
import HelpFeedback, { isHelpFeedbackPath } from "../features/HelpFeedback";
import { profileSection } from "../app/profile-workspace";
import { Catalog } from "../features/Catalog";
import { RecommendationControls } from "../features/Account";
import { EditFood } from "../features/EditFood";
import { EditRestaurant, isShopEditPath } from "../features/EditRestaurant";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { useContentMotion, useExitPresence } from "../motion/hooks";
import { desktopLayout, editingFlow } from "../app/layout";
import { isStandaloneLoginPath } from "../app/auth-routes";
import { NotFound } from "../app/navigation";
import { useProfileReturnTo } from "../app/profile-navigation";
import { ProfileDraftProvider } from "../app/profile-draft";
import { useVisibleViewport } from "../app/viewport";
import RestaurantLocationField from "../features/RestaurantLocationField";
import { NewShopSearch } from "../features/NewShopSearch";
import { useNewShop } from "../features/useNewShop";
import SheetHandle from "./SheetHandle";
import { ShopTraitsFields } from "../features/ShopTraits";
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
  const hasPublishDraft = !!(
    draft.name ||
    draft.price ||
    draft.description ||
    draft.images.length ||
    draft.category !== emptyDraft.category ||
    draft.stage ||
    draft.photoEdit ||
    draft.tags.length ||
    draft.tagInput ||
    draft.systemTagIds?.length ||
    draft.signature ||
    draft.mealTimes?.length ||
    draft.deliveryEnabled ||
    draft.restaurantPicked ||
    draft.publishing ||
    draft.publishUncertain
  );
  useEffect(() => {
    if (!hasPublishDraft) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasPublishDraft]);
  images.current = draft.images;
  const photoEdit = useRef(draft.photoEdit);
  photoEdit.current = draft.photoEdit;
  const previousPhotoRoute = useRef(loc.pathname);
  useEffect(() => {
    const leaving =
      previousPhotoRoute.current === "/publish/crop" &&
      loc.pathname !== "/publish/crop";
    previousPhotoRoute.current = loc.pathname;
    const pending = photoEdit.current;
    if (leaving && pending) {
      URL.revokeObjectURL(pending.url);
      setDraftState((current) =>
        current.photoEdit === pending
          ? { ...current, photoEdit: undefined }
          : current,
      );
    }
  }, [loc.pathname]);
  useEffect(
    () => () => {
      for (const image of images.current) {
        if (image.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
      }
      if (photoEdit.current) URL.revokeObjectURL(photoEdit.current.url);
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
    ["/me/edit", "/me/details", "/settings/personalization"].includes(
      loc.pathname,
    ) ||
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
  const navigationPresence = useExitPresence(navigationSection);
  const mobileLibraryPath = loc.pathname.replace(/\/+$/, "");
  const mobileFavorites = ["/favorites", "/restaurants/favorites"].includes(
    mobileLibraryPath,
  );
  useEffect(() => {
    setPanel(null);
  }, [loc.pathname]);
  useContentMotion(
    () =>
      !admin && !desktop && !reference && !showIndex
        ? document.querySelector<HTMLElement>(
            ".mobile-viewport, .ew-mobile-feature, .mobile-page-native, .mobile-library",
          )
        : null,
    isHelpFeedbackPath(loc.pathname)
      ? "/help"
      : mobileFavorites
        ? "/favorites"
        : loc.pathname,
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
    setDraft: (patch: DraftPatch) =>
      setDraftState((d) => ({
        ...d,
        ...(typeof patch === "function" ? patch(d) : patch),
      })),
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
    desktop &&
    loc.pathname === "/me" &&
    !new URLSearchParams(loc.search).has("people")
  ) {
    const legacy = new URLSearchParams(loc.search);
    const tab = legacy.get("tab");
    if (["uploads", "comments", "favorites", "likes"].includes(tab ?? "")) {
      if (tab !== "comments") legacy.delete("tab");
      return (
        <Navigate
          replace
          to={
            (tab === "favorites" ? "/favorites" : tab === "likes" ? "/likes" : "/me/shares") +
            (legacy.size ? "?" + legacy : "")
          }
          state={loc.state}
        />
      );
    }
  }
  if (loc.pathname === "/panels/filter") {
    return (
      <Navigate replace to={desktop ? "/restaurants/directory" : "/nearby?filter=1"} />
    );
  }
  if (!desktop && !reference && loc.pathname === "/me/shares") {
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
                  isHelpFeedbackPath(loc.pathname) ? (
                  <div className="ew-mobile-feature profile-mobile-page">
                    <HelpFeedback />
                  </div>
                ) : !desktop &&
                  !reference &&
                  mobileSettingsPages[loc.pathname] ? (
                  <MobileSettingsPages key={loc.pathname} />
                ) : !desktop &&
                  !reference &&
                  loc.pathname === "/notifications" ? (
                  <Gate verified={false}>
                    <MobileNotifications />
                  </Gate>
                ) : !desktop &&
                  !reference &&
                  loc.pathname === "/announcements" ? (
                  <MobileNotifications />
                ) : !desktop &&
                  !reference &&
                  mobileLibraryPath === "/likes" ? (
                  <MobileLikedFoods />
                ) : !desktop && !reference && mobileFavorites ? (
                  <MobileLibrary />
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
                  /^\/foods\/\d+\/edit$/.test(loc.pathname) ? (
                  <EditFood mobile />
                ) : !desktop &&
                  !reference &&
                  (loc.pathname === "/search" ||
                    isShopEditPath(loc.pathname)) ? (
                  <div className="ew-mobile-feature">
                    {loc.pathname === "/search" ? (
                      <Catalog />
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
                    <Gate>
                      <NewShop />
                    </Gate>
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
                    className={`mobile-viewport${!reference && ["G2-Home", "G-HomePhoto"].includes(screen) ? " mobile-fluid-home" : ""}${!reference && screen === "G-Dish" ? " mobile-fluid-detail" : ""}${!reference && screen === "G-Detail" ? " mobile-fluid-restaurant" : ""}${!reference && screen === "G-PickShop" ? " mobile-fluid-pick-shop" : ""}${!reference && screen === "G-EditProfile" ? " mobile-fluid-profile-edit" : ""}${!reference && screen === "G-Me" ? " mobile-fluid-profile" : ""}`}
                    style={
                      {
                        minHeight:
                          !reference &&
                          ["G-Detail", "G-EditProfile", "G-PickShop"].includes(
                            screen,
                          )
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
            {!desktop &&
              !reference &&
              !showIndex &&
              navigationPresence.value && (
                <div
                  className="mobile-main-navigation"
                  data-exiting={navigationPresence.exiting || undefined}
                  aria-hidden={
                    navigationPresence.exiting ||
                    panelPresence.value ||
                    noticePresence.value
                      ? true
                      : undefined
                  }
                  inert={
                    navigationPresence.exiting ||
                    panelPresence.value ||
                    noticePresence.value
                      ? true
                      : undefined
                  }
                >
                  <DesignNav active={navigationPresence.value} />
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

function NewShop() {
  const flow = useNewShop();
  const { details, draft, busy } = flow;
  const longName = codePoints(draft.name.trim()) > 20;
  return (
    <main
      className="mobile-page-native mobile-new-shop"
      data-step={details ? "details" : "search"}
    >
      <header className="mobile-new-shop-header">
        {details ? (
          <button
            type="button"
            onClick={flow.back}
            disabled={flow.pending}
            aria-label={draft.uncertain ? "返回发布" : "返回搜店"}
          >
            <DesignIcon name="back" size={22} />
          </button>
        ) : (
          <Link to="/publish" aria-label="返回">
            <DesignIcon name="back" size={22} />
          </Link>
        )}
        <h1 id="mobile-new-shop-title">
          {details ? "填写店铺信息" : "添加一家店"}
        </h1>
      </header>
      {draft.uncertain && (
        <p className="mobile-error" role="alert">
          提交结果尚未确认，请返回发布页核实店铺，避免重复添加。
        </p>
      )}
      {details ? (
        <form
          ref={flow.formRef}
          tabIndex={-1}
          aria-labelledby="mobile-new-shop-title"
          className="mobile-new-shop-form"
          onSubmit={(event) => {
            event.preventDefault();
            flow.submit();
          }}
        >
          <label className="mobile-new-shop-name">
            <span>
              店名
              <FieldMark required />
            </span>
            <input
              name="name"
              aria-label="店名"
              aria-describedby={
                longName ? "mobile-new-shop-name-hint" : undefined
              }
              value={draft.name}
              onChange={(event) => flow.update({ name: event.target.value })}
              maxLength={20}
              placeholder="输入店铺名称"
              autoComplete="off"
              disabled={busy}
              required
            />
            {longName && (
              <small id="mobile-new-shop-name-hint">
                请将店名简化至 20 字以内。
              </small>
            )}
          </label>
          <RestaurantLocationField
            place={draft.choice.place}
            point={draft.point}
            onPick={(point) => flow.update({ point })}
            address={draft.address}
            onAddressChange={(address) => flow.update({ address })}
            disabled={busy}
          />
          <ShopTraitsFields
            value={draft.traits}
            onChange={(traits) => flow.update({ traits })}
            disabled={busy}
            compact
          />
          <footer className="mobile-new-shop-footer">
            <PrimaryButton disabled={!flow.canSubmit}>
              {flow.pending ? "正在添加…" : "添加并继续"}
            </PrimaryButton>
          </footer>
        </form>
      ) : (
        <NewShopSearch
          keyword={flow.keyword}
          onKeywordChange={flow.setKeyword}
          onSelect={flow.select}
          disabled={busy}
        />
      )}
    </main>
  );
}
