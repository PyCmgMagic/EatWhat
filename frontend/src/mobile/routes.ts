import { restaurantHistoryId } from "../features/v4-paths";

export const screenRoutes: Record<string, string> = {
  "G2-Home": "/",
  "G-HomePhoto": "/home-photo",
  "G-Nearby": "/nearby",
  "G-Me": "/me",
  "G-Inbox": "/notifications",
  "G-Dish": "/foods/1",
  "G-Detail": "/restaurants/1",
  "G-PickShop": "/publish",
  "G-AddDish": "/publish/dish",
  "G-NewShop": "/restaurants/new",
  "G-Login": "/auth",
  "G-PasswordLogin": "/auth/password",
  "G-PhoneLogin": "/auth/register",
  "G-RegisterConfirm": "/auth/register/confirm",
  "G-ForgotPassword": "/auth/forgot",
  "G-DataNotice": "/data-notice",
  "G-Verify": "/verify",
  "G-Search": "/search",
  "G-TopicArchive": "/topics",
  "G-Topic": "/topics/current",
  "G-Comments": "/comments",
  "G-WriteComment": "/comments/write",
  "G-WrongInfo": "/restaurants/correction",
  "G-UserProfile": "/users/21",
  "G-Follows": "/follows",
  "G-EditProfile": "/me/edit",
  "G-MyTags": "/me/tags",
  "G-TagDishes": "/favorites",
  "G-History": "/history",
  "G-Settings": "/settings",
  "G-SettingsAccount": "/settings/account",
  "G-ChangePhone": "/settings/phone",
  "G-ChangePassword": "/settings/password",
  "G-Devices": "/settings/devices",
  "G-DeleteAccount": "/settings/delete",
  "G-SettingsPrivacy": "/settings/privacy",
  "G-Blocked": "/settings/blocked",
  "G-SettingsNotify": "/settings/notifications",
  "G-SettingsAbout": "/settings/about",
  "G-Feedback": "/feedback",
  "G-Crop": "/publish/crop",
  "G-PanelPlace": "/panels/place",
  "G-PanelFilter": "/panels/filter",
  "G-PanelTag": "/panels/tags",
  "G-PanelReport": "/panels/report",
  "G-Kit": "/design/components",
  "G-Icons": "/design/icons",
  "G-Icon": "/design/icon",
  "G-Nav": "/design/navigation",
  "G-PhotoPipeline": "/design/photo-pipeline",
};
// Settings share a phone layout while retaining their existing API controllers.
export const mobileSettingsPages: Record<
  string,
  {
    title: string;
    back: string;
    source?: "v4" | "v2" | "preferences";
    public?: boolean;
  }
> = {
  "/settings/privacy": { title: "隐私设置", back: "/settings" },
  "/settings/password": { title: "修改密码", back: "/settings/account" },
  "/settings/bind-phone": { title: "绑定手机号", back: "/settings/account" },
  "/settings/username": {
    title: "设置登录名",
    back: "/settings/account",
    source: "v2",
  },
  "/settings/blocked": {
    title: "屏蔽名单",
    back: "/settings/privacy",
    source: "v2",
  },
  "/settings/devices": {
    title: "登录设备",
    back: "/settings/account",
    source: "v4",
  },
  "/settings/phone": {
    title: "更换手机号",
    back: "/settings/account",
    source: "v4",
  },
  "/settings/delete": {
    title: "注销账号",
    back: "/settings/account",
    source: "v4",
  },
  "/settings/notifications": {
    title: "通知偏好",
    back: "/settings",
    source: "v4",
  },
  "/settings/telemetry": {
    title: "使用统计",
    back: "/settings/privacy",
    source: "v4",
  },
  "/settings/preferences": {
    title: "口味偏好",
    back: "/settings",
    source: "preferences",
  },
  "/verify": { title: "学生认证", back: "/settings/account" },
  "/settings/about": { title: "关于我们", back: "/settings", public: true },
  "/data-notice": {
    title: "数据存放说明",
    back: "/settings/about",
    public: true,
  },
};
export function screenForPath(path: string) {
  if (/^\/foods\/\d+$/.test(path)) return "G-Dish";
  if (/^\/restaurants\/\d+$/.test(path)) return "G-Detail";
  if (/^\/users\/\d+$/.test(path)) return "G-UserProfile";
  if (path === "/restaurants") return "G-Nearby";
  if (path === "/recommend") return "G2-Home";
  return (
    Object.keys(screenRoutes).find((k) => screenRoutes[k] === path) ??
    "G-NotFound"
  );
}
export const panelScreens = new Set([
  "G-PanelPlace",
  "G-PanelFilter",
  "G-PanelTag",
  "G-PanelReport",
]);
export const pendingScreens: Record<string, string> = {
  "G-Topic": "专题详情",
  "G-ChangePhone": "换绑手机号",
  "G-Devices": "登录设备管理",
  "G-DeleteAccount": "注销账号",
  "G-Blocked": "屏蔽用户",
  "G-SettingsNotify": "通知设置",
  "G-Feedback": "意见反馈",
  "G-WrongInfo": "信息纠错",
  "G-PanelReport": "内容举报",

  "G-TopicArchive": "往期专题目录",
};

