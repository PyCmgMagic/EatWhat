import { useContext, type ReactNode } from "react";
import { BRAND_SLOGAN } from "../app/brand";
import { ProfileWorkspaceContext } from "../app/profile-workspace";
import { ContentSkeleton } from "../components/LoadingSkeleton";
import { Link, useLocation } from "react-router-dom";
import { DesignIcon as Icon } from "../mobile/ui";
import { errorMessage } from "../api/client";
import { mediaUrl } from "../api/models";
import "./secondary.css";
import { ToastError } from "../components/feedback";
import { isRetiredV2 } from "../app/retired-routes";
import { settingsNavGroups } from "../features/settings-nav";
import SettingsPageHeader from "../features/SettingsPageHeader";

export const secondaryTitles: Record<string, string> = {
  "/me": "个人总览",
  "/me/shares": "我的分享",
  "/help": "帮助与反馈",
  "/notifications": "通知中心",
  "/verify": "学生认证",
  "/settings/account": "账号与安全",
  "/settings/password": "修改密码",
  "/settings/privacy": "隐私设置",
  "/settings/preferences": "口味偏好",
  "/settings/bind-phone": "绑定手机号",
  "/settings/about": "关于我们",
  "/data-notice": "数据存放说明",
  "/follows": "关注与粉丝",
  "/restaurants/new": "添加一家店",
  "/restaurants/new/details": "填写店铺信息",
  "/auth": "欢迎回来",
  "/auth/password": "密码登录",
  "/auth/username-register": "手机登录 / 注册",
  "/auth/register": "手机登录 / 注册",
  "/auth/register/confirm": "注册确认",
  "/auth/forgot": "找回密码",
  "/settings/phone": "更换手机号",
  "/settings/devices": "登录设备",
  "/settings/delete": "注销账号",
  "/settings/blocked": "屏蔽名单",
  "/settings/username": "设置登录名",
  "/auth/password-conflict/reset": "恢复登录密码",
  "/settings/notifications": "通知偏好",
  "/feedback": "意见反馈",
  "/restaurants/correction": "店铺纠错",
  "/topics": "往期专题",
  "/topics/current": "本期专题",
};
export function secondaryTitle(path: string) {
  return /^\/users\/\d+$/.test(path) ? "食友主页" : secondaryTitles[path];
}
export function PageHead({
  title,
  detail,
  action,
  back = "/me",
  crumb = "我的",
  onBack,
  backDisabled = false,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  back?: string;
  crumb?: string;
  onBack?: () => void;
  backDisabled?: boolean;
}) {
  const location = useLocation();
  if (
    location.pathname.startsWith("/settings/") ||
    ["/verify", "/data-notice"].includes(location.pathname)
  )
    return (
      <SettingsPageHeader
        title={title}
        detail={detail}
        action={action}
        back={back}
        backLabel={crumb.startsWith("返回") ? crumb : `返回${crumb}`}
        onBack={onBack}
        backDisabled={backDisabled}
      />
    );
  return (
    <header className="pc-secondary-head">
      <div>
        {onBack ? (
          <button
            type="button"
            className="pc-secondary-back"
            onClick={onBack}
            disabled={backDisabled}
          >
            <Icon name="back" size={17} />
            {crumb}
          </button>
        ) : (
          <Link className="pc-secondary-back" to={back}>
            <Icon name="back" size={17} />
            {crumb}
          </Link>
        )}
        <h1>{title}</h1>
        {detail && <p>{detail}</p>}
      </div>
      {action && <div className="pc-secondary-head-action">{action}</div>}
    </header>
  );
}
export function SettingsShell({ children }: { children: ReactNode }) {
  const path = useLocation().pathname;
  const embedded = useContext(ProfileWorkspaceContext);
  if (embedded)
    return <section className="pc-secondary-body">{children}</section>;
  const groups = settingsNavGroups.map((group) => ({
    title: group.title,
    items: group.items.filter((item) => !isRetiredV2(item.to)),
  }));
  return (
    <div className="pc-secondary-layout">
      <aside className="pc-secondary-rail">
        <Link className="pc-secondary-rail-back" to="/settings">
          <Icon name="back" size={18} />
          全部设置
        </Link>
        {groups.map((g) => (
          <nav key={g.title} aria-label={g.title + "设置"}>
            <p>{g.title}</p>
            {g.items.map(({ to, name, icon }) => (
              <Link
                key={to}
                to={to}
                aria-current={
                  path === to ||
                  (to === "/settings/account" &&
                    [
                      "/settings/phone",
                      "/settings/devices",
                      "/settings/delete",
                      "/settings/password",
                      "/settings/bind-phone",
                      "/settings/username",
                      "/verify",
                    ].includes(path))
                    ? "page"
                    : undefined
                }
              >
                <Icon name={icon} size={19} />
                {name}
                <Icon name="chevronRight" size={15} />
              </Link>
            ))}
          </nav>
        ))}
        <div className="pc-secondary-rail-note">
          <Icon name="bowl" size={26} />
          <b>{BRAND_SLOGAN}</b>
        </div>
      </aside>
      <section className="pc-secondary-body">{children}</section>
    </div>
  );
}
export function Section({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="pc-secondary-section">
      <div className="pc-secondary-section-title">
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {children}
    </section>
  );
}
export function Note({
  title,
  children,
  icon = "bowl",
}: {
  title: string;
  children: ReactNode;
  icon?: string;
}) {
  return (
    <aside className="pc-secondary-note">
      <Icon name={icon} size={26} />
      <h3>{title}</h3>
      <div>{children}</div>
    </aside>
  );
}
export function State({
  loading,
  error,
  retry,
  title = "这里还没有内容",
  detail,
  children,
}: {
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
  title?: string;
  detail?: string;
  children?: ReactNode;
}) {
  if (loading) return <ContentSkeleton kind="rows" count={3} />;
  return (
    <div className="pc-secondary-state" role={error ? "alert" : "status"}>
      <Icon name={error ? "warning" : "bowl"} size={34} />
      <h2>
        {loading ? "正在准备内容…" : error ? "内容暂时没有加载成功" : title}
      </h2>
      <p>{error ? errorMessage(error) : detail}</p>
      {!!error && retry && (
        <button className="pc-button light" onClick={retry}>
          重新加载
        </button>
      )}
      {children}
    </div>
  );
}
export function TaskError({ error }: { error: unknown }) {
  return <ToastError error={error} />;
}
export function Avatar({
  name,
  src,
  large = false,
}: {
  name?: string | null;
  src?: string | null;
  large?: boolean;
}) {
  const url = mediaUrl(src);
  return (
    <span className={`pc-secondary-avatar ${large ? "large" : ""}`}>
      {url ? <img src={url} alt="" /> : name?.slice(0, 1) || "食"}
    </span>
  );
}
export function Pager({
  page,
  hasNext,
  disabled,
  onPage,
}: {
  page: number;
  hasNext?: boolean | null;
  disabled?: boolean;
  onPage: (page: number) => void;
}) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav className="pc-secondary-pager" aria-label="分页">
      <button
        className="pc-button light"
        disabled={page === 1 || disabled}
        onClick={() => onPage(page - 1)}
      >
        上一页
      </button>
      <span>第 {page} 页</span>
      <button
        className="pc-button light"
        disabled={!hasNext || disabled}
        onClick={() => onPage(page + 1)}
      >
        下一页
      </button>
    </nav>
  );
}
export const pendingPages: Record<
  string,
  {
    title: string;
    detail: string;
    items: string[];
    link: string;
    label: string;
    icon: string;
  }
