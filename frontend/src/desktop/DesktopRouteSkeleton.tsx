import { useContext } from "react";
import { useLocation } from "react-router-dom";
import { ProfileWorkspaceContext } from "../app/profile-workspace";
import { useProfileReturnTo } from "../app/profile-navigation";
import {
  ContentSkeleton,
  PageSkeleton,
  Skeleton,
} from "../components/LoadingSkeleton";
import { DesignIcon as Icon } from "../mobile/ui";
import { PageHead, Section } from "./secondary";
import "../features/settings-home.css";
import "./profile.css";
import "./route-skeleton.css";

function SettingRows({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <div className="settings-home-row" key={i}>
      <span className="settings-home-icon">
        <Skeleton width={21} height={21} />
      </span>
      <span className="settings-home-copy">
        <Skeleton width="42%" height={21} />
        <Skeleton width="72%" height={19.2} />
      </span>
      <Skeleton width={17} height={17} />
    </div>
  ));
}

/** Reuse the page's layout classes so its breakpoints and spacing stay in sync. */
function SettingsSkeleton() {
  return (
    <div
      className="settings-home settings-home-loading"
      role="status"
      aria-label="正在加载账号设置"
      aria-busy="true"
    >
      <header className="settings-home-heading" aria-hidden="true">
        <div>
          <div>
            <h1>账号设置</h1>
            <p>管理你的账号，调整自己的使用习惯。</p>
          </div>
        </div>
      </header>
      <section className="settings-home-profile" aria-hidden="true">
        <span className="settings-home-avatar">
          <Skeleton width="100%" height="100%" round />
        </span>
        <div className="settings-home-identity">
          <h2>
            <Skeleton width={150} height="1.5em" />
          </h2>
          <div>
            <Skeleton width={112} height={18} />
          </div>
        </div>
        <span className="settings-home-edit">
          <Icon name="edit" size={17} />
          编辑资料
        </span>
        <div className="settings-home-status">
          <span className="settings-home-loading-status">
            <Icon name="phone" size={17} />
            <span>手机号</span>
            <Skeleton width={90} height={18} />
          </span>
          <span className="settings-home-loading-status">
            <Icon name="lock" size={17} />
            <span>登录密码</span>
            <Skeleton width={50} height={18} />
          </span>
        </div>
      </section>
      <div className="settings-home-groups" aria-hidden="true">
        {[
          { title: "账号与安全", icon: "shield" },
          { title: "偏好与隐私", icon: "settings" },
        ].map((group, i) => (
          <section className="settings-home-group" key={group.title}>
            <header>
              <span>
                <Icon name={group.icon} size={18} />
              </span>
              <h2>{group.title}</h2>
            </header>
            <div className="settings-home-group-content">
              <div className="settings-home-group-items">
                <SettingRows count={5} />
              </div>
              {i === 0 && (
                <details className="settings-home-recovery" inert>
                  <summary>账号恢复</summary>
                </details>
              )}
            </div>
          </section>
        ))}
      </div>
      <section className="settings-home-support" aria-hidden="true">
        <header>
          <h2>帮助与关于</h2>
        </header>
        <div>
          <SettingRows count={3} />
        </div>
      </section>
      <footer className="settings-home-session" aria-hidden="true">
        <div>
          <strong>当前账号</strong>
          <p>退出后，收藏和分享会保留在账号中。</p>
        </div>
        <span className="settings-home-logout">
          <Icon name="logout" size={18} />
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
      <PageHead
        title="编辑个人资料"
        detail="管理头像、昵称和个人信息，保存后同步到个人主页。"
        crumb={crumb}
        back={returnTo}
      />
      <div className="pc-profile-form" aria-hidden="true">
        <Section title="基本资料" detail="头像、昵称和签名会展示在个人主页。">
          <div className="pc-profile-avatar-row">
            <span className="pc-profile-avatar-picker">
              <Skeleton width="100%" height="100%" round />
            </span>
            <div className="pc-profile-avatar-details">
              <b>头像</b>
              <p>点击或拖入图片，支持 JPG、PNG、WebP，10 MB 以内。</p>
              <Skeleton width={104} height={36} />
            </div>
          </div>
          <div className="pc-profile-fields">
            <div className="pc-profile-field">
              <label>昵称</label>
              <Skeleton height={44} />
              <p>2–12 个字，可以和其他食友重名。</p>
            </div>
            <div className="pc-profile-field">
              <label>个性签名</label>
              <Skeleton height={77} />
            </div>
          </div>
        </Section>
        <Section
          title="更多资料"
          detail="以下信息均为选填，可以按自己的意愿填写。"
        >
          <div className="pc-profile-fields">
            {["性别", "生日", "家乡省份", "家乡城市"].map((label) => (
              <div className="pc-profile-field" key={label}>
                <label>{label}</label>
                <Skeleton height={44} />
              </div>
            ))}
          </div>
        </Section>
        <footer className="pc-profile-savebar">
          <div className="pc-profile-save-status">
            <Icon name="refresh" size={18} />
            <span>正在加载资料…</span>
          </div>
          <div>
            <button className="pc-button light" type="button" disabled>
              取消修改
            </button>
            <button className="pc-button" type="button" disabled>
              保存修改
              <Icon name="check" size={17} />
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
  if (pathname === "/settings") return <SettingsSkeleton />;
  if (pathname === "/me/edit" || pathname === "/me/details")
    return <ProfileEditorSkeleton />;
  // The workspace already owns its rail; never nest the former full profile shell.
  return inWorkspace ? (
    <ContentSkeleton kind="rows" count={4} />
  ) : (
    <PageSkeleton kind="profile" />
  );
}
