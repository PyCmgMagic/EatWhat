import { useLocation } from "react-router-dom";
import { useApp } from "../app/state";
import { localDestination } from "../app/navigation";
import { Gate } from "../components/ui";
import { DesktopSettingsPage } from "../desktop/DesktopAccount";
import ApiV2Routes from "../features/ApiV2Routes";
import V4Routes from "../features/v4/Routes";
import { Preferences } from "../features/Account";
import Personalization from "../theme/Personalization";
import AboutPage from "../features/AboutPage";
import { findAboutPage } from "../features/about-navigation";
import { mobileSettingsPages } from "./routes";
import SettingsFrame from "./SettingsFrame";
import {
  readVerificationCallback,
  verificationReturn,
} from "../app/verification-return";

export default function MobileSettingsPages() {
  const location = useLocation(),
    path = location.pathname;
  const { user } = useApp();
  const about = findAboutPage(path);
  if (about) return <AboutPage page={about} />;
  const page = mobileSettingsPages[path];
  const returnTo =
    path === "/verify"
      ? readVerificationCallback(location.search)
        ? verificationReturn(user?.id).intent?.returnTo
        : localDestination(new URLSearchParams(location.search).get("next"))
      : null;
  const title =
    path === "/settings/password" && user?.hasPassword === false
      ? "设置密码"
      : page.title;
  const content =
    page.source === "v4" ? (
      <V4Routes />
    ) : page.source === "v2" ? (
      <ApiV2Routes />
    ) : page.source === "preferences" ? (
      <Preferences />
    ) : path === "/settings/personalization" ? (
      <Personalization showBottomNavigation />
    ) : page.public ? (
      <DesktopSettingsPage />
    ) : (
      <Gate verified={false}>
        <DesktopSettingsPage />
      </Gate>
    );
  return (
    <SettingsFrame
      title={title}
      detail={
        path === "/verify" && user?.verified
          ? "学生身份已确认，可以继续探索校园美食。"
          : undefined
      }
      back={returnTo ?? page.back}
      backLabel={returnTo ? "返回原页面" : undefined}
    >
      {content}
    </SettingsFrame>
  );
}
