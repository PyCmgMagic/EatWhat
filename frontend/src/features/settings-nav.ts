export type SettingsNavItem = {
  to: string;
  name: string;
  icon: string;
};

export type SettingsNavGroup = {
  title: string;
  items: SettingsNavItem[];
};

/**
 * Single source of truth for the settings menu. Both the settings home
 * (/settings) and the standalone settings sidebar render these groups, so
 * the two surfaces never drift apart.
 */
export const settingsNavGroups: SettingsNavGroup[] = [
  {
    title: "账号",
    items: [
      { to: "/settings/account", name: "账号与安全", icon: "idcard" },
      { to: "/verify", name: "学生认证", icon: "verify" },
      { to: "/settings/password", name: "修改密码", icon: "lock" },
      { to: "/settings/bind-phone", name: "绑定手机号", icon: "phone" },
    ],
  },
  {
    title: "偏好",
    items: [
      { to: "/settings/privacy", name: "隐私设置", icon: "eye" },
      { to: "/settings/preferences", name: "口味偏好", icon: "utensils" },
      { to: "/settings/notifications", name: "通知偏好", icon: "bell" },
      { to: "/settings/blocked", name: "屏蔽名单", icon: "block" },
    ],
  },
  {
    title: "更多",
    items: [
      { to: "/help", name: "帮助与反馈", icon: "feedback" },
      { to: "/settings/about", name: "关于我们", icon: "bowl" },
      { to: "/data-notice", name: "数据存放说明", icon: "document" },
    ],
  },
];
