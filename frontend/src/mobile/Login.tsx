import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthForm } from "../desktop/DesktopAccount";
import { PhoneLoginForm } from "../features/Account";
import { DishCarousel } from "../components/DishCarousel";
import { localDestination } from "../app/navigation";
import { isPhoneAuthPath } from "../app/auth-routes";
import "./login.css";

/** G-Login's yellow stage and G-PasswordLogin's full-page, underlined form. */
export default function MobileLogin() {
  const location = useLocation();
  const landing = location.pathname === "/auth";
  const phone = isPhoneAuthPath(location.pathname);
  const title = phone ? "手机登录 / 注册" : "登录";
  const suffix = location.search;
  const returnTo =
    localDestination(
      (location.state as { returnTo?: string } | null)?.returnTo,
    ) ?? "/";
  useEffect(() => {
    document.title = `${title} · 山软今天吃什么`;
  }, [title]);

  if (landing)
    return (
      <main className="ew-login mobile-login-landing" data-screen="G-Login">
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
            to={"/auth/password" + suffix}
            state={location.state}
          >
            登录
          </Link>
          <p className="mobile-login-register">
            还没有账号？
            <Link to={"/auth/register" + suffix} state={location.state}>
              注册
            </Link>
          </p>
        </section>
      </main>
    );

  return (
    <main
      className="ew-login mobile-auth-page"
      data-screen={phone ? "G-PhoneLogin" : "G-PasswordLogin"}
    >
      <header className="mobile-auth-header">
        <Link to={"/auth" + suffix} state={location.state} aria-label="返回">
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
      <section
        className="mobile-auth-form pc-secondary-auth-content"
        aria-label={title}
      >
        {phone ? <PhoneLoginForm embedded compact /> : <AuthForm compact />}
        {!phone && (
          <Link className="mobile-auth-forgot" to={"/auth/forgot" + suffix}>
            忘了密码
          </Link>
        )}
      </section>
      <footer className="mobile-auth-footer">
        {!phone ? (
          <>
            <p>
              还没有账号？
              <Link to={"/auth/register" + suffix} state={location.state}>
                注册
              </Link>
            </p>
            <Link to={"/auth/register" + suffix} state={location.state}>
              使用验证码登录
            </Link>
          </>
        ) : (
          <>
            <Link to={"/auth/password" + suffix} state={location.state}>
              已有账号，去登录
            </Link>
          </>
        )}
      </footer>
    </main>
  );
}
