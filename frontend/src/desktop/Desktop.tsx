import { foodAuthor } from "../api/models";
import ProfileRail from "./ProfileRail";
import ProfileOverview from "../features/ProfileOverview";
import ProfileHelp from "../features/ProfileHelp";
import { ProfileSectionNav } from "../features/ProfileSectionNav";
import { unreadCount } from "../api/notifications";
import {
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { NotFound, useReturnTo } from "../app/navigation";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useApp } from "../app/state";
import { LoginLink } from "../app/auth-dialog";
import { useDebouncedSearch } from "../app/search";
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
import "./profile-workspace.css";
import "./profile-shell.css";
import {
  ProfileWorkspaceContext,
  ProfileNavigationGuardContext,
  type ProfileNavigationGuard,
  profileSection,
  profileSections,
  type ProfileSection,
} from "../app/profile-workspace";
import { MotionRegion, SlidingTabs } from "./motion";
import { useContentMotion } from "../motion/hooks";
import { instantMotion } from "../motion/runtime";
import {
  dragHeroOrbit,
  heroOrbitSlots,
  heroOrbitStep,
  heroPlateTransform,
  nearestHeroPosition,
} from "./hero-orbit";
import { isV4Path } from "../features/v4-paths";
import {
  FeatureAvailability,
  useRemoteConfig,
  recommendationBatchSize,
} from "../features/v4/Remote";
const V4Routes = lazy(() => import("../features/v4/Routes"));
const ApiV2Routes = lazy(() => import("../features/ApiV2Routes"));
const DesktopPublish = lazy(() => import("./DesktopPublish"));
const DesktopProfile = lazy(() => import("./DesktopProfile"));
const RestaurantActions = lazy(() =>
  import("../features/v4/Community").then((m) => ({
    default: m.RestaurantActions,
  })),
);
const FoodExtras = lazy(() =>
  import("../features/v4/DetailExtras").then((m) => ({
    default: m.FoodExtras,
  })),
);
const FoodDiscussion = lazy(() => import("./FoodDiscussion"));
const MyFoodComments = lazy(() =>
  import("./FoodDiscussion").then((m) => ({ default: m.MyFoodComments })),
);
const DesktopTags = lazy(() =>
  import("./DesktopLibrary").then((m) => ({ default: m.DesktopTags })),
);
const DesktopHistory = lazy(() =>
  import("./DesktopLibrary").then((m) => ({ default: m.DesktopHistory })),
);
import { Catalog, FoodManage } from "../features/Catalog";
import { RecommendationControls, Preferences } from "../features/Account";
import { EditFood } from "../features/EditFood";
import { useActionAccess } from "../features/access";
import { guestDeviceId, mealCode } from "../api/food-display";
import { useFoodImageRefresh } from "../features/media";
import RestaurantMap from "../features/RestaurantMap";
import { baiduMarkerUrl } from "../features/map-geometry";
const DesktopAuth = lazy(() =>
  import("./DesktopAccount").then((m) => ({ default: m.DesktopAuth })),
);
const DesktopSettingsPage = lazy(() =>
  import("./DesktopAccount").then((m) => ({ default: m.DesktopSettingsPage })),
);
const SettingsHome = lazy(() => import("../features/SettingsHome"));
const DesktopNotifications = lazy(() =>
  import("./DesktopCommunity").then((m) => ({
    default: m.DesktopNotifications,
  })),
);
const DesktopUser = lazy(() =>
  import("./DesktopCommunity").then((m) => ({ default: m.DesktopUser })),
);
const DesktopNewShop = lazy(() =>
  import("./DesktopCommunity").then((m) => ({ default: m.DesktopNewShop })),
);
import { peopleHref } from "../features/profile-people";
import { AccessWelcome } from "../components/AccessWelcome";
import {
  ContentSkeleton,
  PageSkeleton,
  Skeleton,
  type PageSkeletonKind,
} from "../components/LoadingSkeleton";
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
const protectedScreens = new Set(["G-MyTags"]);
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
  children,
}: {
  enabled: boolean;
  screen: string;
  overlay: boolean;
  children: ReactNode;
}) {
  const location = useLocation();
  const { session } = useApp();
  const workspace = !!session && profileSection(location.pathname) !== null;
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
          "G-History": "浏览足迹",
        } as Record<string, string>
      )[screen];
    if (isV4Path(location.pathname)) return;
    if (enabled && label) document.title = label + " · 山软今天吃什么";
  }, [enabled, screen, location.pathname]);
  if (!enabled) return children;
  return (
    <div className="pc-app" inert={overlay || undefined}>
      <DesktopHeader />
      <main className="pc-main">
        <MotionRegion
          // Reapply inheritance after a modal closes; lazy subtrees can retain
          // Chromium's computed inert state even after the attribute is removed.
          style={
            { interactivity: overlay ? undefined : "inherit" } as CSSProperties
          }
          changeKey={
            workspace
              ? "profile-workspace"
              : location.pathname.startsWith("/publish")
                ? "/publish"
                : location.pathname
          }
          order={location.pathname === "/nearby" ? 1 : workspace ? 2 : 0}
        >
          <Suspense fallback={<ContentSkeleton kind="form" count={3} />}>
            <DesktopRoute screen={screen}>{children}</DesktopRoute>
          </Suspense>
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
    queryFn: () => unreadCount(api),
    enabled: !!session,
    refetchInterval: 60_000,
  });
  const active =
    location.pathname === "/nearby" ||
    location.pathname === "/restaurants" ||
    location.pathname === "/restaurants/directory"
      ? "nearby"
      : profileSection(location.pathname) !== null ||
          location.pathname.startsWith("/me") ||
          location.pathname.startsWith("/settings") ||
          location.pathname === "/favorites" ||
          location.pathname === "/history" ||
          location.pathname === "/notifications" ||
          location.pathname === "/features" ||
          location.pathname === "/submissions" ||
          location.pathname.startsWith("/submissions/") ||
          location.pathname === "/feedback/mine" ||
          location.pathname.startsWith("/feedback/mine/") ||
          location.pathname === "/restaurants/favorites" ||
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
              aria-label="搜索菜品或店名"
              placeholder="搜菜品或店名"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button aria-label="开始搜索">
              <Icon name="chevronRight" size={16} />
            </button>
          </form>
          <Link
            className="pc-compact-search pc-icon-button"
            to="/search"
            aria-label="搜索菜品或店名"
          >
            <Icon name="search" size={21} />
          </Link>
          <Link
            className="pc-icon-button"
            to="/notifications"
            aria-label={`通知${unread.data ? `，${unread.data} 条未读` : ""}`}
          >
            <Icon name="bell" size={23} />
            {!!unread.data && <i />}
          </Link>
          <Link
            className="pc-button pc-publish-button"
            to="/publish"
            aria-label="发布一道菜"
          >
            <Icon name="add" size={20} />
            <span>发布一道菜</span>
          </Link>
          <LoginLink
            to={session ? "/me" : "/auth"}
            className="pc-user-avatar"
            aria-label={session ? "我的主页" : "登录"}
          >
            {user?.avatar && mediaUrl(user.avatar) ? (
              <img src={mediaUrl(user.avatar)} alt="" />
            ) : (
              (user?.displayName?.slice(0, 1) ?? <Icon name="me" size={20} />)
            )}
          </LoginLink>
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
  const { session } = useApp();
  const location = useLocation();
  const section = profileSection(location.pathname);
  const page = <DesktopPage screen={screen}>{children}</DesktopPage>;
  return session && section ? (
    <ProfileWorkspace section={section}>{page}</ProfileWorkspace>
  ) : (
    page
  );
}

