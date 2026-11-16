import { useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import "./profile-section-nav.css";
import { isRetiredV2 } from "../app/retired-routes";
import { ProfileWorkspaceContext } from "../app/profile-workspace";
import { ProfilePageHead } from "./ProfilePage";

const sections = {
  collections: {
    label: "收藏分类",
    items: [
      { to: "/favorites", label: "菜品收藏" },
      { to: "/restaurants/favorites", label: "餐厅收藏" },
      { to: "/me/tags", label: "标签管理" },
    ],
  },
  shares: {
    label: "分享内容",
    items: [
      { to: "/me/shares", label: "已发布" },
      { to: "/me/shares?tab=comments", label: "我的评论" },
      { to: "/submissions", label: "审核进度" },
    ],
  },
  messages: {
    label: "消息分类",
    items: [
      { to: "/notifications", label: "互动通知" },
      { to: "/announcements", label: "站点公告" },
    ],
  },
  help: {
    label: "帮助与反馈",
    items: [
      { to: "/help", label: "帮助" },
      { to: "/feedback", label: "提交反馈" },
      { to: "/feedback/mine", label: "反馈记录" },
    ],
  },
} as const;

export type ProfileSectionNavKind = keyof typeof sections;

function ProfileSectionHeader({
  section,
  title,
  eyebrow,
  detail,
}: {
  section: ProfileSectionNavKind;
  title: string;
  eyebrow?: string;
  detail: string;
}) {
  return (
    <>
      <header className="profile-section-heading">
        {eyebrow && <span className="profile-page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{detail}</p>
      </header>
      <ProfileSectionNav section={section} />
    </>
  );
}

export function ProfileHelpHeader() {
  return (
    <ProfileSectionHeader
      section="help"
      eyebrow="使用帮助"
      title="帮助与反馈"
      detail="查找常见问题，提交建议，并查看处理进度与回复。"
    />
  );
}

export function ProfileCollectionsHeader({
  action,
}: {
  /** 个人空间里放在视图切换旁边的次要操作。 */
  action?: ReactNode;
} = {}) {
  // 个人空间里与其他标签页共用同一套页头；独立打开时保留原来的窄屏排版。
  const embedded = useContext(ProfileWorkspaceContext);
  if (embedded)
    return (
      <ProfilePageHead
        title="我的收藏"
        detail="喜欢的菜品和想去的餐厅，都留在这里。"
      >
        {action}
        <ProfileSectionNav section="collections" />
      </ProfilePageHead>
    );
  return (
    <div className="profile-collections-head">
      <header className="profile-section-heading">
        <h1>我的收藏</h1>
        <p>喜欢的菜品和想去的餐厅，都留在这里。</p>
      </header>
      <ProfileSectionNav section="collections" />
    </div>
  );
}

export function ProfileSectionNav({
  section,
}: {
  section: ProfileSectionNavKind;
}) {
  const location = useLocation();
  const { pathname, search } = location;
  const config = sections[section];
  const items = config.items.filter((item) => !isRetiredV2(item.to));
  const current =
    section === "shares" && pathname === "/me/shares"
      ? pathname +
        (new URLSearchParams(search).get("tab") === "comments"
          ? "?tab=comments"
          : "")
      : pathname;
  const selected = [...items]
    .reverse()
    .find(
      (item) => current === item.to || current.startsWith(item.to + "/"),
    )?.to;
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const previous = useRef<string | undefined>(undefined);
  // The underline follows the active tab instead of jumping between links, so
  // a switch reads as one control moving rather than two unrelated highlights.
  useLayoutEffect(() => {
    const container = nav.current,
      bar = indicator.current;
    if (!container || !bar) return;
    const place = (animate: boolean) => {
      const active = container.querySelector<HTMLElement>(
        '[aria-current="page"]',
      );
      if (!active) {
        bar.style.opacity = "0";
        return;
      }
      bar.style.transition = animate ? "" : "none";
      bar.style.opacity = "1";
      bar.style.transform =
        `translate3d(${active.offsetLeft}px,0,0)` +
        ` scaleX(${active.offsetWidth / 100})`;
      container.dataset.tabIndicator = "ready";
      if (animate) return;
      // Snap for the first paint and for resizes; keep the transition rule
      // usable for the next tab switch.
      void bar.offsetWidth;
      bar.style.transition = "";
    };
    place(previous.current !== undefined && previous.current !== selected);
    previous.current = selected;
    if (typeof ResizeObserver === "undefined") return;
    // ResizeObserver reports once for every target right after observe(); only
    // a real size change should re-place the underline (and it should snap).
    const signature = () =>
      [
        container.clientWidth,
        ...Array.from(container.querySelectorAll("a")).map(
          (link) => link.offsetWidth,
        ),
      ].join(":");
    let measured = signature();
    const observer = new ResizeObserver(() => {
      const next = signature();
      if (next === measured) return;
      measured = next;
      place(false);
    });
    observer.observe(container);
    container.querySelectorAll("a").forEach((link) => observer.observe(link));
    return () => observer.disconnect();
  }, [selected]);
  return (
    <nav
      ref={nav}
      className="profile-section-nav"
      data-section={section}
      aria-label={config.label}
    >
      <span
        ref={indicator}
        className="profile-section-tab-indicator"
        aria-hidden="true"
      />
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          aria-current={selected === item.to ? "page" : undefined}
          state={
            section === "help" &&
            item.to === "/feedback/mine" &&
            pathname === "/feedback"
              ? {
                  workspaceSwitch: true,
                  feedbackReturnTo: pathname + search,
                  feedbackSource: "/help",
                }
              : { workspaceSwitch: true }
          }
          preventScrollReset
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default ProfileSectionNav;
