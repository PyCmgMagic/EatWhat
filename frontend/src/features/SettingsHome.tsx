import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { localDestination, useReturnTo } from "../app/navigation";
import { useApp } from "../app/state";
import { ProfileEditLink } from "../app/profile-navigation";
import { mediaUrl } from "../api/models";
import { Modal } from "../components/ui";
import { useTask } from "../components/useTask";
import { DesignIcon as Icon } from "../mobile/ui";
import "./settings-home.css";
import { isRetiredV2 } from "../app/retired-routes";
import "./profile-section-nav.css";
import SettingsPageHeader from "./SettingsPageHeader";
import { settingsNavGroups, type SettingsNavItem } from "./settings-nav";

function SettingLink({ item }: { item: SettingsNavItem }) {
  return (
    <Link className="settings-home-row" to={item.to}>
      <span className="settings-home-icon">
        <Icon name={item.icon} size={21} />
      </span>
      <span className="settings-home-copy">
        <strong>{item.name}</strong>
      </span>
      <Icon name="chevronRight" size={17} />
    </Link>
  );
}

export default function SettingsHome({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const { user, signOut } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const origin = useReturnTo("/me");
  const featureSource =
    localDestination(
      (location.state as { featuresReturnTo?: string } | null)
        ?.featuresReturnTo,
    ) ?? origin;
  const featuresReturnTo =
    featureSource.split("?")[0] === "/features" ? featureSource : undefined;
  const logout = useTask();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const verified = user?.verified === true;
  const verificationKnown = typeof user?.verified === "boolean";
  const avatar = mediaUrl(user?.avatar);
  useEffect(() => {
    document.title = "账号设置 · 山软今天吃什么";
  }, []);
  const groups = settingsNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !isRetiredV2(item.to)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="settings-home" aria-labelledby="settings-home-title">
      <SettingsPageHeader
        title="账号设置"
        detail=""
        headingId="settings-home-title"
        back={embedded ? undefined : "/me"}
        action={
          featuresReturnTo && (
            <Link className="settings-home-all" to={featuresReturnTo}>
              <Icon name="back" size={16} />
              返回功能搜索
            </Link>
          )
        }
      />

      <section className="settings-home-profile" aria-label="当前账号">
        <span className="settings-home-avatar" aria-hidden="true">
          {user?.displayName?.slice(0, 1) || "食"}
          {avatar && (
            <img
              src={avatar}
              alt=""
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          )}
        </span>
        <div className="settings-home-identity">
          <h2>{user?.displayName || "我的账号"}</h2>
          <div>
            <span
              className="settings-home-badge"
              data-verified={verified || undefined}
            >
              <Icon name={verified ? "verify" : "me"} size={14} />
              {verified
                ? "学生身份已认证"
                : verificationKnown
                  ? "学生身份未认证"
                  : "认证状态待确认"}
            </span>
          </div>
        </div>
        <ProfileEditLink className="settings-home-edit">
          <Icon name="edit" size={17} />
          编辑资料
        </ProfileEditLink>
      </section>

      <div className="settings-home-groups">
        {groups.map((group) => (
          <section
            key={group.title}
            className="settings-home-group"
            aria-label={group.title + "设置"}
          >
            <header>
              <h2>{group.title}</h2>
            </header>
            <div className="settings-home-group-items">
              {group.items.map((item) => (
                <SettingLink key={item.to} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <footer className="settings-home-session">
        <button
          type="button"
          className="settings-home-logout"
          onClick={() => {
            logout.reset();
            setConfirmLogout(true);
          }}
        >
          <Icon name="logout" size={18} />
          退出登录
        </button>
      </footer>
      {confirmLogout && (
        <Modal
          title="退出当前账号？"
          className="settings-home-dialog"
          dismissible={!logout.isPending}
          onClose={() => setConfirmLogout(false)}
        >
          <p>退出后需要重新登录。你的收藏、分享和账号设置会保留。</p>

          <div className="settings-home-dialog-actions">
            <button
              type="button"
              disabled={logout.isPending}
              onClick={() => setConfirmLogout(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="is-confirm"
              disabled={logout.isPending}
              onClick={() =>
                logout.run(async () => {
                  await signOut();
                  navigate("/auth");
                })
              }
            >
              {logout.isPending ? "正在退出…" : "确认退出"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