function ProfileWorkspace({
  section,
  children,
}: {
  section: ProfileSection;
  children: ReactNode;
}) {
  const location = useLocation();
  const content = useRef<HTMLDivElement>(null);
  const navigationGuard = useRef<ProfileNavigationGuard | null>(null);
  return (
    <ProfileWorkspaceContext.Provider value>
      <ProfileNavigationGuardContext.Provider value={navigationGuard}>
        <div className="pc-profile-layout pc-profile-workspace">
          <ProfileRail
            activeSection={section}
            allowNavigate={(destination) =>
              destination === location.pathname + location.search ||
              (navigationGuard.current?.(destination) ?? true)
            }
          />
          <div
            ref={content}
            id="profile-workspace-panel"
            className="pc-profile-workspace-content"
            role="region"
            aria-label="个人中心内容"
            tabIndex={-1}
          >
            <MotionRegion
              changeKey={location.pathname}
              order={profileSections.findIndex((item) => item.to === section)}
            >
              <Suspense fallback={<ContentSkeleton kind="form" count={3} />}>
                {children}
              </Suspense>
            </MotionRegion>
          </div>
        </div>
      </ProfileNavigationGuardContext.Provider>
    </ProfileWorkspaceContext.Provider>
  );
}

function DesktopPage({
  screen,
  children,
}: {
  screen: string;
  children: ReactNode;
}) {
  const loc = useLocation();
  if (loc.pathname === "/me/shares")
    return (
      <DesktopGate verified={false}>
        <DesktopShares />
      </DesktopGate>
    );
  if (loc.pathname === "/help") return <ProfileHelp />;
  if (isV4Path(loc.pathname)) return <V4Routes key={loc.pathname} />;
  if (/^\/foods\/\d+\/edit$/.test(loc.pathname)) return <EditFood />;
  if (
    [
      "/settings/username",
      "/settings/blocked",
      "/auth/password-conflict/reset",
    ].includes(loc.pathname)
  )
    return <ApiV2Routes key={loc.pathname} />;
  if (loc.pathname === "/settings/preferences") return <Preferences />;
  if (loc.pathname === "/search") return <Catalog />;
  if (loc.pathname === "/favorites")
    return (
      <DesktopGate verified={false}>
        <Catalog favorites />
      </DesktopGate>
    );
  if (loc.pathname === "/auth" || loc.pathname.startsWith("/auth/"))
    return [
      "/auth",
      "/auth/password",
      "/auth/register",
      "/auth/register/confirm",
      "/auth/username-register",
      "/auth/forgot",
    ].includes(loc.pathname) ? (
      <DesktopAuth key={loc.pathname} />
    ) : (
      <NotFound />
    );
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
  if (loc.pathname === "/follows") return null;
  if (
    loc.pathname === "/restaurants/new" ||
    loc.pathname === "/restaurants/new/details"
  )
    return (
      <DesktopGate verified>
        <FeatureAvailability name="newShop">
          <DesktopNewShop />
        </FeatureAvailability>
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
        <FeatureAvailability name="publish">
          <DesktopPublish />
        </FeatureAvailability>
      </DesktopGate>
    );
  if (loc.pathname === "/admin")
    return (
      <DesktopSource screen={screen} auth={loc.pathname.startsWith("/auth/")}>
        {children}
      </DesktopSource>
    );
  let content: ReactNode;
  if (screen === "G-NotFound") return <NotFound />;
  if (screen === "G2-Home" || screen === "G-HomePhoto")
    content = <DesktopHome />;
  else if (screen === "G-Nearby") content = <DesktopNearby />;
  else if (screen === "G-Search") content = <DesktopSearch />;
  else if (screen === "G-Me") content = <ProfileOverview />;
  else if (screen === "G-Dish") content = <DesktopDish />;
  else if (screen === "G-Detail") content = <DesktopRestaurant />;
  else if (screen === "G-TagDishes") content = <Catalog favorites />;
  else if (screen === "G-MyTags" || screen === "G-History")
    content = screen === "G-MyTags" ? <DesktopTags /> : <DesktopHistory />;
  else if (screen === "G-Settings" && loc.pathname === "/settings")
    content = <SettingsHome embedded />;
  else {
    const auth = [
      "G-Login",
      "G-PasswordLogin",
      "G-PhoneLogin",
      "G-ForgotPassword",
      "G-RegisterConfirm",
    ].includes(screen);
    return (
      <DesktopSource screen={screen} auth={auth}>
        {children}
      </DesktopSource>
    );
  }
  return [
    "G2-Home",
    "G-HomePhoto",
    "G-Dish",
    "G-Detail",
    "G-Nearby",
    "G-Search",
  ].includes(screen) ? (
    content
  ) : (
    <DesktopGate verified={protectedScreens.has(screen)}>{content}</DesktopGate>
  );
}
function DiscussionRedirect() {
  const loc = useLocation(),
    m = useMobile(),
    nav = useNavigate();
  const id =
    parseId(new URLSearchParams(loc.search).get("foodId") ?? undefined) ??
    m.foodId;
  useEffect(() => {
    // A resize may render the old phone route as a new hash arrives.
    // Do not let that route's deferred redirect replace a newer navigation.
    if (window.location.hash.slice(1).split("?")[0] !== loc.pathname) return;
    nav(
      `/foods/${id}?section=comments${loc.pathname.endsWith("/write") ? "&compose=1" : ""}`,
      { replace: true },
    );
  }, [id, loc.pathname, nav]);
  return <ContentSkeleton kind="rows" count={3} />;
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
  const { session, user, me } = useApp();
  if (!session) return <AccessWelcome />;
  if (me.isPending) return <PageSkeleton kind="profile" />;
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
    return <AccessWelcome verification />;
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
  skeleton,
  rows = false,
}: {
  query: {
    isPending: boolean;
    error: unknown;
    data?: unknown;
    refetch: () => unknown;
  };
  empty?: boolean;
  children: ReactNode;
  skeleton?: PageSkeletonKind;
  rows?: boolean;
}) {
  if (query.isPending)
    return skeleton ? (
      <PageSkeleton kind={skeleton} />
    ) : (
      <ContentSkeleton kind={rows ? "rows" : "cards"} />
    );
  if (query.error && !query.data)
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
  lazy = false,
  priority = false,
  orbitOffset,
}: {
  food: Food;
  className?: string;
  style?: CSSProperties;
  hidden?: boolean;
  lazy?: boolean;
  priority?: boolean;
  orbitOffset?: number;
}) {
  const visual = visualFor(food, isDemo),
    src = mediaUrl(food.pictureUrl?.[0]);
  const renew = useFoodImageRefresh();
  return (
    <div
      className={`pc-plate ${visual.asset ? "is-illustration" : "is-photo"} ${className}`}
      style={style}
      aria-hidden={hidden || undefined}
      data-orbit-offset={orbitOffset}
    >
      {src ? (
        <img
          src={src}
          alt={food.name ?? "菜品"}
          onError={() => renew(src)}
          loading={lazy ? "lazy" : "eager"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
        />
      ) : (
        <Icon name="bowl" size={80} />
      )}
    </div>
  );
}
function DesktopHome() {
  const remote = useRemoteConfig(),
    batchSize = recommendationBatchSize(remote.data);
  const { api } = useApp(),
    m = useMobile(),
    { campusId } = useArea(),
    [n, setN] = useState(0),
    [category, setCategory] = useState(""),
    pointer = useRef<{ id: number; x: number; radius: number } | null>(null),
    copy = useRef<HTMLDivElement>(null);
  const query = useQuery({
      queryKey: ["foods", "mobile-recommend", campusId, m.meal, "", batchSize],
      queryFn: () =>
        api.recommend(batchSize, {
          campusId,
          mealTime: mealCode(m.meal),
          deviceId: guestDeviceId(),
        }),
      placeholderData: keepPreviousData,
    }),
    list = query.data ?? [],
    index = list.length ? ((n % list.length) + list.length) % list.length : 0,
    food = list[index],
    visual = food ? visualFor(food, isDemo) : null;
  const categoryQuery = useQuery({
    queryKey: [
      "foods",
      "mobile-recommend",
      campusId,
      m.meal,
      category,
      batchSize,
    ],
    queryFn: () =>
      api.recommend(batchSize, {
        campusId,
        mealTime: mealCode(m.meal),
        category: category || undefined,
        deviceId: guestDeviceId(),
      }),
    enabled: !!category,
    placeholderData: keepPreviousData,
  });
  useContentMotion(copy, food?.id ?? undefined, n, "y");
  const selection = category
    ? (categoryQuery.data ?? []).filter((f) => f.category === category)
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
      <div className="pc-home">
        <RecommendationControls />
        <QueryStatus
          query={query}
          skeleton="home"
          empty={!query.isPending && !query.error}
        >
          <span />
        </QueryStatus>
      </div>
    );
  return (
    <div className="pc-home">
      <RecommendationControls />
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
        <div className="pc-hero-counter">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span>/ {String(list.length).padStart(2, "0")}</span>
        </div>
        <div className="pc-hero-copy" ref={copy}>
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
            if (
              !e.isPrimary ||
              e.button !== 0 ||
              pointer.current ||
              list.length < 2
            )
              return;
            const plate =
              e.currentTarget.querySelector<HTMLElement>(".pc-current-plate");
            pointer.current = {
              id: e.pointerId,
              x: e.clientX,
              radius: (plate?.offsetWidth ?? 430) * 1.03,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const start = pointer.current;
            if (start?.id !== e.pointerId || instantMotion()) return;
            e.currentTarget.dataset.dragging = "true";
            const angle =
              heroOrbitStep *
              Math.tanh(
                (e.clientX - start.x) /
                  ((start.radius * heroOrbitStep * Math.PI) / 180),
              );
            dragHeroOrbit(e.currentTarget, angle);
          }}
          onPointerUp={(e) => {
            const start = pointer.current;
            if (start?.id !== e.pointerId) return;
            pointer.current = null;
            delete e.currentTarget.dataset.dragging;
            dragHeroOrbit(e.currentTarget);
            if (
              start?.id === e.pointerId &&
              Math.abs(e.clientX - start.x) > 30
            ) {
              const direction = e.clientX < start.x ? 1 : -1;
              setN((i) => i + direction);
            }
          }}
          onLostPointerCapture={(e) => {
            if (pointer.current?.id !== e.pointerId) return;
            pointer.current = null;
            delete e.currentTarget.dataset.dragging;
            dragHeroOrbit(e.currentTarget);
          }}
          onPointerCancel={(e) => {
            if (pointer.current?.id !== e.pointerId) return;
            pointer.current = null;
            delete e.currentTarget.dataset.dragging;
            dragHeroOrbit(e.currentTarget);
          }}
        >
          {heroOrbitSlots(n, list.length).map((slot) => {
            const item =
              list[((slot % list.length) + list.length) % list.length];
            const offset = slot - n;
            return (
              <Plate
                key={`${slot}:${item.id}`}
                food={item}
                hidden={offset !== 0}
                priority={offset === 0}
                orbitOffset={offset}
                style={{
                  transform: heroPlateTransform(offset * heroOrbitStep),
                }}
                className={
                  offset === 0
                    ? "pc-current-plate"
                    : offset === 1
                      ? "pc-next-plate"
                      : offset === -1
                        ? "pc-previous-plate"
                        : "pc-waiting-plate"
                }
              />
            );
          })}
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
              onClick={() =>
                setN((position) =>
                  nearestHeroPosition(position, i, list.length),
                )
              }
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
          aria-busy={!!category && categoryQuery.isFetching}
          reserveSpace
        >
          {category && categoryQuery.isFetching && !selection.length && (
            <ContentSkeleton count={4} />
          )}
          <div className="pc-food-grid">
            {selection.map((f) => (
              <FoodCard key={f.id} food={f} />
            ))}
          </div>
          {category && categoryQuery.isError ? (
            <Status
              title="这一组暂时没端上来"
              detail={errorMessage(categoryQuery.error)}
            >
              <button
                className="pc-button light"
                onClick={() => void categoryQuery.refetch()}
              >
                重新加载
              </button>
            </Status>
          ) : (
            !selection.length &&
            !categoryQuery.isFetching && (
              <Status
                title={
                  category && categoryQuery.isFetching
                    ? "正在端上这一组好味道"
                    : "这一组里，还没有这个口味"
                }
              />
            )
          )}
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
        <Plate food={food} lazy />
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
  const [params, setParams] = useSearchParams();
  const update = (patch: Record<string, string | undefined>) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(patch))
          value ? next.set(key, value) : next.delete(key);
        return next;
      },
      { replace: true },
    );
  const page = Math.max(1, Number(params.get("page")) || 1);
  const setPage = (change: number | ((value: number) => number)) =>
    update({
      page: String(typeof change === "function" ? change(page) : change),
    });
  const selected = parseId(params.get("selected") ?? undefined);
  const setSelected = (id: number) => update({ selected: String(id) });
  const q = params.get("q") ?? "";
  const setQ = (value: string) =>
    update({ q: value || undefined, page: undefined });
  const { api } = useApp(),
    { area } = useArea(),
    m = useMobile();
  const areaKey = JSON.stringify(area);
  const previousArea = useRef(areaKey);
  const areaChanged = previousArea.current !== areaKey;
  useEffect(() => {
    if (previousArea.current !== areaKey) {
      previousArea.current = areaKey;
      update({ page: undefined, selected: undefined });
    }
  }, [areaKey]);
  const keyword = useDebouncedSearch(q);
  const query = useQuery({
      queryKey: ["restaurants", "desktop-nearby", area, keyword, page],
      queryFn: () =>
        area
          ? api.restaurantSearch({
              gcjLng: area!.gcjLng,
              gcjLat: area!.gcjLat,
              hubId: area?.hubId,
              keyword: keyword || undefined,
              page,
              pageSize: 10,
            })
          : api.browseRestaurants({
              keyword: keyword || undefined,
              page,
              pageSize: 10,
            }),
      placeholderData: keepPreviousData,
      enabled: !areaChanged,
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
            <Link to="/restaurants/directory">更多筛选 →</Link>
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
                }}
              />
              {q && (
                <button aria-label="清空搜索" onClick={() => setQ("")}>
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
            <span className="pc-small-note" role="status">
              {(query.isFetching && !query.isPending) || q !== keyword
                ? "正在更新附近的店…"
                : "按所选区域查询"}
            </span>
          </div>
          <div
            className="pc-nearby-list-scroll"
            aria-busy={query.isFetching || q !== keyword}
          >
            {
              <QueryStatus query={query} rows empty={!shops.length}>
                {shops.map((shop) => (
                  <button
                    key={shop.id}
                    className="pc-shop-row"
                    aria-pressed={current?.id === shop.id}
                    onClick={() => setSelected(shop.id!)}
                  >
                    <div className="pc-shop-thumbnail">
                      {mediaUrl(shop.pictureUrl?.[0]) ? (
                        <img
                          src={mediaUrl(shop.pictureUrl?.[0])}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
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
            }
          </div>
        </section>
        <section className="pc-map" aria-label="附近餐厅地图">
          <div className="pc-map-surface">
            <RestaurantMap
              autoLocate
              restaurants={shops}
              selectedId={current?.id ?? undefined}
              onSelect={(shop) => setSelected(shop.id!)}
            />
          </div>
          {query.isPending && (
            <div className="pc-map-selected">
              <ContentSkeleton kind="rows" count={1} />
            </div>
          )}
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
function DesktopSearch() {
  return <Catalog />;
}
function DesktopDish() {
  const returnTo = useReturnTo("/");
  const { api, session, user } = useApp(),
    m = useMobile(),
    loc = useLocation(),
    id = parseId(loc.pathname.split("/").pop()) ?? m.foodId,
    task = useTask(),
    access = useActionAccess();
  const query = useQuery({
      queryKey: ["foods", "detail", id],
      queryFn: () => api.food(id),
      // A detail visit also records history; a cached page must not skip it.
      staleTime: 0,
    }),
    food = query.data,
    v = food ? visualFor(food, isDemo) : null;
  const shop = useQuery({
    queryKey: ["restaurants", "detail", food?.restaurantId],
    queryFn: () => api.restaurant(food!.restaurantId!),
    enabled: !!food?.restaurantId,
  });
  const [image, setImage] = useState(0),
    photo = useRef<HTMLDivElement>(null);
  useContentMotion(photo, image, image, "opacity");
  useEffect(() => setImage(0), [id]);
  useEffect(() => m.setFoodId(id), [id]);
  return (
    <QueryStatus query={query} skeleton="dish">
      {food && v && (
        <>
          <div className="pc-breadcrumb">
            <Link to={returnTo}>
              <Icon name="back" size={14} />
              返回
            </Link>
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
              <div className="pc-dish-plate" ref={photo}>
                <Plate
                  priority
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
                  disabled={
                    task.busy ||
                    (!!session &&
                      user?.verified === true &&
                      food.isFavorite == null)
                  }
                  onClick={() =>
                    void task.run(() =>
                      api.favorite(id, food.isFavorite === true),
                    )
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
                  <small>
                    {shop.isPending && !shop.data ? (
                      <Skeleton width="85%" height={14} />
                    ) : (
                      (shop.data?.address ?? "地址待补充")
                    )}
                  </small>
                </span>
                <Icon name="chevronRight" size={21} />
              </Link>
              <div className="pc-dish-actions">
                <button
                  className="pc-button light"
                  aria-pressed={food.isLiked === true}
                  disabled={
                    task.busy ||
                    (!!session &&
                      user?.verified === true &&
                      food.isLiked == null)
                  }
                  onClick={() =>
                    void task.run(() => api.like(id, food.isLiked === true))
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
                        if (!access(true)) return;
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
                      if (!access(true)) return;
                      m.setFoodId(id);
                      m.openPanel("G-PanelTag");
                    }}
                  >
                    + 加标签
                  </button>
                </div>
              </div>
              <div className="pc-contributor">
                {foodAuthor(food).id ? (
                  <Link to={`/users/${foodAuthor(food).id}`}>
                    <span className="pc-user-avatar">
                      {foodAuthor(food).name?.slice(0, 1) ?? "食"}
                    </span>
                    <b>{foodAuthor(food).name ?? "同学"}</b>
                  </Link>
                ) : (
                  <b>{foodAuthor(food).name ?? "校园食友"}</b>
                )}
                <span>分享了这道菜</span>
              </div>
              <p className="pc-dish-description">
                {food.description ?? "分享者还没有留下描述。"}
              </p>
              <FoodManage food={food} />
              <div className="pc-detail-secondary">
                <Link to={`/foods/${id}?section=comments`}>
                  <Icon name="comment" size={15} /> 食友讨论
                </Link>
                <Link to={`/reports/new?type=FOOD&id=${id}`}>举报</Link>
              </div>
              {task.error && (
                <p className="pc-error" role="alert">
                  {task.error}
                </p>
              )}
            </section>
          </div>
          <Suspense fallback={<ContentSkeleton kind="rows" count={3} />}>
            <FoodDiscussion key={id} food={{ ...food, id }} />
            <FoodExtras id={id} />
          </Suspense>
        </>
      )}
    </QueryStatus>
  );
}
function DesktopRestaurant() {
  const returnTo = useReturnTo("/nearby");
  const { api } = useApp(),
    m = useMobile(),
    loc = useLocation(),
    id = parseId(loc.pathname.split("/").pop()) ?? m.shopId,
    [page, setPage] = useState(1);
  const query = useQuery({
      queryKey: ["restaurants", "detail", id],
      queryFn: () => api.restaurant(id),
      staleTime: 0,
    }),
    foods = useQuery({
      queryKey: ["foods", "restaurant", id, page],
      queryFn: () => api.foods(id, page),
      placeholderData: keepPreviousData,
    }),
    shop = query.data;
  return (
    <QueryStatus query={query} skeleton="restaurant">
      {shop && (
        <>
          <div className="pc-breadcrumb">
            <Link to={returnTo}>
              <Icon name="back" size={14} />
              返回
            </Link>
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
                  {shop.ratingSummaryState === "SYNC_PENDING"
                    ? "评分同步中"
                    : shop.recommendationRate == null
                      ? "评分人数不足"
                      : `推荐率 ${shop.recommendationRate}%`}
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
                          baiduMarkerUrl(shop),
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
              {foods.isPending ? (
                <div
                  className="ew-skeleton-stage"
                  style={{ width: "100%", height: "100%" }}
                >
                  <span
                    className="ew-skeleton"
                    style={{
                      width: "80%",
                      aspectRatio: 1,
                      borderRadius: "50%",
                    }}
                  />
                </div>
              ) : foods.data?.items?.[0] ? (
                <Plate food={foods.data.items[0]} />
              ) : mediaUrl(shop.pictureUrl?.[0]) ? (
                <img src={mediaUrl(shop.pictureUrl?.[0])} alt="" />
              ) : (
                <Icon name="store" size={140} />
              )}
            </div>
          </section>
          <Suspense fallback={<ContentSkeleton kind="rows" count={1} />}>
            <RestaurantActions id={id} />
          </Suspense>
          <section className="pc-content-sheet">
            <div className="pc-sheet-handle" />
            <div className="pc-section-toolbar">
              <h2>这家店的好味道</h2>
              <Link
                to={`/restaurants/correction?id=${id}`}
                onClick={() => m.setShopId(id)}
              >
                信息有误
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

export function DesktopShares() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "comments" ? "comments" : "uploads";
  const page = Math.max(1, Number(params.get("page")) || 1);

  const setPage = (change: number | ((value: number) => number)) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set(
        "page",
        String(typeof change === "function" ? change(page) : change),
      );
      return next;
    });
  const { api, user } = useApp(),
    myComments = useQuery({
      queryKey: ["demo-my-comments", user?.id],
      queryFn: async () =>
        (await import("../demo/comments")).myCommentEntries(user!.id!),
      enabled: isDemo && !!user?.id,
    }),
    query = useQuery({
      queryKey: ["foods", "mine", page],
      queryFn: () => api.myFoods(page),
      enabled: !!user && tab !== "comments",
      placeholderData: keepPreviousData,
    });
  useEffect(() => {
    document.title = "我的分享 · 山软今天吃什么";
  }, []);
  return (
    <section className="pc-profile-content profile-shares">
      <header className="pc-library-heading">
        <div>
          <h1>我的分享</h1>
          <p>记录吃过的好味道，也分享给下一位食友。</p>
        </div>
        <Link to="/publish" className="profile-shares-publish">
          <Icon name="add" size={19} />
          分享一道菜
        </Link>
      </header>
      <div className="pc-section-toolbar">
        <ProfileSectionNav section="shares" />
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
        order={tab === "uploads" ? 0 : 1}
        aria-busy={tab !== "comments" && query.isPlaceholderData}
        className="pc-profile-tab-content"
      >
        {tab === "comments" && !isDemo ? (
          <div className="profile-comments-unavailable" role="status">
            <Icon name="comment" size={28} />
            <h2>评论记录暂未开放</h2>
            <p>你可以在对应菜品的详情页查看评论。</p>
            <Link to="/me/shares" replace>
              查看已发布的菜品
            </Link>
          </div>
        ) : tab === "comments" ? (
          <Suspense fallback={<ContentSkeleton kind="rows" count={3} />}>
            <MyFoodComments entries={myComments.data ?? []} />
          </Suspense>
        ) : (
          <>
            <QueryStatus query={query}>
              {query.data?.items?.length ? (
                <div className="profile-shares-grid">
                  {query.data.items.map((f) => (
                    <article className="profile-share-card" key={f.id}>
                      <FoodCard food={f} />
                      <FoodManage food={f} />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="profile-comments-unavailable">
                  <Icon name="bowl" size={28} />
                  <h2>
                    {page > 1 ? "这一页没有更多分享了" : "分享你的第一道好菜"}
                  </h2>
                  <p>
                    {page > 1
                      ? "返回前一页，继续查看已发布的菜品。"
                      : "记下喜欢的味道，也给食友一份参考。"}
                  </p>
                  {page === 1 && <Link to="/publish">分享一道菜</Link>}
                </div>
              )}
            </QueryStatus>
            {query.isSuccess && (
              <NextPage
                page={page}
                hasNext={query.data?.hasNext}
                onNext={() => setPage((p) => p + 1)}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              />
            )}
          </>
        )}
      </MotionRegion>
    </section>
  );
}
