import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { DesignIcon as Icon } from "../mobile/ui";
import "./settings-page-header.css";

const details: Record<string, string> = {
  "/settings": "管理账号安全、隐私偏好与站点服务。",
  "/settings/preferences": "设置喜欢和不喜欢的口味，让推荐更合心意。",
  "/settings/bind-phone": "完成验证码确认，将手机号与你的账号关联。",
  "/settings/phone": "先验证原手机号，再验证新号码。",
  "/settings/devices": "查看登录中的设备，发现陌生设备时可以把它下线。",
  "/settings/blocked": "管理不想在推荐中看到的食友。",
  "/settings/username": "设置用于登录的账号标识，与展示昵称互不影响。",
  "/data-notice": "了解账号信息与分享内容的保存方式。",
  "/verify": "完成学校统一认证或学校邮箱认证。",
  "/auth/account-recovery": "继续未完成的设备、手机号或注销操作。",
  "/auth/device-recovery": "恢复未完成的登录设备管理操作。",
  "/auth/mobile-recovery": "恢复未完成的手机号更换操作。",
};

export function settingsBackLabel(back = "/settings") {
  if (back === "/settings/account") return "返回账号与安全";
  if (back === "/settings/privacy") return "返回隐私设置";
  if (back === "/settings/personalization") return "返回个性化";
  if (back === "/settings/about") return "返回关于";
  if (back === "/help") return "返回帮助与反馈";
  if (back === "/settings") return "返回设置";
  if (back === "/me") return "返回个人中心";
  if (back === "/") return "返回发现";
  return "返回";
}

export default function SettingsPageHeader({
  title,
  detail,
  back,
  backLabel,
  action,
  onBack,
  backDisabled = false,
  headingId,
}: {
  title: string;
  detail?: string;
  back?: string;
  backLabel?: string;
  action?: ReactNode;
  onBack?: () => void;
  backDisabled?: boolean;
  headingId?: string;
}) {
  const location = useLocation();
  const description = detail ?? details[location.pathname];
  const label = backLabel ?? settingsBackLabel(back);
  return (
    <header className="settings-page-head">
      <div className="settings-page-head-copy">
        {onBack ? (
          <button
            type="button"
            className="settings-page-back"
            onClick={onBack}
            disabled={backDisabled}
          >
            <Icon name="back" size={16} />
            {label}
          </button>
        ) : back ? (
          <Link className="settings-page-back" to={back}>
            <Icon name="back" size={16} />
            {label}
          </Link>
        ) : null}
        <h1 id={headingId}>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="settings-page-head-action">{action}</div>}
    </header>
  );
}
