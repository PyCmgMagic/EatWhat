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
  "/settings/about": { title: "关于与反馈", back: "/settings", public: true },
  "/data-notice": {
    title: "数据存放说明",
    back: "/settings/account",
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
  "G-Comments": "评论列表",
  "G-WriteComment": "发表评论",
  "G-TopicArchive": "往期专题目录",
};
