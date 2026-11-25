import {
  Fragment,
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  adminModules,
  resolveAdminRoute,
  type AdminModuleId,
} from "../app/admin-routes";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { LoginLink } from "../app/auth-dialog";
import { errorMessage } from "../api/client";
import { Modal } from "../components/ui";
import { Avatar, Icon, num } from "./kit";
import WorkspaceSwitch from "./WorkspaceSwitch";
import { ThemeToggle } from "../theme/AppearanceControl";
import "./admin.css";

const pages: Record<AdminModuleId, ReturnType<typeof lazy>> = {
  summary: lazy(() => import("./modules/Overview")),
  engagement: lazy(() => import("./modules/Engagement")),
  telemetry: lazy(() => import("./modules/Telemetry")),
  foods: lazy(() => import("./modules/Foods")),
  restaurants: lazy(() => import("./modules/Restaurants")),
  hubs: lazy(() =>
    import("./modules/Restaurants").then((m) => ({ default: m.Hubs })),
  ),
  feedback: lazy(() => import("./modules/Feedback")),
  users: lazy(() => import("./modules/Users")),
  announcements: lazy(() =>
    import("./modules/Site").then((m) => ({ default: m.Announcements })),
  ),
  config: lazy(() =>
    import("./modules/Site").then((m) => ({ default: m.Config })),
  ),
  versions: lazy(() =>
    import("./modules/Site").then((m) => ({ default: m.Versions })),
  ),
  "consent-policies": lazy(() => import("./modules/ConsentPolicies")),
  ai: lazy(() => import("./modules/Site").then((m) => ({ default: m.Ai }))),
  audit: lazy(() =>
    import("./modules/Site").then((m) => ({ default: m.Audit })),
  ),
};

const compactAdmin = "(max-width: 960px)";

function Brand({ to, onClick }: { to: string; onClick?: () => void }) {
  return (
    <Link className="admin-brand" to={to} onClick={onClick}>
      <span className="admin-brand-icon">
        <Icon name="bowl" size={20} />
      </span>
      <span>
        EatWhat<small>管理后台</small>
      </span>
    </Link>
  );
}

function UserTotal() {
  const { api } = useApp();
  const summary = useQuery({
    queryKey: ["admin", "summary"],
    queryFn: () => api.summary(),
  });
  const total = summary.data?.totalUsers;
  return (
    <p aria-live="polite">
      用户总数{" "}
      {total != null ? (
        <strong>{num(total)} 人</strong>
      ) : summary.isPending ? (
        "加载中…"
      ) : (
        "暂时无法获取"
      )}
    </p>
  );
}

