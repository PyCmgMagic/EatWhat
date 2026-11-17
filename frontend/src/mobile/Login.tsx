import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthForm } from "../desktop/DesktopAccount";
import { PhoneLoginForm, RecoverPassword } from "../features/Account";
import { DishCarousel } from "../components/DishCarousel";
import AuthLanding from "../components/AuthLanding";
import { isPhoneAuthPath } from "../app/auth-routes";
import { BRAND_SLOGAN } from "../app/brand";
import { DesignIcon as Icon } from "./ui";
import "./login.css";

export default function LoginPage({ desktop }: { desktop: boolean }) {
  const location = useLocation();
  const { pathname: path, search: suffix, state } = location;
  const phone = isPhoneAuthPath(path);
  const recovery = path === "/auth/forgot";
  const title = recovery ? "找回密码" : phone ? "手机登录 / 注册" : "登录";
  useEffect(() => {
    document.title = `${title} · 山软今天吃什么`;
  }, [title]);

  if (path === "/auth") return <AuthLanding desktop={desktop} />;

  return (
    <div
      className={desktop ? "pc-secondary-auth" : "ew-login mobile-auth-page"}
      data-pc-secondary={desktop ? "auth" : undefined}
      data-screen={
        desktop
          ? undefined
          : recovery
            ? "G-ForgotPassword"
            : phone
              ? "G-PhoneLogin"
              : "G-PasswordLogin"
      }
    >
      {desktop ? (
        <aside className="pc-secondary-auth-art">
          <Link to="/" className="pc-secondary-back">
            <Icon name="back" size={17} />
            回到发现
          </Link>
          <span className="pc-eyebrow">山软 · 今天吃什么</span>
          <h1>{BRAND_SLOGAN}</h1>
          <DishCarousel />
        </aside>
      ) : (
        <>
          <header className="mobile-auth-header">
            <Link
              to={(recovery ? "/auth/password" : "/auth") + suffix}
              state={state}
              aria-label="返回"
            >
              <ArrowLeft size={24} aria-hidden="true" />
            </Link>
          </header>
          <div className="mobile-auth-intro">
            <h1>{title}</h1>
            <p>
              {recovery
                ? "用绑定的手机号登录后，即可设置新密码"
                : phone
                  ? "新号码自动注册，已有号码直接登录"
                  : "用手机号、邮箱或用户名都可以"}
            </p>
          </div>
        </>
      )}
      <section
        className={
          desktop
            ? "pc-secondary-auth-content"
            : "mobile-auth-form pc-secondary-auth-content"
        }
        aria-label={title}
      >
        {recovery ? (
          <RecoverPassword compact={!desktop} />
        ) : phone ? (
          <PhoneLoginForm embedded compact={!desktop} />
        ) : (
          <AuthForm compact={!desktop} />
        )}
        {!desktop && !phone && !recovery && (
          <Link className="mobile-auth-forgot" to={"/auth/forgot" + suffix}>
            忘了密码
          </Link>
        )}
      </section>
      {!desktop && (
        <footer className="mobile-auth-footer">
          {recovery ? (
            <Link to={"/auth/password" + suffix} state={state}>
              返回密码登录
            </Link>
          ) : !phone ? (
            <>
              <p>
                还没有账号？
                <Link to={"/auth/register" + suffix} state={state}>
                  注册
                </Link>
              </p>
              <Link to={"/auth/register" + suffix} state={state}>
                使用验证码登录
              </Link>
            </>
          ) : (
            <Link to={"/auth/password" + suffix} state={state}>
              已有账号，去登录
            </Link>
          )}
        </footer>
      )}
    </div>
  );
}
