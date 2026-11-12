import { lazy, Suspense, useEffect } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { V2Provider, isV2Demo, useV2 } from "./state";
import {
  AuthPage,
  AccountSettings,
  Devices,
  PublicPolicy,
  Reconsent,
  Verification,
} from "./account";
import { Discover } from "./discover";
import {
  Directory,
  RestaurantDetail,
  RestaurantEditorRoute,
} from "./restaurants";
import { FoodCollection, FoodDetail, FoodEditor } from "./foods";
import {
  BrowseHistory,
  Feedback,
  MyComments,
  Notifications,
  PushSettings,
  RemoteConfigBanner,
  TelemetryReporter,
} from "./operations";
import {
  OtherProfile,
  People,
  Preferences,
  Privacy,
  Profile,
  ProfileEditor,
  Settings,
} from "./profile";
import { Require } from "./ui";
import { DesignIcon } from "../mobile/ui";
import {
  DesktopFooter,
  DesktopNavigation,
  MobileNavigation,
  useDesktopWorkspace,
} from "./layout";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource-variable/bricolage-grotesque";
import "./app.css";
import "../mobile/mobile.css";
import "../desktop/desktop.css";
import "../features/latest.css";
import "../responsive.css";
import "../motion/motion.css";
import "./discover.css";

const Admin = lazy(() =>
  import("./admin").then((module) => ({ default: module.Admin })),
);
const DesignReference = lazy(() => import("./reference"));

export default function V2App() {
  const { pathname } = useLocation();
  if (
    pathname === "/design" ||
    pathname.startsWith("/design/") ||
    pathname.startsWith("/reference/")
  )
    return (
      <Suspense fallback={<p role="status">正在加载画板…</p>}>
        <DesignReference />
      </Suspense>
    );
  return (
    <V2Provider>
      <Workspace />
    </V2Provider>
  );
}

