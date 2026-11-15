import { Link, useLocation } from "react-router-dom";
import "./profile-section-nav.css";
import { isRetiredV2 } from "../app/retired-routes";

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

export function ProfileHelpHeader() {
  return (
    <>
      <header className="profile-help-header">
        <span className="profile-page-eyebrow">使用帮助</span>
        <h1>帮助与反馈</h1>
        <p>查找常见问题，提交建议，并查看处理进度与回复。</p>
      </header>
      <ProfileSectionNav section="help" />
    </>
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
  return (
    <nav className="profile-section-nav" aria-label={config.label}>
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          aria-current={selected === item.to ? "page" : undefined}
          state={
            section === "help" &&
            item.to === "/feedback/mine" &&
            pathname === "/feedback"
              ? { feedbackReturnTo: pathname + search, feedbackSource: "/help" }
              : undefined
          }
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default ProfileSectionNav;
