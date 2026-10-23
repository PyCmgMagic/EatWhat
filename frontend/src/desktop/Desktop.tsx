import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useArea } from "../app/area";
import { isDemo } from "../app/runtime";
import { errorMessage } from "../api/client";
import {
  hasCoordinates,
  mediaUrl,
  money,
  parseId,
  type Food,
  type Restaurant,
} from "../api/models";
import { DesignIcon as Icon, Pending, useMobile } from "../mobile/ui";
import { visualFor } from "../mobile/catalog";
import "./desktop.css";
import { MotionRegion, SlidingTabs, useMotionInput } from "./motion";
import DesktopPublish from "./DesktopPublish";
import DesktopProfile from "./DesktopProfile";
import FoodDiscussion, { MyFoodComments } from "./FoodDiscussion";
import { myCommentEntries } from "../demo/comments";
import { DesktopTags, DesktopHistory } from "./DesktopLibrary";
import { DesktopAuth, DesktopSettingsPage } from "./DesktopAccount";
import {
  DesktopNotifications,
  DesktopUser,
  DesktopFollows,
  DesktopNewShop,
} from "./DesktopCommunity";
import {
  PendingPage,
  pendingPages,
  secondaryTitle,
  secondaryTitles,
} from "./secondary";

const categoryNames: Record<string, string> = {
  staple: "主食",
  snack: "小吃",
  drink: "饮品",
  dessert: "甜品",
  soup: "汤",
  hot_pot: "火锅",
  grill: "烧烤",
  cold_dish: "凉菜",
  side_dish: "配菜",
  other: "其他",
};
const categories = [
  { key: "", name: "今日推荐" },
  { key: "staple", name: "主食" },
  { key: "snack", name: "小吃" },
  { key: "drink", name: "饮品" },
  { key: "dessert", name: "甜品" },
];
const protectedScreens = new Set([
  "G2-Home",
  "G-HomePhoto",
  "G-Dish",
  "G-Detail",
  "G-TagDishes",
  "G-MyTags",
  "G-History",
]);
function useTask() {
  const cache = useQueryClient(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return {
    busy,
    error,
    run: async (fn: () => Promise<unknown>) => {
      if (busy) return;
      setBusy(true);
      setError("");
      try {
        await fn();
        await Promise.all(
          [
            "foods",
            "food-tags",
            "my-tags",
            "user",
            "social",
            "notifications",
          ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
        );
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
    },
  };
}
export default function DesktopExperience({
  enabled,
  screen,
  overlay,
  fitScale = 1,
  children,
}: {
  enabled: boolean;
  screen: string;
  overlay: boolean;
  fitScale?: number;
  children: ReactNode;
}) {
  const location = useLocation();
  useMotionInput(enabled);
  useEffect(() => {
    const label =
      secondaryTitle(location.pathname) ??
      (
        {
          "G2-Home": "发现",
          "G-HomePhoto": "发现",
          "G-Nearby": "附近",
          "G-Me": "我的",
          "G-Dish": "菜品详情",
          "G-Detail": "餐厅详情",
          "G-TagDishes": "我的收藏",
          "G-Search": "搜索",
          "G-Settings": "设置",
          "G-MyTags": "我的标签",
          "G-History": "足迹",
        } as Record<string, string>
      )[screen];
    if (enabled && label) document.title = label + " · 山软今天吃什么";
  }, [enabled, screen, location.pathname]);
  if (!enabled) return children;
  return (
    <div
      className={`pc-app ${fitScale < 1 ? "pc-design-preview" : ""}`}
      style={
        fitScale < 1
          ? ({
              width: 1280,
              zoom: fitScale,
              "--preview-scale": fitScale,
            } as CSSProperties)
          : undefined
      }
      inert={overlay || undefined}
    >
      <DesktopHeader />
      <main className="pc-main">
        <MotionRegion
          changeKey={
            location.pathname.startsWith("/publish")
              ? "/publish"
              : location.pathname
          }
          order={
            location.pathname === "/nearby"
              ? 1
              : location.pathname === "/me"
                ? 2
                : 0
          }
        >
          <DesktopRoute screen={screen}>{children}</DesktopRoute>
        </MotionRegion>
      </main>
      <DesktopFooter />
    </div>
  );
}
function DesktopHeader() {
  const { user, session, api } = useApp(),
    location = useLocation(),
    nav = useNavigate(),
    [search, setSearch] = useState("");
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.unread(),
    enabled: !!session,
    refetchInterval: 60_000,
  });
  const active =
    location.pathname === "/nearby" || location.pathname === "/restaurants"
      ? "nearby"
      : location.pathname.startsWith("/me") ||
          location.pathname.startsWith("/settings") ||
          location.pathname === "/favorites" ||
          location.pathname === "/history" ||
          location.pathname === "/notifications" ||
          location.pathname === "/verify" ||
          location.pathname === "/follows"
        ? "me"
        : "home";
  return (
    <header className="pc-header">
      <div className="pc-header-inner">
        <Link className="pc-brand" to="/" aria-label="山软今天吃什么，回到发现">
          <span className="pc-brand-symbol">
            <Icon name="bowl" size={29} />
          </span>
          <span>
            <b>
              山软<span>今天吃什么</span>
            </b>
            <small>好好吃饭，认真生活</small>
          </span>
        </Link>
        <SlidingTabs label="桌面主导航" active={active} navigation>
          {[
            { key: "home", path: "/", icon: "discover", name: "发现" },
            { key: "nearby", path: "/nearby", icon: "nearby", name: "附近" },
            { key: "me", path: "/me", icon: "me", name: "我的" },
          ].map((n) => (
            <Link
              key={n.key}
              to={n.path}
              aria-current={active === n.key ? "page" : undefined}
            >
              <Icon name={n.icon} size={20} />
              {n.name}
            </Link>
          ))}
        </SlidingTabs>
        <div className="pc-header-actions">
          <form
            className="pc-header-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              nav("/search?q=" + encodeURIComponent(search.trim()));
            }}
          >
            <Icon name="search" size={18} />
            <input
              aria-label="搜索店名"
              placeholder="找一家好吃的店"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button aria-label="开始搜索">
              <Icon name="chevronRight" size={16} />
            </button>
          </form>
          <Link
            className="pc-icon-button"
            to="/notifications"
            aria-label={`通知${unread.data ? `，${unread.data} 条未读` : ""}`}
          >
            <Icon name="bell" size={23} />
            {!!unread.data && <i />}
          </Link>
          <Link className="pc-button pc-publish-button" to="/publish">
            <Icon name="add" size={20} />
            发布一道菜
          </Link>
          <Link
            to={session ? "/me" : "/auth"}
            className="pc-user-avatar"
            aria-label={session ? "我的主页" : "登录"}
          >
            {user?.avatar && mediaUrl(user.avatar) ? (
              <img src={mediaUrl(user.avatar)} alt="" />
            ) : (
              (user?.userName?.slice(0, 1) ?? <Icon name="me" size={20} />)
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
function DesktopFooter() {
  return (
    <footer className="pc-footer">
      <span>
        山软今天吃什么 <span className="pc-footer-separator" />
        好好吃饭，认真生活
      </span>
      <div>
        {isDemo && (
          <>
            <span className="pc-demo-label">演示模式</span>
            <Link to="/design">设计画板</Link>
            <a href="/?demo=0">真实接口模式</a>
          </>
        )}
        <Link to="/settings/about">关于</Link>
        <Link to="/feedback">反馈</Link>
      </div>
    </footer>
  );
}
function DesktopRoute({
  screen,
  children,
}: {
  screen: string;
  children: ReactNode;
}) {
  const loc = useLocation();
  if (loc.pathname === "/auth" || loc.pathname.startsWith("/auth/"))
    return <DesktopAuth key={loc.pathname} />;
  if (loc.pathname === "/notifications")
    return (
      <DesktopGate verified={false}>
        <DesktopNotifications />
      </DesktopGate>
    );
  if (/^\/users\/\d+$/.test(loc.pathname))
    return (
      <DesktopGate verified={false}>
        <DesktopUser key={loc.pathname} />
      </DesktopGate>
    );
  if (loc.pathname === "/follows")
    return (
      <DesktopGate verified={false}>
        <DesktopFollows key={loc.search} />
      </DesktopGate>
    );
  if (
    loc.pathname === "/restaurants/new" ||
    loc.pathname === "/restaurants/new/details"
  )
    return (
      <DesktopGate verified>
        <DesktopNewShop />
      </DesktopGate>
    );
  if (
    secondaryTitles[loc.pathname] &&
    (loc.pathname.startsWith("/settings/") ||
      ["/verify", "/data-notice", "/feedback"].includes(loc.pathname))
  ) {
    const page = (
      <div data-pc-secondary="settings">
        <DesktopSettingsPage key={loc.pathname} />
      </div>
    );
    return ["/settings/about", "/data-notice", "/feedback"].includes(
      loc.pathname,
    ) ? (
      page
    ) : (
      <DesktopGate verified={false}>{page}</DesktopGate>
    );
  }
  if (pendingPages[loc.pathname])
    return (
      <div className="pc-secondary-standalone" data-pc-secondary="pending">
        <PendingPage path={loc.pathname} />
      </div>
    );
  if (loc.pathname === "/comments" || loc.pathname === "/comments/write")
    return <DiscussionRedirect />;
  if (loc.pathname === "/me/edit" || loc.pathname === "/me/details")
    return (
      <DesktopGate verified={false}>
        <DesktopProfile />
      </DesktopGate>
    );
  if (["G-PickShop", "G-AddDish", "G-Crop"].includes(screen))
    return (
      <DesktopGate verified>
        <DesktopPublish />
      </DesktopGate>
    );
  if (loc.pathname === "/admin")
    return (
      <DesktopSource screen={screen} auth={loc.pathname.startsWith("/auth/")}>
        {children}
      </DesktopSource>
    );
  let content: ReactNode;
  if (screen === "G2-Home" || screen === "G-HomePhoto")
    content = <DesktopHome />;
  else if (screen === "G-Nearby") content = <DesktopNearby />;
  else if (screen === "G-Search") content = <DesktopSearch />;
  else if (screen === "G-Me") content = <DesktopMe />;
  else if (screen === "G-Dish") content = <DesktopDish />;
  else if (screen === "G-Detail") content = <DesktopRestaurant />;
  else if (screen === "G-TagDishes") content = <DesktopFavorites />;
  else if (screen === "G-MyTags" || screen === "G-History")
    content = (
      <div className="pc-profile-layout">
        <ProfileRail />
        {screen === "G-MyTags" ? <DesktopTags /> : <DesktopHistory />}
      </div>
    );
  else if (screen === "G-Settings" && loc.pathname === "/settings")
    content = <DesktopSettings />;
  else {
    const auth = [
      "G-Login",
      "G-PasswordLogin",
      "G-PhoneLogin",
      "G-ForgotPassword",
      "G-RegisterConfirm",
      "G-Reconsent",
    ].includes(screen);
    return (
      <DesktopSource screen={screen} auth={auth}>
        {children}
      </DesktopSource>
    );
  }
  return (
    <DesktopGate verified={protectedScreens.has(screen)}>{content}</DesktopGate>
  );
}
function DiscussionRedirect() {
  const loc = useLocation(),
    m = useMobile();
  const id =
    parseId(new URLSearchParams(loc.search).get("foodId") ?? undefined) ??
    m.foodId;
  return (
    <Navigate
      replace
      to={`/foods/${id}?section=comments${loc.pathname.endsWith("/write") ? "&compose=1" : ""}`}
    />
  );
}
function DesktopSource({
  screen,
  auth = false,
  children,
}: {
  screen: string;
  auth?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`pc-source-page ${auth ? "pc-auth-layout" : ""}`}
      data-pc-screen={screen}
    >
      {auth && (
        <aside className="pc-auth-stage">
          <span className="pc-eyebrow">山软今天吃什么</span>
          <h1>
            同校的你，
            <br />
            一起好好吃饭。
          </h1>
          <p>
            发现一份好味道，
            <br />
            也分享你的私藏。
          </p>
          <img src="/prototype/assets/dishes/yuntun.svg" alt="一碗鲜虾云吞" />
        </aside>
      )}
      <div className="pc-source-content">{children}</div>
    </div>
  );
}
function DesktopGate({
  verified = true,
  children,
}: {
  verified?: boolean;
  children: ReactNode;
}) {
  const { session, user, me } = useApp(),
    loc = useLocation();
  if (!session)
    return (
      <Status
        icon="bowl"
        title="同校的你，一起好好吃饭"
        detail="登录后，发现喜欢的菜，整理自己的想吃清单。"
      >
        <Link
          className="pc-button"
          to={
            "/auth/password?next=" +
            encodeURIComponent(loc.pathname + loc.search)
          }
        >
          登录 / 注册
          <Icon name="chevronRight" size={18} />
        </Link>
      </Status>
    );
  if (me.isPending) return <Status title="正在端上这一份好味道" />;
  if (me.error)
    return (
      <Status title="暂时没能读取账号" detail={errorMessage(me.error)}>
        <button className="pc-button" onClick={() => void me.refetch()}>
          再试一次
        </button>
      </Status>
    );
  if (user?.banned)
    return (
      <Status
        title="账号暂时无法使用"
        detail={user.banReason ?? "请联系管理员了解账号状态。"}
      />
    );
  if (verified && user?.verified !== true)
    return (
      <Status
        icon="verify"
        title="先认识一下，同校的你"
        detail="完成学生认证后，就可以浏览菜品、收藏和发布。"
      >
        <Link className="pc-button" to="/verify">
          去认证
          <Icon name="chevronRight" size={18} />
        </Link>
      </Status>
    );
  return children;
}
function Status({
  title,
  detail,
  children,
  icon = "bowl",
}: {
  title: string;
  detail?: string;
  children?: ReactNode;
  icon?: string;
}) {
  return (
    <section className="pc-status">
      <div className="pc-status-icon">
        <Icon name={icon} size={36} />
      </div>
      <h1>{title}</h1>
      {detail && <p>{detail}</p>}
      {children}
    </section>
  );
}
function QueryStatus({
  query,
  empty,
  children,
}: {
  query: { isPending: boolean; error: unknown; refetch: () => unknown };
  empty?: boolean;
  children: ReactNode;
}) {
  if (query.isPending) return <Status title="正在找这一份好味道" />;
  if (query.error)
    return (
      <Status title="这一份内容暂时没端上来" detail={errorMessage(query.error)}>
        <button className="pc-button" onClick={() => void query.refetch()}>
          再试一次
        </button>
      </Status>
    );
  if (empty)
    return (
      <Status
        title="这里还没有内容"
        detail="去发现喜欢的菜，或者分享今天吃到的好味道。"
      >
        <Link to="/" className="pc-button">
          去发现
        </Link>
      </Status>
    );
  return children;
}
function Plate({
  food,
  className = "",
  style,
  hidden = false,
}: {
  food: Food;
  className?: string;
  style?: CSSProperties;
  hidden?: boolean;
}) {
  const visual = visualFor(food, isDemo),
    src = mediaUrl(food.pictureUrl?.[0]);
  return (
    <div
      className={`pc-plate ${visual.asset ? "is-illustration" : "is-photo"} ${className}`}
      style={style}
      aria-hidden={hidden || undefined}
    >
      {src ? (
        <img src={src} alt={food.name ?? "菜品"} />
      ) : (
        <Icon name="bowl" size={80} />
      )}
    </div>
  );
}
function DesktopHome() {
  const { api } = useApp(),
    m = useMobile(),
    { area } = useArea(),
    [n, setN] = useState(0),
    [category, setCategory] = useState(""),
    pointer = useRef<number | null>(null);
  const query = useQuery({
      queryKey: ["foods", "mobile-recommend"],
      queryFn: () => api.recommend(8),
    }),
    list = query.data ?? [],
    index = list.length ? ((n % list.length) + list.length) % list.length : 0,
    food = list[index],
    visual = food ? visualFor(food, isDemo) : null;
  const selection = category
    ? list.filter((f) => f.category === category)
    : isDemo
      ? [
          list[4],
          list[5],
          list[0],
          list[2],
          ...list.filter((_, i) => ![4, 5, 0, 2].includes(i)),
        ].filter(Boolean)
      : list;
  useEffect(() => {
    document.title = "发现 · 山软今天吃什么";
  }, []);
  if (!food || !visual)
    return (
      <QueryStatus query={query} empty={!query.isPending && !query.error}>
        <span />
      </QueryStatus>
    );
  return (
    <div className="pc-home">
      <section
        className="pc-hero"
        style={
          {
            "--stage": visual.stage,
            "--stage-on": visual.on,
            "--stage-ghost": visual.ghost,
          } as CSSProperties
        }
      >
        <div className="pc-round-table" />
        <div className="pc-orbit-line" />
        <button
          className="pc-location"
          onClick={() => m.openPanel("G-PanelPlace")}
        >
          <Icon name="nearby" size={18} />
          {area?.name ?? "选一个地点"}
          <span>{m.meal}</span>
          <Icon name="chevronDown" size={16} />
        </button>
        <div className="pc-hero-counter">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span>/ {String(list.length).padStart(2, "0")}</span>
        </div>
        <div className="pc-hero-copy">
          <span className="pc-eyebrow">今天这顿，就从这里开始</span>
          <h1 title={food.name ?? undefined}>
            {visual.l1}
            <br />
            {visual.l2}
          </h1>
          <Link
            to={`/restaurants/${food.restaurantId}`}
            className="pc-hero-shop"
          >
            {food.restaurantName}
            <Icon name="chevronRight" size={16} />
          </Link>
          {visual.dist && (
            <span className="pc-hero-distance">{visual.dist}</span>
          )}
          <div className="pc-hero-price">{money(food.price)}</div>
        </div>
        <div
          className="pc-hero-food"
          role="group"
          aria-label="推荐转盘，左右拖动换菜"
          tabIndex={0}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
              e.preventDefault();
              setN((i) => i + (e.key === "ArrowRight" ? 1 : -1));
            }
          }}
          onPointerDown={(e) => {
            pointer.current = e.clientX;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            const start = pointer.current;
            pointer.current = null;
            if (start !== null && Math.abs(e.clientX - start) > 30) {
              const direction = e.clientX < start ? 1 : -1;
              setN((i) => i + direction);
            }
          }}
          onPointerCancel={() => (pointer.current = null)}
        >
          {list.map((item, i) => (
            <Plate
              key={item.id}
              food={item}
              hidden={i !== index}
              className={
                i === index
                  ? "pc-current-plate"
                  : i === (index + 1) % list.length
                    ? "pc-next-plate"
                    : i === (index - 1 + list.length) % list.length
                      ? "pc-previous-plate"
                      : "pc-waiting-plate"
              }
            />
          ))}
        </div>
        <div className="pc-hero-actions">
          <button
            className="pc-hero-secondary"
            onClick={() => setN((i) => i + 1)}
          >
            <Icon name="shuffle" size={20} />
            换一个
          </button>
          <Link
            className="pc-hero-primary"
            to={`/foods/${food.id}`}
            onClick={() => {
              m.setFoodId(food.id!);
              if (food.restaurantId) m.setShopId(food.restaurantId);
            }}
          >
            就它了
            <Icon name="chevronRight" size={19} />
          </Link>
        </div>
        <div className="pc-hero-dots">
          {list.map((f, i) => (
            <button
              key={f.id}
              aria-label={`看第 ${i + 1} 道菜`}
              aria-pressed={i === index}
              onClick={() => setN(i)}
            />
          ))}
        </div>
        <span className="pc-drag-hint">
          <Icon name="shuffle" size={15} />
          左右拖动，换一道
        </span>
      </section>
      <section className="pc-discovery-sheet">
        <div className="pc-sheet-handle" />
        <div className="pc-section-toolbar">
          <SlidingTabs label="推荐分类" active={category}>
            {categories.map((c) => (
              <button
                key={c.key}
                role="tab"
                aria-selected={c.key === category}
                tabIndex={c.key === category ? 0 : -1}
                onClick={() => setCategory(c.key)}
              >
                {c.name}
              </button>
            ))}
          </SlidingTabs>
          <span className="pc-small-note">这一组好味道，慢慢挑。</span>
        </div>
        <MotionRegion
          changeKey={category}
          order={categories.findIndex((c) => c.key === category)}
          className="pc-category-content"
          reserveSpace
        >
          <div className="pc-food-grid">
            {selection.map((f) => (
              <FoodCard key={f.id} food={f} />
            ))}
          </div>
          {!selection.length && <Status title="这一组里，还没有这个口味" />}
        </MotionRegion>
      </section>
    </div>
  );
}
function FoodCard({ food }: { food: Food }) {
  const v = visualFor(food, isDemo),
    m = useMobile();
  return (
    <Link
      to={`/foods/${food.id}`}
      className="pc-food-card"
      onClick={() => m.setFoodId(food.id!)}
    >
      <div className="pc-food-card-image" style={{ background: v.tile }}>
        <Plate food={food} />
        <span className="pc-card-category">
          {categoryNames[food.category ?? "other"]}
        </span>
      </div>
      <div className="pc-food-card-title">
        <h3>{food.name}</h3>
        <span>{money(food.price)}</span>
      </div>
      <div className="pc-food-card-meta">
        <span>{food.restaurantName ?? "餐厅信息待补充"}</span>
        <span>
          <Icon name="heart" size={14} />
          {food.likesCount ?? "—"}
        </span>
      </div>
    </Link>
  );
}
function PageHeading({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children?: ReactNode;
}) {
  return (
    <div className="pc-page-heading">
      <div>
        {kicker && <span className="pc-eyebrow">{kicker}</span>}
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
function NextPage({
  hasNext,
  onNext,
  page,
  onPrevious,
}: {
  hasNext?: boolean | null;
  onNext: () => void;
  page: number;
  onPrevious: () => void;
}) {
  return hasNext || page > 1 ? (
    <div className="pc-pagination">
      {page > 1 && (
        <button className="pc-button light" onClick={onPrevious}>
          <Icon name="back" size={16} />
          上一页
        </button>
      )}
      <span>第 {page} 页</span>
      {hasNext && (
        <button className="pc-button light" onClick={onNext}>
          下一页
          <Icon name="chevronRight" size={16} />
        </button>
      )}
    </div>
  ) : null;
}

function DesktopNearby() {
  const { api } = useApp(),
    { area } = useArea(),
    m = useMobile(),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<number>();
  const query = useQuery({
      queryKey: ["restaurants", "desktop-nearby", area, q, page],
      queryFn: () =>
        api.restaurantSearch({
          gcjLng: area!.gcjLng,
          gcjLat: area!.gcjLat,
          hubId: area?.hubId,
          keyword: q || undefined,
          page,
          pageSize: 10,
        }),
      enabled: !!area,
    }),
    shops = query.data?.items ?? [],
    current = shops.find((s) => s.id === selected) ?? shops[0];
  return (
    <>
      <PageHeading title="好吃的，就在附近" kicker="从这一站，找到下一餐">
        <button
          className="pc-button light"
          onClick={() => m.openPanel("G-PanelPlace")}
        >
          <Icon name="nearby" size={18} />
          {area?.name ?? "选择区域"}
          <Icon name="chevronDown" size={16} />
        </button>
      </PageHeading>
      <div className="pc-nearby-layout">
        <section className="pc-nearby-list">
          <div className="pc-nearby-list-header">
            <h2>
              附近的店 <span>{query.data?.totalItems ?? "—"}</span>
            </h2>
            <div className="pc-search-field">
              <Icon name="search" size={20} />
              <input
                aria-label="附近搜店名"
                placeholder="搜一家店"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
              {q && (
                <button aria-label="清空搜索" onClick={() => setQ("")}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
            <span className="pc-small-note">按所选区域查询</span>
          </div>
          <div className="pc-nearby-list-scroll">
            {!area ? (
              <Status title="先选一个区域">
                <button
                  className="pc-button"
                  onClick={() => m.openPanel("G-PanelPlace")}
                >
                  选择地点
                </button>
              </Status>
            ) : (
              <QueryStatus query={query} empty={!shops.length}>
                {shops.map((shop) => (
                  <button
                    key={shop.id}
                    className="pc-shop-row"
                    aria-pressed={current?.id === shop.id}
                    onClick={() => setSelected(shop.id!)}
                  >
                    <div className="pc-shop-thumbnail">
                      {mediaUrl(shop.pictureUrl?.[0]) ? (
                        <img src={mediaUrl(shop.pictureUrl?.[0])} alt="" />
                      ) : (
                        <Icon name="store" size={28} />
                      )}
                    </div>
                    <span>
                      <strong>{shop.name}</strong>
                      <small>{shop.address ?? "地址待补充"}</small>
                    </span>
                    <Icon name="chevronRight" size={20} />
                  </button>
                ))}
                <NextPage
                  page={page}
                  hasNext={query.data?.hasNext}
                  onNext={() => setPage((p) => p + 1)}
                  onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                />
              </QueryStatus>
            )}
          </div>
        </section>
        <section className="pc-map" aria-label="附近餐厅示意图">
          <MapDrawing />
          {shops.slice(0, 7).map((shop, i) => (
            <button
              key={shop.id}
              className={`pc-map-pin ${shop.id === current?.id ? "selected" : ""}`}
              style={{
                left: [32, 69, 57, 23, 80, 44, 74][i] + "%",
                top: [36, 25, 58, 69, 75, 17, 48][i] + "%",
              }}
              aria-label={`在示意图选择${shop.name}`}
              onClick={() => setSelected(shop.id!)}
            >
              {mediaUrl(shop.pictureUrl?.[0]) ? (
                <img src={mediaUrl(shop.pictureUrl?.[0])} alt="" />
              ) : (
                <Icon name="store" size={26} />
              )}
              <span>{shop.name}</span>
            </button>
          ))}
          <span className="pc-map-legend">
            <Icon name="map" size={16} />
            示意地图 <Pending name="真实地图待接入" />
          </span>
          {current && (
            <div className="pc-map-selected">
              <div>
                <span className="pc-eyebrow">这一家，想去看看</span>
                <h2>{current.name}</h2>
                <p>{current.address ?? "地址待补充"}</p>
              </div>
              <Link
                className="pc-button"
                to={`/restaurants/${current.id}`}
                onClick={() => m.setShopId(current.id!)}
              >
                去这家店
                <Icon name="chevronRight" size={18} />
              </Link>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
function MapDrawing() {
  return (
    <svg
      className="pc-map-drawing"
      viewBox="0 0 900 760"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="900" height="760" fill="#ECE5D8" />
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => (
          <rect
            key={row + "-" + col}
            x={col * 194 - 70}
            y={row * 172 - 50}
            width="172"
            height="148"
            rx="12"
            fill={(row + col) % 5 === 0 ? "#D6E1BB" : "#E2D9C8"}
          />
        )),
      )}
      <g stroke="#fff" strokeWidth="17">
        <path d="M0 112H900M0 285H900M0 458H900M0 630H900M110 0V760M305 0V760M500 0V760M695 0V760M890 0V760" />
      </g>
      <g stroke="#F3C46E" strokeWidth="1.5" strokeDasharray="10 8">
        <path d="M0 285H900M500 0V760" />
      </g>
      <g fill="#9A8B80" fontSize="15" fontFamily="Noto Sans SC Variable">
        <text x="350" y="277">
          华中路
        </text>
        <text x="701" y="409" transform="rotate(-90 701 409)">
          学府路
        </text>
        <text x="130" y="90">
          街心公园
        </text>
        <text x="535" y="652">
          校园生活区
        </text>
      </g>
      <circle cx="170" cy="350" r="28" fill="#9DB8D955" />
      <circle
        cx="170"
        cy="350"
        r="8"
        fill="#4F7CDD"
        stroke="#fff"
        strokeWidth="3"
      />
    </svg>
  );
}
function DesktopSearch() {
  const { api } = useApp(),
    { area } = useArea(),
    m = useMobile(),
    loc = useLocation(),
    [q, setQ] = useState(new URLSearchParams(loc.search).get("q") ?? ""),
    [page, setPage] = useState(1);
  useEffect(() => {
    setQ(new URLSearchParams(loc.search).get("q") ?? "");
    setPage(1);
  }, [loc.search]);
  const query = useQuery({
    queryKey: ["restaurants", "desktop-search", area, q, page],
    queryFn: () =>
      api.restaurantSearch({
        gcjLng: area!.gcjLng,
        gcjLat: area!.gcjLat,
        hubId: area?.hubId,
        keyword: q || undefined,
        page,
        pageSize: 12,
      }),
    enabled: !!area,
  });
  return (
    <>
      <PageHeading title="找一家好吃的店" kicker="想吃的，也许就在下一个转角" />
      <div className="pc-search-panel">
        <div className="pc-search-field large">
          <Icon name="search" size={23} />
          <input
            aria-label="搜索餐厅"
            placeholder="输入店名"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          {q && (
            <button aria-label="清空搜索" onClick={() => setQ("")}>
              <Icon name="close" size={20} />
            </button>
          )}
        </div>
        <button
          className="pc-location light"
          onClick={() => m.openPanel("G-PanelPlace")}
        >
          <Icon name="nearby" size={17} />
          {area?.name ?? "选择区域"}
          <Icon name="chevronDown" size={15} />
        </button>
      </div>
      <div className="pc-result-heading">
        <h2>
          店 <span>{query.data?.totalItems ?? "—"}</span>
        </h2>
        <span>
          菜品全站搜索 <Pending />
        </span>
      </div>
      {!area ? (
        <Status title="先选一个区域">
          <button
            className="pc-button"
            onClick={() => m.openPanel("G-PanelPlace")}
          >
            选择地点
          </button>
        </Status>
      ) : (
        <QueryStatus query={query} empty={!query.data?.items?.length}>
          <div className="pc-restaurant-grid">
            {query.data?.items?.map((shop) => (
              <Link
                key={shop.id}
                className="pc-restaurant-card"
                to={`/restaurants/${shop.id}`}
              >
                <div className="pc-restaurant-card-photo">
                  {mediaUrl(shop.pictureUrl?.[0]) ? (
                    <img src={mediaUrl(shop.pictureUrl?.[0])} alt="" />
                  ) : (
                    <Icon name="store" size={48} />
                  )}
                </div>
                <div>
                  <h2>{shop.name}</h2>
                  <p>{shop.address ?? "地址待补充"}</p>
                  <span>
                    去这家店 <Icon name="chevronRight" size={17} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <NextPage
            page={page}
            hasNext={query.data?.hasNext}
            onNext={() => setPage((p) => p + 1)}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          />
        </QueryStatus>
      )}
    </>
  );
}

function DesktopDish() {
  const { api } = useApp(),
    m = useMobile(),
    loc = useLocation(),
    id = parseId(loc.pathname.split("/").pop()) ?? m.foodId,
    task = useTask();
  const query = useQuery({
      queryKey: ["foods", "detail", id],
      queryFn: () => api.food(id),
    }),
    food = query.data,
    v = food ? visualFor(food, isDemo) : null;
  const shop = useQuery({
    queryKey: ["restaurants", "detail", food?.restaurantId],
    queryFn: () => api.restaurant(food!.restaurantId!),
    enabled: !!food?.restaurantId,
  });
  const [image, setImage] = useState(0);
  useEffect(() => setImage(0), [id]);
  useEffect(() => m.setFoodId(id), [id]);
  return (
    <QueryStatus query={query}>
      {food && v && (
        <>
          <div className="pc-breadcrumb">
            <Link to="/">发现</Link>
            <Icon name="chevronRight" size={14} />
            <Link to={`/restaurants/${food.restaurantId}`}>
              {food.restaurantName}
            </Link>
            <Icon name="chevronRight" size={14} />
            <span>{food.name}</span>
          </div>
          <div className="pc-dish-layout">
            <section
              className="pc-dish-stage"
              style={
                { "--stage": v.stage, "--stage-on": v.on } as CSSProperties
              }
            >
              <div className="pc-dish-stage-table" />
              <div className="pc-dish-plate">
                <Plate
                  food={{
                    ...food,
                    pictureUrl: food.pictureUrl?.[image]
                      ? [food.pictureUrl[image]]
                      : food.pictureUrl,
                  }}
                />
              </div>
              <span className="pc-dish-stage-category">
                {categoryNames[food.category ?? "other"]}
              </span>
              <div className="pc-photo-thumbnails">
                {food.pictureUrl?.length! > 1 &&
                  food.pictureUrl?.map((src, i) => (
                    <button
                      key={src}
                      aria-label={`查看第 ${i + 1} 张照片`}
                      aria-pressed={i === image}
                      onClick={() => setImage(i)}
                    >
                      <img src={mediaUrl(src)} alt="" />
                    </button>
                  ))}
              </div>
            </section>
            <section className="pc-dish-info">
              <div className="pc-dish-heading">
                <span className="pc-eyebrow">
                  {categoryNames[food.category ?? "other"]}
                </span>
                <button
                  className="pc-icon-button"
                  aria-label={food.isFavorite ? "取消收藏" : "收藏"}
                  aria-pressed={food.isFavorite === true}
                  disabled={task.busy || food.isFavorite == null}
                  onClick={() =>
                    void task.run(() => api.favorite(id, food.isFavorite!))
                  }
                >
                  <Icon
                    name={food.isFavorite ? "bookmarkOn" : "bookmark"}
                    size={25}
                  />
                </button>
              </div>
              <h1>{food.name}</h1>
              <div className="pc-detail-price">{money(food.price)}</div>
              <Link
                className="pc-dish-shop"
                to={`/restaurants/${food.restaurantId}`}
                onClick={() => m.setShopId(food.restaurantId!)}
              >
                <span className="pc-detail-store-icon">
                  <Icon name="store" size={24} />
                </span>
                <span>
                  <b>{food.restaurantName}</b>
                  <small>{shop.data?.address ?? "地址待补充"}</small>
                </span>
                <Icon name="chevronRight" size={21} />
              </Link>
              <div className="pc-dish-actions">
                <button
                  className="pc-button light"
                  aria-pressed={food.isLiked === true}
                  disabled={task.busy || food.isLiked == null}
                  onClick={() =>
                    void task.run(() => api.like(id, food.isLiked!))
                  }
                >
                  <Icon name={food.isLiked ? "heartOn" : "heart"} size={21} />
                  {food.likesCount ?? "—"}
                </button>
                <Link
                  className="pc-button"
                  to={`/restaurants/${food.restaurantId}`}
                >
                  去这家店
                  <Icon name="navigate" size={18} />
                </Link>
              </div>
              <div className="pc-taste-section">
                <h2>大家怎么说</h2>
                <div className="pc-taste-cloud">
                  {food.systemTags?.map((tag, i) => (
                    <button
                      key={tag.id}
                      style={{
                        fontSize: [30, 24, 20, 17][Math.min(i, 3)],
                        fontWeight: i === 0 ? 900 : 600,
                      }}
                      onClick={() => {
                        m.setFoodId(id);
                        m.openPanel("G-PanelTag");
                      }}
                    >
                      {tag.name}
                      <sup>{tag.count ?? "—"}</sup>
                    </button>
                  ))}
                  <button
                    className="pc-dashed-button"
                    onClick={() => {
                      m.setFoodId(id);
                      m.openPanel("G-PanelTag");
                    }}
                  >
                    + 加标签
                  </button>
                </div>
              </div>
              <div className="pc-contributor">
                <Link to={`/users/${food.accountId}`}>
                  <span className="pc-user-avatar">
                    {food.uploaderName?.slice(0, 1) ?? "食"}
                  </span>
                  <b>{food.uploaderName ?? "同学"}</b>
                </Link>
                <span>分享了这道菜</span>
              </div>
              <p className="pc-dish-description">
                {food.description ?? "分享者还没有留下描述。"}
              </p>
              <div className="pc-detail-secondary">
                <Link to={`/foods/${id}?section=comments`}>
                  <Icon name="comment" size={15} /> 食友讨论
                </Link>
                <button onClick={() => m.openPanel("G-PanelReport")}>
                  举报 <Pending />
                </button>
              </div>
              {task.error && (
                <p className="pc-error" role="alert">
                  {task.error}
                </p>
              )}
            </section>
          </div>
          <FoodDiscussion key={id} food={{ ...food, id }} />
        </>
      )}
    </QueryStatus>
  );
}
function DesktopRestaurant() {
  const { api } = useApp(),
    m = useMobile(),
    loc = useLocation(),
    id = parseId(loc.pathname.split("/").pop()) ?? m.shopId,
    [page, setPage] = useState(1);
  const query = useQuery({
      queryKey: ["restaurants", "detail", id],
      queryFn: () => api.restaurant(id),
    }),
    foods = useQuery({
      queryKey: ["foods", "restaurant", id, page],
      queryFn: () => api.foods(id, page),
    }),
    shop = query.data;
  return (
    <QueryStatus query={query}>
      {shop && (
        <>
          <div className="pc-breadcrumb">
            <Link to="/nearby">附近</Link>
            <Icon name="chevronRight" size={14} />
            <span>{shop.name}</span>
          </div>
          <section className="pc-restaurant-hero">
            <div>
              <span className="pc-eyebrow">好味道，也值得被分享</span>
              <h1>{shop.name}</h1>
              <p>
                <Icon name="nearby" size={18} />
                {shop.address ?? "地址待补充"}
              </p>
              <div className="pc-restaurant-stats">
                <strong>{foods.data?.totalItems ?? "—"}</strong>
                <span>道菜</span>
                <span>
                  评分 <Pending />
                </span>
              </div>
              <div className="pc-restaurant-actions">
                <button
                  className="pc-button"
                  onClick={() => {
                    m.setShopId(id);
                    m.go("G-AddDish");
                  }}
                >
                  <Icon name="add" size={21} />
                  加一道菜
                </button>
                <button
                  className="pc-button light"
                  onClick={() =>
                    hasCoordinates(shop)
                      ? window.open(
                          `https://uri.amap.com/marker?position=${shop.gcjLng},${shop.gcjLat}&name=${encodeURIComponent(shop.name ?? "餐厅")}&coordinate=gaode`,
                          "_blank",
                          "noopener,noreferrer",
                        )
                      : m.notice("这家店还没有可用的位置。")
                  }
                >
                  <Icon name="navigate" size={20} />
                  导航去店里
                </button>
              </div>
            </div>
            <div className="pc-restaurant-hero-plate">
              {foods.data?.items?.[0] ? (
                <Plate food={foods.data.items[0]} />
              ) : mediaUrl(shop.pictureUrl?.[0]) ? (
                <img src={mediaUrl(shop.pictureUrl?.[0])} alt="" />
              ) : (
                <Icon name="store" size={140} />
              )}
            </div>
          </section>
          <section className="pc-content-sheet">
            <div className="pc-sheet-handle" />
            <div className="pc-section-toolbar">
              <h2>这家店的好味道</h2>
              <Link
                to="/restaurants/correction"
                onClick={() => m.setShopId(id)}
              >
                信息有误 <Pending />
              </Link>
            </div>
            <QueryStatus query={foods} empty={!foods.data?.items?.length}>
              <div className="pc-food-grid">
                {foods.data?.items?.map((food) => (
                  <FoodCard key={food.id} food={food} />
                ))}
              </div>
              <NextPage
                page={page}
                hasNext={foods.data?.hasNext}
                onNext={() => setPage((p) => p + 1)}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              />
            </QueryStatus>
          </section>
        </>
      )}
    </QueryStatus>
  );
}

function ProfileRail() {
  const loc = useLocation();
  const { user, api } = useApp(),
    stats = useQuery({
      queryKey: ["user", user?.id],
      queryFn: () => api.otherUser(user!.id!),
      enabled: !!user?.id,
    });
  return (
    <aside className="pc-profile-rail">
      <div className="pc-profile-card">
        <img
          className="pc-profile-decoration"
          src="/prototype/assets/dishes/yangzhi.svg"
          alt=""
        />
        <div className="pc-profile-avatar">
          {user?.avatar && mediaUrl(user.avatar) ? (
            <img src={mediaUrl(user.avatar)} alt="" />
          ) : (
            (user?.userName?.slice(0, 1) ?? "食")
          )}
        </div>
        <h1>{user?.userName ?? "同学"}</h1>
        <p>{user?.signature ?? "认真吃饭，认真生活。"}</p>
        <div className="pc-profile-stats">
          <span>
            <b>{stats.data?.earnedLikes ?? "—"}</b>获赞
          </span>
          <span>
            <b>{stats.data?.uploadedFoodsCount ?? "—"}</b>上传的菜
          </span>
          <Link to="/follows?tab=fans">
            <b>{stats.data?.fansCount ?? "—"}</b>粉丝
          </Link>
          <Link to="/follows?tab=follow">
            <b>{stats.data?.followingsCount ?? "—"}</b>关注
          </Link>
        </div>
        <Link className="pc-button" to="/me/edit">
          <Icon name="edit" size={17} />
          编辑资料
        </Link>
      </div>
      <nav className="pc-profile-menu" aria-label="个人中心">
        {[
          { to: "/me", name: "我的分享", icon: "bowl" },
          { to: "/favorites", name: "我的收藏", icon: "bookmark" },
          { to: "/me/tags", name: "我的标签", icon: "tag" },
          { to: "/history", name: "足迹", icon: "history" },
          { to: "/settings", name: "设置", icon: "settings" },
        ].map((n) => (
          <Link
            key={n.to}
            to={n.to}
            aria-current={loc.pathname === n.to ? "page" : undefined}
          >
            <Icon name={n.icon} size={20} />
            {n.name}
            <Icon name="chevronRight" size={17} />
          </Link>
        ))}
      </nav>
    </aside>
  );
}
function DesktopMe() {
  const { api, user } = useApp(),
    cache = useQueryClient(),
    loc = useLocation(),
    [tab, setTab] = useState(() => {
      const tab = new URLSearchParams(loc.search).get("tab");
      return tab === "comments" || tab === "favorites" ? tab : "uploads";
    }),
    [page, setPage] = useState(1),
    myComments = useQuery({
      queryKey: ["demo-my-comments", user?.id],
      queryFn: () => myCommentEntries(user!.id!),
      enabled: isDemo && !!user?.id,
    }),
    query = useQuery({
      queryKey: ["foods", tab === "uploads" ? "mine" : "favorites", page],
      queryFn: () =>
        tab === "uploads" ? api.myFoods(page) : api.favorites(page),
      enabled: user?.verified === true && tab !== "comments",
      placeholderData: keepPreviousData,
    });
  useEffect(() => {
    const selected = new URLSearchParams(loc.search).get("tab");
    if (
      selected === "comments" ||
      selected === "favorites" ||
      selected === "uploads"
    )
      setTab(selected);
  }, [loc.search]);
  return (
    <div className="pc-profile-layout">
      <ProfileRail />
      <section className="pc-profile-content">
        <div className="pc-section-toolbar">
          <SlidingTabs label="我的内容" active={tab}>
            <button
              role="tab"
              aria-selected={tab === "uploads"}
              tabIndex={tab === "uploads" ? 0 : -1}
              onClick={() => {
                setTab("uploads");
                setPage(1);
              }}
            >
              上传{" "}
              <span className="pc-tab-count">
                {(tab === "uploads" && !query.isPlaceholderData
                  ? query.data?.totalItems
                  : cache.getQueryData<{ totalItems?: number }>([
                      "foods",
                      "mine",
                      1,
                    ])?.totalItems) ?? "—"}
              </span>
            </button>
            <button
              role="tab"
              aria-selected={tab === "favorites"}
              tabIndex={tab === "favorites" ? 0 : -1}
              onClick={() => {
                setTab("favorites");
                setPage(1);
              }}
            >
              收藏{" "}
              <span className="pc-tab-count">
                {(tab === "favorites" && !query.isPlaceholderData
                  ? query.data?.totalItems
                  : cache.getQueryData<{ totalItems?: number }>([
                      "foods",
                      "favorites",
                      1,
                    ])?.totalItems) ?? "—"}
              </span>
            </button>
            <button
              role="tab"
              aria-selected={tab === "comments"}
              tabIndex={tab === "comments" ? 0 : -1}
              onClick={() => {
                setTab("comments");
                setPage(1);
              }}
            >
              评论{" "}
              <span className="pc-tab-count">
                {isDemo ? (myComments.data?.length ?? 0) : "—"}
              </span>
            </button>
          </SlidingTabs>
          <Link to="/publish" className="pc-small-link">
            <Icon name="add" size={17} />
            分享一道菜
          </Link>
        </div>
        {tab !== "comments" && query.isPlaceholderData && (
          <p className="pc-tab-loading" role="status">
            正在切换内容…
          </p>
        )}
        <MotionRegion
          changeKey={
            tab === "comments"
              ? `comments:${myComments.dataUpdatedAt}`
              : query.isPlaceholderData
                ? undefined
                : `${tab}:${page}:${query.dataUpdatedAt}`
          }
          order={tab === "uploads" ? 0 : tab === "favorites" ? 1 : 2}
          aria-busy={tab !== "comments" && query.isPlaceholderData}
          className="pc-profile-tab-content"
          reserveSpace
        >
          {user?.verified !== true ? (
            <Status
              title="认证后，收集你的好味道"
              detail="完成学生认证，就可以浏览、收藏和分享菜品。"
            >
              <Link className="pc-button" to="/verify">
                去认证
              </Link>
            </Status>
          ) : tab === "comments" ? (
            <MyFoodComments entries={myComments.data ?? []} />
          ) : (
            <QueryStatus query={query} empty={!query.data?.items?.length}>
              <div className="pc-food-grid three">
                {query.data?.items?.map((f) => (
                  <FoodCard key={f.id} food={f} />
                ))}
              </div>
              <NextPage
                page={page}
                hasNext={query.data?.hasNext}
                onNext={() => setPage((p) => p + 1)}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              />
            </QueryStatus>
          )}
        </MotionRegion>
      </section>
    </div>
  );
}
function DesktopFavorites() {
  const { api } = useApp(),
    m = useMobile(),
    [page, setPage] = useState(1),
    query = useQuery({
      queryKey: ["foods", "favorites", page],
      queryFn: () => api.favorites(page),
    }),
    tags = useQuery({ queryKey: ["my-tags", 1], queryFn: () => api.myTags(1) }),
    items = (query.data?.items ?? []).filter(
      (f) => !m.tagId || f.myCustomTags?.some((t) => t.id === m.tagId),
    );
  return (
    <div className="pc-profile-layout">
      <ProfileRail />
      <section className="pc-profile-content">
        <PageHeading title="喜欢的，慢慢吃" kicker="我的收藏" />
        <div className="pc-category-pills">
          <button aria-pressed={!m.tagId} onClick={() => m.setTagId(undefined)}>
            全部收藏
          </button>
          {tags.data?.items?.map((t) => (
            <button
              key={t.id}
              aria-pressed={m.tagId === t.id}
              onClick={() => m.setTagId(t.id!)}
            >
              {t.name}
            </button>
          ))}
          <Link to="/me/tags">
            <Icon name="edit" size={16} />
            管理标签
          </Link>
        </div>
        <p className="pc-small-note">
          分类筛选当前页收藏 <Pending name="全量分类待接入" />
        </p>
        <QueryStatus query={query} empty={!items.length}>
          <div className="pc-food-grid three">
            {items.map((f) => (
              <FoodCard key={f.id} food={f} />
            ))}
          </div>
          <NextPage
            page={page}
            hasNext={query.data?.hasNext}
            onNext={() => setPage((p) => p + 1)}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          />
        </QueryStatus>
      </section>
    </div>
  );
}
function DesktopSettings() {
  const { user, signOut } = useApp(),
    nav = useNavigate(),
    dialog = useRef<HTMLDialogElement>(null),
    task = useTask();
  const groups = [
    {
      title: "账号与安全",
      icon: "shield",
      items: [
        ["账号与安全", "登录方式、认证与密码", "/settings/account"],
        ["修改密码", "用新的密码保护账号", "/settings/password"],
        [
          "学生认证",
          user?.verified ? "已经是认证同学" : "完成认证，发现更多好味道",
          "/verify",
        ],
      ],
    },
    {
      title: "偏好与隐私",
      icon: "lock",
      items: [
        ["隐私", "决定别人能看到什么", "/settings/privacy"],
        ["通知", "管理互动提醒", "/settings/notifications"],
        ["屏蔽的人", "屏蔽管理待接入", "/settings/blocked"],
      ],
    },
    {
      title: "关于这个小天地",
      icon: "bowl",
      items: [
        ["关于", "认识山软今天吃什么", "/settings/about"],
        ["意见反馈", "说说你的想法", "/feedback"],
        ["数据存放说明", "了解账号与数据", "/data-notice"],
      ],
    },
  ];
  return (
    <>
      <PageHeading title="按你的习惯，慢慢来" kicker="设置">
        <Link className="pc-button light" to="/me">
          <Icon name="back" size={18} />
          回到我的
        </Link>
      </PageHeading>
      <div className="pc-settings-grid">
        {groups.map((g) => (
          <section key={g.title} className="pc-settings-group">
            <div className="pc-settings-group-title">
              <Icon name={g.icon} size={24} />
              <h2>{g.title}</h2>
            </div>
            {g.items.map(([title, detail, path]) => (
              <Link key={path} to={path}>
                <span>
                  <b>{title}</b>
                  <small>{detail}</small>
                </span>
                <Icon name="chevronRight" size={19} />
              </Link>
            ))}
          </section>
        ))}
      </div>
      <div className="pc-settings-bottom">
        <span>吃饱了，也可以随时回来。</span>
        <button
          className="pc-button light"
          onClick={() => dialog.current?.showModal()}
        >
          <Icon name="logout" size={18} />
          退出登录
        </button>
      </div>
      <dialog
        ref={dialog}
        className="pc-confirm-dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <h2>这次先吃到这里？</h2>
        <p>退出后，重新登录就能找回你的收藏和分享。</p>
        {task.error && <p className="pc-error">{task.error}</p>}
        <div>
          <button
            className="pc-button light"
            onClick={() => dialog.current?.close()}
          >
            再待一会儿
          </button>
          <button
            className="pc-button"
            disabled={task.busy}
            onClick={() =>
              void task.run(async () => {
                await signOut();
                nav("/auth");
              })
            }
          >
            退出登录
          </button>
        </div>
      </dialog>
    </>
  );
}
