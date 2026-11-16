import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { mediaUrl, money, type Food } from "../api/models";
import { DesignIcon as Icon } from "../mobile/ui";
import { visualFor } from "../mobile/catalog";
import { useFoodImageRefresh } from "./media";
import { AccessWelcome } from "../components/AccessWelcome";
import { DishIllustration } from "../components/DishIllustration";
import "./profile-overview.css";

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

function DishCard({
  food,
  showLikes = false,
}: {
  food: Food;
  showLikes?: boolean;
}) {
  return (
    <Link to={`/foods/${food.id}`} className="profile-overview-dish-card">
      <FoodPhoto food={food} />
      <div className="profile-overview-food-heading">
        <h3>{food.name || "未命名菜品"}</h3>
        <strong>{money(food.price)}</strong>
      </div>
      <div className="profile-overview-dish-meta">
        <span>{food.restaurantName || "餐厅信息待补充"}</span>
        {showLikes && food.likesCount != null && (
          <span className="profile-overview-dish-likes">
            <Icon name="heart" size={13} />
            {food.likesCount}
          </span>
        )}
      </div>
    </Link>
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
  useEffect(() => {
    document.title = "我的 · 山软今天吃什么";
  }, []);
  const favorites = useQuery({
    queryKey: ["foods", "profile-overview-favorites", user?.id],
    queryFn: () => api.favorites(1),
    enabled: !!session && !!user?.id,
  });
  const shares = useQuery({
    queryKey: ["foods", "mine", 1],
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
  return (
    <div className="profile-overview">
      <div className="profile-overview-columns">
        <section
          className="profile-overview-uploads"
          aria-labelledby="profile-recent-shares"
        >
          <div className="profile-overview-section-heading">
            <div className="profile-overview-section-title">
              <h2 id="profile-recent-shares">最近上传</h2>
              {shares.data?.totalItems != null && (
                <span>{shares.data.totalItems} 道</span>
              )}
            </div>
            <Link to="/me/shares">
              全部上传
              <Icon name="chevronRight" size={15} />
            </Link>
          </div>
          <CollectionState
            loading={shares.isPending}
            error={shares.isError}
            retry={() => void shares.refetch()}
          >
            {shareItems.length ? (
              <div className="profile-overview-dish-grid">
                {shareItems.map((food) => (
                  <DishCard key={food.id} food={food} showLikes />
                ))}
              </div>
            ) : (
              <div className="profile-overview-empty">
                <DishIllustration name="yuntun" />
                <h3>分享你的第一道好菜</h3>
                <p>记下喜欢的味道，也给其他食友一份参考。</p>
                <Link to="/publish">
                  <Icon name="add" size={15} />
                  分享一道菜
                </Link>
              </div>
            )}
          </CollectionState>
        </section>

        <section
          className="profile-overview-collection"
          aria-labelledby="profile-recent-favorites"
        >
          <div className="profile-overview-section-heading">
            <div className="profile-overview-section-title">
              <h2 id="profile-recent-favorites">最近收藏</h2>
              {favorites.data?.totalItems != null && (
                <span>{favorites.data.totalItems} 道</span>
              )}
            </div>
            <Link to="/favorites">
              全部收藏
              <Icon name="chevronRight" size={15} />
            </Link>
          </div>
          <CollectionState
            loading={favorites.isPending}
            error={favorites.isError}
            retry={() => void favorites.refetch()}
          >
            {favoriteItems.length ? (
              <div className="profile-overview-dish-grid">
                {favoriteItems.map((food) => (
                  <DishCard key={food.id} food={food} />
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
            <Icon name="store" size={17} />
            也看看收藏的店
            <Icon name="chevronRight" size={15} />
          </Link>
        </section>
      </div>
    </div>
  );
}
