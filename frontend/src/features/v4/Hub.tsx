import { useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { DesignIcon as Icon } from "../../mobile/ui";
import { Shell } from "./shared";
import "./hub.css";

type Feature = {
  to: string;
  title: string;
  detail: string;
  icon: string;
  keywords?: string;
};
const groups = [
  {
    id: "discover",
    title: "发现与收藏",
    icon: "bowl",
    tone: "green",
    items: [
      {
        to: "/restaurants/directory",
        title: "找一家店",
        detail: "按分类、预算筛选餐厅",
        icon: "store",
        keywords: "店铺 美食 搜索 吃什么",
      },
      {
        to: "/restaurants/favorites",
        title: "收藏的餐厅",
        detail: "收好想去和常去的店",
        icon: "bookmark",
        keywords: "店铺",
      },
      {
        to: "/favorites",
        title: "收藏的菜品",
        detail: "查看收藏与分类",
        icon: "heart",
        keywords: "我的收藏",
      },
      {
        to: "/me/tags",
        title: "收藏标签",
        detail: "按自己的习惯整理收藏",
        icon: "tag",
        keywords: "分类 我的标签",
      },
      {
        to: "/history",
        title: "浏览足迹",
        detail: "找回看过的菜品和店铺",
        icon: "history",
        keywords: "历史记录",
      },
      {
        to: "/topics/current",
        title: "本期专题",
        detail: "看看这期校园美食推荐",
        icon: "topic",
        keywords: "活动",
      },
      {
        to: "/topics",
        title: "往期专题",
        detail: "回顾之前的美食合集",
        icon: "document",
        keywords: "活动 历史",
      },
    ],
  },
  {
    id: "shares",
    title: "分享与审核",
    icon: "document",
    tone: "gold",
    items: [
      {
        to: "/me/shares",
        title: "我的分享",
        detail: "查看和管理已发布的菜品",
        icon: "bowl",
        keywords: "上传 编辑 删除",
      },
      {
        to: "/submissions",
        title: "审核进度",
        detail: "查看分享与修改的审核结果",
        icon: "document",
        keywords: "我的提交 发布 记录 状态",
      },
    ],
  },
  {
    id: "updates",
    title: "消息与帮助",
    icon: "bell",
    tone: "gold",
    items: [
      {
        to: "/notifications",
        title: "通知中心",
        detail: "查看互动消息与处理结果",
        icon: "bell",
        keywords: "点赞 提醒 未读",
      },
      {
        to: "/help",
        title: "帮助与反馈",
        detail: "查看常见问题和反馈入口",
        icon: "question",
        keywords: "客服 使用说明",
      },
      {
        to: "/feedback",
        title: "意见反馈",
        detail: "遇到问题或有建议，告诉我们",
        icon: "feedback",
        keywords: "帮助 客服 写反馈",
      },
      {
        to: "/feedback/mine",
        title: "反馈记录",
        detail: "查看反馈回复与处理进度",
        icon: "mail",
        keywords: "帮助 客服 我的反馈",
      },
      {
        to: "/announcements",
        title: "站点公告",
        detail: "了解最新通知与服务安排",
        icon: "announce",
        keywords: "消息",
      },
    ],
  },
  {
    id: "account",
    title: "账号与安全",
    icon: "shield",
    tone: "blue",
    items: [
      {
        to: "/settings/devices",
        title: "登录设备",
        detail: "管理已登录的设备",
        icon: "computer",
        keywords: "安全 下线",
      },
      {
        to: "/settings/phone",
        title: "更换手机号",
        detail: "更新绑定的手机号码",
        icon: "phone",
        keywords: "换绑 手机号",
      },
      {
        to: "/auth/consent-offer",
        title: "重新确认授权",
        detail: "查看并确认账号授权",
        icon: "verify",
        keywords: "同意 隐私 协议",
      },
      {
        to: "/auth/account-recovery",
        title: "恢复账号操作",
        detail: "继续未完成的账号操作",
        icon: "key",
        keywords: "找回 恢复文件",
      },
      {
        to: "/settings/delete",
        title: "注销账号",
        detail: "了解注销流程与影响",
        icon: "logout",
        keywords: "删除账号",
      },
    ],
  },
  {
    id: "preferences",
    title: "偏好与设置",
    icon: "settings",
    tone: "rose",
    items: [
      {
        to: "/settings/notifications",
        title: "通知偏好",
        detail: "功能准备中，敬请期待",
        icon: "bell",
        keywords: "消息 推送 关闭",
      },
      {
        to: "/settings/telemetry",
        title: "使用统计授权",
        detail: "管理使用统计与隐私授权",
        icon: "lock",
        keywords: "隐私 数据 收集",
      },
      {
        to: "/settings",
        title: "账号设置",
        detail: "资料、认证与其他设置",
        icon: "settings",
        keywords: "密码 头像 昵称 邮箱 学校 认证 隐私",
      },
    ],
  },
] satisfies {
  id: string;
  title: string;
  icon: string;
  tone: string;
  items: Feature[];
}[];
const allFeatures: Feature[] = groups.flatMap((group) => group.items);

export default function Features() {
  const { user, api, session } = useApp();
  const [params, setParams] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const search = params.get("q") ?? "";
  const featuresReturnTo =
    "/features" + (params.size ? "?" + params.toString() : "");
  const category = groups.some((group) => group.id === params.get("category"))
    ? params.get("category")!
    : "all";
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  const filteredGroups = groups
    .filter((group) => category === "all" || category === group.id)
    .map((group) => ({
      ...group,
      items: group.items.filter((item: Feature) => {
        const text = [item.title, item.detail, item.keywords ?? "", group.title]
          .join(" ")
          .toLocaleLowerCase();
        return terms.every((term) => text.includes(term));
      }),
    }))
    .filter((group) => group.items.length > 0);
  const resultCount = filteredGroups.reduce(
    (count, group) => count + group.items.length,
    0,
  );
  const unread = useQuery({
    queryKey: ["notification-cards", "unread"],
    queryFn: () => api.unreadCards(),
    enabled: !!session,
    retry: false,
  });
  const unreadCount =
    session && typeof unread.data?.members === "number"
      ? unread.data.members
      : 0;

  function updateSearch(value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set("q", value);
        else next.delete("q");
        // A new query searches all categories.
        next.delete("category");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }
  function selectCategory(value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === "all") next.delete("category");
        else next.set("category", value);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }
  function clearFilters() {
    setParams({}, { replace: true, preventScrollReset: true });
    searchRef.current?.focus();
  }
  function badge(item: Feature) {
    return item.to === "/notifications" && unreadCount > 0 ? (
      <span className="feature-unread" aria-label={unreadCount + " 条未读"}>
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>
    ) : null;
  }

  return (
    <Shell
      title="查找功能"
      detail="输入你想做的事，快速找到对应入口。"
      back="/me"
    >
      <div className="feature-center profile-function-search">
        <section
          className="feature-directory"
          aria-labelledby="feature-directory-title"
        >
          <div className="feature-directory-heading">
            <div>
              <h2 id="feature-directory-title">按用途查找</h2>
              <span>也可以从左侧分组直接进入</span>
            </div>
            <div className="feature-search" role="search" aria-label="查找功能">
              <Icon name="search" size={21} />
              <input
                ref={searchRef}
                type="search"
                aria-label="搜索功能"
                placeholder="搜索功能，如：收藏、手机号"
                value={search}
                onChange={(event) => updateSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") clearFilters();
                }}
              />
              {search && (
                <button
                  type="button"
                  aria-label="清空搜索"
                  onClick={() => {
                    updateSearch("");
                    searchRef.current?.focus();
                  }}
                >
                  <Icon name="close" size={18} />
                </button>
              )}
            </div>
          </div>
          <div className="feature-filters" role="group" aria-label="功能分类">
            {[{ id: "all", title: "全部", items: allFeatures }, ...groups].map(
              (group) => (
                <button
                  type="button"
                  key={group.id}
                  aria-pressed={category === group.id}
                  aria-controls="feature-results"
                  onClick={() => selectCategory(group.id)}
                >
                  {group.title}
                  <span>{group.items.length}</span>
                </button>
              ),
            )}
          </div>
          <p className="feature-result-status" role="status" aria-live="polite">
            {searching
              ? "找到 " + resultCount + " 项相关功能"
              : "共 " + resultCount + " 项功能"}
          </p>
          <div
            id="feature-results"
            className="feature-groups"
            data-single={filteredGroups.length === 1 || undefined}
          >
            {filteredGroups.map((group) => (
              <section
                key={group.id}
                className={"feature-group tone-" + group.tone}
                aria-labelledby={"feature-group-" + group.id}
              >
                <header>
                  <span className="feature-group-marker">
                    <Icon name={group.icon} size={18} />
                  </span>
                  <h3 id={"feature-group-" + group.id}>{group.title}</h3>
                  <span>{group.items.length} 项</span>
                </header>
                <div className="feature-list">
                  {group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      state={{ featuresReturnTo }}
                      className="feature-link"
                    >
                      <span className="feature-icon">
                        <Icon name={item.icon} size={20} />
                      </span>
                      <span className="feature-copy">
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                      {badge(item)}
                      <Icon name="chevronRight" size={15} />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
          {resultCount === 0 && (
            <div className="feature-empty">
              <Icon name="search" size={30} />
              <h3>没有找到相关功能</h3>
              <p>试试“通知”“收藏”或“账号”，也可以查看全部功能。</p>
              <button type="button" onClick={clearFilters}>
                查看全部功能
              </button>
            </div>
          )}
        </section>
        <div className="feature-help">
          <span>
            <Icon name="question" size={18} />
            没有找到需要的功能？
          </span>
          <Link to="/feedback" state={{ featuresReturnTo }}>
            告诉我们你的需求
            <Icon name="chevronRight" size={15} />
          </Link>
        </div>
        {user?.role === "admin" && (
          <Link
            className="feature-admin"
            to="/admin/v4"
            state={{ featuresReturnTo }}
          >
            <Icon name="tool" size={21} />
            <span>
              <strong>内容与运营管理</strong>
              <small>审核分享、处理反馈与维护专题</small>
            </span>
            <span>
              进入工作台
              <Icon name="chevronRight" size={17} />
            </span>
          </Link>
        )}
      </div>
    </Shell>
  );
}