function Workspace() {
  const { pathname, search } = useLocation();
  const { consentRequired, session, user } = useV2();
  const admin = /^\/admin(?:\/|$)/.test(pathname);
  const desktop = useDesktopWorkspace() && !admin;
  const home = pathname === "/";
  const mobileNav =
    !desktop &&
    !admin &&
    !/^\/auth(?:\/|$)|\/edit$|^\/restaurants\/new(?:\/|$)/.test(pathname);
  const isConsent = pathname === "/auth/consent";
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  if (consentRequired && session && !isConsent && pathname !== "/data-notice")
    return (
      <Navigate
        to={"/auth/consent?next=" + encodeURIComponent(pathname + search)}
        replace
      />
    );

  return (
    <div
      className={
        "v2-app" + (admin ? " v2-admin-app" : desktop ? " pc-app" : " v2-phone")
      }
    >
      <a
        className="v2-skip"
        href="#v2-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("v2-content")?.focus();
        }}
      >
        跳到页面内容
      </a>
      {desktop ? (
        <DesktopNavigation />
      ) : (
        (!home || admin) && (
          <header className="v2-header">
            <div>
              <Link className="v2-brand" to="/">
                <span>
                  <DesignIcon name="bowl" size={20} />
                </span>
                山软今天吃什么
              </Link>
              <div className="v2-header-actions">
                {isV2Demo && <span className="v2-demo-label">演示</span>}
                {user?.role === "admin" && !admin && (
                  <Link to="/admin">管理后台</Link>
                )}
                {!session && <Link to="/auth">登录</Link>}
              </div>
            </div>
          </header>
        )
      )}
      <RemoteConfigBanner />
      <TelemetryReporter />
      <main
        className={
          desktop ? "pc-main" : home ? "v2-mobile-home-main" : "v2-main"
        }
        id="v2-content"
        tabIndex={-1}
        key={session?.tokenValue ?? "guest"}
      >
        <Suspense
          fallback={
            <p className="v2-state" role="status">
              正在加载…
            </p>
          }
        >
          <Routes>
            <Route index element={<Discover desktop={desktop} />} />
            <Route path="recommend" element={<Navigate to="/" replace />} />
            <Route path="home-photo" element={<Navigate to="/" replace />} />
            <Route
              path="nearby"
              element={<Directory key="nearby" mode="nearby" />}
            />
            <Route
              path="restaurants"
              element={<Navigate to="/nearby" replace />}
            />
            <Route
              path="restaurants/directory"
              element={<Navigate to="/nearby" replace />}
            />
            <Route
              path="search"
              element={
                <Directory
                  key={"search" + search}
                  mode="search"
                  initialKeyword={new URLSearchParams(search).get("q") ?? ""}
                />
              }
            />
            <Route
              path="favorites"
              element={
                <Require>
                  <Directory key="favorites" mode="favorites" />
                </Require>
              }
            />
            <Route
              path="notifications"
              element={
                <Require>
                  <Notifications />
                </Require>
              }
            />
            <Route
              path="history"
              element={
                <Require>
                  <BrowseHistory />
                </Require>
              }
            />
            <Route
              path="comments/my"
              element={
                <Require>
                  <MyComments />
                </Require>
              }
            />
            <Route
              path="feedback"
              element={
                <Require>
                  <Feedback />
                </Require>
              }
            />
            <Route
              path="restaurants/favorites"
              element={<Navigate to="/favorites" replace />}
            />
            <Route path="restaurants/new" element={<RestaurantEditorRoute />} />
            <Route
              path="restaurants/new/details"
              element={<Navigate to="/restaurants/new" replace />}
            />
            <Route path="restaurants/:id" element={<ShopRoute />} />
            <Route path="restaurants/:id/edit" element={<ShopRoute edit />} />
            <Route
              path="foods/favorites"
              element={
                <Require>
                  <FoodCollection mode="favorites" />
                </Require>
              }
            />
            <Route
              path="foods/my"
              element={
                <Require>
                  <FoodCollection mode="mine" />
                </Require>
              }
            />
            <Route path="foods/new" element={<FoodEditorRoute />} />
            <Route path="foods/:id" element={<FoodRoute />} />
            <Route path="foods/:id/edit" element={<FoodEditorRoute edit />} />
            <Route path="auth" element={<AuthPage />} />
            <Route path="auth/password" element={<AuthPage />} />
            <Route path="auth/forgot" element={<AuthPage />} />
            <Route path="auth/register/*" element={<AuthPage />} />
            <Route path="auth/username-register" element={<AuthPage />} />
            <Route
              path="auth/consent"
              element={
                session ? <Reconsent /> : <Navigate to="/auth" replace />
              }
            />
            <Route path="data-notice" element={<PublicPolicy />} />
            <Route
              path="verify/*"
              element={
                <Require>
                  <Verification />
                </Require>
              }
            />
            <Route
              path="me"
              element={
                <Require>
                  <Profile />
                </Require>
              }
            />
            <Route
              path="me/edit"
              element={
                <Require>
                  <ProfileEditor />
                </Require>
              }
            />
            <Route
              path="me/details"
              element={<Navigate to="/me/edit" replace />}
            />
            <Route
              path="users/:id"
              element={
                <Require>
                  <PersonRoute />
                </Require>
              }
            />
            <Route
              path="follows"
              element={
                <Require>
                  <FollowsRoute />
                </Require>
              }
            />
            <Route
              path="settings"
              element={
                <Require>
                  <Settings />
                </Require>
              }
            />
            <Route
              path="settings/account"
              element={<Navigate to="/settings" replace />}
            />
            <Route
              path="settings/phone"
              element={
                <Require>
                  <AccountSettings key="phone" page="phone" />
                </Require>
              }
            />
            <Route
              path="settings/bind-phone"
              element={<Navigate to="/settings/phone" replace />}
            />
            <Route
              path="settings/password"
              element={
                <Require>
                  <AccountSettings key="password" page="password" />
                </Require>
              }
            />
            <Route
              path="settings/username"
              element={
                <Require>
                  <AccountSettings key="username" page="username" />
                </Require>
              }
            />
            <Route
              path="settings/privacy"
              element={
                <Require>
                  <Privacy />
                </Require>
              }
            />
            <Route
              path="settings/devices"
              element={
                <Require>
                  <Devices />
                </Require>
              }
            />
            <Route
              path="settings/blocked"
              element={
                <Require>
                  <People kind="blocks" />
                </Require>
              }
            />
            <Route
              path="settings/preferences"
              element={
                <Require>
                  <Preferences />
                </Require>
              }
            />
            <Route
              path="settings/notifications"
              element={
                <Require>
                  <PushSettings />
                </Require>
              }
            />
            <Route
              path="settings/about"
              element={<Navigate to="/help" replace />}
            />
            <Route
              path="help"
              element={
                <section className="v2-panel">
                  <h1>帮助</h1>
                  <div className="v2-links">
                    <Link to="/auth/forgot">找回密码</Link>
                    <Link to="/data-notice">隐私政策和数据跨境说明</Link>
                  </div>
                </section>
              }
            />
            <Route path="admin/v4" element={<OldAdmin />} />
            <Route path="admin" element={<OldAdmin />} />
            <Route path="admin/:module/:id?" element={<Admin />} />
            <Route path="*" element={<Unavailable />} />
          </Routes>
        </Suspense>
      </main>
      {desktop && <DesktopFooter />}
      {mobileNav && <MobileNavigation />}
    </div>
  );
}

