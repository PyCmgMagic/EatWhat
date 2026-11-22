import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { BRAND_SLOGAN } from "../app/brand";
import { ProfileEditLink } from "../app/profile-navigation";
import { profileSection } from "../app/profile-workspace";
import { mediaUrl } from "../api/models";
import { DesignIcon as Icon } from "../mobile/ui";
import { useApp } from "../app/state";
import { FoodCover } from "../components/FoodCover";
import { peopleHref } from "./profile-people";
import ProfileGrowth from "./ProfileGrowth";
import { useMyProfileCover } from "./useMyProfileCover";
import { ProfileCoverPicker } from "./ProfileCoverPicker";
import "./profile-overview.css";

const tabs = [
  { key: "home", to: "/me", label: "主页", icon: "me" },
  { key: "uploads", to: "/me/shares", label: "上传", icon: "bowl" },
  { key: "favorites", to: "/favorites", label: "收藏", icon: "bookmark" },
  { key: "likes", to: "/likes", label: "赞过", icon: "heart" },
  {
    key: "comments",
    to: "/me/shares?tab=comments",
    label: "评论",
    icon: "comment",
  },
  { key: "history", to: "/history", label: "足迹", icon: "history" },
  { key: "growth", to: "/me/growth", label: "成长", icon: "hot" },
  { key: "settings", to: "/settings", label: "设置", icon: "settings" },
] as const;

export default function ProfileSpaceHeader() {
  const { api, user, session } = useApp();
  const location = useLocation();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatar = mediaUrl(user?.avatar);
  useEffect(() => setAvatarFailed(false), [avatar]);
  // The tab bar sticks under the page header while the content scrolls; drop its
  // rounded shoulders once it is pinned so no card corner peeks through.
  const tabbar = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    const bar = tabbar.current;
    if (!bar || typeof IntersectionObserver === "undefined") return;
    const top = Number.parseFloat(getComputedStyle(bar).top) || 0;
    const observer = new IntersectionObserver(
      ([record]) => setPinned(record.intersectionRatio < 1),
      { rootMargin: `-${Math.round(top) + 1}px 0px 0px 0px`, threshold: [0, 1] },
    );
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  const stats = useQuery({
    queryKey: ["user", user?.id],
    queryFn: () => api.otherUser(user!.id!),
    enabled: !!session && !!user?.id,
  });
  const favorites = useQuery({
    queryKey: ["foods", "profile-overview-favorites", user?.id],
    queryFn: () => api.favorites(1),
    enabled: !!session && !!user?.id,
  });
  const {
    cover: displayedProfileCover,
    src: profileCoverSrc,
    illustration,
    onImageError,
    visual: heroVisual,
    pending: profileCoverPending,
  } = useMyProfileCover(!!session && !!user?.id);
  const section = profileSection(location.pathname);
  const activeTab =
    location.pathname === "/me/shares" &&
    new URLSearchParams(location.search).get("tab") === "comments"
      ? "comments"
      : tabs.find((tab) => tab.to === section)?.key;
  const statValue = (value: number | null | undefined) =>
    stats.isPending ? (
      <span className="profile-overview-stat-loading" aria-label="正在加载" />
    ) : (
      (value ?? "—")
    );
  return (
    <>
      <section
        className="profile-overview-hero"
        aria-labelledby="profile-overview-name"
        aria-busy={profileCoverPending}
        style={
          {
            "--profile-stage": heroVisual.stage,
            "--profile-on": heroVisual.on,
            "--profile-ghost": heroVisual.ghost,
          } as CSSProperties
        }
      >
        <div
          className="profile-overview-cover"
          data-cover-kind={illustration ? "illustration" : "photo"}
          data-cover-loading={profileCoverPending || undefined}
          aria-hidden="true"
        >
          {profileCoverPending ? (
            <span className="profile-overview-cover-loading" />
          ) : illustration ? (
            <img
              src={profileCoverSrc}
              alt=""
              draggable={false}
            />
          ) : (
            <FoodCover
              src={profileCoverSrc}
              crop={displayedProfileCover.coverCrop}
              alt=""
              draggable={false}
              onError={onImageError}
            />
          )}
        </div>
        {session && !!user?.id && (
          <ProfileCoverPicker key={user.id} displayedId={displayedProfileCover.id} />
        )}
        <div className="profile-overview-hero-top">
          <span className="profile-overview-eyebrow">我的美食档案</span>
          <ProfileEditLink className="profile-overview-edit">
            <Icon name="edit" size={17} />
            编辑资料
          </ProfileEditLink>
        </div>
        <header className="profile-overview-identity">
          <span className="profile-overview-avatar" aria-hidden="true">
            {avatar && !avatarFailed ? (
              <img src={avatar} alt="" onError={() => setAvatarFailed(true)} />
            ) : (
              user?.displayName?.slice(0, 1) || "食"
            )}
          </span>
          <div className="profile-overview-intro">
            <h1 id="profile-overview-name">{user?.displayName || "我的"}</h1>
            <p>{user?.signature || BRAND_SLOGAN}</p>
            <ProfileGrowth compact />
          </div>
        </header>
        <div className="profile-overview-social" aria-label="个人统计">
          <div>
            <strong>{statValue(stats.data?.earnedLikes)}</strong>
            <span>获赞</span>
          </div>
          <Link to="/me/shares">
            <strong>{statValue(stats.data?.uploadedFoodsCount)}</strong>
            <span>上传的菜</span>
          </Link>
          <Link
            to={peopleHref(location.pathname, location.search, "fans")}
            state={{ profilePeopleFrom: location.key }}
            preventScrollReset
            aria-label="查看我的粉丝"
          >
            <strong>{statValue(stats.data?.fansCount)}</strong>
            <span>粉丝</span>
          </Link>
          <Link
            to={peopleHref(location.pathname, location.search, "follow")}
            state={{ profilePeopleFrom: location.key }}
            preventScrollReset
            aria-label="查看我的关注"
          >
            <strong>{statValue(stats.data?.followingsCount)}</strong>
            <span>关注</span>
          </Link>
          {stats.isError && (
            <button
              className="profile-overview-stat-retry"
              onClick={() => void stats.refetch()}
            >
              重新加载统计
            </button>
          )}
        </div>
      </section>
      <div
        className="profile-overview-tabbar"
        ref={tabbar}
        data-pinned={pinned || undefined}
      >
        <nav className="profile-overview-tabs" aria-label="个人中心功能">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              to={tab.to}
              aria-current={activeTab === tab.key ? "page" : undefined}
              aria-controls="profile-workspace-panel"
              state={{ alignTabs: true }}
              preventScrollReset
            >
              <Icon name={tab.icon} size={19} />
              {tab.label}
              {tab.key === "uploads" &&
                stats.data?.uploadedFoodsCount != null && (
                  <span>{stats.data.uploadedFoodsCount}</span>
                )}
              {tab.key === "favorites" &&
                favorites.data?.totalItems != null && (
                  <span>{favorites.data.totalItems}</span>
                )}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
