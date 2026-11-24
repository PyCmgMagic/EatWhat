// Modules for features backend v2 has (no review queues, topics or tag editing).
export const adminModules = [
  {
    id: "summary",
    title: "数据概览",
    path: "/admin",
    icon: "tool",
    group: "工作台",
    detail: "全站数据、待办与系统状态",
  },
  {
    id: "engagement",
    title: "活跃统计",
    path: "/admin/engagement",
    icon: "history",
    group: "工作台",
    detail: "日活、月活、分端与分时走势",
  },
  {
    id: "telemetry",
    title: "使用统计",
    path: "/admin/telemetry",
    icon: "time",
    group: "工作台",
    detail: "近 7 天各端的使用事件",
  },
  {
    id: "foods",
    title: "菜品管理",
    path: "/admin/foods",
    icon: "bowl",
    group: "内容管理",
    detail: "检索、维护与下架菜品",
  },
  {
    id: "restaurants",
    title: "餐厅管理",
    path: "/admin/restaurants",
    icon: "store",
    group: "内容管理",
    detail: "维护餐厅资料与营业信息",
  },
  {
    id: "hubs",
    title: "区域管理",
    path: "/admin/hubs",
    icon: "district",
    group: "内容管理",
    detail: "区域中心、边界与餐厅归属",
  },
  {
    id: "feedback",
    title: "反馈举报",
    path: "/admin/feedback",
    icon: "feedback",
    group: "审核与反馈",
    detail: "处理意见反馈、纠错与举报",
  },
  {
    id: "users",
    title: "用户管理",
    path: "/admin/users",
    icon: "me",
    group: "账号管理",
    detail: "账号状态、封禁与临时密码",
  },
  {
    id: "announcements",
    title: "公告管理",
    path: "/admin/announcements",
    icon: "announce",
    group: "站点运营",
    detail: "发布范围、时间与级别",
  },
  {
    id: "config",
    title: "远程配置",
    path: "/admin/config",
    icon: "settings",
    group: "站点运营",
    detail: "功能开关与维护模式",
  },
  {
    id: "versions",
    title: "版本管理",
    path: "/admin/versions",
    icon: "download",
    group: "站点运营",
    detail: "各端最低与最新版本",
  },
  {
    id: "ai",
    title: "AI 设置",
    path: "/admin/ai",
    icon: "computer",
    group: "站点运营",
    detail: "模型提供商与图片检查",
  },
  {
    id: "audit",
    title: "配置审计",
    path: "/admin/audit",
    icon: "document",
    group: "站点运营",
    detail: "配置与公告的修改记录",
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
