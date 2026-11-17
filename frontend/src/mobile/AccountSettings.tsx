import { Link } from "react-router-dom";
import { useApp } from "../app/state";
import { Gate } from "../components/ui";
import { DesignIcon } from "./ui";
import SettingsFrame from "./SettingsFrame";

function AccountRow({
  icon,
  label,
  value,
  to,
}: {
  icon: string;
  label: string;
  value?: string;
  to?: string;
}) {
  const content = (
    <>
      <DesignIcon name={icon} size={22} />
      <span className="mobile-account-label">{label}</span>
      {value && <span className="mobile-account-value">{value}</span>}
      {to && <DesignIcon name="chevronRight" size={20} />}
    </>
  );
  return to ? (
    <Link className="mobile-account-row" to={to}>
      {content}
    </Link>
  ) : (
    <div className="mobile-account-row">{content}</div>
  );
}

function AccountContent() {
  const { user } = useApp();
  return (
    <div className="mobile-account-groups">
      <nav className="mobile-account-group" aria-label="账号与安全设置">
        <AccountRow
          icon="idcard"
          label="登录名"
          value={
            user?.hasUsername === false
              ? "去设置"
              : user?.userName || "暂不可用"
          }
          to={user?.hasUsername === false ? "/settings/username" : undefined}
        />
        <AccountRow
          icon="phone"
          label="手机号"
          value={
            user?.phone
              ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, "$1 **** $2")
              : "去绑定"
          }
          to={user?.phone ? "/settings/phone" : "/settings/bind-phone"}
        />
        <AccountRow
          icon="key"
          label={user?.hasPassword === false ? "设置密码" : "修改密码"}
          to="/settings/password"
        />
        <AccountRow icon="computer" label="登录设备" to="/settings/devices" />
        <AccountRow
          icon="verify"
          label="学生认证"
          value={user?.verified ? "已认证" : "去认证"}
          to="/verify"
        />
      </nav>
      <nav className="mobile-account-group" aria-label="账号管理">
        <h2>更多管理</h2>
        <AccountRow icon="logout" label="注销账号" to="/settings/delete" />
      </nav>
    </div>
  );
}

export default function MobileAccountSettings() {
  return (
    <SettingsFrame title="账号与安全" list>
      <Gate verified={false}>
        <AccountContent />
      </Gate>
    </SettingsFrame>
  );
}
