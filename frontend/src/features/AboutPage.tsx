import { UsersRound } from "lucide-react";
import { useContext } from "react";
import { Link } from "react-router-dom";
import { DesignIcon as Icon } from "../mobile/ui";
import { aboutHome, aboutUs, productionTeam } from "./about-navigation";
import DevelopmentTeam from "./DevelopmentTeam";
import SettingsPageHeader from "./SettingsPageHeader";
import { DesktopSettingsContext } from "./settings-nav";
import "./about.css";

function AboutDirectory() {
  return (
    <nav className="about-directory" aria-label="关于栏目">
      <Link to={aboutUs.path}>
        <span className="about-tile-icon">
          <Icon name="bowl" size={24} />
        </span>
        <span>{aboutUs.title}</span>
        <Icon name="chevronRight" size={18} />
      </Link>
      <Link to={productionTeam.path}>
        <span className="about-tile-icon about-team-icon">
          <UsersRound size={22} aria-hidden="true" />
        </span>
        <span>{productionTeam.title}</span>
        <Icon name="chevronRight" size={18} />
      </Link>
    </nav>
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
    <section className="about-screen" aria-labelledby="about-page-title">
      {desktopSettings ? (
        <SettingsPageHeader
          title={page.title}
          back={page.back}
          headingId="about-page-title"
        />
      ) : (
        <header className="about-heading">
          <Link to={page.back} aria-label={isHome ? "返回设置" : "返回关于"}>
            <Icon name="back" />
          </Link>
          <h1 id="about-page-title">{page.title}</h1>
        </header>
      )}
      {isHome ? (
        <AboutDirectory />
      ) : page.path === aboutUs.path ? (
        <AboutUs />
      ) : (
        <DevelopmentTeam />
      )}
    </section>
  );
}
