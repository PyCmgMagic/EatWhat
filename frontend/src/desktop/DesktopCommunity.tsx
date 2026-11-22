import { BRAND_NAME } from "../app/brand";
import "../features/user-level.css";
import { UserTitle } from "../components/UserTitle";
import { userTitle } from "../api/growth";
import { FieldMark } from "../features/FieldMark";
import { codePoints } from "../api/content-rules";
import { BlockControl, UserFoods } from "../features/ApiV2";
import { ProfileFoodLike } from "../features/ProfileFoodLike";
import { useEffect, useState, type CSSProperties } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { ProfileEditLink } from "../app/profile-navigation";
import { isDemo } from "../app/runtime";
import { mediaUrl, money, parseId, type Food } from "../api/models";
import { useTask } from "../components/useTask";
import { DesignIcon as Icon, ReactionIcon } from "../mobile/ui";
import { SlidingTabs } from "./motion";
import { useContentMotion } from "../motion/hooks";
import { followLabel, peopleHref } from "../features/profile-people";
import { useFoodImageRefresh } from "../features/media";
import { demoDishes, visualFor } from "../mobile/catalog";
import { stageCode } from "../api/food-display";
import { DishIllustration } from "../components/DishIllustration";
import "./friend-profile.css";
import RestaurantLocationField from "../features/RestaurantLocationField";
import { NewShopSearch } from "../features/NewShopSearch";
import { useNewShop } from "../features/useNewShop";
import "./new-shop.css";
import { PageSkeleton } from "../components/LoadingSkeleton";
import "../features/profile-activity.css";
import { ShopTraitsFields } from "../features/ShopTraits";
import { PageHead, State, TaskError } from "./secondary";

