import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { useArea } from "../app/area";
import { Icon, Modal, Picture } from "./ui";
const pages = [
  { path: "/", label: "发现", icon: "discover" },
  { path: "/recommend", label: "今天吃什么", icon: "bowl" },
  { path: "/publish", label: "发布分享", mobile: "发布", icon: "plus" },
  { path: "/favorites", label: "我的收藏", mobile: "收藏", icon: "bookmark" },
  { path: "/me", label: "我的", icon: "user" },
];
export default function Layout() {
  const { user, session, api } = useApp(),
    { area, openArea } = useArea(),
    location = useLocation(),
    navigate = useNavigate();
  const [search, setSearch] = useState(""),
    [searchOpen, setSearchOpen] = useState(false);
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.unread(),
    enabled: !!session,
    refetchInterval: 60_000,
  });
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname]);
  function submit(e: FormEvent) {
    e.preventDefault();
    navigate(`/restaurants?keyword=${encodeURIComponent(search.trim())}`);
    setSearchOpen(false);
  }
  const name = user?.userName || "来吃饭的同学",
    current =
      pages.find((p) => p.path === location.pathname)?.label ??
      (location.pathname.startsWith("/restaurants")
        ? "找餐厅"
        : location.pathname.startsWith("/foods")
          ? "菜品详情"
          : location.pathname === "/settings"
            ? "账号设置"
            : location.pathname === "/notifications"
              ? "消息中心"
              : "校园食友圈");
  const searchForm = (
    <form className="search-form" role="search" onSubmit={submit}>
      <Icon name="search" />
      <input
        aria-label="搜索餐厅"
        type="search"
        placeholder="找一家喜欢的店，再看看店里的好味道"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button aria-label="提交搜索" type="submit">
        <Icon name="arrow" />
      </button>
    </form>
  );
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        跳到主要内容
      </a>
      <aside className="sidebar" aria-label="主导航">
        <Link className="brand" to="/" aria-label="山软今天吃什么，返回发现">
          <span className="brand-mark">
            <Icon name="bowl" />
          </span>
          <span>
            <span className="brand-campus">山软</span>
            <strong>
              今天吃什么<span className="brand-dot">.</span>
            </strong>
          </span>
        </Link>
        <div className="nav-caption">把每一顿，吃成小期待</div>
        <nav>
          {pages.map((p) => (
            <NavLink
              end={p.path === "/"}
              key={p.path}
              to={p.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""} ${p.path === "/publish" ? "nav-publish" : ""}`
              }
            >
              <Icon name={p.icon} />
              <span>{p.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="mini-spark">✳</span>
          <p>
            好的日常，
            <br />
            从好好吃饭开始。
          </p>
          <span>SHANRUAN FOOD CLUB</span>
        </div>
        <Link to={session ? "/me" : "/auth"} className="sidebar-user">
          <span className="avatar avatar-me">
            {user?.avatar ? (
              <Picture src={user.avatar} alt="我的头像" />
            ) : (
              name.slice(0, 1)
            )}
          </span>
          <span>
            <strong>{session ? name : "加入校园食友圈"}</strong>
            <small>
              {user?.verified
                ? "校内已认证"
                : session
                  ? "待认证"
                  : "登录 / 注册"}
            </small>
          </span>
          <span className="user-arrow">↗</span>
        </Link>
      </aside>
      <div className="app-shell">
        <header className="topbar">
          <Link className="mobile-brand" to="/">
            <span className="mobile-brand-mark">吃</span>
            <strong>
              今天吃什么<span>.</span>
            </strong>
          </Link>
          <div className="breadcrumb">
            <span>校园食友圈</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{current}</strong>
          </div>
          {searchForm}
          <div className="topbar-actions">
            <button
              className="icon-button mobile-search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="搜索餐厅"
            >
              <Icon name="search" />
            </button>
            <button className="location-button" onClick={openArea}>
              <Icon name="pin" />
              <span>{area?.name || "选择区域"}</span>
              <span className="chevron">⌄</span>
            </button>
            <Link
              className="icon-button notification-button"
              to="/notifications"
              aria-label={`消息中心${unread.data ? `，${unread.data}条未读` : ""}`}
            >
              <Icon name="bell" />
              {!!unread.data && <span className="notification-dot" />}
            </Link>
          </div>
        </header>
        {isDemo && (
          <div className="demo-banner">
            <span>演示模式 · 示例内容仅保存在当前浏览器</span>
            <a href={location.pathname === "/" ? "/?demo=0" : "/?demo=0"}>
              连接真实服务 ↗
            </a>
          </div>
        )}
        <main id="main" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            好好吃饭，认真生活。<span className="footer-flower">✳</span>
          </span>
          <div>
            <Link to="/restaurants">找餐厅</Link>
            <Link to="/settings">账号与认证</Link>
            {!isDemo && import.meta.env.DEV && <a href="/?demo=1">查看演示</a>}
          </div>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="移动端主导航">
        {pages.map((p) => (
          <NavLink end={p.path === "/"} key={p.path} to={p.path}>
            <Icon name={p.icon} />
            <span>{p.mobile || p.label}</span>
          </NavLink>
        ))}
      </nav>
      {searchOpen && (
        <Modal title="找一家想去的店" onClose={() => setSearchOpen(false)}>
          <div className="mobile-search-form">{searchForm}</div>
          <p className="muted">先找到餐厅，再看看同学们分享的店内菜品。</p>
        </Modal>
      )}
    </>
  );
}
