import { AuthForm } from "../desktop/DesktopAccount";
import { PhoneLoginForm, RecoverPassword } from "../features/Account";
import { PasswordConsentWithdrawal } from "../features/AccountExtras";
import { ConsentRecovery } from "../features/Consent";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useAuthFlow } from "../app/auth-dialog";

export default function AuthDialogContent({ path }: { path: string }) {
  const { location } = useAuthFlow();
  if (path === "/auth/consent") return <ConsentRecovery />;
  if (path === "/auth/forgot") return <RecoverPassword />;
  if (path === "/auth/withdraw-consent") return <PasswordConsentWithdrawal />;
  const phone = path === "/auth/register" || path === "/auth/register/confirm";
  const register = path === "/auth/username-register";
  const suffix = location.search;
  return (
    <>
      <div className="ew-auth-intro">
        <h2>
          {register ? "加入食友圈" : "欢迎回来"}
          <span aria-hidden="true">。</span>
        </h2>
        <p>
          {register
            ? "记下喜欢的菜，分享你的这一餐。"
            : "登录，接着发现和收藏好味道。"}
        </p>
      </div>
      {!register && (
        <nav className="ew-auth-methods" aria-label="登录方式">
          <Link
            to={"/auth" + suffix}
            aria-current={!phone ? "page" : undefined}
          >
            密码登录
          </Link>
          <Link
            to={"/auth/register" + suffix}
            aria-current={phone ? "page" : undefined}
          >
            验证码登录
          </Link>
        </nav>
      )}
      {phone ? (
        <PhoneLoginForm embedded compact />
      ) : (
        <AuthForm register={register} compact />
      )}
      {phone && (
        <p className="ew-auth-phone-note">
          新号码将自动注册，验证码 5 分钟内有效。
        </p>
      )}
      <footer className="ew-auth-footer">
        <p>
          {register ? "已经有账号？" : "还没有账号？"}
          <Link to={(register ? "/auth" : "/auth/username-register") + suffix}>
            {register ? "去登录" : "注册账号"}
          </Link>
        </p>
        <details className="ew-auth-help">
          <summary>
            登录帮助
            <ChevronDown size={13} aria-hidden="true" />
          </summary>
          <div>
            <Link to="/auth/forgot">找回密码</Link>
            <Link to="/auth/withdraw-consent">撤回同步授权</Link>
          </div>
        </details>
      </footer>
    </>
  );
}