function OldAdmin() {
  const { search, pathname } = useLocation();
  const tab = new URLSearchParams(search).get("tab");
  if (tab && ["users", "restaurants", "hubs", "policies"].includes(tab))
    return <Navigate replace to={"/admin/" + tab} />;
  return pathname === "/admin/v4" ? (
    <Navigate replace to="/admin" />
  ) : (
    <Admin />
  );
}

function routeId(value: string | null | undefined) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function ShopRoute({ edit = false }: { edit?: boolean }) {
  const { id: raw } = useParams();
  const id = routeId(raw);
  return id ? (
    edit ? (
      <RestaurantEditorRoute key={id} id={id} />
    ) : (
      <RestaurantDetail key={id} id={id} />
    )
  ) : (
    <Unavailable />
  );
}

function PersonRoute() {
  const id = routeId(useParams().id);
  return id ? <OtherProfile key={id} id={id} /> : <Unavailable />;
}

function FoodRoute() {
  const id = routeId(useParams().id);
  return id ? <FoodDetail key={id} id={id} /> : <Unavailable />;
}

function FoodEditorRoute({ edit = false }: { edit?: boolean }) {
  const id = routeId(useParams().id);
  const restaurantId = routeId(
    new URLSearchParams(useLocation().search).get("restaurantId"),
  );
  if (edit && !id) return <Unavailable />;
  if (!edit && !restaurantId) return <Unavailable />;
  return (
    <Require edit>
      <FoodEditor id={edit ? id : undefined} restaurantId={restaurantId} />
    </Require>
  );
}

function FollowsRoute() {
  const query = new URLSearchParams(useLocation().search);
  const kind = query.get("kind") === "followers" ? "followers" : "followings";
  const userId = routeId(query.get("userId"));
  return <People key={kind + ":" + userId} kind={kind} userId={userId} />;
}

function Unavailable() {
  const { pathname } = useLocation();
  const retired =
    /^\/(?:publish|topics|activities|activity|submissions|reports|features|announcements|me\/(?:tags|shares|growth)|settings\/(?:telemetry|delete)|auth\/(?:device-recovery|mobile-recovery|account-recovery|password-conflict)|restaurants\/correction)(?:\/|$)/.test(
      pathname,
    );
  return (
    <section className="v2-panel v2-state">
      <h1>{retired ? "该功能暂未开放" : "找不到这个页面"}</h1>
      <Link className="v2-primary" to="/">
        回到发现
      </Link>
    </section>
  );
}