function FriendFoodPhoto({ food }: { food: Food }) {
  const visual = visualFor(food, isDemo);
  const src = mediaUrl(food.pictureUrl?.[0]);
  const renew = useFoodImageRefresh();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span
      className="profile-overview-food-photo"
      style={{ backgroundColor: visual.tileSurface }}
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

function FriendDishCard({ food }: { food: Food }) {
  return (
    <article className="profile-overview-dish-card profile-food-link-area">
      <FriendFoodPhoto food={food} />
      <div className="profile-overview-food-heading">
        <h3>
          <Link className="profile-food-link" to={`/foods/${food.id}`}>
            {food.name || "未命名菜品"}
          </Link>
        </h3>
        <strong>{money(food.price)}</strong>
      </div>
      <div className="profile-overview-dish-meta">
        <span>{food.restaurantName || "餐厅信息待补充"}</span>
        <ProfileFoodLike food={food} />
      </div>
    </article>
  );
}

export function DesktopUser() {
  const { api, user, session } = useApp(),
    loc = useLocation(),
    id = parseId(loc.pathname.split("/").pop()),
    profile = useQuery({
      queryKey: ["user", id],
      queryFn: () => api.otherUser(id!),
      enabled: !!id,
    }),
    shares = useQuery({
      queryKey: ["foods", "by-user", id, "friend-overview"],
      queryFn: () => api.userFoods(id!, 1),
      enabled: !!id && !!session,
    }),
    task = useTask(undefined, undefined, ["user", "social"]);
  // 管理员在别人主页的临时「管理」开关：默认关闭，离开页面即复位。
  const [manage, setManage] = useState(false);
  useEffect(() => {
    document.title = `食友主页 · ${BRAND_NAME}`;
  }, []);
  if (!id)
    return (
      <State title="食友编号无效">
        <Link to="/">返回发现</Link>
      </State>
    );
  if (profile.isPending) return <PageSkeleton kind="profile" />;
  if (profile.isError && !profile.data)
    return (
      <State
        loading={profile.isPending}
        error={profile.error}
        retry={() => void profile.refetch()}
      />
    );
  const u = profile.data,
    self = id === user?.id,
    items = (shares.data?.items ?? []).filter((food) => food.id),
    latest = items[0],
    fallbackDish = demoDishes[(id ?? 0) % demoDishes.length],
    fallbackCover = {
      name: fallbackDish.name,
      pictureUrl: [`/prototype/assets/dishes/${fallbackDish.asset}.svg`],
      stageColor: stageCode(fallbackDish.stage),
    } as Food,
    heroFood = latest ?? fallbackCover,
    heroVisual = visualFor(heroFood, isDemo),
    coverSrc = mediaUrl(heroFood.pictureUrl?.[0]),
    initial = (u.displayName || "食友").slice(0, 1),
    people = [
      {
        key: "fans" as const,
        name: "粉丝",
        count: u.fansCount,
        visible: self || u.fansVisible === true,
        pending: u.fansVisible == null,
      },
      {
        key: "follow" as const,
        name: "关注",
        count: u.followingsCount,
        visible: self || u.followingsVisible === true,
        pending: u.followingsVisible == null,
      },
    ];
  const canManage = !self && user?.role === "admin";
  return (
    <div className="pc-profile-space pc-friend-space">
      <section
        className="profile-overview-hero"
        aria-labelledby="friend-profile-name"
        style={
          {
            "--profile-stage": heroVisual.stage,
            "--profile-on": heroVisual.on,
            "--profile-ghost": heroVisual.ghost,
          } as CSSProperties
        }
      >
        <div className="profile-overview-hero-top">
          <span className="profile-overview-eyebrow">
            {self ? "我的公开主页" : "食友主页"}
          </span>
          <div className="pc-friend-actions">
            {self ? (
              <ProfileEditLink className="profile-overview-edit">
                <Icon name="edit" size={17} />
                编辑资料
              </ProfileEditLink>
            ) : (
              <button
                type="button"
                className={`pc-friend-follow${u.isFollowingHim ? " is-following" : ""}`}
                aria-pressed={u.isFollowingHim === true}
                aria-busy={task.isPending}
                disabled={task.isPending || u.isFollowingHim == null}
                onClick={() =>
                  task.run(() => api.follow(id, u.isFollowingHim === true))
                }
              >
                <ReactionIcon kind="follow" size={18} />
                <span className="follow-label">
                  {task.isPending ? "更新中…" : followLabel(u)}
                </span>
              </button>
            )}
            <BlockControl userId={id} />
            {canManage && (
              <button
                type="button"
                className={`pc-friend-manage${manage ? " is-on" : ""}`}
                aria-pressed={manage}
                title={
                  manage
                    ? "关闭后卡片恢复只读"
                    : "开启后可编辑、删除这位食友的菜品"
                }
                onClick={() => setManage(!manage)}
              >
                <Icon name="tool" size={17} />
                {manage ? "管理中" : "管理"}
              </button>
            )}
          </div>
        </div>
        <div
          className="profile-overview-cover"
          data-cover-kind={latest ? "photo" : "illustration"}
        >
          {coverSrc ? (
            <img src={coverSrc} alt="" />
          ) : (
            <Icon name="bowl" size={64} />
          )}
        </div>
        <header className="profile-overview-identity">
          <div className="profile-overview-avatar">
            {u.avatar ? <img src={mediaUrl(u.avatar)} alt="" /> : initial}
          </div>
          <div className="profile-overview-intro">
            <h1 id="friend-profile-name">{u.displayName || "校园食友"}</h1>
            <p>{self ? "这是其他同学眼中的你。" : "山软校园食友"}</p>
            <div className="pc-friend-meta">
              {u.level != null && (
                <span className="user-level-badge">Lv.{u.level}</span>
              )}
              <UserTitle title={userTitle(u)} />
              {u.isFollowingMe && (
                <span className="pc-friend-following-me">关注了你</span>
              )}
            </div>
          </div>
        </header>
        <div className="profile-overview-social">
          <div>
            <strong>{u.earnedLikes ?? "—"}</strong>
            <span>获赞</span>
          </div>
          <div>
            <strong>{u.uploadedFoodsCount ?? "—"}</strong>
            <span>{self ? "上传的菜" : "分享的菜"}</span>
          </div>
          {people.map((person) =>
            person.visible ? (
              <Link
                key={person.key}
                to={peopleHref(
                  loc.pathname,
                  loc.search,
                  person.key as "fans" | "follow",
                )}
                state={{ profilePeopleFrom: loc.key }}
                preventScrollReset
              >
                <strong>{person.count ?? "—"}</strong>
                <span>{person.name}</span>
              </Link>
            ) : (
              <div
                key={person.key}
                title={person.pending ? "公开状态待确认" : "对方没有公开"}
              >
                <strong className="pc-friend-locked">
                  <Icon name="lock" size={20} />
                </strong>
                <span>{person.name}</span>
              </div>
            ),
          )}
        </div>
        {task.error && <TaskError error={task.error} />}
      </section>
      <div className="profile-overview-sheet">
        <div className="profile-overview">
          <div className="profile-overview-columns">
            <section
              className="profile-overview-uploads"
              aria-labelledby="friend-recent-shares"
            >
              <div className="profile-overview-section-heading">
                <div className="profile-overview-section-title">
                  <h2 id="friend-recent-shares">
                    {self ? "最近上传" : "最近分享"}
                  </h2>
                  {shares.data?.totalItems != null && (
                    <span>{shares.data.totalItems} 道</span>
                  )}
                </div>
              </div>
              {session && shares.isPending ? (
                <div
                  className="profile-overview-loading"
                  role="status"
                  aria-label="正在加载内容"
                >
                  <span />
                  <span />
                  <span />
                </div>
              ) : shares.isError ? (
                <div className="profile-overview-empty" role="alert">
                  <Icon name="warning" size={30} />
                  <h3>分享暂时没有加载出来</h3>
                  <p>网络或服务出了点问题，再试一次就好。</p>
                  <button
                    type="button"
                    onClick={() => void shares.refetch()}
                    disabled={shares.isFetching}
                  >
                    {shares.isFetching ? "正在重新加载…" : "重新加载"}
                  </button>
                </div>
              ) : items.length ? (
                <div className="profile-overview-dish-grid">
                  {items.slice(0, 3).map((food) => (
                    <FriendDishCard key={food.id} food={food} />
                  ))}
                </div>
              ) : (
                <div className="profile-overview-empty">
                  <DishIllustration name="yuntun" />
                  <h3>{self ? "分享你的第一道好菜" : "TA 还没有分享"}</h3>
                  <p>
                    {self
                      ? "记下喜欢的味道，也给其他食友一份参考。"
                      : "等 TA 分享第一道好菜，这里就会热闹起来。"}
                  </p>
                  {self && (
                    <Link to="/publish">
                      <Icon name="add" size={15} />
                      分享一道菜
                    </Link>
                  )}
                </div>
              )}
              <p className="pc-friend-record">
                {self ? "你" : "TA"}分享了 {u.uploadedFoodsCount ?? "—"} 道菜，
                添加了 {u.uploadedRestaurantsCount ?? "—"} 家店。
              </p>
            </section>
          </div>
          <section
            className="pc-friend-shares"
            aria-labelledby="friend-all-shares"
          >
            <div className="profile-overview-section-heading">
              <div className="profile-overview-section-title">
                <h2 id="friend-all-shares">
                  {self ? "我的全部分享" : "TA 的全部分享"}
                </h2>
              </div>
            </div>
            {session ? (
              <UserFoods
                key={id}
                userId={id}
                manage={self || (canManage && manage)}
              />
            ) : (
              <p className="ew-note">登录后可以浏览食友的全部分享。</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export function DesktopNewShop() {
  const flow = useNewShop(true);
  const { details, draft, busy } = flow;
  const longName = codePoints(draft.name.trim()) > 20;

  return (
    <div className="pc-secondary-new-shop" data-pc-secondary="new-shop">
      <PageHead
        title={details ? "填写店铺信息" : "添加一家店"}
        back="/publish"
        crumb={details && !draft.uncertain ? "返回搜店" : "发布一道菜"}
        onBack={details ? flow.back : undefined}
        backDisabled={flow.pending}
      />
      {draft.uncertain && (
        <p className="pc-secondary-error" role="alert">
          提交结果尚未确认，请返回发布页核实店铺，避免重复添加。
        </p>
      )}
      {details ? (
        <div className="pc-new-shop">
          <form
            ref={flow.formRef}
            tabIndex={-1}
            aria-label="填写店铺信息"
            id="new-shop-form"
            className="pc-new-shop-form"
            onSubmit={(event) => {
              event.preventDefault();
              flow.submit();
            }}
          >
            <section
              className="pc-new-shop-section"
              aria-labelledby="pc-new-shop-basics-title"
            >
              <h2 id="pc-new-shop-basics-title">
                <span>
                  <Icon name="pin" size={19} />
                </span>
                店名与位置
              </h2>
              <label className="pc-new-shop-name">
                <span>
                  店名
                  <FieldMark required />
                </span>
                <input
                  name="name"
                  aria-label="店铺名称"
                  aria-describedby={
                    longName ? "pc-new-shop-name-hint" : undefined
                  }
                  value={draft.name}
                  maxLength={20}
                  onChange={(event) =>
                    flow.update({ name: event.target.value })
                  }
                  disabled={busy}
                  required
                  autoComplete="off"
                  placeholder="输入店铺名称"
                />
                {longName && (
                  <small id="pc-new-shop-name-hint">
                    请将店名简化至 20 字以内。
                  </small>
                )}
              </label>
              <RestaurantLocationField
                place={draft.choice.place}
                point={draft.point}
                onPick={(point) => flow.update({ point })}
                address={draft.address}
                onAddressChange={(address) => flow.update({ address })}
                disabled={busy}
              />
            </section>
            <section
              className="pc-new-shop-section"
              aria-labelledby="pc-new-shop-traits-title"
            >
              <h2 id="pc-new-shop-traits-title">
                <span>
                  <Icon name="tag" size={19} />
                </span>
                经营信息
              </h2>
              <ShopTraitsFields
                value={draft.traits}
                onChange={(traits) => flow.update({ traits })}
                disabled={busy}
                compact
              />
            </section>
          </form>
          <aside
            className="pc-new-shop-summary"
            aria-labelledby="pc-new-shop-preview-title"
          >
            <div className="pc-new-shop-preview-art">
              <img
                src="/assets/restaurants/campus-storefront.webp"
                alt=""
                width={768}
                height={512}
              />
            </div>
            <div className="pc-new-shop-preview-copy">
              <h2 id="pc-new-shop-preview-title">店铺预览</h2>
              <strong>{draft.name.trim() || "待填写店名"}</strong>
              {draft.address.trim() && (
                <p>
                  <Icon name="pin" size={16} />
                  {draft.address.trim()}
                </p>
              )}
            </div>
            <div className="pc-new-shop-preview-footer">
              <button
                className="pc-button"
                type="submit"
                form="new-shop-form"
                disabled={!flow.canSubmit}
              >
                {flow.pending ? "正在提交…" : "提交新店"}
                <Icon name="chevronRight" size={17} />
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <NewShopSearch
          keyword={flow.keyword}
          onKeywordChange={flow.setKeyword}
          onSelect={flow.select}
          disabled={busy}
          desktop
        />
      )}
    </div>
  );
}
