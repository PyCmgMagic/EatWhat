import "./user-level.css";
import { UserTitle } from "../components/UserTitle";
import { userTitle } from "../api/growth";
import { Select } from "../components/Select";
import { isDemo, readSession, sameSession } from "../app/runtime";
import { authNext, useReturnTo } from "../app/navigation";
import { historyEntry, historyTime } from "../desktop/history";
import { emptyHistoryCache, historyCacheFilters } from "./history-cache";
import { useSendSignal } from "./useSendSignal";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useApp } from "../app/state";
import { ProfileEditLink } from "../app/profile-navigation";
import { LoginLink } from "../app/auth-dialog";
import { useTask } from "../components/useTask";
import { errorMessage, unavailable } from "../api/client";
import { categories, mediaUrl, money, parseId, type Food } from "../api/models";
import { DesignIcon as Icon, ReactionIcon, useMobile } from "../mobile/ui";
import { followLabel, peopleHref } from "./profile-people";
import { CatalogCard, FeaturePage, FeatureState, FoodManage } from "./Catalog";
import { visualFor } from "../mobile/catalog";
import ProfileSheet, { ProfileToolbarIdentity } from "../mobile/ProfileSheet";
import { UserAvatar } from "../components/UserAvatar";
import { useFoodImageRefresh } from "./media";
import { ProfileFoodLike } from "./ProfileFoodLike";
import "./api-v2.css";
import "./user-profile.css";
import { ToastError } from "../components/feedback";
import { Modal } from "../components/ui";

function RequestError({ error }: { error: unknown }) {
  return (
    <ToastError
      error={
        error && (unavailable(error) ? "这项功能正在准备中，敬请期待。" : error)
      }
    />
  );
}
function Pages({
  page,
  next,
  busy,
  change,
}: {
  page: number;
  next: boolean;
  busy: boolean;
  change: (page: number) => void;
}) {
  return (
    <div className="ew-v2-pages">
      <button disabled={busy || page <= 1} onClick={() => change(page - 1)}>
        上一页
      </button>
      <span>第 {page} 页</span>
      <button disabled={busy || !next} onClick={() => change(page + 1)}>
        下一页
      </button>
    </div>
  );
}
const userFoodDefaults = { keyword: "", category: "", sort: "NEWEST" };

function ProfileFoodCard({
  food,
  manage = false,
}: {
  food: Food;
  manage?: boolean;
}) {
  const { user } = useApp();
  // 自己的菜随时可管；别人的菜只有管理员打开「管理」后才出现操作。
  const own = !!user?.id && food.accountId === user.id;
  const src = mediaUrl(food.pictureUrl?.[0]);
  const [failed, setFailed] = useState<string>();
  const renewImage = useFoodImageRefresh();
  return (
    <article className="mobile-user-food-card">
      <div className="profile-food-link-area">
        <div className="mobile-user-food-photo">
          {src && failed !== src ? (
            <img
              src={src}
              alt={food.name || "菜品"}
              loading="lazy"
              decoding="async"
              onError={() => {
                setFailed(src);
                renewImage(src);
              }}
            />
          ) : (
            <span className="mobile-user-photo-empty">
              <Icon name="image" size={28} />
              <span>暂无照片</span>
            </span>
          )}
        </div>
        <div className="mobile-user-food-title">
          <h3>
            <Link className="profile-food-link" to={`/foods/${food.id}`}>
              {food.name || "未命名菜品"}
            </Link>
          </h3>
          <ProfileFoodLike food={food} />
        </div>
        <div className="mobile-user-food-meta">
          <span>{food.restaurantName || "餐厅信息待补充"}</span>
          {food.price != null && <b>{money(food.price)}</b>}
        </div>
      </div>
      {(own || manage) && <FoodManage food={food} anyone />}
    </article>
  );
}

