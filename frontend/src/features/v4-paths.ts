import { parseId } from "../api/models";

export function restaurantHistoryId(path: string) {
  return parseId(/^\/restaurants\/(\d+)\/history$/.exec(path)?.[1]);
}

/**
 * 互动通知与站点公告是「消息通知」这一页的两个视图：共用页头与分类导航，
 * 切换时只换下方内容，不重挂整页、也不让整页播入场动效。
 */
export function isMessagesPath(path: string) {
  return path === "/notifications" || path === "/announcements";
}

/** 动效与重挂用的稳定键：同一页的两个视图必须映射到同一个键。 */
export function routeMotionKey(path: string) {
  return isMessagesPath(path) ? "/notifications" : path;
}

export function isV4Path(path: string) {
  return (
    [
      "/feedback",
      "/feedback/mine",
      "/reports/new",
      "/restaurants/correction",
      "/settings/devices",
      "/settings/phone",
      "/settings/delete",
      "/settings/notifications",
      "/auth/account-recovery",
      "/auth/device-recovery",
      "/auth/mobile-recovery",
      "/notifications",
      "/announcements",
      "/topics",
      "/topics/current",
      "/submissions",
      "/restaurants/favorites",
      "/features",
      "/me/growth",
      "/restaurants/directory",
    ].includes(path) ||
    restaurantHistoryId(path) !== undefined ||
    /^\/(feedback\/mine|submissions|topics)\/[^/]+$/.test(path) ||
    path === "/admin/v4" ||
    /^\/me\/tags\/\d+\/foods$/.test(path)
  );
}
