import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { localDestination, useReturnTo } from "../app/navigation";
import { useApp } from "../app/state";
import { mediaUrl } from "../api/models";
import { Modal } from "../components/ui";
import { useTask } from "../components/useTask";
import { DesignIcon as Icon } from "../mobile/ui";
import "./settings-home.css";
import "./profile-section-nav.css";

type Setting = {
  title: string;
  detail: string;
  to: string;
  icon: string;
  value?: string;
  attention?: boolean;
};

function SettingLink({ item }: { item: Setting }) {
  return (
    <Link className="settings-home-row" to={item.to}>
      <span className="settings-home-icon">
        <Icon name={item.icon} size={21} />
      </span>
      <span className="settings-home-copy">
        <strong>{item.title}</strong>
        <small>{item.detail}</small>
      </span>
      {item.value && (
        <span
          className="settings-home-value"
          data-attention={item.attention || undefined}
          data-unknown={item.value === "状态待确认" || undefined}
        >
          {item.value}
        </span>
      )}
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
  const phone = user?.phone;
  const phoneMissing = phone === null || phone === "";
  const phoneNeedsVerification = phoneMissing && user?.verified === false;
  const phoneValue = phone
    ? phone.replace(/(\d{3})\d{4}(\d{4})$/, "$1****$2")
    : phoneMissing
      ? "未绑定"
      : "状态待确认";
  const passwordValue =
    user?.hasPassword === true
      ? "已设置"
      : user?.hasPassword === false
        ? "未设置"
        : "状态待确认";
  useEffect(() => {
    document.title = "账号设置 · 山软今天吃什么";
  }, []);

  const account: Setting[] = [
    {
      title: "账号信息",
      detail: "登录名、认证信息与跨站授权",
      to: "/settings/account",
      icon: "idcard",
    },
    {
      title: phoneMissing ? "绑定手机号" : "手机号",
      detail: phoneNeedsVerification
        ? "完成学生认证后可绑定手机号"
        : "用于登录与账号验证",
      to: phone
        ? "/settings/phone"
        : phoneMissing && verificationKnown
          ? phoneNeedsVerification
            ? "/verify"
            : "/settings/bind-phone"
          : "/settings/account",
      icon: "phone",
      value: phoneValue,
      attention: phoneMissing,
    },
    {
      title: user?.hasPassword === false ? "设置密码" : "登录密码",
      detail: "设置或更新你的登录密码",
      to: "/settings/password",
      icon: "lock",
      value: passwordValue,
      attention: user?.hasPassword === false,
    },
    {
      title: "登录设备",
      detail: "查看与管理已登录的设备",
      to: "/settings/devices",
      icon: "computer",
    },
    {
      title: "学生认证",
      detail: "查看校内身份与认证方式",
      to: "/verify",
      icon: "verify",
      value: verified ? "已认证" : verificationKnown ? "未认证" : "状态待确认",
      attention: user?.verified === false,
    },
  ];
  const preferences: Setting[] = [
    {
      title: "隐私设置",
      detail: "管理关注、粉丝的公开范围",
      to: "/settings/privacy",
      icon: "eye",
    },
    {
      title: "口味偏好",
      detail: "设置喜欢和不喜欢的口味",
      to: "/settings/preferences",
      icon: "utensils",
    },
    {
      title: "通知偏好",
      detail: "选择想收到的消息提醒",
      to: "/settings/notifications",
      icon: "bell",
    },
    {
      title: "屏蔽名单",
      detail: "管理不想在推荐中看到的食友",
      to: "/settings/blocked",
      icon: "block",
    },
    {
      title: "使用统计授权",
      detail: "自主决定是否分享使用统计",
      to: "/settings/telemetry",
      icon: "shield",
    },
  ];
  const recovery: Setting[] = [
    {
      title: "重新确认授权",
      detail: "查看当前政策并确认跨站同步授权",
      to: "/auth/consent-offer",
      icon: "verify",
    },
    {
      title: "恢复账号操作",
      detail: "继续未完成的设备、手机号或注销操作",
      to: "/auth/account-recovery",
      icon: "key",
    },
  ];
  const support: Setting[] = [
    {
      title: "关于我们",
      detail: "认识山软今天吃什么",
      to: "/settings/about",
      icon: "bowl",
    },
    {
      title: "帮助与反馈",
      detail: "查看使用帮助，提交与跟进问题",
      to: "/help",
      icon: "feedback",
    },
    {
      title: "数据存放说明",
      detail: "了解账号与内容的保存方式",
      to: "/data-notice",
      icon: "document",
    },
  ];

  return (
    <div className="settings-home" aria-labelledby="settings-home-title">
      <header className="settings-home-heading">
        {!embedded && (
          <Link className="settings-home-back" to="/me">
            <Icon name="back" size={16} />
            个人中心
          </Link>
        )}
        <div>
          <div>
            <span className="settings-home-eyebrow">账号与使用习惯</span>
            <h1 id="settings-home-title">账号设置</h1>
            <p>管理你的账号，调整自己的使用习惯。</p>
          </div>
          {featuresReturnTo && (
            <Link className="settings-home-all" to={featuresReturnTo}>
              <Icon name="back" size={16} />
              返回功能搜索
            </Link>
          )}
        </div>
      </header>

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
            <span>当前登录的账号</span>
          </div>
        </div>
        <Link className="settings-home-edit" to="/me/edit">
          <Icon name="edit" size={17} />
          编辑资料
        </Link>
        <div className="settings-home-status">
          <Link to={account[1].to}>
            <Icon name="phone" size={17} />
            <span>手机号</span>
            <strong>{phoneValue}</strong>
          </Link>
          <Link to="/settings/password">
            <Icon name="lock" size={17} />
            <span>登录密码</span>
            <strong>{passwordValue}</strong>
          </Link>
        </div>
        {user?.verified === false && (
          <div className="settings-home-verification">
            <span>
              <Icon name="verify" size={18} />
              完成学生认证后，可以发布菜品、点赞和管理标签。
            </span>
            <Link to="/verify">
              去认证
              <Icon name="chevronRight" size={16} />
            </Link>
          </div>
        )}
      </section>

      <div className="settings-home-groups">
        {[
          {
            title: "账号与安全",
            detail: "登录方式与身份管理",
            icon: "shield",
            tone: "gold",
            items: account,
          },
          {
            title: "偏好与隐私",
            detail: "让使用方式更适合你",
            icon: "settings",
            tone: "green",
            items: preferences,
          },
        ].map((group) => (
          <section
            key={group.title}
            className={"settings-home-group tone-" + group.tone}
            aria-label={group.title}
          >
            <header>
              <span>
                <Icon name={group.icon} size={20} />
              </span>
              <div>
                <h2>{group.title}</h2>
                <p>{group.detail}</p>
              </div>
            </header>
            <div className="settings-home-group-content">
              <div className="settings-home-group-items">
                {group.items.map((item) => (
                  <SettingLink key={item.title} item={item} />
                ))}
              </div>
              {group.title === "账号与安全" && (
                <details className="settings-home-recovery">
                  <summary>授权与账号恢复</summary>
                  {recovery.map((item) => (
                    <SettingLink key={item.to} item={item} />
                  ))}
                </details>
              )}
            </div>
          </section>
        ))}
      </div>

      <section
        className="settings-home-support"
        aria-labelledby="settings-home-support-title"
      >
        <header>
          <h2 id="settings-home-support-title">帮助与关于</h2>
          <span>使用帮助、站点介绍与数据说明</span>
        </header>
        <div>
          {support.map((item) => (
            <SettingLink key={item.to} item={item} />
          ))}
        </div>
      </section>
      <footer className="settings-home-session">
        <div>
          <strong>当前账号</strong>
          <p>退出后，收藏和分享会保留在账号中。</p>
        </div>
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
          {logout.errorText && (
            <p className="settings-home-error" role="alert">
              {logout.errorText}
            </p>
          )}
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
