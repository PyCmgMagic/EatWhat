import { useEffect, useId, useRef, type ReactNode } from "react";
import { BRAND_NAME, BRAND_PREFIX, BRAND_SLOGAN } from "../app/brand";
import { BrandLogo } from "./BrandLogo";
import { Link, useLocation } from "react-router-dom";
import { LoginLink, useLoginDialog } from "../app/auth-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Heart,
  Send,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import "./access-welcome.css";

function loginReason(path: string) {
  if (path.startsWith("/publish") || path.startsWith("/restaurants/new"))
    return {
      heading: "登录后继续发布",
      detail: "登录后即可分享菜品、添加餐厅。",
    };
  if (path.startsWith("/likes"))
    return {
      heading: "登录后查看赞过的菜",
      detail: "点赞过的菜品会保存在你的账号中。",
    };
  if (path.startsWith("/favorites") || path.startsWith("/me/tags"))
    return {
      heading: "登录后查看收藏",
      detail: "收藏的菜品和个人标签会保存在你的账号中。",
    };
  return {
    heading: "登录你的账号",
    detail: "登录后查看个人资料、收藏和分享。",
  };
}

type AccessProps = {
  verification?: boolean;
  canvas?: boolean;
  footer?: ReactNode;
};

/** Protected routes enter the existing login flow without a second landing page. */
export function AccessWelcome({ verification = false, ...props }: AccessProps) {
  return verification ? (
    <VerificationWelcome {...props} />
  ) : (
    <LoginRequired {...props} />
  );
}

function LoginRequired({ canvas = false, footer }: AccessProps) {
  const location = useLocation();
  const { openLogin } = useLoginDialog();
  const openedEntry = useRef<string | null>(null);
  const titleId = useId();
  const copy = loginReason(location.pathname);
  const next = location.pathname + location.search + location.hash;
  const to = `/auth?next=${encodeURIComponent(next)}`;
  const entry = location.key + ":" + next;

  useEffect(() => {
    // Closing the dialog leaves a usable page; re-renders must not reopen it.
    if (openedEntry.current === entry) return;
    // HashRouter commits navigation in a transition. A synchronous logout can
    // render this old gate before that commit; do not overwrite the new route.
    if (window.location.hash.slice(1) !== next) return;
    openedEntry.current = entry;
    openLogin(to, { replace: true, returnTo: "/" });
  }, [entry, openLogin, to]);

  return (
    <section
      className={`ew-login-required${canvas ? " ew-login-required-canvas" : ""}`}
      aria-labelledby={titleId}
    >
      <div className="ew-login-required-content">
        <BrandLogo
          size={80}
          className="ew-login-required-logo"
          alt={BRAND_NAME}
        />
        <h1 id={titleId}>{copy.heading}</h1>
        <p>{copy.detail}</p>
        <LoginLink className="ew-login-required-primary" to={to}>
          登录 / 注册
          <ArrowRight size={18} aria-hidden="true" />
        </LoginLink>
        <Link className="ew-login-required-back" to="/">
          返回发现
        </Link>
      </div>
      {footer && <div className="ew-login-required-navigation">{footer}</div>}
    </section>
  );
}

function VerificationWelcome({ canvas = false, footer }: AccessProps) {
  const location = useLocation();
  const titleId = useId();
  const copy = {
    title: [BRAND_SLOGAN],
    description: "用学生身份打个招呼，\n把校园里的好味道分享给彼此。",
    heading: "再认识一下，同校的你",
    detail: "完成学生认证，就能发布菜品、点赞和管理标签。",
    note: BRAND_SLOGAN,
  };
  return (
    <section
      className={`ew-access${canvas ? " ew-access-canvas" : ""}${footer ? " ew-access-with-nav" : ""}`}
      aria-labelledby={titleId}
    >
      <div className="ew-access-stage">
        <header className="ew-access-brand">
          <span>
            {BRAND_PREFIX} <span aria-hidden="true">·</span> 今天吃什么
          </span>
          {location.pathname !== "/me" && (
            <Link to="/" aria-label="返回发现">
              <ArrowLeft size={15} aria-hidden="true" />
              发现
            </Link>
          )}
        </header>
        <div className="ew-access-intro">
          <h1 id={titleId}>
            {copy.title.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <p>{copy.description}</p>
        </div>
        <div className="ew-access-table" aria-hidden="true">
          <img
            className="ew-access-dish ew-access-dish-left"
            src="/prototype/assets/dishes/jiaozi.svg"
            alt=""
          />
          <img
            className="ew-access-dish ew-access-dish-main"
            src="/prototype/assets/dishes/yuntun.svg"
            alt=""
          />
          <img
            className="ew-access-dish ew-access-dish-right"
            src="/prototype/assets/dishes/niunan.svg"
            alt=""
          />
          <span className="ew-access-note">
            <Heart size={14} />
            {copy.note}
          </span>
        </div>
      </div>
      <div className="ew-access-sheet">
        <div className="ew-access-invitation">
          <span className="ew-access-eyebrow">
            <ShieldCheck size={16} aria-hidden="true" />
            校园里的每一份信任
          </span>
          <h2>{copy.heading}</h2>
          <p>{copy.detail}</p>
          <ul className="ew-access-benefits" aria-label="认证后可以">
            <li>
              <Bookmark size={16} aria-hidden="true" />
              收藏想吃的
            </li>
            <li>
              <Send size={16} aria-hidden="true" />
              分享这一餐
            </li>
            <li>
              <UsersRound size={16} aria-hidden="true" />
              认识同校的你
            </li>
          </ul>
          <Link className="ew-access-primary" to="/verify">
            去完成学生认证
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <Link className="ew-access-explore" to="/">
            先逛逛，找点好吃的
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {footer && <div className="ew-access-navigation">{footer}</div>}
      </div>
    </section>
  );
}
