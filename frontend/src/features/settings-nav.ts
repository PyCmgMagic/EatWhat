import { createContext } from "react";
import { mobileSettingsPages } from "../mobile/routes";

export const DesktopSettingsContext = createContext(false);

export const settingsOverview = {
  to: "/settings",
  name: "设置总览",
  icon: "settings",
};

export const androidAppDownload = {
  href: "https://eat.v50to.you/downloads/android",
  name: "下载安卓 App",
  icon: "download",
};

export type SettingsNavItem = {
  name: string;
  icon: string;
} & ({ to: string; href?: never } | { href: string; to?: never });

export const settingsNavGroups: { title: string; items: SettingsNavItem[] }[] =
  [
    {
      title: "账号",
      items: [{ to: "/settings/account", name: "账号与安全", icon: "idcard" }],
    },
    {
      title: "偏好",
      items: [
        { to: "/settings/personalization", name: "个性化", icon: "eye" },
        { to: "/settings/privacy", name: "隐私设置", icon: "lock" },
        { to: "/settings/notifications", name: "通知偏好", icon: "bell" },
      ],
    },
    {
      title: "支持",
      items: [
        { to: "/help", name: "帮助与反馈", icon: "feedback" },
        androidAppDownload,
        { to: "/settings/about", name: "关于", icon: "info" },
      ],
    },
  ];

const categories = new Set([
  settingsOverview.to,
  ...settingsNavGroups.flatMap((group) =>
    group.items.flatMap((item) => (item.to ? [item.to] : [])),
  ),
]);

/** Use each detail page's existing parent so direct links and Back agree. */
export function desktopSettingsCategory(path: string): string | undefined {
  if (categories.has(path)) return path;
  if (
    /^\/feedback(?:\/mine(?:\/[^/]+)?)?$/.test(path) ||
    path === "/reports/new" ||
    path === "/restaurants/correction"
  )
    return "/help";
  const parent = mobileSettingsPages[path]?.back;
  return parent ? desktopSettingsCategory(parent) : undefined;
}