export function UserFoods({
  userId,
  heading,
  manage = false,
  onExitManage,
}: {
  userId: number;
  heading?: string;
  /** 管理员在别人主页打开「管理」后为 true：卡片上出现编辑/删除。 */
  manage?: boolean;
  /** 传了就在列表标题旁显示「管理中」徽章，点一下退出管理模式。 */
  onExitManage?: () => void;
}) {
  const compact = !!heading;
  const [toolsOpen, setToolsOpen] = useState(false);
  const filtersId = useId(),
    form = useRef<HTMLFormElement>(null);
  const { api, session } = useApp();
  const [page, setPage] = useState(1),
    [filters, setFilters] = useState(userFoodDefaults);
  const q = useQuery({
    queryKey: ["foods", "by-user", userId, filters, page],
    queryFn: () => api.userFoods(userId, page, filters),
    enabled: !!session,
    placeholderData: keepPreviousData,
  });
  if (!session)
    return <LoginLink to="/auth/password">登录后查看分享 →</LoginLink>;
  function toggleFilters(event: MouseEvent<HTMLButtonElement>) {
    const panel = form.current;
    if (!toolsOpen && panel && !panel.getAnimations().length) {
      const bounds = panel.parentElement!.getBoundingClientRect();
      const button = event.currentTarget.getBoundingClientRect();
      const x = event.detail ? event.clientX : button.left + button.width / 2;
      const y = event.detail ? event.clientY : button.top + button.height / 2;
      // The mobile shell can be zoomed. The clip uses local panel coordinates.
      const scale = panel.offsetWidth / bounds.width;
      const diameter = 8;
      const height = panel.offsetHeight;
      panel.style.transition = "none";
      panel.style.setProperty(
        "--filter-tap-x",
        `${((x - bounds.left) / bounds.width) * 100}%`,
      );
      panel.style.setProperty("--filter-tap-y", `${(y - bounds.top) * scale - diameter / 2}px`);
      panel.style.setProperty("--filter-seed-scale", String(diameter / height));
      // Establish the new point before the open transition reads its start pose.
      panel.getBoundingClientRect();
      panel.style.removeProperty("transition");
    }
    setToolsOpen((open) => !open);
  }

  const filterForm = (
    <form
      ref={form}
      id={filtersId}
      className={compact ? "mobile-user-filters" : "ew-v2-filter"}
      role="search"
      aria-label="筛选食友分享"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setFilters({
          keyword: String(data.get("keyword") || "").trim(),
          category: String(data.get("category") || ""),
          sort: String(data.get("sort")),
        });
        setPage(1);
      }}
    >
      {compact ? (
        <div className="mobile-user-search">
          <Icon name="search" size={20} />
          <input
            name="keyword"
            type="search"
            enterKeyHint="search"
            aria-label="搜索食友分享"
            placeholder="搜一道分享的菜"
            maxLength={64}
          />
          <button type="submit">搜索</button>
        </div>
      ) : (
        <input
          name="keyword"
          aria-label="搜索食友分享"
          placeholder="在分享中搜一道菜"
          maxLength={64}
        />
      )}
      <Select
        name="category"
        aria-label="分享分类"
        value={compact ? filters.category : undefined}
        onChange={
          compact
            ? (event) => {
                setFilters((current) => ({
                  ...current,
                  category: event.target.value,
                }));
                setPage(1);
              }
            : undefined
        }
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
      <Select
        name="sort"
        aria-label="分享排序"
        value={compact ? filters.sort : undefined}
        onChange={
          compact
            ? (event) => {
                setFilters((current) => ({
                  ...current,
                  sort: event.target.value,
                }));
                setPage(1);
              }
            : undefined
        }
      >
        <option value="NEWEST">最新分享</option>
        <option value="POPULAR">最多获赞</option>
        <option value="PRICE_ASC">价格从低到高</option>
        <option value="PRICE_DESC">价格从高到低</option>
      </Select>
      {!compact && <button className="ew-button">筛选</button>}
    </form>
  );
  return (
    <div
      className={`ew-feature ew-v2-foods${compact ? " mobile-user-foods" : ""}`}
    >
      {heading && (
        <header className="mobile-user-foods-heading">
          <h2>
            {heading}
            <span>{q.data?.totalItems ?? "—"}</span>
            {manage && onExitManage && (
              <button
                type="button"
                className="mobile-user-manage-badge"
                onClick={onExitManage}
                title="退出管理模式"
              >
                管理中
                <span aria-hidden="true">×</span>
              </button>
            )}
          </h2>
          <button
            type="button"
            aria-label="搜索和筛选分享"
            aria-expanded={toolsOpen}
            aria-controls={filtersId}
            onClick={toggleFilters}
          >
            <Icon name="search" size={20} />
            <span>筛选</span>
          </button>
        </header>
      )}
      {compact ? (
        <div
          className="mobile-user-filter-reveal"
          aria-hidden={!toolsOpen}
          inert={!toolsOpen}
        >
          <div className="mobile-user-filter-clip">{filterForm}</div>
        </div>
      ) : (
        filterForm
      )}
      {compact &&
        (filters.keyword || filters.category || filters.sort !== "NEWEST") && (
          <div className="mobile-user-applied-filters" role="status">
            <span>
              {[
                filters.keyword && `“${filters.keyword}”`,
                categories.find((c) => c.id === filters.category)?.label,
                (
                  {
                    NEWEST: "最新分享",
                    POPULAR: "最多获赞",
                    PRICE_ASC: "价格从低到高",
                    PRICE_DESC: "价格从高到低",
                  } as Record<string, string>
                )[filters.sort],
              ]
                .filter(Boolean)
                .join(" / ")}
            </span>
            <button
              type="button"
              onClick={() => {
                form.current?.reset();
                setFilters(userFoodDefaults);
                setPage(1);
              }}
            >
              重置
            </button>
          </div>
        )}
      {q.isPending || (q.isError && !q.data) ? (
        <FeatureState
          loading={q.isPending}
          error={q.error}
          kind="cards"
          retry={() => void q.refetch()}
        />
      ) : (
        <>
          <RequestError error={q.error} />
          {!compact && (
            <p className="ew-note" role="status">
              {q.isFetching
                ? "正在加载分享…"
                : `共 ${q.data?.totalItems ?? 0} 道菜`}
            </p>
          )}
          {!q.data?.items?.length ? (
            <FeatureState illustration="yuntun" empty="还没有符合条件的分享" />
          ) : (
            <div
              className={
                compact ? "mobile-user-food-grid" : "ew-results ew-v2-food-grid"
              }
              aria-busy={q.isFetching}
            >
              {q.data.items.map((f) =>
                compact ? (
                  <ProfileFoodCard key={f.id} food={f} manage={manage} />
                ) : (
                  <CatalogCard
                    key={f.id}
                    food={f}
                    actions={manage}
                    likeControl={<ProfileFoodLike food={f} />}
                  />
                ),
              )}
            </div>
          )}
          {(!compact ||
            page > 1 ||
            q.data?.hasNext ||
            (q.data?.totalPages ?? 0) > 1) && (
            <Pages
              page={page}
              next={!!q.data?.hasNext || page < (q.data?.totalPages ?? 0)}
              busy={q.isFetching}
              change={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
export function BlockControl({
  userId,
  onAction,
}: {
  userId: number;
  onAction?: () => void;
}) {
  const { api, user, session } = useApp(),
    m = useMobile(),
    cache = useQueryClient();
  const q = useQuery({
    queryKey: ["blocks", "status", userId],
    queryFn: () => api.blockStatus(userId),
    enabled: !!session && userId !== user?.id,
    retry: false,
  });
  if (!session || userId === user?.id) return null;
  return (
    <div className="ew-v2-block-control">
      <button
        type="button"
        className="ew-button light"
        disabled={
          q.isPending || q.isError || typeof q.data?.blocked !== "boolean"
        }
        onClick={() => {
          onAction?.();
          m.confirm(
            q.data?.blocked
              ? "解除屏蔽这位食友？"
              : "屏蔽后，推荐中将不再出现这位食友的分享。",
            async () => {
              const result = await api.setBlock(userId, !q.data?.blocked);
              cache.setQueryData(["blocks", "status", userId], result);
              await cache.invalidateQueries({ queryKey: ["blocks"] });
              await cache.invalidateQueries({ queryKey: ["foods"] });
            },
            q.data?.blocked ? "解除屏蔽" : "屏蔽食友",
          );
        }}
      >
        {q.isPending
          ? "正在读取…"
          : q.data?.blocked
            ? "已屏蔽 · 解除"
            : "屏蔽这位食友"}
      </button>
      <RequestError error={q.error} />
      {q.isError && (
        <button type="button" onClick={() => void q.refetch()}>
          重试读取
        </button>
      )}
    </div>
  );
}
function BlockedList() {
  const { api } = useApp(),
    cache = useQueryClient(),
    [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["blocks", "list", page],
    queryFn: () => api.blocks(page),
    retry: false,
  });
  const task = useTask("已解除屏蔽", undefined, ["blocks", "foods"]);
  return (
    <>
      <p className="ew-note">
        仅自己可见。屏蔽会影响推荐，不会删除历史与收藏。
      </p>
        {q.isPending ? (
          <FeatureState loading kind="rows" />
        ) : q.isError ? (
          <>
            <RequestError error={q.error} />
            <button
              className="ew-button light"
              onClick={() => void q.refetch()}
            >
              重新加载
            </button>
          </>
        ) : !q.data.items?.length ? (
          <FeatureState empty="目前没有屏蔽的食友" />
        ) : (
          q.data.items.map((u) => (
            <div className="ew-v2-row" key={u.userId}>
              <Link to={`/users/${u.userId}`}>
                {u.displayName || `食友 #${u.userId}`}
              </Link>
              <button
                className="ew-button light"
                disabled={task.isPending || !u.userId}
                onClick={() =>
                  task.run(async () => {
                    await api.setBlock(u.userId!, false);
                    if (q.data.items?.length === 1 && page > 1) {
                      cache.removeQueries({
                        queryKey: ["blocks", "list", page],
                      });
                      setPage(page - 1);
                    }
                  })
                }
              >
                解除屏蔽
              </button>
            </div>
          ))
        )}
        <RequestError error={task.error} />
        <Pages
          page={page}
          next={!!q.data?.hasNext || page < (q.data?.totalPages ?? 0)}
          busy={q.isFetching || task.isPending}
          change={setPage}
        />
      </>
  );
}
export function BlockedUsers() {
  return (
    <FeaturePage title="屏蔽名单" back="/settings/privacy">
      <div className="ew-v2-card">
        <BlockedList />
      </div>
    </FeaturePage>
  );
}
/** Blocklist opened in place from the privacy settings page. */
export function BlockedListDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="屏蔽名单" onClose={onClose} className="ew-blocked-dialog">
      <BlockedList />
    </Modal>
  );
}
export function ClearHistory({
  kind,
  onClear,
  disabled = false,
}: {
  kind: "food" | "restaurant";
  onClear: () => void;
  disabled?: boolean;
}) {
  const { api, toast } = useApp(),
    cache = useQueryClient(),
    m = useMobile();
  const [scope, setScope] = useState("current");
  return (
    <div className="ew-v2-clear">
      <Select
        aria-label="清空足迹范围"
        disabled={disabled}
        value={scope}
        onChange={(e) => setScope(e.target.value)}
      >
        <option value="current">当前分类</option>
        <option value="all">全部足迹</option>
      </Select>
      <button
        type="button"
        className="history-clear-button"
        disabled={disabled}
        onClick={() =>
          m.confirm(
            scope === "all"
              ? "清空所有菜品和店铺足迹？此操作无法恢复。"
              : "清空当前分类的浏览足迹？此操作无法恢复。",
            async () => {
              await api.clearHistory(scope === "all" ? undefined : kind);
              const filters = historyCacheFilters(
                scope === "all" ? undefined : kind,
              );
              await cache.cancelQueries(filters);
              cache.setQueriesData(filters, emptyHistoryCache);
              cache.removeQueries({ ...filters, type: "inactive" });
              onClear();
              await cache.invalidateQueries(filters);
              toast("足迹已清空");
            },
            "确认清空",
          )
        }
      >
        <Icon name="delete" size={16} />
        清空足迹
      </button>
    </div>
  );
}
export function UsernameSetup() {
  const { api, user, clearLocalSession, toast } = useApp(),
    qc = useQueryClient(),
    nav = useNavigate(),
    first = new URLSearchParams(useLocation().search).has("first"),
    getSignal = useSendSignal();
  const send = useTask("验证码已发送"),
    save = useTask();
  const [until, setUntil] = useState(0),
    [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () =>
      setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    if (!until) return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [until]);
  return (
    <FeaturePage title="设置登录名" back="/settings/account">
      <div className="ew-v2-card ew-v2-account">
        <h2>给账号设置一个登录名</h2>
        <p className="ew-note">
          登录名与展示昵称分开。设置后保持登录，下次可用手机验证码或新的登录名登录。
        </p>
        {user?.hasUsername !== false ? (
          <p>当前登录名：{user?.userName || "正在读取账号信息…"}</p>
        ) : !user.phone ? (
          <Link to="/settings/bind-phone">先绑定手机号 →</Link>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                d = new FormData(form);
              save.run(async () => {
                const requestSession = readSession();
                const newPassword = String(d.get("newPassword") || "");
                if (
                  (newPassword || d.get("confirm")) &&
                  (!newPassword.trim() || newPassword !== d.get("confirm"))
                )
                  throw new Error("请确认两次密码一致，且不是空白字符。");
                const result = await api.setUsername({
                  userName: String(d.get("userName")).trim(),
                  code: String(d.get("code")),
                  ...(!user.hasPassword && newPassword ? { newPassword } : {}),
                });
                if (!sameSession(requestSession, readSession())) return;
                form.reset();
                if (result.reauthenticationRequired === true) {
                  // Navigate while this guarded page is still mounted. Clearing
                  // the identity cache first can remove its router subscription.
                  nav("/auth/password", {
                    replace: true,
                    state: {
                      userName: result.userName,
                      reauthentication: true,
                    },
                  });
                  await clearLocalSession();
                } else {
                  // The write already succeeded. A subsequent read failure must
                  // not leave the first-time setup form available for resubmission.
                  qc.setQueryData(["me"], {
                    ...user,
                    userName: result.userName ?? user.userName,
                    hasUsername: true,
                    hasPassword: result.hasPassword ?? user.hasPassword,
                  });
                  void qc.invalidateQueries({ queryKey: ["me"] });
                  toast("登录名已设置，当前登录已保留。");
                  nav(first ? "/verify" : "/settings/account", {
                    replace: true,
                  });
                }
              });
            }}
          >
            <label>
              登录名
              <input
                name="userName"
                autoComplete="username"
                pattern="[A-Za-z0-9_]{3,10}"
                minLength={3}
                maxLength={10}
                required
              />
              <small>
                3–10 位字母、数字或下划线，区分大小写，不能是纯手机号。
              </small>
            </label>
            <label>
              手机验证码
              <div className="ew-code-row">
                <input
                  name="code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                />
                <button
                  type="button"
                  disabled={send.isPending || save.isPending || seconds > 0}
                  onClick={() =>
                    send.run(async () => {
                      await api.passwordCode(getSignal());
                      setUntil(Date.now() + 60000);
                    })
                  }
                >
                  {seconds ? `${seconds}s 后重发` : "获取验证码"}
                </button>
              </div>
            </label>
            {user.hasPassword === false && (
              <>
                <label>
                  初始密码（选填）
                  <input
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    maxLength={64}
                  />
                </label>
                <label>
                  确认初始密码
                  <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    maxLength={64}
                  />
                </label>
              </>
            )}
            <RequestError error={send.error || save.error} />
            <button
              className="ew-button"
              disabled={save.isPending || send.isPending}
            >
              {save.isPending ? "正在保存…" : "保存登录名"}
            </button>
          </form>
        )}
        <Link to={first ? "/verify" : "/settings/account"}>稍后设置</Link>
      </div>
    </FeaturePage>
  );
}
export function PasswordConflictReset() {
  const { api } = useApp(),
    loc = useLocation(),
    nav = useNavigate();
  const [token, setToken] = useState(
    () =>
      new URLSearchParams(loc.search).get("token") ||
      new URLSearchParams(window.location.search).get("token") ||
      "",
  );
  const [done, setDone] = useState(false),
    task = useTask();
  useEffect(() => {
    // Capture once, then remove the recovery token from both URL query locations.
    const outer = new URL(window.location.href);
    outer.searchParams.delete("token");
    const hash = outer.hash.split("?");
    const params = new URLSearchParams(hash[1]);
    params.delete("token");
    outer.hash = hash[0] + (params.size ? "?" + params : "");
    history.replaceState(history.state, "", outer.href);
    if (new URLSearchParams(loc.search).has("token")) {
      const p = new URLSearchParams(loc.search);
      p.delete("token");
      nav({ pathname: loc.pathname, search: p.toString() }, { replace: true });
    }
  }, []); // Token stays only in this mounted form.
  return (
    <FeaturePage
      title="恢复登录密码"
      back={"/auth/forgot" + authNext(loc.search)}
    >
      <div className="ew-v2-card ew-v2-account">
        {done ? (
          <>
            <h2>密码已重置</h2>
            <p>请使用新密码重新登录。</p>
            <Link
              className="ew-button"
              to={"/auth/password" + authNext(loc.search)}
            >
              返回登录
            </Link>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                d = new FormData(form);
              task.run(async () => {
                if (d.get("password") !== d.get("confirm"))
                  throw new Error("两次密码不一致。");
                await api.passwordConflictReset({
                  token: token.trim(),
                  newPassword: String(d.get("password")),
                });
                form.reset();
                setToken("");
                setDone(true);
              });
            }}
          >
            <h2>设置一个新密码</h2>
            <p className="ew-note">
              恢复令牌由邮件提供，通常 30 分钟有效，只能使用一次。
            </p>
            <label>
              恢复令牌
              <input
                aria-label="恢复令牌"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                maxLength={256}
                required
              />
            </label>
            <label>
              新密码
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </label>
            <label>
              确认新密码
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
              />
            </label>
            <RequestError error={task.error} />
            <button className="ew-button" disabled={task.isPending}>
              {task.isPending ? "正在重置…" : "重置密码"}
            </button>
          </form>
        )}
      </div>
    </FeaturePage>
  );
}
export function MobileUserProfile() {
  const { api, user, session } = useApp(),
    loc = useLocation(),
    id = parseId(loc.pathname.split("/").pop());
  const q = useQuery({
    queryKey: ["user", id],
    queryFn: () => api.otherUser(id!),
    enabled: !!id,
  });
  // Share the initial list's cache; searching never changes the profile's cover.
  const shares = useQuery({
    queryKey: ["foods", "by-user", id, userFoodDefaults, 1],
    queryFn: () => api.userFoods(id!, 1, userFoodDefaults),
    enabled: !!id && !!session,
  });
  const cover = shares.data?.items?.find((food) =>
    mediaUrl(food.pictureUrl?.[0]),
  );
  const visual = visualFor(cover ?? { stageColor: "soy" }, isDemo);
  const coverSrc = mediaUrl(cover?.pictureUrl?.[0]);
  const [failedCover, setFailedCover] = useState<string>();
  const renewImage = useFoodImageRefresh();
  const follow = useTask("关注状态已更新", undefined, ["user", "social"]);
  const back = useReturnTo("/me"),
    moreId = useId();
  const [manage, setManage] = useState(false);
  const self = user?.id === id,
    ready = !!id && !!q.data;
  // 「管理」是管理员的临时开关：默认关闭，离开页面即复位。
  const canManage = !self && user?.role === "admin";
  const following = q.data?.isFollowingHim === true,
    followsMe = q.data?.isFollowingMe === true;
  const name = q.data?.displayName || (ready ? "校园食友" : "食友主页");
  return (
    <div
      className="ew-feature design-screen profile-scroll-screen mobile-public-profile"
      style={
        {
          "--profile-stage": visual.stage,
          "--profile-on": visual.on,
          "--profile-ghost": visual.ghost,
        } as CSSProperties
      }
    >
      <header
        className="profile-collapse-toolbar mobile-user-header"
        aria-label={self ? "我的公开主页" : "食友主页"}
      >
        <Link to={back} aria-label="返回">
          <Icon name="back" size={24} />
        </Link>
        <ProfileToolbarIdentity name={name} avatar={q.data?.avatar} />
        <div className="mobile-user-header-actions">
          {ready &&
            (self ? (
              <ProfileEditLink
                className="mobile-user-follow"
                aria-label="编辑资料"
              >
                <Icon name="edit" size={18} />
                <span className="follow-label">编辑资料</span>
              </ProfileEditLink>
            ) : (
              <button
                className="mobile-user-follow"
                aria-pressed={following}
                aria-busy={follow.isPending}
                disabled={follow.isPending || q.data?.isFollowingHim == null}
                onClick={() => follow.run(() => api.follow(id!, following))}
              >
                <ReactionIcon kind="follow" size={18} />
                <span className="follow-label">
                  {follow.isPending ? "更新中…" : followLabel(q.data!)}
                </span>
              </button>
            ))}
          {ready && !self && (
            <button
              type="button"
              className="mobile-user-more-trigger"
              popoverTarget={moreId}
              aria-label="更多食友操作"
            >
              <Icon name="more" size={24} />
            </button>
          )}
        </div>
        {ready && !self && (
          <div id={moreId} popover="auto" className="mobile-user-more">
            {canManage && (
              <button
                type="button"
                className="mobile-user-manage"
                role="switch"
                aria-checked={manage}
                onClick={() => setManage(!manage)}
              >
                <span className="mobile-user-manage-text">
                  管理
                  <em>开启后可编辑、删除 TA 的菜品</em>
                </span>
                <span
                  className="mobile-user-switch"
                  data-on={manage ? "true" : undefined}
                  aria-hidden="true"
                >
                  <i />
                </span>
              </button>
            )}
            <BlockControl
              userId={id!}
              onAction={() => document.getElementById(moreId)?.hidePopover()}
            />
          </div>
        )}
      </header>
      <div className="mobile-user-stage" data-profile-stage>
        <div className="mobile-user-plate" aria-hidden="true">
          {coverSrc && failedCover !== coverSrc ? (
            <img
              src={coverSrc}
              alt=""
              onError={() => {
                setFailedCover(coverSrc);
                renewImage(coverSrc);
              }}
            />
          ) : (
            <Icon name="bowl" size={92} />
          )}
        </div>
        {ready ? (
          <section
            className="mobile-user-identity"
            aria-labelledby="mobile-user-name"
          >
            <UserAvatar
              className="mobile-user-avatar"
              avatar={q.data!.avatar}
              name={name}
            />
            <h1 id="mobile-user-name">
              {name}
              {q.data!.level != null && (
                <span className="user-level-badge">Lv.{q.data!.level}</span>
              )}
              <UserTitle title={userTitle(q.data!)} />
            </h1>
            <p className="mobile-user-caption">
              {self ? "我的公开主页" : followsMe ? "关注了你" : "校园食友"}
            </p>
            <div
              className="mobile-user-stats"
              role="group"
              aria-label="食友数据"
            >
              <div>
                <strong>{q.data!.earnedLikes ?? "—"}</strong>
                <span>获赞</span>
              </div>
              <div>
                <strong>{q.data!.uploadedFoodsCount ?? "—"}</strong>
                <span>上传的菜</span>
              </div>
              {(
                [
                  ["fans", "粉丝", q.data!.fansVisible, q.data!.fansCount],
                  [
                    "follow",
                    "关注",
                    q.data!.followingsVisible,
                    q.data!.followingsCount,
                  ],
                ] as const
              ).map(([tab, label, visible, count]) =>
                self || visible === true ? (
                  <Link
                    key={tab}
                    to={peopleHref(loc.pathname, loc.search, tab)}
                    state={{ profilePeopleFrom: loc.key }}
                    preventScrollReset
                  >
                    <strong>{count ?? "—"}</strong>
                    <span>{label}</span>
                  </Link>
                ) : (
                  <div key={tab}>
                    <strong className="is-private">未公开</strong>
                    <span>{label}</span>
                  </div>
                ),
              )}
            </div>
          </section>
        ) : (
          <div className="mobile-user-loading-title">食友主页</div>
        )}
      </div>
      <ProfileSheet className="mobile-user-sheet" label="食友分享">
        {!id ? (
          <FeatureState empty="食友编号无效" />
        ) : q.isPending || (q.isError && !q.data) ? (
          <FeatureState
            loading={q.isPending}
            error={q.error}
            retry={() => void q.refetch()}
          />
        ) : (
          <>
            <RequestError error={follow.error} />
            <RequestError error={q.error} />
            <UserFoods
              key={id}
              userId={id}
              heading="上传"
              manage={canManage && manage}
              onExitManage={canManage ? () => setManage(false) : undefined}
            />
          </>
        )}
      </ProfileSheet>
    </div>
  );
}
export function MobileHistory() {
  const back = useReturnTo("/me");
  return (
    <FeaturePage title="浏览足迹" back={back}>
      <div className="ew-v2-card">
        <p className="ew-note">浏览记录仅自己可见。</p>
        <MobileHistoryContent />
      </div>
    </FeaturePage>
  );
}

