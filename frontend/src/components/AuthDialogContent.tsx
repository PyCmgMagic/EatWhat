import { AuthForm } from "../desktop/DesktopAccount";
import { PhoneLoginForm, RecoverPassword } from "../features/Account";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useAuthFlow } from "../app/auth-dialog";
import { isPhoneAuthPath } from "../app/auth-routes";

export default function AuthDialogContent({ path }: { path: string }) {
  const { location } = useAuthFlow();
  if (path === "/auth/forgot") return <RecoverPassword />;
  const phone = isPhoneAuthPath(path);
  const suffix = location.search;
  return (
    <>
      <div className="ew-auth-intro">
        <h2>
          欢迎回来
          <span aria-hidden="true">。</span>
        </h2>
      </div>
      <nav className="ew-auth-methods" aria-label="登录方式">
        <Link to={"/auth" + suffix} aria-current={!phone ? "page" : undefined}>
          密码登录
        </Link>
        <Link
          to={"/auth/register" + suffix}
          aria-current={phone ? "page" : undefined}
        >
          验证码登录
        </Link>
      </nav>
      {phone ? <PhoneLoginForm embedded compact /> : <AuthForm compact />}
      {phone && (
        <p className="ew-auth-phone-note">
          新号码将自动注册，验证码 5 分钟内有效。
        </p>
      )}
      <footer className="ew-auth-footer">
        <p>
          {phone ? "已有账号？" : "还没有账号？"}
          <Link to={(phone ? "/auth/password" : "/auth/register") + suffix}>
            {phone ? "密码登录" : "注册账号"}
          </Link>
        </p>
        <details className="ew-auth-help">
          <summary>
            登录帮助
            <ChevronDown size={13} aria-hidden="true" />
          </summary>
          <div>
            <Link to="/auth/forgot">找回密码</Link>
          </div>
        </details>
      </footer>
    </>
  );
}
