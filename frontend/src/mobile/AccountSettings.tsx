import { Link } from "react-router-dom";
import { useApp } from "../app/state";
import { Gate } from "../components/ui";
import { DesignIcon } from "./ui";
import SettingsFrame from "./SettingsFrame";
import { ProfileEditLink } from "../app/profile-navigation";

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
  return to === "/me/edit" ? (
    <ProfileEditLink className="mobile-account-row">{content}</ProfileEditLink>
  ) : to ? (
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
      <section
        className="mobile-account-group"
        aria-labelledby="account-identity"
      >
        <h2 id="account-identity">身份</h2>
        <AccountRow
          icon="me"
          label="个人资料"
          value={user?.displayName || "同学"}
          to="/me/edit"
        />
        <AccountRow
          icon="verify"
          label="学生认证"
          value={user?.verified ? "已认证" : "去认证"}
          to="/verify"
        />
      </section>
      <section className="mobile-account-group" aria-labelledby="account-login">
        <h2 id="account-login">登录</h2>
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
      </section>
      <section className="mobile-account-group" aria-labelledby="account-data">
        <h2 id="account-data">隐私与数据</h2>
        <AccountRow icon="lock" label="公开范围" to="/settings/privacy" />
        <AccountRow
          icon="bell"
          label="通知偏好"
          value="敬请期待"
          to="/settings/notifications"
        />
        <AccountRow icon="document" label="使用统计" to="/settings/telemetry" />
        <AccountRow icon="earth" label="数据存放" to="/data-notice" />
      </section>
      <section className="mobile-account-group" aria-labelledby="account-more">
        <h2 id="account-more">更多</h2>
        <AccountRow icon="bowl" label="全部功能" to="/features" />
        <AccountRow icon="delete" label="注销账号" to="/settings/delete" />
      </section>
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
