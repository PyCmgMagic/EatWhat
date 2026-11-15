import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthForm } from "../desktop/DesktopAccount";
import { PhoneLoginForm, RecoverPassword } from "../features/Account";
import { DishCarousel } from "../components/DishCarousel";
import { localDestination } from "../app/navigation";
import { isPhoneAuthPath } from "../app/auth-routes";
import { BRAND_SLOGAN } from "../app/brand";
import { DesignIcon as Icon } from "./ui";
import "./login.css";

export default function LoginPage({ desktop }: { desktop: boolean }) {
  const location = useLocation();
  const { pathname: path, search: suffix, state } = location;
  const landing = !desktop && path === "/auth";
  const phone = isPhoneAuthPath(path);
  const recovery = path === "/auth/forgot";
  const title = recovery ? "找回密码" : phone ? "手机登录 / 注册" : "登录";
  useEffect(() => {
    document.title = `${title} · 山软今天吃什么`;
  }, [title]);

  return (
    <div
      className={
        desktop
          ? "pc-secondary-auth"
          : landing
            ? "ew-login mobile-login-landing"
            : recovery
              ? undefined
              : "ew-login mobile-auth-page"
      }
      data-pc-secondary={desktop ? "auth" : undefined}
      data-screen={
        desktop || recovery
          ? undefined
          : landing
            ? "G-Login"
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
      ) : landing ? (
        <MobileLoginLanding />
      ) : !recovery ? (
        <>
          <header className="mobile-auth-header">
            <Link to={"/auth" + suffix} state={state} aria-label="返回">
              <ArrowLeft size={24} aria-hidden="true" />
            </Link>
          </header>
          <div className="mobile-auth-intro">
            <h1>{title}</h1>
            <p>
              {phone
                ? "新号码自动注册，已有号码直接登录"
                : "用手机号、邮箱或用户名都可以"}
            </p>
          </div>
        </>
      ) : null}
      <section
        className={
          desktop
            ? "pc-secondary-auth-content"
            : recovery
              ? "ew-mobile-feature"
              : landing
                ? undefined
                : "mobile-auth-form pc-secondary-auth-content"
        }
        aria-label={title}
        // The desktop password form stays available when the user opens it from the mobile landing.
        hidden={landing}
      >
        {recovery ? (
          <RecoverPassword />
        ) : phone ? (
          <PhoneLoginForm embedded compact={!desktop} />
        ) : (
          <AuthForm compact={!desktop} />
        )}
        {!desktop && !landing && !phone && !recovery && (
          <Link className="mobile-auth-forgot" to={"/auth/forgot" + suffix}>
            忘了密码
          </Link>
        )}
      </section>
      {!desktop && !landing && !recovery && (
        <footer className="mobile-auth-footer">
          {!phone ? (
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

function MobileLoginLanding() {
  const { search, state } = useLocation();
  const returnTo =
    localDestination((state as { returnTo?: string } | null)?.returnTo) ?? "/";
  return (
    <>
      <header className="mobile-login-stage">
        <Link
          className="mobile-login-back"
          to={returnTo}
          replace
          aria-label="返回"
        >
          <ArrowLeft size={24} aria-hidden="true" />
        </Link>
        <div className="mobile-login-intro">
          <span>山软</span>
          <h1>
            今天
            <br />
            吃什么
          </h1>
          <p>
            看看软件园的同学都在吃什么，
            <br />
            再把你的好店分享出去。
          </p>
        </div>
        <DishCarousel />
      </header>
      <section className="mobile-login-sheet" aria-label="登录与注册">
        <Link
          className="mobile-login-primary"
          to={"/auth/password" + search}
          state={state}
        >
          登录
        </Link>
        <p className="mobile-login-register">
          还没有账号？
          <Link to={"/auth/register" + search} state={state}>
            注册
          </Link>
        </p>
      </section>
    </>
  );
}