> = {
  "/settings/phone": {
    title: "换绑手机号",
    detail:
      "更换手机号功能正在准备中，敬请期待。需要帮助时，可以联系平台管理员。",
    items: ["未绑定手机号可使用绑定入口", "更换已绑定号码请联系平台管理员"],
    link: "/settings/account",
    label: "查看账号状态",
    icon: "phone",
  },
  "/settings/devices": {
    title: "登录设备",
    detail:
      "设备管理功能正在准备中，敬请期待。你可以先在账号与安全中管理登录密码。",
    items: ["离开公用电脑前，请主动退出登录", "如担心账号安全，可先修改密码"],
    link: "/settings/password",
    label: "修改登录密码",
    icon: "lock",
  },
  "/settings/delete": {
    title: "注销账号",
    detail:
      "自助注销功能正在准备中，敬请期待。如需处理账号或个人数据，请联系平台管理员。",
    items: [
      "此页面不会删除你的账号或内容",
      "可以先调整关注、粉丝列表的可见范围",
    ],
    link: "/settings/privacy",
    label: "管理隐私设置",
    icon: "me",
  },
  "/settings/blocked": {
    title: "屏蔽名单",
    detail: "屏蔽功能正在准备中，敬请期待。你可以先调整个人资料的公开范围。",
    items: ["可以在食友主页管理关注关系", "公开范围可在隐私设置中调整"],
    link: "/settings/privacy",
    label: "调整隐私设置",
    icon: "me",
  },
  "/settings/notifications": {
    title: "通知偏好",
    detail: "通知设置正在准备中，敬请期待。互动消息可以在通知中心查看。",
    items: ["互动消息会出现在通知中心", "可以逐条标为已读，也可以全部标为已读"],
    link: "/notifications",
    label: "前往通知中心",
    icon: "bell",
  },
  "/feedback": {
    title: "意见反馈",
    detail:
      "在线反馈功能正在准备中，敬请期待。遇到问题时，可以联系平台管理员并说明相关页面。",
    items: [
      "描述你当时进行的操作",
      "附上错误提示，便于定位问题",
      "请勿提供密码或验证码",
    ],
    link: "/settings/about",
    label: "了解平台",
    icon: "comment",
  },
  "/restaurants/correction": {
    title: "店铺纠错",
    detail:
      "店铺纠错功能正在准备中，敬请期待。发现店名或位置有误时，可以联系平台管理员。",
    items: ["记录店铺名称和当前地址", "说明正确的信息，便于核实"],
    link: "/nearby",
    label: "返回附近店铺",
    icon: "nearby",
  },
  "/topics": {
    title: "往期专题",
    detail:
      "往期专题正在准备中，敬请期待。先去发现页，看看同学们分享的好味道。",
    items: ["在发现页浏览推荐菜品", "将喜欢的菜品收藏并添加个人标签"],
    link: "/",
    label: "去发现好味道",
    icon: "bowl",
  },
  "/topics/current": {
    title: "本期专题",
    detail:
      "本期专题正在准备中，敬请期待。先看看今天的推荐，发现下一餐的好味道。",
    items: ["发现页持续展示推荐菜品", "附近页可以按区域查找店铺"],
    link: "/",
    label: "查看今日推荐",
    icon: "bowl",
  },
};
export function PendingPage({ path }: { path: string }) {
  const p = pendingPages[path];
  return (
    <>
      <PageHead
        title={p.title}
        detail="这项功能正在准备中，敬请期待。"
        back={path.startsWith("/settings") ? "/settings" : "/"}
        crumb={path.startsWith("/settings") ? "设置" : "发现"}
      />
      <div className="pc-secondary-columns">
        <Section title="开放状态">
          <div className="pc-secondary-availability">
            <Icon name={p.icon} size={36} />
            <span className="pc-secondary-badge">敬请期待</span>
          </div>
          <h3>{p.title}</h3>
          <p className="pc-secondary-copy">{p.detail}</p>
          <Link className="pc-button" to={p.link}>
            {p.label}
            <Icon name="chevronRight" size={17} />
          </Link>
        </Section>
        <Note title="现在可以做的事" icon={p.icon}>
          <ul>
            {p.items.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Note>
      </div>
    </>
  );
}