// Browser labels belong to product navigation, not prototype file/board names.
const screenTitles: Record<string, string> = {
  "G2-Home": "发现",
  "G-HomePhoto": "发现",
  "G-Nearby": "附近",
  "G-Me": "我的",
  "G-Inbox": "通知中心",
  "G-Dish": "菜品详情",
  "G-Detail": "餐厅详情",
  "G-PickShop": "分享一道菜",
  "G-AddDish": "分享一道菜",
  "G-NewShop": "添加一家店",
  "G-Login": "登录",
  "G-PasswordLogin": "登录",
  "G-PhoneLogin": "手机登录 / 注册",
  "G-RegisterConfirm": "手机登录 / 注册",
  "G-ForgotPassword": "找回密码",
  "G-DataNotice": "数据存放说明",
  "G-Verify": "学生认证",
  "G-Search": "搜索",
  "G-TopicArchive": "往期专题",
  "G-Topic": "本期专题",
  "G-Comments": "菜品评论",
  "G-WriteComment": "发表评论",
  "G-WrongInfo": "店铺纠错",
  "G-UserProfile": "食友主页",
  "G-Follows": "关注与粉丝",
  "G-EditProfile": "编辑个人资料",
  "G-MyTags": "我的标签",
  "G-TagDishes": "我的收藏",
  "G-History": "浏览足迹",
  "G-Settings": "账号设置",
  "G-SettingsAccount": "账号与安全",
  "G-ChangePhone": "更换手机号",
  "G-ChangePassword": "修改密码",
  "G-Devices": "登录设备",
  "G-DeleteAccount": "注销账号",
  "G-SettingsPrivacy": "隐私设置",
  "G-Blocked": "屏蔽名单",
  "G-SettingsNotify": "通知偏好",
  "G-SettingsAbout": "关于与反馈",
  "G-Feedback": "意见反馈",
  "G-Crop": "调整照片",
  "G-PanelPlace": "地点和饭点",
  "G-PanelFilter": "筛选店铺",
  "G-PanelTag": "口味标签",
  "G-PanelReport": "举报内容",
  "G-Kit": "组件预览",
  "G-Icons": "图标预览",
  "G-Icon": "图标预览",
  "G-Nav": "导航预览",
  "G-PhotoPipeline": "照片处理预览",
};

const nativeTitles: Record<string, string> = {
  "/design": "设计预览",
  "/me/shares": "我的分享",
  "/me/details": "更多资料",
  "/me/growth": "我的成长",
  "/help": "帮助与反馈",
  "/restaurants/new/details": "填写店铺信息",
  "/restaurants/favorites": "收藏的店铺",
  "/restaurants/directory": "店铺目录",
  "/auth/username-register": "手机登录 / 注册",
  "/auth/password-conflict/reset": "恢复登录密码",
  "/auth/account-recovery": "找回账号",
  "/auth/device-recovery": "设备恢复",
  "/auth/mobile-recovery": "手机号恢复",
  "/feedback/mine": "我的反馈",
  "/reports/new": "举报内容",
  "/announcements": "公告",
  "/submissions": "我的贡献",
  "/features": "功能搜索",
  "/admin": "管理后台",
  "/admin/v4": "管理后台",
};

export function browserTitle(path: string) {
  const brand = "山软今天吃什么";
  if (path.startsWith("/reference/")) {
    let key: string;
    try {
      key = decodeURIComponent(path.slice("/reference/".length));
    } catch {
      return `页面不存在 · ${brand}`;
    }
    return screenTitles[key]
      ? `${screenTitles[key]} · 原型预览 · ${brand}`
      : `页面不存在 · ${brand}`;
  }
  if (restaurantHistoryId(path) !== undefined) return `修改记录 · ${brand}`;
  const dynamic = /^\/foods\/\d+\/edit$/.test(path)
    ? "编辑菜品"
    : /^\/restaurants\/\d+\/edit$/.test(path)
      ? "修改店铺"
      : /^\/me\/tags\/\d+\/foods$/.test(path)
        ? "标签下的菜品"
        : /^\/feedback\/mine\/[^/]+$/.test(path)
          ? "反馈详情"
          : /^\/submissions\/[^/]+$/.test(path)
            ? "贡献详情"
            : /^\/topics\/[^/]+$/.test(path)
              ? "专题详情"
              : undefined;
  const title =
    nativeTitles[path] ??
    mobileSettingsPages[path]?.title ??
    screenTitles[screenForPath(path)] ??
    dynamic;
  return `${title ?? "页面不存在"} · ${brand}`;
}
