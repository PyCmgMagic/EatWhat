import { useSyncExternalStore, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { desktopLayout } from "../app/layout";
import { SlidingTabs } from "../desktop/motion";
import { DesignIcon, DesignNavigation, mainDestinations } from "../mobile/ui";
import { isV2Demo, useV2 } from "./state";

function subscribeToViewport(change: () => void) {
  window.addEventListener("resize", change);
  return () => window.removeEventListener("resize", change);
}

export function useDesktopWorkspace() {
  const width = useSyncExternalStore(subscribeToViewport, () => innerWidth);
  return desktopLayout(
    width,
    new URLSearchParams(location.search).get("view"),
    false,
    false,
  );
}

function useNavigationSection() {
  const { pathname } = useLocation();
  if (/^\/(?:nearby|restaurants|search)(?:\/|$)/.test(pathname))
    return "nearby";
  if (
    /^\/(?:me|auth|settings|favorites|foods|comments|notifications|history|feedback|users|follows|verify|data-notice)(?:\/|$)/.test(
      pathname,
    )
  )
    return "me";
  return "home";
}

export function DesktopNavigation() {
  const { session, user } = useV2();
  const active = useNavigationSection();
  const navigate = useNavigate();
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = String(
      new FormData(event.currentTarget).get("q") ?? "",
    ).trim();
    navigate(query ? "/search?q=" + encodeURIComponent(query) : "/search");
  };
  return (
    <header className="pc-header">
      <div className="pc-header-inner">
        <Link className="pc-brand" to="/" aria-label="山软今天吃什么，回到发现">
          <span className="pc-brand-symbol">
            <DesignIcon name="bowl" size={29} />
          </span>
          <span>
            <b>
              山软<span>今天吃什么</span>
            </b>
          </span>
        </Link>
        <SlidingTabs label="桌面主导航" active={active} navigation>
          {mainDestinations.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              aria-current={active === item.key ? "page" : undefined}
            >
              <DesignIcon name={item.icon} size={20} />
              {item.label}
            </Link>
          ))}
        </SlidingTabs>
        <div className="pc-header-actions">
          {user?.role === "admin" && (
            <Link
              className="pc-icon-button"
              to="/admin"
              aria-label="管理后台"
              title="管理后台"
            >
              <DesignIcon name="tool" size={21} />
            </Link>
          )}
          <form className="pc-header-search" role="search" onSubmit={search}>
            <DesignIcon name="search" size={18} />
            <input name="q" aria-label="搜索店铺" placeholder="搜店铺" />
            <button aria-label="开始搜索">
              <DesignIcon name="chevronRight" size={16} />
            </button>
          </form>
          <Link
            className="pc-compact-search pc-icon-button"
            to="/search"
            aria-label="搜索店铺"
          >
            <DesignIcon name="search" size={21} />
          </Link>
          <Link
            className="pc-button pc-publish-button"
            to="/restaurants/new"
            aria-label="添加店铺"
          >
            <DesignIcon name="add" size={20} />
            <span>添加店铺</span>
          </Link>
          <Link
            className="pc-user-avatar"
            to={session ? "/me" : "/auth"}
            aria-label={session ? "我的主页" : "登录"}
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="" />
            ) : (
              user?.displayName?.slice(0, 1) || (
                <DesignIcon name="me" size={20} />
              )
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function DesktopFooter() {
  return (
    <footer className="pc-footer">
      <span>山软今天吃什么</span>
      <div>
        {isV2Demo && (
          <>
            <span className="pc-demo-label">演示模式</span>
            <Link to="/design">设计画板</Link>
          </>
        )}
        <Link to="/help">帮助</Link>
      </div>
    </footer>
  );
}

export function MobileNavigation() {
  const active = useNavigationSection();
  return (
    <div className="mobile-main-navigation">
      <DesignNavigation
        active={active}
        action={
          <Link
            className="design-fab"
            to="/restaurants/new"
            aria-label="添加店铺"
          >
            <DesignIcon name="add" size={26} />
          </Link>
        }
      />
    </div>
  );
}
