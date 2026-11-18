import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { mediaUrl, money, type Food } from "../api/models";
import { DesignIcon as Icon } from "../mobile/ui";
import { visualFor } from "../mobile/catalog";
import { useFoodImageRefresh } from "./media";
import { AccessWelcome } from "../components/AccessWelcome";
import { growthPercent } from "../api/growth";
import {
  ProfileEmpty,
  ProfilePageHead,
  ProfileSectionHead,
} from "./ProfilePage";
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
        <span />
      </div>
    );
  if (error)
    return (
      <ProfileEmpty compact role="alert" icon="wifiOff" title="暂时没有加载成功">
        <button type="button" className="pp-button is-quiet" onClick={retry}>
          重新加载
        </button>
      </ProfileEmpty>
    );
  return children;
}

/** 按当前时段打招呼，顺便把“今天吃什么”这个问题抛出来。 */
function mealGreeting(hour: number) {
  if (hour >= 5 && hour < 9)
    return { hello: "早上好", ask: "早饭吃了吗？", meal: "早饭" };
  if (hour >= 9 && hour < 11)
    return { hello: "上午好", ask: "先想想中午吃什么？", meal: "午饭" };
  if (hour >= 11 && hour < 14)
    return { hello: "中午好", ask: "午饭想好吃什么了吗？", meal: "午饭" };
  if (hour >= 14 && hour < 17)
    return { hello: "下午好", ask: "要不要来点小食垫一垫？", meal: "下午茶" };
  if (hour >= 17 && hour < 21)
    return { hello: "晚上好", ask: "晚饭想好吃什么了吗？", meal: "晚饭" };
  return { hello: "夜深了", ask: "来点夜宵，还是早点休息？", meal: "夜宵" };
}