export function MobileHistoryContent() {
  const { api } = useApp();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [managing, setManaging] = useState(false);
  const kind = params.get("historyKind") === "restaurant" ? "restaurant" : "food";
  const page = parseId(params.get("page") ?? undefined) ?? 1;
  const q = useQuery({
    queryKey: ["history", "mobile-v2", kind, page],
    queryFn: () => api.history(kind, page),
    refetchOnMount: "always",
  });
  const hasNext = !!q.data?.hasNext || page < (q.data?.totalPages ?? 0);
  function select(nextKind: typeof kind, nextPage = 1) {
    const search = new URLSearchParams(params);
    if (nextKind === "food") search.delete("historyKind");
    else search.set("historyKind", nextKind);
    if (nextPage === 1) search.delete("page");
    else search.set("page", String(nextPage));
    setManaging(false);
    setParams(search, { replace: true, state: { ...location.state, preserveScroll: true } });
  }
  return (
    <div className="mobile-history-content">
      <div className="mobile-history-toolbar">
        <div className="mobile-history-kinds" role="group" aria-label="足迹分类">
          {(["food", "restaurant"] as const).map(k => (
            <button type="button" key={k} aria-pressed={kind === k} onClick={() => select(k)}>
              {k === "food" ? "菜品" : "店铺"}
            </button>
          ))}
        </div>
        {!!q.data?.items?.length && (
          <button type="button" aria-expanded={managing} onClick={() => setManaging(!managing)}>
            {managing ? "完成" : "管理足迹"}
          </button>
        )}
      </div>
      {managing && !!q.data?.items?.length && (
        <ClearHistory kind={kind} disabled={q.isFetching} onClear={() => select(kind)} />
      )}
      {q.isPending || q.isError ? (
        <FeatureState
          loading={q.isPending}
          error={q.error}
          kind="rows"
          retry={() => void q.refetch()}
        />
      ) : !q.data.items?.length ? (
        <FeatureState illustration="baozi" empty="还没有浏览足迹" />
      ) : (
        q.data.items.map((item, i) => {
          const entry = historyEntry(item, kind),
            date = historyTime(item.viewedAt);
          const body = (
            <>
              <b>{entry.content?.name || "内容暂不可用"}</b>
              <small>{date?.toLocaleDateString("zh-CN") || ""}</small>
            </>
          );
          return entry.href ? (
            <Link className="ew-v2-row" key={i} to={entry.href}>
              {body}
            </Link>
          ) : (
            <div className="ew-v2-row" key={i}>
              {body}
            </div>
          );
        })
      )}
      {(page > 1 || hasNext) && (
        <Pages page={page} next={hasNext} busy={q.isFetching} change={next => select(kind, next)} />
      )}
    </div>
  );
}
