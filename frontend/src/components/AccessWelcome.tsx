import { useId, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LoginLink } from "../app/auth-dialog";
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

function welcomeCopy(path: string) {
  if (path.startsWith("/publish") || path.startsWith("/restaurants/new"))
    return {
      title: ["这一餐的快乐，", "也想分享给你。"],
      description: "拍下喜欢的那道菜，\n把你的私藏好味道分享出去。",
      heading: "登录，分享你的这一餐",
      detail: "记录吃过的好味道，让同学的下一餐多一个选择。",
      note: "这顿值得分享",
    };
  if (path.startsWith("/favorites") || path.startsWith("/me/tags"))
    return {
      title: ["喜欢的味道，", "留给下一餐。"],
      description: "把心动的菜收进清单，\n下次纠结吃什么，就来这里翻翻。",
      heading: "登录，收好你的想吃清单",
      detail: "收藏喜欢的菜，用自己的标签慢慢整理。",
      note: "想吃 +1",
    };
  return {
    title: ["好好吃饭，", "从认识你开始。"],
    description: "收藏想吃的，分享吃过的。\n和同校的你，一起发现好味道。",
    heading: "登录，开启你的美食日常",
    detail: "喜欢的菜、分享的每一餐，都在这里为你留好。",
    note: "今日份好胃口",
  };
}

/** Shared welcome for protected pages, including the prototype-sized canvas. */
export function AccessWelcome({
  verification = false,
  canvas = false,
  footer,
}: {
  verification?: boolean;
  canvas?: boolean;
  footer?: ReactNode;
}) {
  const location = useLocation();
  const titleId = useId();
  const copy = verification
    ? {
        title: ["同校的你，", "一起好好吃饭。"],
        description: "用学生身份打个招呼，\n把校园里的好味道分享给彼此。",
        heading: "再认识一下，同校的你",
        detail: "完成学生认证，就能发布菜品、点赞和管理标签。",
        note: "同校的好味道",
      }
    : welcomeCopy(location.pathname);
  const next = location.pathname + location.search;
  return (
    <section
      className={`ew-access${canvas ? " ew-access-canvas" : ""}${footer ? " ew-access-with-nav" : ""}`}
      aria-labelledby={titleId}
    >
      <div className="ew-access-stage">
        <header className="ew-access-brand">
          <span>
            山软 <span aria-hidden="true">·</span> 今天吃什么
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
            {verification ? (
              <ShieldCheck size={16} aria-hidden="true" />
            ) : (
              <UsersRound size={16} aria-hidden="true" />
            )}
            {verification ? "校园里的每一份信任" : "你的校园美食手账"}
          </span>
          <h2>{copy.heading}</h2>
          <p>{copy.detail}</p>
          <ul
            className="ew-access-benefits"
            aria-label={verification ? "认证后可以" : "登录后可以"}
          >
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
          <LoginLink
            className="ew-access-primary"
            to={
              verification
                ? "/verify"
                : `/auth?next=${encodeURIComponent(next)}`
            }
          >
            {verification ? "去完成学生认证" : "登录 / 注册"}
            <ArrowRight size={18} aria-hidden="true" />
          </LoginLink>
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
