export type SettingsNavItem = {
  to: string;
  name: string;
  icon: string;
  /** Optional one-line hint; the settings home shows it under the name. */
  hint?: string;
};

export type SettingsNavGroup = {
  /** Stable key so the home can feature one group without matching titles. */
  id: "account" | "preferences" | "more";
  title: string;
  detail: string;
  items: SettingsNavItem[];
};

/**
 * Single source of truth for the settings menu. Both the settings home
 * (/settings) and the standalone settings sidebar render these groups, so
 * the two surfaces never drift apart.
 *
 * The account group intentionally holds a single entry: login name, phone,
 * password, devices and student verification all live inside 账号与安全 now,
 * so repeating them as separate menu rows would offer two doors to one room.
 */
export const settingsNavGroups: SettingsNavGroup[] = [
  {
    id: "account",
    title: "账号",
    detail: "登录、绑定与身份认证",
    items: [{ to: "/settings/account", name: "账号与安全", icon: "idcard" }],
  },
  {
    id: "preferences",
    title: "偏好",
    detail: "隐私、口味与通知",
    items: [
      {
        to: "/settings/privacy",
        name: "隐私设置",
        icon: "eye",
        hint: "主页可见性、屏蔽与数据授权",
      },
      {
        to: "/settings/preferences",
        name: "口味偏好",
        icon: "utensils",
        hint: "辣度、忌口与推荐口味",
      },
      {
        to: "/settings/notifications",
        name: "通知偏好",
        icon: "bell",
        hint: "接收哪些提醒",
      },
    ],
  },
  {
    id: "more",
    title: "更多",
    detail: "帮助、关于与数据",
    items: [
      {
        to: "/help",
        name: "帮助与反馈",
        icon: "feedback",
        hint: "遇到问题或想提建议",
      },
      {
        to: "/settings/about",
        name: "关于我们",
        icon: "bowl",
        hint: "产品介绍与联系方式",
      },
      {
        to: "/data-notice",
        name: "数据存放说明",
        icon: "document",
        hint: "你的数据如何保存",
      },
    ],
  },
];
