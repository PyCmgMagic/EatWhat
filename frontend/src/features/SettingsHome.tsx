import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { localDestination, useReturnTo } from "../app/navigation";
import { useApp } from "../app/state";
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
        <Icon name={item.icon} size={19} />
      </span>
      <span className="settings-home-copy">
        <strong>{item.name}</strong>
        {item.hint && <small>{item.hint}</small>}
      </span>
      <Icon name="chevronRight" size={16} />
    </Link>
  );
}

type AccountFact = {
  icon: string;
  label: string;
  value: string;
  tone?: "attention" | "muted";
};

function maskPhone(phone: string) {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
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
  const passwordKnown = typeof user?.hasPassword === "boolean";
  useEffect(() => {
    document.title = "账号设置 · 山软今天吃什么";
  }, []);
  const groups = settingsNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !isRetiredV2(item.to)),
    }))
    .filter((group) => group.items.length > 0);
  const accountEntry: SettingsNavItem = groups.find(
    (group) => group.id === "account",
  )?.items[0] ?? { to: "/settings/account", name: "账号与安全", icon: "idcard" };
  const menuGroups = groups.filter((group) => group.id !== "account");
  const facts: AccountFact[] = [
    {
      icon: "phone",
      label: "手机号",
      value: user?.phone ? maskPhone(user.phone) : "未绑定",
      tone: user?.phone ? undefined : "attention",
    },
    {
      icon: "key",
      label: "登录密码",
      value:
        user?.hasPassword === false
          ? "未设置"
          : passwordKnown
            ? "已设置"
            : "待确认",
      tone:
        user?.hasPassword === false
          ? "attention"
          : passwordKnown
            ? undefined
            : "muted",
    },
    {
      icon: "verify",
      label: "学生认证",
      value: verified ? "已认证" : verificationKnown ? "未认证" : "待确认",
      tone: verified
        ? undefined
        : verificationKnown
          ? "attention"
          : ("muted" as const),
    },
  ];

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

      <Link className="settings-home-account" to={accountEntry.to}>
        <div className="settings-home-account-row">
          <span className="settings-home-account-icon">
            <Icon name={accountEntry.icon} size={23} />
          </span>
          <span className="settings-home-account-copy">
            <strong>{accountEntry.name}</strong>
            <small>登录名、手机号、密码、登录设备与学生认证</small>
          </span>
          <span className="settings-home-account-go">
            管理
            <Icon name="chevronRight" size={15} />
          </span>
        </div>
        <div className="settings-home-facts">
          {facts.map((fact) => (
            <div
              className="settings-home-fact"
              key={fact.label}
              data-tone={fact.tone}
            >
              <Icon name={fact.icon} size={16} />
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>
      </Link>

      <div className="settings-home-groups">
        {menuGroups.map((group) => (
          <section
            key={group.id}
            className="settings-home-group"
            aria-label={group.title + "设置"}
          >
            <header>
              <h2>{group.title}</h2>
              <p>{group.detail}</p>
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
          <Icon name="logout" size={17} />
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
