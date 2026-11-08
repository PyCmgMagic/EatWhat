import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { ProfileEditLink } from "../app/profile-navigation";
import { isDemo } from "../app/runtime";
import { mediaUrl, money, type Food } from "../api/models";
import { DesignIcon as Icon } from "../mobile/ui";
import { visualFor } from "../mobile/catalog";
import { peopleHref } from "./profile-people";
import { useFoodImageRefresh } from "./media";
import { AccessWelcome } from "../components/AccessWelcome";
import { DishIllustration } from "../components/DishIllustration";
import ProfileGrowth from "./ProfileGrowth";
import "./profile-overview.css";

const mobileLinks = [
  { to: "/me/shares", name: "我的分享", icon: "bowl" },
  { to: "/favorites", name: "我的收藏", icon: "bookmark" },
  { to: "/history", name: "浏览足迹", icon: "history" },
  { to: "/notifications", name: "消息", icon: "bell" },
  { to: "/settings", name: "设置", icon: "settings" },
  { to: "/help", name: "帮助与反馈", icon: "feedback" },
];

function FoodPhoto({ food }: { food: Food }) {
  const visual = visualFor(food, isDemo);
  const src = mediaUrl(food.pictureUrl?.[0]);
  const renew = useFoodImageRefresh();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span
      className="profile-overview-food-photo"
      style={{ backgroundColor: visual.tile }}
      data-illustration={!!visual.asset || undefined}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => {
            setFailed(true);
            renew(src);
          }}
        />
      ) : (
        <Icon name="bowl" size={32} />
      )}
    </span>
  );
}

function CollectionState({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: boolean;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading)
    return (
      <div
        className="profile-overview-loading"
        role="status"
        aria-label="正在加载内容"
      >
        <span />
        <span />
        <span />
      </div>
    );
  if (error)
    return (
      <div className="profile-overview-empty" role="alert">
        <p>暂时没有加载成功</p>
        <button onClick={retry}>
          重新加载 <Icon name="refresh" size={15} />
        </button>
      </div>
    );
  return children;
}

