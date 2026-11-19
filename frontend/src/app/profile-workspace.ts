import { createContext, type RefObject } from "react";

export const profileSections = [
  { to: "/me", name: "个人总览", icon: "me", group: "" },
  { to: "/me/shares", name: "我的分享", icon: "bowl", group: "我的内容" },
  { to: "/favorites", name: "我的收藏", icon: "bookmark", group: "我的内容" },
  { to: "/likes", name: "赞过的菜", icon: "heart", group: "我的内容" },
  { to: "/me/growth", name: "我的成长", icon: "bowl", group: "我的内容" },
  { to: "/history", name: "浏览足迹", icon: "history", group: "我的内容" },
  { to: "/settings", name: "账号设置", icon: "settings", group: "账号与服务" },
] as const;

export type ProfileSection =
  (typeof profileSections)[number]["to"] | "/features";
export const ProfileWorkspaceContext = createContext(false);
export type ProfileNavigationGuard = (destination: string) => boolean;
export const ProfileNavigationGuardContext =
  createContext<RefObject<ProfileNavigationGuard | null> | null>(null);

/** Presentation only: each destination retains its own access and recovery gates. */
export function profileSection(path: string): ProfileSection | null {
  if (path === "/features") return "/features";
  if (path === "/me") return "/me";
  if (path === "/me/shares" || /^\/submissions(?:\/[^/]+)?$/.test(path))
    return "/me/shares";
  if (path === "/likes") return "/likes";
  if (path === "/favorites" || path === "/restaurants/favorites")
    return "/favorites";
  if (path === "/me/tags" || /^\/me\/tags\/\d+\/foods$/.test(path))
    return "/favorites";
  if (path === "/me/growth") return "/me/growth";
  if (path === "/history") return "/history";
  if (
    path === "/help" ||
    path === "/feedback" ||
    /^\/feedback\/mine(?:\/\d+)?$/.test(path) ||
    path === "/reports/new" ||
    path === "/restaurants/correction"
  )
    return "/settings";
  if (
    path === "/settings" ||
    path.startsWith("/settings/") ||
    [
      "/verify",
      "/data-notice",
      "/me/edit",
      "/me/details",
      "/auth/account-recovery",
      "/auth/device-recovery",
      "/auth/mobile-recovery",
    ].includes(path)
  )
    return "/settings";
  return null;
}
