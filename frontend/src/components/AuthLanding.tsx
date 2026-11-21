import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BRAND_SLOGAN } from "../app/brand";
import { localDestination } from "../app/navigation";
import { DesignIcon as Icon } from "../mobile/ui";
import { DishCarousel } from "./DishCarousel";
import { AuthPageCurl } from "./AuthPageCurl";
import { Modal } from "./ui";
import "./auth-landing.css";

type LoginDestination = "/auth/register" | "/auth/password";

export default function AuthLanding({ desktop }: { desktop: boolean }) {
  const location = useLocation(),
    navigate = useNavigate(),
    [agreed, setAgreed] = useState(false),
    [destination, setDestination] = useState<LoginDestination | null>(null),
    [accepted, setAccepted] = useState<LoginDestination | null>(null),
    returnTo =
      localDestination(
        (location.state as { returnTo?: string } | null)?.returnTo,
      ) ?? "/";
  useEffect(() => {
    if (accepted) navigate(accepted + location.search);
  }, [accepted, location.search, navigate]);

  function choose(path: LoginDestination) {
    if (agreed) navigate(path + location.search);
    else setDestination(path);
  }

  return (
    <div className={`auth-landing ${desktop ? "is-desktop" : "is-mobile"}`}>
      <section
        className="auth-landing-stage"
        aria-labelledby="auth-landing-title"
      >
        <AuthPageCurl to={returnTo} />
        <div className="auth-landing-intro">
          <span>山软</span>
          <h1 id="auth-landing-title">
            今天
            <br />
            吃什么
          </h1>
          <p>
            {BRAND_SLOGAN}
            <span className="auth-landing-thought" aria-hidden="true">
              🤔
            </span>
          </p>
        </div>
        <DishCarousel />
      </section>

      <section className="auth-landing-sheet" aria-label="选择登录方式">
        <div className="auth-landing-actions">
          <button type="button" onClick={() => choose("/auth/register")}>
            <Icon name="phone" size={21} />
            手机注册 / 登录
          </button>
          <button type="button" onClick={() => choose("/auth/password")}>
            <Icon name="lock" size={21} />
            账号密码登录
          </button>
        </div>
        <label className="auth-landing-consent">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          <span>
            我已阅读并同意<span className="auth-policy-name">《隐私政策》</span>
            <span className="auth-policy-name">《用户协议》</span>和
            <span className="auth-policy-name">《个人信息出境说明》</span>
          </span>
        </label>
      </section>

      {destination && (
        <Modal
          title="同意后继续"
          className="auth-policy-prompt"
          onClose={() => setDestination(null)}
        >
          <p className="auth-policy-prompt-copy">
            使用时会收集设备信息和使用记录，传到境外服务器存储和处理。继续前请阅读并同意
            <span className="auth-policy-name">《隐私政策》</span>
            <span className="auth-policy-name">《用户协议》</span>和
            <span className="auth-policy-name">《个人信息出境说明》</span>。
          </p>
          <div className="auth-policy-prompt-actions">
            <button type="button" onClick={() => setDestination(null)}>
              不同意
            </button>
            <button
              type="button"
              className="is-confirm"
              onClick={() => {
                setAgreed(true);
                setAccepted(destination);
                setDestination(null);
              }}
            >
              同意并继续
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
