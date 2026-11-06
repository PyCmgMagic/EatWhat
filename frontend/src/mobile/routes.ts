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
  "G-Reconsent": "/auth/consent",
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