/** 今日食签：每天从收藏里固定挑出一道，不满意可以换。 */
function TodayPick({
  foods,
  meal,
  loading,
  error,
  retry,
}: {
  foods: Food[];
  meal: string;
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  const now = new Date();
  const day = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(now.getFullYear(), 0, 0)) /
      86400000,
  );
  const [turn, setTurn] = useState(0);
  const food = foods.length ? foods[(day + turn) % foods.length] : undefined;
  const visual = food ? visualFor(food, isDemo) : undefined;
  return (
    <section
      className="pp-pick"
      aria-labelledby="profile-today-pick"
      aria-busy={loading}
      style={
        visual ? ({ "--pp-pick-tile": visual.tile } as CSSProperties) : undefined
      }
    >
      <div className="pp-pick-copy">
        <span className="pp-eyebrow" id="profile-today-pick">
          今日食签
        </span>
        {loading ? (
          <div className="pp-pick-loading" role="status" aria-label="正在抽签">
            <span />
            <span />
          </div>
        ) : error ? (
          <>
            <h2>食签没抽出来</h2>
            <p>收藏暂时没有加载成功。</p>
            <div className="pp-pick-actions">
              <button type="button" className="pp-button is-quiet" onClick={retry}>
                重新加载
              </button>
            </div>
          </>
        ) : food ? (
          <>
            <h2 key={food.id} className="pp-pick-name">
              {meal}就吃「{food.name || "这道菜"}」？
            </h2>
            <p key={`meta-${food.id}`} className="pp-pick-name">
              {food.restaurantName || "餐厅信息待补充"}
              {food.price != null && <b>{money(food.price)}</b>}
              <small>从你的 {foods.length} 道收藏里抽的</small>
            </p>
            <div className="pp-pick-actions">
              <Link className="pp-button is-ink" to={`/foods/${food.id}`}>
                就吃这个
                <Icon name="chevronRight" size={15} />
              </Link>
              {foods.length > 1 && (
                <button
                  type="button"
                  className="pp-button is-quiet"
                  onClick={() => setTurn((value) => value + 1)}
                >
                  <Icon name="shuffle" size={15} />
                  换一道
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h2>还没有可以抽的菜</h2>
            <p>收藏几道想吃的，这里每天帮你挑一道。</p>
            <div className="pp-pick-actions">
              <Link className="pp-button is-ink" to="/search">
                去发现好味道
                <Icon name="chevronRight" size={15} />
              </Link>
            </div>
          </>
        )}
      </div>
      {food && (
        <Link
          key={food.id}
          className="pp-pick-photo"
          to={`/foods/${food.id}`}
          aria-label={`查看${food.name || "这道菜"}`}
        >
          <FoodPhoto food={food} />
        </Link>
      )}
    </section>
  );
}

/** 成长速览：等级、本级进度、离下一级还差多少。 */
function GrowthGlance() {
  const { api, user, session } = useApp();
  const progress = useQuery({
    queryKey: ["growth", user?.id, "progress"],
    queryFn: () => api.growth(),
    enabled: !!session && !!user?.id,
  });
  const growth = progress.data;
  const percent = growthPercent(growth);
  const level = growth?.level ?? user?.level;
  const total = growth?.totalExperience ?? user?.totalExperience;
  const next = growth?.maxLevel
    ? "已经是当前最高等级"
    : growth?.experienceToNextLevel != null
      ? `再攒 ${growth.experienceToNextLevel} 经验升到 Lv.${(growth.level ?? 0) + 1}`
      : progress.isPending
        ? "正在加载等级进度"
        : "查看等级与经验";
  return (
    <Link className="pp-growth" to="/me/growth" state={{ alignTabs: true }}>
      <span className="pp-eyebrow">我的成长</span>
      <strong>{level != null ? `Lv.${level}` : "—"}</strong>
      <span
        className="pp-growth-track"
        role="progressbar"
        aria-label="当前等级进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent == null ? undefined : Math.round(percent)}
      >
        <span style={{ width: `${percent ?? 0}%` }} />
      </span>
      <span className="pp-growth-next">{next}</span>
      <span className="pp-growth-foot">
        {total != null ? `累计 ${total} 经验` : "经验明细"}
        <Icon name="chevronRight" size={15} />
      </span>
    </Link>
  );
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
  const favoriteAll = (favorites.data?.items ?? []).filter((food) => food.id);
  const favoriteItems = favoriteAll.slice(0, 4);
  const shareItems = (shares.data?.items ?? [])
    .filter((food) => food.id)
    .slice(0, 4);
  const greeting = mealGreeting(new Date().getHours());
  return (
    <div className="profile-overview pp-page pp-overview">
      <ProfilePageHead
        title={`${greeting.hello}，${greeting.ask}`}
        detail="抽一张今日食签，或者接着看看最近的上传和收藏。"
      />
      <div className="pp-glance">
        <TodayPick
          foods={favoriteAll}
          meal={greeting.meal}
          loading={favorites.isPending}
          error={favorites.isError}
          retry={() => void favorites.refetch()}
        />
        <GrowthGlance />
      </div>

      <section className="pp-section" aria-labelledby="profile-recent-shares">
        <ProfileSectionHead
          title="最近上传"
          headingId="profile-recent-shares"
          count={
            shares.data?.totalItems != null
              ? `${shares.data.totalItems} 道`
              : undefined
          }
        >
          <Link to="/me/shares" state={{ alignTabs: true }}>
            全部上传
            <Icon name="chevronRight" size={15} />
          </Link>
        </ProfileSectionHead>
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
            <ProfileEmpty
              compact
              illustration="yuntun"
              title="分享你的第一道好菜"
              detail="记下喜欢的味道，也给其他食友一份参考。"
            >
              <Link className="pp-button" to="/publish">
                <Icon name="add" size={16} />
                分享一道菜
              </Link>
            </ProfileEmpty>
          )}
        </CollectionState>
      </section>

      <section
        className="pp-section"
        aria-labelledby="profile-recent-favorites"
      >
        <ProfileSectionHead
          title="最近收藏"
          headingId="profile-recent-favorites"
          count={
            favorites.data?.totalItems != null
              ? `${favorites.data.totalItems} 道`
              : undefined
          }
        >
          <Link to="/likes" state={{ alignTabs: true }}>
            <Icon name="heart" size={15} />
            赞过的菜
          </Link>
          <Link to="/restaurants/favorites" state={{ alignTabs: true }}>
            <Icon name="store" size={15} />
            收藏的店
          </Link>
          <Link to="/favorites" state={{ alignTabs: true }}>
            全部收藏
            <Icon name="chevronRight" size={15} />
          </Link>
        </ProfileSectionHead>
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
            <ProfileEmpty
              compact
              illustration="jiaozi"
              title="把想吃的，先收藏起来"
              detail="喜欢的菜品会出现在这里，下次不用重新找。"
            >
              <Link className="pp-button" to="/search">
                去发现好味道
                <Icon name="chevronRight" size={15} />
              </Link>
            </ProfileEmpty>
          )}
        </CollectionState>
      </section>
    </div>
  );
}
