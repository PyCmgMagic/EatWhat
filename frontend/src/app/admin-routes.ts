export const adminModules = [
  {
    id: "summary",
    title: "数据概览",
    path: "/admin",
    icon: "tool",
    group: "工作台",
    source: "directory",
  },
  {
    id: "engagement",
    title: "活跃统计",
    path: "/admin/engagement",
    icon: "history",
    group: "工作台",
    source: "operations",
  },
  {
    id: "foods",
    title: "菜品管理",
    path: "/admin/foods",
    icon: "bowl",
    group: "内容管理",
    source: "directory",
  },
  {
    id: "restaurants",
    title: "餐厅管理",
    path: "/admin/restaurants",
    icon: "store",
    group: "内容管理",
    source: "directory",
  },
  {
    id: "tags",
    title: "公共标签",
    path: "/admin/tags",
    icon: "tag",
    group: "内容管理",
    source: "directory",
  },
  {
    id: "hubs",
    title: "区域管理",
    path: "/admin/hubs",
    icon: "nearby",
    group: "内容管理",
    source: "directory",
  },
  {
    id: "topics",
    title: "校园专题",
    path: "/admin/topics",
    icon: "topic",
    group: "内容管理",
    source: "operations",
  },
  {
    id: "moderation",
    title: "内容审核",
    path: "/admin/moderation",
    icon: "shield",
    group: "审核与反馈",
    source: "operations",
  },
  {
    id: "comments",
    title: "评论审核",
    path: "/admin/comments",
    icon: "comment",
    group: "审核与反馈",
    source: "operations",
  },
  {
    id: "feedback",
    title: "反馈举报",
    path: "/admin/feedback",
    icon: "feedback",
    group: "审核与反馈",
    source: "operations",
  },
  {
    id: "users",
    title: "用户管理",
    path: "/admin/users",
    icon: "me",
    group: "账号管理",
    source: "directory",
  },
  {
    id: "security",
    title: "账号安全复核",
    path: "/admin/security",
    icon: "lock",
    group: "账号管理",
    source: "directory",
  },
  {
    id: "announcements",
    title: "公告管理",
    path: "/admin/announcements",
    icon: "announce",
    group: "站点运营",
    source: "operations",
  },
  {
    id: "config",
    title: "远程配置",
    path: "/admin/config",
    icon: "settings",
    group: "站点运营",
    source: "operations",
  },
  {
    id: "versions",
    title: "版本管理",
    path: "/admin/versions",
    icon: "download",
    group: "站点运营",
    source: "operations",
  },
  {
    id: "audit",
    title: "配置审计",
    path: "/admin/audit",
    icon: "document",
    group: "站点运营",
    source: "operations",
  },
] as const;

export type AdminModule = (typeof adminModules)[number];
export type AdminModuleId = AdminModule["id"];
export const isAdminPath = (path: string) =>
  path === "/admin" || path.startsWith("/admin/");

/** Keep old bookmarks and links from feedback cases working in the new shell. */
export function resolveAdminRoute(path: string, search = "") {
  const params = new URLSearchParams(search);
  if (path === "/admin/v4" || (path === "/admin" && params.has("tab"))) {
    const requested =
      params.get("tab") ?? (path === "/admin/v4" ? "feedback" : "summary");
    const module =
      adminModules.find((item) => item.id === requested) ?? adminModules[0];
    params.delete("tab");
    return {
      module,
      redirect: module.path + (params.size ? `?${params}` : ""),
    };
  }
  return {
    module: adminModules.find((item) => item.path === path),
    redirect: undefined,
  };
}

function localPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\r\n#]/.test(value)
  );
}
export function safeFrontWorkspace(value: unknown) {
  if (!localPath(value)) return undefined;
  const path = value.split("?")[0];
  return !isAdminPath(path) &&
    !/^\/(auth|reference)(\/|$)/.test(path) &&
    path !== "/design"
    ? value
    : undefined;
}
export function safeAdminWorkspace(value: unknown) {
  if (!localPath(value)) return undefined;
  const [path, search = ""] = value.split("?");
  const resolved = resolveAdminRoute(path, search);
  return resolved.module ? (resolved.redirect ?? value) : undefined;
}