export default function ProfileOverview() {
  const { api, user, session } = useApp();
  const location = useLocation();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatar = mediaUrl(user?.avatar);
  useEffect(() => setAvatarFailed(false), [avatar]);
  useEffect(() => {
    document.title = "我的 · 山软今天吃什么";
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
  const shares = useQuery({
    queryKey: ["foods", "profile-overview-shares", user?.id],
    queryFn: () => api.myFoods(1),
    enabled: !!session && !!user?.id,
  });
  if (!session) return <AccessWelcome />;
  const favoriteItems = (favorites.data?.items ?? [])
    .filter((food) => food.id)
    .slice(0, 3);
  const shareItems = (shares.data?.items ?? [])
    .filter((food) => food.id)
    .slice(0, 3);
  const statValue = (value: number | null | undefined) =>
    stats.isPending ? (
      <span className="profile-overview-stat-loading" aria-label="正在加载" />
    ) : (
      (value ?? "—")
    );
  return (
    <div className="profile-overview">
      <header className="profile-overview-identity">
        <span className="profile-overview-avatar" aria-hidden="true">
          {avatar && !avatarFailed ? (
            <img src={avatar} alt="" onError={() => setAvatarFailed(true)} />
          ) : (
            user?.displayName?.slice(0, 1) || "食"
          )}
        </span>
        <div className="profile-overview-intro">
          <span className="profile-overview-eyebrow">个人总览</span>
          <h1>{user?.displayName || "我的"}</h1>
          <p>{user?.signature || "认真吃饭，认真生活。"}</p>
          <ProfileGrowth />
        </div>
        <ProfileEditLink className="profile-overview-edit">
          <Icon name="edit" size={17} />
          编辑资料
        </ProfileEditLink>
      </header>
      <div className="profile-overview-social" aria-label="个人统计">
        <div>
          <strong>{statValue(stats.data?.earnedLikes)}</strong>
          <span>获赞</span>
        </div>
        <Link to="/me/shares">
          <strong>{statValue(stats.data?.uploadedFoodsCount)}</strong>
          <span>分享的菜</span>
        </Link>
        <Link
          to={peopleHref("/me", location.search, "fans")}
          state={{ profilePeopleFrom: location.key }}
          preventScrollReset
          aria-label="查看我的粉丝"
        >
          <strong>{statValue(stats.data?.fansCount)}</strong>
          <span>粉丝</span>
        </Link>
        <Link
          to={peopleHref("/me", location.search, "follow")}
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

      <nav className="profile-overview-mobile-nav" aria-label="我的常用功能">
        {mobileLinks.map((item) => (
          <Link key={item.to} to={item.to}>
            <Icon name={item.icon} size={20} />
            <span>{item.name}</span>
            <Icon name="chevronRight" size={15} />
          </Link>
        ))}
      </nav>

      <div className="profile-overview-columns">
        <section
          className="profile-overview-collection"
          aria-labelledby="profile-recent-favorites"
        >
          <div className="profile-overview-section-heading">
            <div>
              <h2 id="profile-recent-favorites">最近收藏</h2>
            </div>
            <Link to="/favorites">
              查看全部
              <Icon name="chevronRight" size={15} />
            </Link>
          </div>
          <CollectionState
            loading={favorites.isPending}
            error={favorites.isError}
            retry={() => void favorites.refetch()}
          >
            {favoriteItems.length ? (
              <div className="profile-overview-favorites">
                {favoriteItems.map((food) => (
                  <Link
                    to={`/foods/${food.id}`}
                    key={food.id}
                    className="profile-overview-favorite"
                  >
                    <FoodPhoto food={food} />
                    <div className="profile-overview-food-heading">
                      <h3>{food.name || "未命名菜品"}</h3>
                      <strong>{money(food.price)}</strong>
                    </div>
                    <p>{food.restaurantName || "餐厅信息待补充"}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="profile-overview-empty">
                <DishIllustration name="jiaozi" />
                <h3>把想吃的，先收藏起来</h3>
                <p>喜欢的菜品会出现在这里，下次不用重新找。</p>
                <Link to="/search">
                  去发现好味道
                  <Icon name="chevronRight" size={15} />
                </Link>
              </div>
            )}
          </CollectionState>
          <Link
            className="profile-overview-secondary-link"
            to="/restaurants/favorites"
          >
            <Icon name="store" size={18} />
            也看看收藏的店
            <Icon name="chevronRight" size={15} />
          </Link>
        </section>

        <section
          className="profile-overview-sharing"
          aria-labelledby="profile-recent-shares"
        >
          <div className="profile-overview-section-heading">
            <div>
              <h2 id="profile-recent-shares">我的分享</h2>
            </div>
            <Link to="/me/shares">
              查看全部
              <Icon name="chevronRight" size={15} />
            </Link>
          </div>
          <CollectionState
            loading={shares.isPending}
            error={shares.isError}
            retry={() => void shares.refetch()}
          >
            {shareItems.length ? (
              <div className="profile-overview-shares">
                {shareItems.map((food) => (
                  <Link
                    key={food.id}
                    to={`/foods/${food.id}`}
                    className="profile-overview-share"
                  >
                    <FoodPhoto food={food} />
                    <div className="profile-overview-share-copy">
                      <h3>{food.name || "未命名菜品"}</h3>
                      <span>{food.restaurantName || "餐厅信息待补充"}</span>
                      <small>
                        {money(food.price)}
                        {food.likesCount != null && (
                          <>
                            <i />
                            {food.likesCount} 人喜欢
                          </>
                        )}
                      </small>
                    </div>
                    <Icon name="chevronRight" size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="profile-overview-empty">
                <DishIllustration name="yuntun" />
                <h3>还没有分享过菜品</h3>
                <p>从最近吃到的一道好菜开始。</p>
              </div>
            )}
          </CollectionState>
          <div className="profile-overview-share-actions">
            <Link className="profile-overview-publish" to="/publish">
              <Icon name="add" size={17} />
              分享一道菜
            </Link>
            <Link to="/submissions">
              查看审核进度
              <Icon name="chevronRight" size={14} />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
