import "../features/user-level.css";
import { UserTitle } from "../components/UserTitle";
import { userTitle } from "../api/growth";
import { FieldMark } from "../features/FieldMark";
import { boundedText, submissionPath } from "../api/content-rules";
import { BlockControl, UserFoods } from "../features/ApiV2";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { ProfileEditLink } from "../app/profile-navigation";
import { useArea } from "../app/area";
import { isDemo } from "../app/runtime";
import { resultUncertain } from "../api/client";
import { parseId, type Notification } from "../api/models";
import { useTask } from "../components/useTask";
import { useMobile, DesignIcon as Icon } from "../mobile/ui";
import { SlidingTabs } from "./motion";
import { useContentMotion } from "../motion/hooks";
import { peopleHref } from "../features/profile-people";
import { historyTime } from "./history";
import RestaurantLocationField, {
  requireShopLocation,
} from "../features/RestaurantLocationField";
import type { MapPoint } from "../features/map-geometry";
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
  Note,
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
export function DesktopUser() {
  const { api, user } = useApp(),
    loc = useLocation(),
    id = parseId(loc.pathname.split("/").pop()),
    q = useQuery({
      queryKey: ["user", id],
      queryFn: () => api.otherUser(id!),
      enabled: !!id,
    }),
    task = useTask(undefined, undefined, ["user", "social"]);
  if (!id)
    return (
      <State title="食友编号无效">
        <Link to="/">返回发现</Link>
      </State>
    );
  if (q.isPending) return <PageSkeleton kind="profile" />;
  if (q.isError && !q.data)
    return (
      <State
        loading={q.isPending}
        error={q.error}
        retry={() => void q.refetch()}
      />
    );
  const u = q.data,
    self = id === user?.id;
  return (
    <div className="pc-secondary-user" data-pc-secondary="user">
      <PageHead title={self ? "我的公开主页" : "食友主页"} />
      <div className="pc-secondary-user-layout">
        <aside className="pc-secondary-user-card">
          <img
            className="pc-secondary-user-dish"
            src="/prototype/assets/dishes/yangzhi.svg"
            alt=""
          />
          <Avatar large name={u.displayName} src={u.avatar} />
          <h2>
            {u.displayName || "校园食友"}
            {u.level != null && (
              <span className="user-level-badge">Lv.{u.level}</span>
            )}
            <UserTitle title={userTitle(u)} />
          </h2>
          <p>{self ? "这是其他同学眼中的你。" : "山软校园食友"}</p>
          {u.isFollowingMe && (
            <span className="pc-secondary-badge">关注了你</span>
          )}
          <div className="pc-secondary-user-stats">
            <span>
              <b>{u.earnedLikes ?? "—"}</b>获赞
            </span>
            <span>
              <b>{u.uploadedFoodsCount ?? "—"}</b>分享的菜
            </span>
          </div>
          {self ? (
            <ProfileEditLink className="pc-button">
              编辑个人资料
            </ProfileEditLink>
          ) : (
            <button
              className={`pc-button ${u.isFollowingHim ? "light" : ""}`}
              disabled={task.isPending || u.isFollowingHim == null}
              onClick={() =>
                task.run(() => api.follow(id, u.isFollowingHim === true))
              }
            >
              <Icon name={u.isFollowingHim ? "followed" : "follow"} size={18} />
              {task.isPending
                ? "正在更新…"
                : u.isFollowingHim
                  ? "已关注 · 取消关注"
                  : "关注这位食友"}
            </button>
          )}
          <TaskError error={task.error} />
          <BlockControl userId={id} />
        </aside>
        <div>
          <Section title="TA 的校园美食档案">
            <div className="pc-secondary-user-relations">
              {[
                {
                  key: "fans",
                  name: "粉丝",
                  count: u.fansCount,
                  visible: u.fansVisible,
                },
                {
                  key: "follow",
                  name: "关注",
                  count: u.followingsCount,
                  visible: u.followingsVisible,
                },
              ].map((x) =>
                self || x.visible === true ? (
                  <Link
                    key={x.key}
                    to={peopleHref(
                      loc.pathname,
                      loc.search,
                      x.key as "fans" | "follow",
                    )}
                    state={{ profilePeopleFrom: loc.key }}
                    preventScrollReset
                  >
                    <Icon name="me" size={22} />
                    <span>
                      <b>{x.count ?? "—"}</b>
                      {x.name}
                    </span>
                    <Icon name="chevronRight" size={18} />
                  </Link>
                ) : (
                  <div key={x.key}>
                    <Icon name="lock" size={22} />
                    <span>
                      <b>{x.name}</b>
                      {x.visible === false ? "对方没有公开" : "公开状态待确认"}
                    </span>
                  </div>
                ),
              )}
            </div>
            <div className="pc-secondary-row">
              <div>
                <b>分享记录</b>
                <p>
                  分享了 {u.uploadedFoodsCount ?? "—"} 道菜，添加了{" "}
                  {u.uploadedRestaurantsCount ?? "—"} 家店。
                </p>
              </div>
            </div>
          </Section>
          <Section title={self ? "我的分享" : "TA 的分享"}>
            <UserFoods key={id} userId={id} />
          </Section>
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
        <div className="pc-secondary-columns">
          <Section title="店铺信息" detail="基本信息和位置在同一页完成。">
            <form
              className="pc-secondary-form"
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
              <label className="pc-secondary-field">
                <span>
                  店铺名称
                  <FieldMark required />
                </span>
                <input
                  aria-label="店铺名称"
                  value={draft.name}
                  maxLength={20}
                  onChange={(e) => update({ name: e.target.value })}
                  disabled={task.isPending || draft.uncertain}
                  required
                  placeholder="例如：西门口的那家云吞店"
                />
              </label>
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
                disabled={task.isPending || draft.uncertain}
              />
              <ShopTraitsFields
                value={draft.traits}
                onChange={(traits) => update({ traits })}
                disabled={task.isPending || draft.uncertain}
              />
              <TaskError error={task.error} />
              {draft.uncertain && (
                <div className="pc-secondary-error" role="alert">
                  提交结果还未确认。请先返回发布页搜索这家店，核实结果，避免重复创建。本次提交已暂停。
                </div>
              )}
              <div className="pc-secondary-form-footer">
                <span>未提交内容在本次访问中保留</span>
                <button
                  className="pc-button"
                  disabled={task.isPending || draft.uncertain || !draft.point}
                >
                  {task.isPending
                    ? "正在提交…"
                    : draft.point
                      ? "提交新店"
                      : "请先在地图选点"}
                  <Icon name="check" size={17} />
                </button>
              </div>
            </form>
          </Section>
          <div className="pc-secondary-sticky">
            <Note title="先找一找，再添加" icon="store">
              <p>
                同一家店可能已经被其他同学添加。建议先在发布页搜索，避免重复。
              </p>
              <Link to="/publish">返回发布页搜索 →</Link>
            </Note>
            <Note title="位置越准确，越容易找到" icon="pin">
              <p>请在地图上标记店铺入口，方便同学找到它。</p>
              <p>新店提交后，需要回到列表选择准确的店铺，再继续发布菜品。</p>
            </Note>
          </div>
        </div>
      )}
    </div>
  );
}
