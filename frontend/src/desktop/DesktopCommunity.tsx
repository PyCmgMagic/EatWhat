import "../features/user-level.css";
import { UserTitle } from "../components/UserTitle";
import { userTitle } from "../api/growth";
import { FieldMark } from "../features/FieldMark";
import { boundedText, submissionPath } from "../api/content-rules";
import { BlockControl, UserFoods } from "../features/ApiV2";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { ProfileEditLink } from "../app/profile-navigation";
import { useArea } from "../app/area";
import { isDemo } from "../app/runtime";
import { resultUncertain } from "../api/client";
import {
  mediaUrl,
  money,
  parseId,
  type Food,
  type Notification,
} from "../api/models";
import { useTask } from "../components/useTask";
import { useMobile, DesignIcon as Icon } from "../mobile/ui";
import { SlidingTabs } from "./motion";
import { useContentMotion } from "../motion/hooks";
import { peopleHref } from "../features/profile-people";
import { useFoodImageRefresh } from "../features/media";
import { demoDishes, visualFor } from "../mobile/catalog";
import { stageCode } from "../api/food-display";
import { DishIllustration } from "../components/DishIllustration";
import "./friend-profile.css";
import { historyTime } from "./history";
import RestaurantLocationField, {
  requireShopLocation,
} from "../features/RestaurantLocationField";
import type { MapPoint } from "../features/map-geometry";
import { mealTimes, priceBands, shopKinds } from "../api/v2-vocab";
import "./new-shop.css";
import { PageSkeleton } from "../components/LoadingSkeleton";
import { ProfileSectionNav } from "../features/ProfileSectionNav";
import "../features/profile-activity.css";
import {
  ShopTraitsFields,
  defaultShopTraits,
  type ShopTraits,
} from "../features/ShopTraits";
import {
  Avatar,
  PageHead,
  Pager,
  Section,
  State,
  TaskError,
} from "./secondary";

