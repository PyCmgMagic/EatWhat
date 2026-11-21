import {
  ChevronLeft,
  ChevronRight,
  Copy,
  History,
  MessageSquareText,
} from "lucide-react";
import { lazy, Suspense, useContext, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { buildNumber, webVersion } from "../app/version";
import { DesignIcon as Icon } from "../mobile/ui";
import {
  aboutHome,
  aboutUs,
  openSource,
  productionTeam,
} from "./about-navigation";
import DevelopmentTeam from "./DevelopmentTeam";
import SettingsPageHeader from "./SettingsPageHeader";
import { DesktopSettingsContext } from "./settings-nav";
import "./about.css";

const OpenSourceNotices = lazy(() => import("./OpenSourceNotices"));

function VersionInfo() {
  const build =
    buildNumber === undefined
      ? import.meta.env.DEV
        ? "本地构建"
        : "构建号未提供"
      : `构建 ${buildNumber}`;
  const text = `山软今天吃什么 Web ${webVersion}（${build}）`;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  async function copyVersion() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  }
  return (
    <section className="about-version" aria-labelledby="about-version-title">
      <h2 id="about-version-title">版本</h2>
      <div className="about-version-row">
        <div className="about-version-numbers">
          <strong>{webVersion}</strong>
          <span>{build}</span>
        </div>
        <button type="button" aria-label="复制版本信息" onClick={copyVersion}>
          <Copy size={18} aria-hidden="true" />
          复制
        </button>
      </div>
      <p role="status">
        {copyState === "copied"
          ? "已复制版本号和构建信息。"
          : copyState === "manual"
            ? "请手动复制下方的版本信息。"
            : "如需向他人提供版本号，请一并提供构建信息。"}
      </p>
      {copyState === "manual" && (
        <input
          aria-label="可手动复制的版本信息"
          readOnly
          value={text}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </section>
  );
}

function AboutRow({
  title,
  to,
  href,
  icon,
  detail,
}: {
  title: string;
  icon?: ReactNode;
  detail?: string;
} & ({ to: string; href?: never } | { href: string; to?: never })) {
  const body = (
    <>
      {icon}
      <span className="about-row-label">{title}</span>
      {detail && <span className="about-row-detail">{detail}</span>}
      <ChevronRight
        className="about-row-chevron"
        size={19}
        aria-hidden="true"
      />
    </>
  );
  return href !== undefined ? (
    <a href={href}>{body}</a>
  ) : (
    <Link to={to}>{body}</Link>
  );
}

function AboutDirectory() {
  return (
    <>
      <VersionInfo />
      <nav className="about-directory" aria-label="关于栏目">
        <div className="about-list about-feedback-links">
          <AboutRow
            to="/feedback"
            title="反馈"
            detail="问题反馈与建议"
            icon={<MessageSquareText size={22} aria-hidden="true" />}
          />
          <AboutRow
            to="/feedback/mine"
            title="我的反馈"
            detail="提交记录与处理结果"
            icon={<History size={22} aria-hidden="true" />}
          />
        </div>
        <div className="about-list">
          <AboutRow
            href="https://eat.v50to.you/legal/privacy-policy.html"
            title="隐私政策"
          />
          <AboutRow
            href="https://eat.v50to.you/legal/user-agreement.html"
            title="用户协议"
          />
          <AboutRow to={productionTeam.path} title={productionTeam.title} />
          <AboutRow to={openSource.path} title={openSource.title} />
        </div>
        <Link className="about-us-link" to={aboutUs.path}>
          {aboutUs.title}
        </Link>
      </nav>
    </>
  );
}

function AboutUs() {
  return (
    <>
      <article className="about-story">
        <span className="about-tile-icon">
          <Icon name="bowl" size={24} />
        </span>
        <h2>山软今天吃什么</h2>
        <p>
          这是山软同学一起做的校园美食指南。选好校区、饭点和堂食或外卖，就能从大家分享的菜品里挑一顿想吃的。
        </p>
        <p>
          这里的店铺、菜品和评价都来自校园里的食友。你可以收藏想吃的菜，也可以写下自己的口味和体验，给下一位同学做参考。
        </p>
        <Link to="/">
          去发现菜品 <Icon name="chevronRight" size={16} />
        </Link>
      </article>
      <nav className="about-resources" aria-label="相关服务">
        <Link to="/data-notice">
          数据存放说明 <Icon name="chevronRight" size={18} />
        </Link>
        <Link to="/feedback">
          意见反馈 <Icon name="chevronRight" size={18} />
        </Link>
      </nav>
    </>
  );
}

export default function AboutPage({ page }: { page: typeof aboutHome }) {
  const isHome = page.path === aboutHome.path;
  const desktopSettings = useContext(DesktopSettingsContext);
  return (
    <section
      className={isHome ? "about-screen about-home" : "about-screen"}
      aria-labelledby="about-page-title"
    >
      {desktopSettings ? (
        <SettingsPageHeader
          title={page.title}
          back={page.back}
          headingId="about-page-title"
        />
      ) : (
        <header className="about-heading">
          <Link to={page.back} aria-label={isHome ? "返回设置" : "返回关于"}>
            <ChevronLeft size={24} aria-hidden="true" />
          </Link>
          <h1 id="about-page-title">{page.title}</h1>
        </header>
      )}
      {isHome ? (
        <AboutDirectory />
      ) : page.path === aboutUs.path ? (
        <AboutUs />
      ) : page.path === openSource.path ? (
        <Suspense fallback={<p role="status">正在读取开源声明…</p>}>
          <OpenSourceNotices />
        </Suspense>
      ) : (
        <DevelopmentTeam />
      )}
    </section>
  );
}
