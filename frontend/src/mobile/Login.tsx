import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthForm } from "../desktop/DesktopAccount";
import { PhoneLoginForm } from "../features/Account";
import { DishCarousel } from "../components/DishCarousel";
import "./login.css";

export default function MobileLogin() {
  const location = useLocation();
  const phone = ["/auth/register", "/auth/register/confirm"].includes(
    location.pathname,
  );
  const register = location.pathname === "/auth/username-register";
  const title = phone ? "手机登录 / 注册" : register ? "注册账号" : "登录";
  useEffect(() => {
    document.title = `${title} · 山软今天吃什么`;
  }, [title]);
  return (
    <main className="ew-login">
      <header className="ew-login-stage">
        <div className="ew-login-brand">
          <span>山软 · 今天吃什么</span>
          <Link to={phone || register ? "/auth" + location.search : "/"}>
            <ArrowLeft size={15} aria-hidden="true" />
            {phone || register ? "返回登录" : "返回发现"}
          </Link>
        </div>
        <h1>
          今天
          <br />
          吃什么
        </h1>
        <p>
          看看同学们都在吃什么，
          <br />
          再分享你的私藏好味道。
        </p>
        <DishCarousel />
      </header>
      <section
        className="ew-login-sheet pc-secondary-auth-content"
        aria-label={title}
      >
        {phone ? (
          <PhoneLoginForm embedded />
        ) : (
          <AuthForm key={register ? "register" : "login"} register={register} />
        )}
      </section>
    </main>
  );
}
