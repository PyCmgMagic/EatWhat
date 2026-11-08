import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app/state";
import { ProfileEditLink } from "../app/profile-navigation";
import { mediaUrl } from "../api/models";
import { DesignIcon as Icon } from "../mobile/ui";
import { profileSections, type ProfileSection } from "../app/profile-workspace";

export default function ProfileRail({
  activeSection,
  allowNavigate,
}: {
  activeSection: ProfileSection;
  allowNavigate: (destination: string) => boolean;
}) {
  const { user } = useApp();
  return (
    <aside
      className="pc-profile-rail"
      onClickCapture={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const anchor = (event.target as Element).closest<HTMLAnchorElement>(
          "a[href]",
        );
        const target = anchor ? new URL(anchor.href).hash.slice(1) : "";
        if (target && !allowNavigate(target)) event.preventDefault();
      }}
    >
      <ProfileEditLink
        className="profile-rail-identity"
        aria-label="编辑个人资料"
      >
        <span className="profile-rail-avatar">
          {user?.avatar && mediaUrl(user.avatar) ? (
            <img src={mediaUrl(user.avatar)} alt="" />
          ) : (
            (user?.displayName?.slice(0, 1) ?? "食")
          )}
        </span>
        <span>
          <strong>{user?.displayName || "我的账号"}</strong>
          <small>查看与编辑资料</small>
        </span>
        <Icon name="chevronRight" size={14} />
      </ProfileEditLink>
      <Link
        className="profile-rail-search"
        to="/features"
        state={{ focusFeatureSearch: true }}
        aria-current={activeSection === "/features" ? "page" : undefined}
        aria-controls="profile-workspace-panel"
      >
        <Icon name="search" size={17} />
        <span>搜索功能</span>
        <Icon name="chevronRight" size={14} />
      </Link>
      <nav className="pc-profile-menu" aria-label="个人中心">
        {profileSections.map((item, index) => (
          <Fragment key={item.to}>
            {item.group && item.group !== profileSections[index - 1]?.group && (
              <span className="profile-nav-group">{item.group}</span>
            )}
            <Link
              to={item.to}
              aria-current={activeSection === item.to ? "page" : undefined}
              aria-controls="profile-workspace-panel"
            >
              <Icon name={item.icon} size={19} />
              <span>{item.name}</span>
              <i aria-hidden="true" />
            </Link>
          </Fragment>
        ))}
      </nav>
      <div className="profile-rail-tools">
        {user?.role === "admin" && (
          <Link to="/admin/v4">
            <Icon name="tool" size={17} />
            管理工作台
          </Link>
        )}
        <span>好好吃饭，认真生活。</span>
      </div>
    </aside>
  );
}
