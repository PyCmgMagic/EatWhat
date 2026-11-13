import { Fragment, lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminModules, resolveAdminRoute } from "../app/admin-routes";
import { useApp } from "../app/state";
import { useArea } from "../app/area";
import { isDemo } from "../app/runtime";
import { LoginLink } from "../app/auth-dialog";
import { mediaUrl } from "../api/models";
import { errorMessage } from "../api/client";
import { DesignIcon as Icon } from "../mobile/ui";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import WorkspaceSwitch from "./WorkspaceSwitch";
import "../features/v4/v4.css";
import "../features/v4/design.css";
import "./admin.css";

const Directory = lazy(() => import("../pages/Admin"));
const Operations = lazy(() => import("../features/v4/Admin"));

export default function AdminApp() {
  const { user, session, me } = useApp(),
    location = useLocation();
  const { campusId } = useArea();
  const route = resolveAdminRoute(location.pathname, location.search);
  const [menu, setMenu] = useState(false),
    menuButton = useRef<HTMLButtonElement>(null);
  const previous = useRef(location.pathname);
  useEffect(() => {
    const wide = matchMedia("(min-width: 761px)");
    const close = () => {
      if (wide.matches) setMenu(false);
    };
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);
  useEffect(() => {
    setMenu(false);
    if (previous.current !== location.pathname) {
      window.scrollTo({ top: 0, behavior: "instant" });
      document
        .getElementById("admin-page-title")
        ?.focus({ preventScroll: true });
      previous.current = location.pathname;
    }
    document.title = `${route.module?.title ?? "管理后台"} · EatWhat 管理后台`;
  }, [location.pathname, route.module?.title]);
  useEffect(() => {
    if (!menu) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document
      .querySelector<HTMLAnchorElement>(
        '#admin-navigation nav a[aria-current="page"]',
      )
      ?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
      document.body.style.overflow = previousOverflow;
    };
  }, [menu]);
  if (route.redirect)
    return <Navigate replace to={route.redirect} state={location.state} />;
  const authorized = !!session && user?.role === "admin" && !user.banned;
  if (!authorized)
    return (
      <div className="admin-app admin-access">
        <Link className="admin-brand" to="/">
          <span className="admin-brand-icon">
            <Icon name="bowl" size={25} />
          </span>
          <span>
            EatWhat<small>管理后台</small>
          </span>
        </Link>
        <main className="admin-access-card">
          {session && me.isPending ? (
            <ContentSkeleton kind="rows" count={2} />
          ) : session && me.isError ? (
            <>
              <h1>暂时无法核实账号</h1>
              <p>{errorMessage(me.error)}</p>
              <button
                className="admin-solid-button"
                onClick={() => void me.refetch()}
              >
                重新加载
              </button>
            </>
          ) : !session ? (
            <>
              <Icon name="lock" size={34} />
              <h1>登录管理后台</h1>
              <LoginLink
                className="admin-solid-button"
                to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`}
              >
                登录
              </LoginLink>
              <Link to="/">返回前台</Link>
            </>
          ) : (
            <>
              <Icon name="shield" size={34} />
              <h1>{user?.banned ? "账号暂时无法使用" : "需要管理员身份"}</h1>
              <Link className="admin-solid-button" to="/me">
                返回前台
              </Link>
            </>
          )}
        </main>
      </div>
    );
  const module = route.module;
  return (
    <div className="admin-app">
      <a
        className="admin-skip"
        href="#admin-main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("admin-main")?.focus();
        }}
      >
        跳到管理内容
      </a>
      <aside
        className="admin-sidebar"
        id="admin-navigation"
        data-open={menu || undefined}
        aria-label="后台导航"
      >
        <button
          className="admin-drawer-close"
          aria-label="关闭管理菜单"
          onClick={() => {
            setMenu(false);
            menuButton.current?.focus();
          }}
        >
          <Icon name="close" size={20} />
        </button>
        <Link className="admin-brand" to="/admin">
          <span className="admin-brand-icon">
            <Icon name="bowl" size={25} />
          </span>
          <span>
            EatWhat<small>管理后台</small>
          </span>
        </Link>
        <nav aria-label="管理模块">
          {adminModules.map((item, index) => (
            <Fragment key={item.id}>
              {item.group !== adminModules[index - 1]?.group && (
                <span className="admin-nav-group">{item.group}</span>
              )}
              <Link
                to={item.path}
                aria-current={module?.id === item.id ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                <Icon name={item.icon} size={20} />
                <span>{item.title}</span>
                {module?.id === item.id && <i />}
              </Link>
            </Fragment>
          ))}
        </nav>
        <div className="admin-identity">
          <span className="admin-avatar">
            {mediaUrl(user.avatar) ? (
              <img src={mediaUrl(user.avatar)} alt="" />
            ) : (
              Array.from(user.displayName || "管")[0]
            )}
          </span>
          <span>
            <strong>{user.displayName || "管理员"}</strong>
            <small>
              管理员{isDemo && <span className="admin-demo">演示</span>}
            </small>
          </span>
        </div>
      </aside>
      {menu && (
        <button
          className="admin-scrim"
          aria-label="关闭后台导航"
          onClick={() => {
            setMenu(false);
            menuButton.current?.focus();
          }}
        />
      )}
      <div className="admin-workspace" inert={menu || undefined}>
        <header className="admin-topbar">
          <div className="admin-location">
            <button
              ref={menuButton}
              type="button"
              className="admin-menu-toggle"
              aria-label={menu ? "关闭管理菜单" : "打开管理菜单"}
              aria-expanded={menu}
              aria-controls="admin-navigation"
              onClick={() => setMenu((v) => !v)}
            >
              <Icon name="tool" size={22} />
            </button>
            <span>管理后台</span>
            {module && (
              <>
                <Icon name="chevronRight" size={14} />
                <strong>{module.title}</strong>
              </>
            )}
          </div>
          <WorkspaceSwitch mode="front" />
        </header>
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          <header className="admin-page-heading">
            <div>
              <span className="admin-page-group">
                {module?.group ?? "管理后台"}
              </span>
              <h1 id="admin-page-title" tabIndex={-1}>
                {module?.title ?? "页面不存在"}
              </h1>
            </div>
          </header>
          {module ? (
            <div
              className={`admin-content v4-page admin-content-${module.id}`}
              data-section="admin"
              data-route={module.path}
            >
              <Suspense fallback={<ContentSkeleton kind="rows" count={4} />}>
                {module.source === "directory" ? (
                  <div className="admin-directory legacy-admin">
                    <Directory key={module.id} tab={module.id} />
                  </div>
                ) : (
                  <Operations key={module.id} tab={module.id} />
                )}
              </Suspense>
            </div>
          ) : (
            <div className="admin-empty-page">
              <p>这个管理页面不存在。</p>
              <Link className="admin-solid-button" to="/admin">
                返回数据概览
              </Link>
            </div>
          )}
          {module?.id === "summary" && (
            <section
              className="admin-shortcuts"
              aria-labelledby="admin-shortcuts-title"
            >
              <h2 id="admin-shortcuts-title">常用管理</h2>
              <div>
                {adminModules
                  .filter((item) =>
                    ["feedback", "users", "foods", "restaurants"].includes(
                      item.id,
                    ),
                  )
                  .map((item) => (
                    <Link key={item.id} to={item.path}>
                      <span>
                        <Icon name={item.icon} size={22} />
                      </span>
                      <strong>{item.title}</strong>
                      <Icon name="chevronRight" size={17} />
                    </Link>
                  ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function CampusSelector() {
  const { api } = useApp(),
    { campusId, selectCampus } = useArea();
  const q = useQuery({
    queryKey: ["campuses"],
    queryFn: () => api.campuses(),
    staleTime: 300000,
  });
  return (
    <label className="admin-campus">
      校区
      <select
        value={campusId ?? ""}
        disabled={q.isPending || q.isError}
        onChange={(e) => selectCampus(Number(e.target.value))}
      >
        <option value="" disabled>
          {q.isError ? "校区加载失败" : "选择校区"}
        </option>
        {q.data
          ?.filter((c) => c.open !== false)
          .map((c) => (
            <option key={c.id} value={c.id!}>
              {c.name}
            </option>
          ))}
      </select>
      {q.isError && <button onClick={() => void q.refetch()}>重试</button>}
    </label>
  );
}