export default function AdminApp() {
  const { user, session, me } = useApp(),
    location = useLocation();
  const route = resolveAdminRoute(location.pathname, location.search);
  const [compact, setCompact] = useState(
      () => matchMedia(compactAdmin).matches,
    ),
    [menu, setMenu] = useState(false),
    [palette, setPalette] = useState(false),
    menuButton = useRef<HTMLButtonElement>(null),
    paletteButton = useRef<HTMLButtonElement>(null),
    paletteFocus = useRef<HTMLElement | null>(null),
    restoreMenuFocus = useRef(false);
  const previous = useRef(location.pathname);
  const authorized = !!session && user?.role === "admin" && !user.banned;

  function closeMenu(restoreFocus: boolean) {
    restoreMenuFocus.current = restoreFocus;
    setMenu(false);
  }

  useEffect(() => {
    const media = matchMedia(compactAdmin);
    const change = () => {
      setCompact(media.matches);
      if (!media.matches) setMenu(false);
    };
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    setMenu(false);
    setPalette(false);
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
    if (!authorized) return;
    const listener = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (palette || document.querySelector("dialog[open]")) return;
        e.preventDefault();
        const active = document.activeElement;
        paletteFocus.current =
          active instanceof HTMLElement && active !== document.body
            ? active
            : paletteButton.current;
        setPalette(true);
      } else if (
        menu &&
        e.key === "Escape" &&
        !document.querySelector("dialog[open]")
      ) {
        e.preventDefault();
        closeMenu(true);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [authorized, menu, palette]);
  useLayoutEffect(() => {
    if (!authorized) return;
    if (!menu) {
      if (restoreMenuFocus.current) {
        restoreMenuFocus.current = false;
        menuButton.current?.focus({ preventScroll: true });
      }
      return;
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const currentLink =
      document.querySelector<HTMLAnchorElement>(
        '#admin-navigation nav a[aria-current="page"]',
      ) ?? document.querySelector<HTMLAnchorElement>("#admin-navigation nav a");
    currentLink?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [authorized, menu]);
  if (route.redirect)
    return <Navigate replace to={route.redirect} state={location.state} />;
  if (!authorized)
    return (
      <div className="admin-app admin-access">
        <Brand to="/" />
        <main className="admin-access-card">
          {session && me.isPending ? (
            <div className="ew-admin-skeleton" aria-busy="true">
              <span />
              <span />
            </div>
          ) : session && me.isError ? (
            <>
              <h1>暂时无法核实账号</h1>
              <p>{errorMessage(me.error)}</p>
              <button
                className="ew-admin-btn is-primary"
                onClick={() => void me.refetch()}
              >
                重新加载
              </button>
            </>
          ) : !session ? (
            <>
              <span className="admin-access-mark">
                <Icon name="lock" size={26} />
              </span>
              <h1>登录管理后台</h1>
              <p>使用管理员账号登录后继续。</p>
              <LoginLink
                className="ew-admin-btn is-primary"
                to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`}
              >
                登录
              </LoginLink>
              <Link className="ew-admin-link" to="/">
                返回前台
              </Link>
            </>
          ) : (
            <>
              <span className="admin-access-mark">
                <Icon name="shield" size={26} />
              </span>
              <h1>{user?.banned ? "账号暂时无法使用" : "需要管理员身份"}</h1>
              <p>当前账号没有进入管理后台的权限。</p>
              <Link className="ew-admin-btn is-primary" to="/me">
                返回前台
              </Link>
            </>
          )}
        </main>
      </div>
    );
  const module = route.module,
    Page = module && pages[module.id];
  return (
    <div className="admin-app">
      <a
        className="admin-skip"
        inert={menu || undefined}
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
        inert={(compact && !menu) || undefined}
        aria-hidden={(compact && !menu) || undefined}
        aria-label="后台导航"
      >
        <Brand
          to="/admin"
          onClick={() => menu && closeMenu(location.pathname === "/admin")}
        />
        <Navigation
          current={module?.id}
          onNavigate={(path) => menu && closeMenu(location.pathname === path)}
        />
        <div className="admin-identity">
          <Avatar src={user.avatar} name={user.displayName || "管"} size={36} />
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
          type="button"
          className="admin-scrim"
          aria-label="关闭后台导航"
          onClick={() => closeMenu(true)}
        />
      )}
      <div className="admin-workspace" inert={menu || undefined}>
        <header className="admin-topbar">
          <button
            ref={menuButton}
            type="button"
            className="ew-admin-icon-btn admin-menu-toggle"
            aria-label={menu ? "关闭管理菜单" : "打开管理菜单"}
            aria-expanded={menu}
            aria-controls="admin-navigation"
            onClick={() => setMenu((v) => !v)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M3 5.5h14M3 10h14M3 14.5h14"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <nav className="admin-crumbs" aria-label="当前位置">
            <span>{module?.group ?? "管理后台"}</span>
            {module && (
              <>
                <Icon name="chevronRight" size={13} />
                <strong>{module.title}</strong>
              </>
            )}
          </nav>
          <button
            ref={paletteButton}
            type="button"
            className="admin-jump"
            aria-label="跳转到模块"
            aria-haspopup="dialog"
            aria-expanded={palette}
            onClick={(event) => {
              paletteFocus.current = event.currentTarget;
              setPalette(true);
            }}
          >
            <Icon name="search" size={16} />
            <span>跳转到模块</span>
            <kbd>⌘K</kbd>
          </button>
          <ThemeToggle />
          <WorkspaceSwitch mode="front" />
        </header>
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          <header className="admin-page-heading">
            <h1 id="admin-page-title" tabIndex={-1}>
              {module?.title ?? "页面不存在"}
            </h1>
            {module?.id === "users" ? (
              <UserTotal />
            ) : (
              module && module.id !== "feedback" && <p>{module.detail}</p>
            )}
          </header>
          {Page ? (
            <div className="admin-content" data-module={module.id}>
              <Suspense
                fallback={
                  <div className="ew-admin-skeleton" aria-busy="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                }
              >
                <Page key={module.id} />
              </Suspense>
            </div>
          ) : (
            <div className="ew-admin-state is-tall">
              <Icon name="question" size={30} />
              <strong>这个管理页面不存在</strong>
              <Link className="ew-admin-btn is-primary" to="/admin">
                返回数据概览
              </Link>
            </div>
          )}
        </main>
      </div>
      {palette && (
        <Palette
          onClose={() => setPalette(false)}
          origin={paletteButton.current}
          returnFocus={paletteFocus.current}
        />
      )}
    </div>
  );
}

function Navigation({
  current,
  onNavigate,
}: {
  current?: AdminModuleId;
  onNavigate: (path: string) => void;
}) {
  const { api } = useApp();
  // Same key as the overview, so the two share one request.
  const open = useQuery({
    queryKey: ["admin", "feedback", "counts"],
    queryFn: () => api.feedbackCounts(),
    staleTime: 60000,
    retry: false,
  });
  const badge: Partial<Record<AdminModuleId, number>> = {
    feedback: open.data?.total,
  };
  return (
    <nav aria-label="管理模块">
      {adminModules.map((item, index) => (
        <Fragment key={item.id}>
          {item.group !== adminModules[index - 1]?.group && (
            <span className="admin-nav-group">{item.group}</span>
          )}
          <Link
            to={item.path}
            aria-current={current === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.path)}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.title}</span>
            {!!badge[item.id] && (
              <em aria-label={`${badge[item.id]} 条待处理`}>
                {badge[item.id]! > 99 ? "99+" : badge[item.id]}
              </em>
            )}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}

/** ⌘K: jump to any module by name. */
function Palette({
  onClose,
  origin,
  returnFocus,
}: {
  onClose: () => void;
  origin: HTMLElement | null;
  returnFocus: HTMLElement | null;
}) {
  const navigate = useNavigate(),
    [text, setText] = useState(""),
    [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const selected = useRef<HTMLButtonElement>(null);
  const resultsId = useId();
  const matches = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return adminModules.filter((m) =>
      `${m.title}${m.group}${m.detail}${m.id}`.toLowerCase().includes(needle),
    );
  }, [text]);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };
  return (
    <Modal
      className="admin-palette"
      title="跳转到模块"
      motionOrigin={origin}
      returnFocus={returnFocus}
      onClose={onClose}
      onKeyDown={(event, dismiss) => {
        if (
          !event.nativeEvent.isComposing &&
          event.keyCode !== 229 &&
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "k"
        ) {
          event.preventDefault();
          dismiss();
        }
      }}
    >
      <div>
        <label>
          <Icon name="search" size={18} />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls={resultsId}
            aria-activedescendant={
              matches[index] ? `${resultsId}-${matches[index].id}` : undefined
            }
            value={text}
            placeholder="输入模块名称，例如 用户、公告"
            aria-label="模块名称"
            onChange={(e) => {
              setText(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const step = e.key === "ArrowDown" ? 1 : -1;
                setIndex(
                  (i) => (i + step + matches.length) % (matches.length || 1),
                );
              } else if (e.key === "Enter" && matches[index]) {
                e.preventDefault();
                go(matches[index].path);
              }
            }}
          />
        </label>
        <ul id={resultsId} role="listbox" aria-label="匹配的模块">
          {matches.map((m, i) => (
            <li key={m.id} role="presentation">
              <button
                ref={i === index ? selected : undefined}
                type="button"
                role="option"
                tabIndex={-1}
                id={`${resultsId}-${m.id}`}
                aria-selected={i === index}
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(m.path)}
              >
                <Icon name={m.icon} size={18} />
                <span>
                  {m.title}
                  <small>{m.detail}</small>
                </span>
                <em>{m.group}</em>
              </button>
            </li>
          ))}
        </ul>
        {!matches.length && (
          <p className="is-empty" role="status">
            没有匹配的模块
          </p>
        )}
      </div>
    </Modal>
  );
}