function notificationLink(n: Notification) {
  const id = parseId(String(n.targetId ?? ""));
  if (!id) return undefined;
  const type = n.targetType?.toLowerCase();
  return type === "food"
    ? `/foods/${id}`
    : type === "restaurant"
      ? `/restaurants/${id}`
      : undefined;
}
export function DesktopNotifications() {
  const { api } = useApp(),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState("all"),
    q = useQuery({
      queryKey: ["notifications", "list", page],
      queryFn: () => api.notifications(page),
    }),
    unread = useQuery({
      queryKey: ["notifications", "unread"],
      queryFn: () => api.unread(),
    }),
    task = useTask(undefined, undefined, ["notifications"]);
  const rows =
    q.data?.items?.filter((n) => filter !== "unread" || n.read !== true) ?? [];
  const list = useRef<HTMLDivElement>(null);
  useContentMotion(
    list,
    `${filter}:${page}`,
    filter === "all" ? 0 : 1,
    "opacity",
  );
  return (
    <div
      className="pc-secondary-notifications profile-legacy-messages"
      data-pc-secondary="notifications"
    >
      <PageHead
        title="消息通知"
        action={
          <button
            className="pc-button light"
            disabled={task.isPending || !unread.data}
            onClick={() => task.run(() => api.readAll())}
          >
            <Icon name="check" size={17} />
            全部标为已读
          </button>
        }
      />
      <ProfileSectionNav section="messages" />
      <div className="profile-legacy-message-body">
        <section className="profile-legacy-message-panel" aria-label="互动消息">
          <div className="pc-secondary-list-toolbar">
            <SlidingTabs label="通知筛选" active={filter}>
              {[
                { id: "all", name: "全部消息" },
                { id: "unread", name: "本页未读" },
              ].map((x) => (
                <button
                  key={x.id}
                  role="tab"
                  aria-selected={filter === x.id}
                  tabIndex={filter === x.id ? 0 : -1}
                  onClick={() => setFilter(x.id)}
                >
                  {x.name}
                </button>
              ))}
            </SlidingTabs>
            <span className="profile-message-unread-count">
              {unread.data == null
                ? ""
                : unread.data > 0
                  ? `${unread.data} 条未读`
                  : "消息都已读完"}
            </span>
          </div>
          <TaskError error={task.error} />
          {q.isPending || q.isError ? (
            <State
              loading={q.isPending}
              error={q.error}
              retry={() => void q.refetch()}
            />
          ) : rows.length ? (
            <div className="pc-secondary-message-list" ref={list}>
              {rows.map((n, i) => {
                const link = notificationLink(n),
                  date = historyTime(n.createdAt),
                  actorId = parseId(String(n.actorId ?? "")),
                  text =
                    (
                      {
                        like: "赞了你的分享",
                        favorite: "收藏了你的分享",
                        follow: "关注了你",
                        comment: "与你的分享有了新讨论",
                      } as Record<string, string>
                    )[n.type?.toLowerCase() ?? ""] || "与你有了新互动";
                return (
                  <article
                    key={n.id ?? i}
                    className={`pc-secondary-message profile-message-row ${n.read === false ? "unread" : ""}`}
                  >
                    <Avatar name={n.actorName} src={n.actorAvatar} />
                    <div>
                      <div className="pc-secondary-message-title">
                        {actorId ? (
                          <Link to={`/users/${actorId}`}>
                            {n.actorName || "校园食友"}
                          </Link>
                        ) : (
                          <b>{n.actorName || "校园食友圈"}</b>
                        )}
                        <span>{text}</span>
                      </div>
                      <time dateTime={date?.toISOString()}>
                        {date
                          ? date.toLocaleString("zh-CN", {
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "时间待确认"}
                      </time>
                      <div className="pc-secondary-inline-actions">
                        {link && <Link to={link}>查看相关内容 →</Link>}
                        {n.read === false && n.id && (
                          <button
                            disabled={task.isPending}
                            onClick={() => task.run(() => api.read(n.id!))}
                          >
                            标为已读
                          </button>
                        )}
                      </div>
                    </div>
                    {n.read === false && (
                      <i className="pc-secondary-unread-dot" />
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <State
              title={
                filter === "unread" ? "本页消息都已读完" : "暂时没有新消息"
              }
              detail="有新的互动时，会在这里告诉你。"
            >
              <Link className="pc-button light" to="/">
                去发现好味道
              </Link>
            </State>
          )}
          <Pager
            page={page}
            hasNext={q.data?.hasNext}
            disabled={q.isFetching}
            onPage={setPage}
          />
        </section>
        <div className="profile-activity-note">
          <p>“本页未读”筛选当前页的消息，翻页可以继续查看更早的互动。</p>
          <Link to="/settings/notifications">
            <Icon name="settings" size={16} />
            通知偏好
          </Link>
        </div>
      </div>
    </div>
  );
}
function FriendFoodPhoto({ food }: { food: Food }) {
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

function FriendDishCard({ food }: { food: Food }) {
  return (
    <Link to={`/foods/${food.id}`} className="profile-overview-dish-card">
      <FriendFoodPhoto food={food} />
      <div className="profile-overview-food-heading">
        <h3>{food.name || "未命名菜品"}</h3>
        <strong>{money(food.price)}</strong>
      </div>
      <div className="profile-overview-dish-meta">
        <span>{food.restaurantName || "餐厅信息待补充"}</span>
        {food.likesCount != null && (
          <span className="profile-overview-dish-likes">
            <Icon name="heart" size={13} />
            {food.likesCount}
          </span>
        )}
      </div>
    </Link>
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
    document.title = "食友主页 · 山软今天吃什么";
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
                disabled={task.isPending || u.isFollowingHim == null}
                onClick={() =>
                  task.run(() => api.follow(id, u.isFollowingHim === true))
                }
              >
                <Icon
                  name={u.isFollowingHim ? "followed" : "follow"}
                  size={18}
                />
                {task.isPending
                  ? "正在更新…"
                  : u.isFollowingHim
                    ? "已关注"
                    : "关注这位食友"}
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
            </section>
            <section
              className="profile-overview-collection"
              aria-labelledby="friend-archive"
            >
              <div className="profile-overview-section-heading">
                <div className="profile-overview-section-title">
                  <h2 id="friend-archive">
                    {self ? "我的校园美食档案" : "TA 的校园美食档案"}
                  </h2>
                </div>
              </div>
              <div className="pc-friend-relations">
                {people.map((person) =>
                  person.visible ? (
                    <Link
                      key={person.key}
                      className="pc-friend-relation"
                      to={peopleHref(
                        loc.pathname,
                        loc.search,
                        person.key as "fans" | "follow",
                      )}
                      state={{ profilePeopleFrom: loc.key }}
                      preventScrollReset
                    >
                      <Icon name="me" size={22} />
                      <span>
                        <b>{person.count ?? "—"}</b> {person.name}
                      </span>
                      <Icon name="chevronRight" size={18} />
                    </Link>
                  ) : (
                    <div
                      key={person.key}
                      className="pc-friend-relation is-locked"
                    >
                      <Icon name="lock" size={22} />
                      <span>
                        <b>{person.name}</b>
                        <small>
                          {person.pending ? "公开状态待确认" : "对方没有公开"}
                        </small>
                      </span>
                    </div>
                  ),
                )}
              </div>
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
              <UserFoods key={id} userId={id} manage={canManage && manage} />
            ) : (
              <p className="ew-note">登录后可以浏览食友的全部分享。</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

type ShopDraft = {
  name: string;
  address: string;
  traits: ShopTraits;
  point?: MapPoint;
  uncertain: boolean;
  done: boolean;
};
const shopDrafts = new Map<string, ShopDraft>();
function StepMark({ index, done }: { index: number; done: boolean }) {
  return (
    <span className="pc-new-shop-step-mark" aria-hidden="true">
      {done ? <Icon name="check" size={15} /> : index}
    </span>
  );
}
export function DesktopNewShop() {
  const { api, user } = useApp(),
    { area } = useArea(),
    m = useMobile(),
    nav = useNavigate(),
    key = `${isDemo ? "demo" : "live"}:${user?.id ?? ""}`,
    [draft, setDraft] = useState<ShopDraft>(
      () =>
        shopDrafts.get(key) ?? {
          name: m.draft.restaurantId ? "" : (m.draft.shopName ?? ""),
          address: "",
          traits: defaultShopTraits(),
          uncertain: false,
          done: false,
        },
    ),
    task = useTask(),
    locked = useRef(false);
  function update(patch: Partial<ShopDraft>) {
    setDraft((d) => {
      const next = { ...d, ...patch };
      shopDrafts.set(key, next);
      return next;
    });
  }
  const dirty = !!(draft.name || draft.address || draft.point) && !draft.done;
  useEffect(() => {
    if (!dirty) return;
    const leave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  const busy = task.isPending || draft.uncertain,
    hasName = !!draft.name.trim(),
    hasPlace = !!draft.point && !!draft.address.trim(),
    hasMeals = !!draft.traits.mealTimes.length,
    checks = [
      { name: "店名", done: hasName },
      { name: "地图选点", done: !!draft.point },
      { name: "详细地址", done: !!draft.address.trim() },
      { name: "营业饭点", done: hasMeals },
    ],
    traitNames = [
      shopKinds.find((k) => k.id === draft.traits.kind)?.name,
      priceBands.find((p) => p.id === draft.traits.priceBand)?.name,
      ...mealTimes
        .filter((t) => draft.traits.mealTimes.includes(t.id))
        .map((t) => t.name),
      ...draft.traits.categories,
      ...draft.traits.tags,
    ].filter((name): name is string => !!name);
  return (
    <div className="pc-secondary-new-shop" data-pc-secondary="new-shop">
      <PageHead
        title={draft.done ? "新店已提交" : "添加一家店"}
        back="/publish"
        crumb="发布一道菜"
      />
      {draft.done ? (
        <Section title="提交完成">
          <State
            title="新店信息已提交"
            detail="回到发布页，搜索并选择这家店后，就可以继续添加菜品。"
          >
            <button
              className="pc-button"
              onClick={() => {
                m.setDraft({ shopName: draft.name });
                shopDrafts.delete(key);
                nav("/publish");
              }}
            >
              回到发布页选店
            </button>
          </State>
        </Section>
      ) : (
        <div className="pc-new-shop">
          <form
            id="new-shop-form"
            className="pc-new-shop-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (locked.current || draft.uncertain) return;
              locked.current = true;
              task.run(async () => {
                try {
                  const name = boundedText(draft.name, 20, "店名"),
                    address = boundedText(draft.address, 30, "地址");
                  if (!name || !address)
                    throw new Error("请填写店名和详细地址。");
                  const point = requireShopLocation(draft.point);
                  if (!draft.traits.mealTimes.length)
                    throw new Error("请至少选择一个营业饭点。");
                  const created = await api.createRestaurant({
                    name,
                    address,
                    ...point,
                    hubId: area?.hubId,
                    ...draft.traits,
                  });
                  update({ done: true });
                  if (created.revisionId) {
                    shopDrafts.delete(key);
                    nav(submissionPath(created, "/publish"));
                    return;
                  }
                  m.setShopId(created.id);
                  m.setDraft({ shopName: name, restaurantId: created.id });
                  shopDrafts.delete(key);
                  nav("/publish/dish");
                } catch (error) {
                  if (resultUncertain(error)) update({ uncertain: true });
                  throw error;
                } finally {
                  locked.current = false;
                }
              });
            }}
          >
            <section className="pc-new-shop-step" data-done={hasName}>
              <StepMark index={1} done={hasName} />
              <label className="pc-new-shop-name">
                <span className="pc-new-shop-step-title">
                  这家店叫什么
                  <FieldMark required />
                </span>
                <input
                  aria-label="店铺名称"
                  value={draft.name}
                  maxLength={20}
                  onChange={(e) => update({ name: e.target.value })}
                  disabled={busy}
                  required
                  placeholder="例如：西门口的那家云吞店"
                />
                <small>
                  写同学们平时叫的名字，最多 20
                  字。下面搜索地点时选中结果，也会自动填入。
                </small>
              </label>
            </section>
            <section className="pc-new-shop-step" data-done={hasPlace}>
              <StepMark index={2} done={hasPlace} />
              <RestaurantLocationField
                name={draft.name}
                onNameChange={(name) => update({ name })}
                point={draft.point}
                onPick={(point) => {
                  update({ point });
                  task.reset();
                }}
                address={draft.address}
                onAddressChange={(address) => update({ address })}
                disabled={busy}
              />
            </section>
            <section className="pc-new-shop-step" data-done={hasMeals}>
              <StepMark index={3} done={hasMeals} />
              <div className="pc-new-shop-traits">
                <h2 className="pc-new-shop-step-title">这家店的特点</h2>
                <p>用于推荐和筛选，除类型和营业饭点外都可以先不填。</p>
                <ShopTraitsFields
                  value={draft.traits}
                  onChange={(traits) => update({ traits })}
                  disabled={busy}
                />
              </div>
            </section>
            <TaskError error={task.error} />
            {draft.uncertain && (
              <div className="pc-secondary-error" role="alert">
                提交结果还未确认。请先返回发布页搜索这家店，核实结果，避免重复创建。本次提交已暂停。
              </div>
            )}
          </form>
          <aside className="pc-new-shop-side">
            <div className="pc-new-shop-summary">
              <span className="pc-new-shop-eyebrow">即将添加</span>
              <div className="pc-new-shop-card">
                <span className="pc-new-shop-card-icon">
                  <Icon name="store" size={22} />
                </span>
                <div>
                  <strong data-empty={!hasName}>
                    {draft.name.trim() || "还没有店名"}
                  </strong>
                  <small>
                    {draft.address.trim() ||
                      (draft.point
                        ? "位置已标记，请补充详细地址"
                        : "在地图上选点后显示地址")}
                  </small>
                </div>
              </div>
              {traitNames.length > 0 && (
                <ul className="pc-new-shop-chips" aria-label="已选特点">
                  {traitNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              )}
              <ul className="pc-new-shop-checks" aria-live="polite">
                {checks.map((item) => (
                  <li key={item.name} data-done={item.done}>
                    <Icon name={item.done ? "check" : "add"} size={13} />
                    {item.name}
                  </li>
                ))}
              </ul>
              <button
                className="pc-button"
                form="new-shop-form"
                disabled={busy || !draft.point}
              >
                {task.isPending
                  ? "正在提交…"
                  : draft.point
                    ? "提交新店"
                    : "请先在地图选点"}
                <Icon name="check" size={17} />
              </button>
              <p className="pc-new-shop-keep">未提交内容在本次访问中保留</p>
            </div>
            <div className="pc-new-shop-tip">
              <Icon name="search" size={18} />
              <div>
                <strong>先找一找，再添加</strong>
                <p>同一家店可能已经被其他同学添加，先搜索可以避免重复。</p>
                <Link to="/publish">返回发布页搜索 →</Link>
              </div>
            </div>
            <div className="pc-new-shop-tip">
              <Icon name="pin" size={18} />
              <div>
                <strong>把图钉放在店铺入口</strong>
                <p>
                  位置越准确，同学越容易找到。提交后回到发布页选中这家店，就能继续发布菜品。
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
