import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useArea } from "../app/area";
import { isDemo } from "../app/runtime";
import { resultUncertain } from "../api/client";
import { parseId, type Notification } from "../api/models";
import { useTask } from "../components/useTask";
import { useMobile, DesignIcon as Icon } from "../mobile/ui";
import { SlidingTabs } from "./motion";
import { historyTime } from "./history";
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
  return (
    <div
      className="pc-secondary-notifications"
      data-pc-secondary="notifications"
    >
      <PageHead
        title="通知中心"
        detail="关于你分享的好味道，这里有新消息。"
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
      <div className="pc-secondary-columns">
        <Section title="互动消息">
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
            <span>{unread.data == null ? "" : `${unread.data} 条未读`}</span>
          </div>
          <TaskError error={task.error} />
          {q.isPending || q.isError ? (
            <State
              loading={q.isPending}
              error={q.error}
              retry={() => void q.refetch()}
            />
          ) : rows.length ? (
            <div className="pc-secondary-message-list">
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
                    className={`pc-secondary-message ${n.read === false ? "unread" : ""}`}
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
        </Section>
        <Note title="每一份分享，都有回响" icon="bell">
          <p>点赞、收藏和关注等互动消息会集中展示在这里。</p>
          <p>“本页未读”只筛选当前这一页。切换分页，可以继续查看更早的消息。</p>
          <Link to="/settings/notifications">了解通知偏好 →</Link>
        </Note>
      </div>
    </div>
  );
}
export function DesktopUser() {
  const { api, user } = useApp(),
    id = parseId(useLocation().pathname.split("/").pop()),
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
  if (q.isPending || q.isError)
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
      <PageHead
        title={self ? "我的公开主页" : "食友主页"}
        detail="同校的你，也在认真记录每一餐。"
      />
      <div className="pc-secondary-user-layout">
        <aside className="pc-secondary-user-card">
          <img
            className="pc-secondary-user-dish"
            src="/prototype/assets/dishes/yangzhi.svg"
            alt=""
          />
          <Avatar large name={u.userName} src={u.avatar} />
          <h2>{u.userName || "校园食友"}</h2>
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
            <Link className="pc-button" to="/me/edit">
              编辑个人资料
            </Link>
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
                  <Link key={x.key} to={`/follows?tab=${x.key}&userId=${id}`}>
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
            {self ? (
              <State
                title="你的分享都在个人中心"
                detail="在那里继续查看和管理已经上传的菜品。"
              >
                <Link className="pc-button light" to="/me">
                  查看我的分享
                </Link>
              </State>
            ) : (
              <State
                title="TA 的分享列表暂未开放"
                detail="你可以先关注这位同学，或去发现页看看更多好味道。"
              >
                <Link className="pc-button light" to="/">
                  浏览今日推荐
                </Link>
              </State>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
export function DesktopFollows() {
  const loc = useLocation(),
    params = new URLSearchParams(loc.search),
    { api, user } = useApp(),
    nav = useNavigate(),
    idRaw = params.get("userId"),
    id = idRaw ? parseId(idRaw) : (user?.id ?? undefined),
    kind = params.get("tab") === "fans" ? "followers" : "followings",
    [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const own = id === user?.id,
    profile = useQuery({
      queryKey: ["user", id],
      queryFn: () => api.otherUser(id!),
      enabled: !!id,
    }),
    visible =
      kind === "followers"
        ? profile.data?.fansVisible
        : profile.data?.followingsVisible,
    allowed = !!id && (own || (profile.isSuccess && visible === true)),
    q = useQuery({
      queryKey: ["social", kind, id, page],
      queryFn: () => api.followers(kind, id, page),
      enabled: allowed,
    });
  useEffect(() => {
    setPage(1);
    setSearch("");
  }, [kind, id]);
  function switchTab(tab: string) {
    const p = new URLSearchParams(loc.search);
    p.set("tab", tab);
    setPage(1);
    setSearch("");
    nav("/follows?" + p.toString());
  }
  const rows =
    q.data?.items?.filter((p) => (p.userName || "").includes(search.trim())) ??
    [];
  return (
    <div className="pc-secondary-follows" data-pc-secondary="follows">
      <PageHead
        title={own ? "我的食友" : "TA 的食友"}
        detail="从一份好味道，认识同校的你。"
        back={own ? "/me" : id ? `/users/${id}` : "/me"}
        crumb={own ? "我的" : "食友主页"}
      />
      <div className="pc-secondary-columns">
        <Section title="关注与粉丝">
          <div className="pc-secondary-list-toolbar">
            <SlidingTabs active={kind} label="关注与粉丝">
              <button
                role="tab"
                aria-selected={kind === "followings"}
                tabIndex={kind === "followings" ? 0 : -1}
                onClick={() => switchTab("follow")}
              >
                关注
              </button>
              <button
                role="tab"
                aria-selected={kind === "followers"}
                tabIndex={kind === "followers" ? 0 : -1}
                onClick={() => switchTab("fans")}
              >
                粉丝
              </button>
            </SlidingTabs>
            <label className="pc-secondary-search">
              <Icon name="search" size={17} />
              <input
                aria-label="搜索本页食友"
                placeholder="搜索本页食友"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {!id ? (
            <State title="食友编号无效" detail="请返回主页后重新进入。" />
          ) : !own && (profile.isPending || profile.isError) ? (
            <State
              loading={profile.isPending}
              error={profile.error}
              retry={() => void profile.refetch()}
            />
          ) : !allowed ? (
            <State
              title={
                visible === false
                  ? "对方没有公开这个列表"
                  : "暂时无法确认公开范围"
              }
              detail="食友可以在隐私设置中管理列表的可见范围。"
            />
          ) : q.isPending || q.isError ? (
            <State
              loading={q.isPending}
              error={q.error}
              retry={() => void q.refetch()}
            />
          ) : rows.length ? (
            <div className="pc-secondary-people">
              {rows.map((p, i) => (
                <article key={p.id ?? i}>
                  <Avatar name={p.userName} src={p.avatar} />
                  <div>
                    <b>{p.userName || "校园食友"}</b>
                    <small>山软校园食友</small>
                  </div>
                  {parseId(String(p.id ?? "")) ? (
                    <Link className="pc-button light" to={`/users/${p.id}`}>
                      查看主页
                      <Icon name="chevronRight" size={15} />
                    </Link>
                  ) : (
                    <span className="pc-secondary-copy">资料待补充</span>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <State
              title={
                search
                  ? "本页没有找到这位食友"
                  : kind === "followers"
                    ? "这里还没有粉丝"
                    : "这里还没有关注的食友"
              }
              detail={
                search
                  ? "试试其他名字，或翻页继续查找。"
                  : "去发现页，认识分享好味道的同学。"
              }
            />
          )}
          <Pager
            page={page}
            hasNext={allowed && q.data?.hasNext}
            disabled={q.isFetching}
            onPage={setPage}
          />
        </Section>
        <Note
          title={own ? "你的校园食友圈" : "尊重彼此的公开范围"}
          icon="follow"
        >
          <p>进入食友主页，可以查看公开资料和管理关注关系。</p>
          {own ? (
            <Link to="/settings/privacy">管理列表可见性 →</Link>
          ) : (
            <Link to={id ? `/users/${id}` : "/"}>回到食友主页 →</Link>
          )}
        </Note>
      </div>
    </div>
  );
}
type ShopDraft = {
  name: string;
  address: string;
  lng: string;
  lat: string;
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
          lng: "",
          lat: "",
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
  const dirty =
    !!(draft.name || draft.address || draft.lng || draft.lat) && !draft.done;
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
        detail="把店名和准确位置一起补充好，接着分享你的拿手推荐。"
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
                    const name = draft.name.trim(),
                      address = draft.address.trim();
                    if (!name || !address)
                      throw new Error("请填写店名和详细地址。");
                    await api.createRestaurant({
                      name,
                      address,
                      gcjLng: Number(draft.lng),
                      gcjLat: Number(draft.lat),
                      hubId: area?.hubId,
                    });
                    update({ done: true });
                    m.setDraft({ shopName: name });
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
                <span>店铺名称</span>
                <input
                  aria-label="店铺名称"
                  value={draft.name}
                  onChange={(e) => update({ name: e.target.value })}
                  disabled={task.isPending || draft.uncertain}
                  required
                  placeholder="例如：西门口的那家云吞店"
                />
              </label>
              <label className="pc-secondary-field">
                <span>详细地址</span>
                <input
                  value={draft.address}
                  onChange={(e) => update({ address: e.target.value })}
                  disabled={task.isPending || draft.uncertain}
                  required
                  placeholder="街道、门牌或食堂楼层与窗口"
                />
              </label>
              <div className="pc-secondary-form-divider">
                <Icon name="pin" size={20} />
                <h3>准确位置</h3>
              </div>
              <p className="pc-secondary-copy">
                地图选点暂未开放，请填写店铺的 GCJ02
                坐标。区域中心不能代替店铺位置。
              </p>
              <div className="pc-secondary-field-pair">
                <label className="pc-secondary-field">
                  <span>GCJ02 经度</span>
                  <input
                    type="number"
                    min="72.004"
                    max="137.8347"
                    step="any"
                    value={draft.lng}
                    onChange={(e) => update({ lng: e.target.value })}
                    disabled={task.isPending || draft.uncertain}
                    required
                    placeholder="72.004–137.8347"
                  />
                </label>
                <label className="pc-secondary-field">
                  <span>GCJ02 纬度</span>
                  <input
                    type="number"
                    min="0.8293"
                    max="55.8271"
                    step="any"
                    value={draft.lat}
                    onChange={(e) => update({ lat: e.target.value })}
                    disabled={task.isPending || draft.uncertain}
                    required
                    placeholder="0.8293–55.8271"
                  />
                </label>
              </div>
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
                  disabled={task.isPending || draft.uncertain}
                >
                  {task.isPending ? "正在提交…" : "提交新店"}
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
              <p>请填写店铺实际位置，别用学校或商圈中心代替。</p>
              <p>新店提交后，需要回到列表选择准确的店铺，再继续发布菜品。</p>
            </Note>
          </div>
        </div>
      )}
    </div>
  );
}
