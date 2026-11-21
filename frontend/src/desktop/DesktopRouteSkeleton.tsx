import { useContext } from "react";
import { useLocation } from "react-router-dom";
import { ProfileWorkspaceContext } from "../app/profile-workspace";
import { DesktopSettingsContext } from "../features/settings-nav";
import { useProfileReturnTo } from "../app/profile-navigation";
import {
  ContentSkeleton,
  PageSkeleton,
  Skeleton,
} from "../components/LoadingSkeleton";
import { DesignIcon as Icon } from "../mobile/ui";
import { PageHead, Section } from "./secondary";
import "../features/settings-home.css";
import "../features/settings-page-header.css";
import "./profile.css";
import "./route-skeleton.css";

/** Reuse the page's layout classes so its breakpoints and spacing stay in sync. */
function SettingsSkeleton() {
  return (
    <div
      className="settings-home settings-home-loading"
      role="status"
      aria-label="正在加载账号设置"
      aria-busy="true"
    >
      <header className="settings-page-head" aria-hidden="true">
        <div className="settings-page-head-copy">
          <h1>设置总览</h1>
        </div>
      </header>
      <div className="settings-home-account" aria-hidden="true">
        <div className="settings-home-account-row">
          <span className="settings-home-account-icon">
            <Skeleton width="100%" height="100%" round />
          </span>
          <span className="settings-home-account-copy">
            <Skeleton width={150} height={22} />
          </span>
          <Skeleton width={78} height={38} />
        </div>
        <div className="settings-home-facts">
          {[0, 1, 2].map((i) => (
            <div className="settings-home-fact" key={i}>
              <Skeleton width={16} height={16} />
              <Skeleton width={38} height={11} />
              <Skeleton width="62%" height={14} />
            </div>
          ))}
        </div>
      </div>
      <footer className="settings-home-session" aria-hidden="true">
        <span className="settings-home-logout">
          <Icon name="logout" size={17} />
          退出登录
        </span>
      </footer>
    </div>
  );
}

function ProfileEditorSkeleton() {
  const returnTo = useProfileReturnTo();
  const crumb = returnTo.startsWith("/settings")
    ? "返回设置"
    : returnTo === "/me"
      ? "返回个人主页"
      : "返回原页面";
  return (
    <div
      className="pc-profile-editor pc-profile-loading"
      role="status"
      aria-label="正在加载个人资料"
      aria-busy="true"
    >
      <PageHead title="编辑个人资料" crumb={crumb} back={returnTo} />
      <div className="pc-profile-form" aria-hidden="true">
        <Section title="基本资料">
          <div className="pc-profile-basics">
            <div className="pc-profile-avatar-row">
              <span className="pc-profile-avatar-picker">
                <Skeleton width="100%" height="100%" round />
              </span>
              <div className="pc-profile-avatar-details">
                <h3>头像</h3>
                <Skeleton width={92} height={32} />
                <p>可拖入 JPG、PNG、WebP，最大 10 MB</p>
              </div>
            </div>
            <div className="pc-profile-fields">
              <div className="pc-profile-field">
                <label>昵称</label>
                <Skeleton height={42} />
                <p>2–12 个字</p>
              </div>
              <div className="pc-profile-field">
                <label>个性签名</label>
                <Skeleton height={74} />
              </div>
            </div>
          </div>
        </Section>
        <Section title="更多资料">
          <div className="pc-profile-fields">
            {["性别", "生日"].map((label) => (
              <div className="pc-profile-field" key={label}>
                <label>{label}</label>
                <Skeleton height={42} />
              </div>
            ))}
          </div>
        </Section>
        <footer className="pc-profile-savebar">
          <div className="pc-profile-save-status">
            <span>正在加载资料…</span>
          </div>
          <div className="pc-profile-save-actions">
            <button className="pc-button light" type="button" disabled>
              取消修改
            </button>
            <button
              className="pc-button pc-profile-primary"
              type="button"
              disabled
            >
              <Icon name="check" size={17} />
              保存修改
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/** Both account hydration and lazy modules use the destination's loading layout. */
export default function DesktopRouteSkeleton() {
  const { pathname } = useLocation();
  const inWorkspace = useContext(ProfileWorkspaceContext);
  const inSettings = useContext(DesktopSettingsContext);
  if (pathname === "/settings") return <SettingsSkeleton />;
  if (pathname === "/me/edit" || pathname === "/me/details")
    return <ProfileEditorSkeleton />;
  // The workspace already owns its rail; never nest the former full profile shell.
  return inWorkspace || inSettings ? (
    <ContentSkeleton kind="rows" count={4} />
  ) : (
    <PageSkeleton kind="profile" />
  );
}
