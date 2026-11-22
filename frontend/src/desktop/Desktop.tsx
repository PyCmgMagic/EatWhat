import WorkspaceSwitch from "../admin/WorkspaceSwitch";
import { ThemeToggle } from "../theme/AppearanceControl";
import { DiscoveryList } from "../features/DiscoveryList";
import { PhotoPreviewButton } from "../components/PhotoPreviewButton";
import { useHomeDiscovery } from "../features/useHomeDiscovery";
import { SupplementPrice } from "../features/SupplementPrice";
import { BRAND_NAME, BRAND_PREFIX, BRAND_SLOGAN } from "../app/brand";
import { BrandLogo } from "../components/BrandLogo";
import { foodAuthor } from "../api/models";
import ProfileOverview from "../features/ProfileOverview";
import { bannedPageAllowed } from "../api/banned-access";
import ProfileSpaceHeader from "../features/ProfileSpaceHeader";
import { ProfileEmpty, ProfilePageHead } from "../features/ProfilePage";
import HelpFeedback, { isHelpFeedbackPath } from "../features/HelpFeedback";
import DesktopRouteSkeleton from "./DesktopRouteSkeleton";
import DesktopSettingsWorkspace from "./DesktopSettingsWorkspace";
import { desktopSettingsCategory } from "../features/settings-nav";
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
} from "@tanstack/react-query";
import { useApp } from "../app/state";
import { LoginLink } from "../app/auth-dialog";
import NearbyFilterSheet, { NearbyFilterTrigger } from "../features/NearbyFilterSheet";
import { hasNearbyFilters, useNearbyBrowse } from "../features/nearby-filters";
import { NearbySearchInput } from "../features/NearbySearchInput";
import { useCelebration, useFoodReaction } from "../features/food-reactions";
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
import { DesignIcon as Icon, Pending, ReactionIcon, useMobile } from "../mobile/ui";
import { mobileSettingsPages } from "../mobile/routes";
import { visualFor } from "../mobile/catalog";
import "./desktop.css";
import "./nearby.css";
import "./profile-workspace.css";
import "./profile-shell.css";
import "./profile-space.css";
import "../features/profile-pages.css";
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
  createHeroOrbitScheduler,
  dragHeroOrbit,
  heroOrbitSlots,
  heroOrbitStep,
  heroPlateTransform,
  nearestHeroPosition,
} from "../motion/hero-orbit";
import { isV4Path, routeMotionKey } from "../features/v4-paths";
import {
  FeatureAvailability,
} from "../features/v4/Remote";
const V4Routes = lazy(() => import("../features/v4/Routes"));
const ApiV2Routes = lazy(() => import("../features/ApiV2Routes"));
const DesktopPublish = lazy(() => import("./DesktopPublish"));
const DesktopProfile = lazy(() => import("./DesktopProfile"));
import { DesktopRestaurantFeedback } from "./DesktopRestaurantFeedback";
import { RestaurantHeaderFavorite } from "../features/v4/RestaurantHeaderFavorite";
const FoodExtras = lazy(() =>
  import("../features/v4/DetailExtras").then((m) => ({
    default: m.FoodExtras,
  })),
);
const FoodDiscussion = lazy(() => import("./FoodDiscussion"));
const MyFoodComments = lazy(() =>
  import("./FoodDiscussion").then((m) => ({ default: m.MyFoodComments })),
);
const DesktopHistory = lazy(() =>
  import("./DesktopLibrary").then((m) => ({ default: m.DesktopHistory })),
);
import { Catalog, FoodManage, LikedFoods } from "../features/Catalog";
import { DishMoreActions } from "./DishMoreActions";
import { RestaurantMoreActions } from "../features/RestaurantMoreActions";
import { RecommendationControls, Preferences } from "../features/Account";
import { EditFood } from "../features/EditFood";
import { EditRestaurant, isShopEditPath } from "../features/EditRestaurant";
import { useActionAccess } from "../features/access";
import { mealCode } from "../api/food-display";
import {
  foodCategories,
  shopFactLabels,
  shopRatingScenes,
  type V2Food,
  type V2Shop,
} from "../api/v2-vocab";
import { useFoodImageRefresh, useFoodPhoto } from "../features/media";
import { FoodPhotoFallback } from "../components/FoodPhotoFallback";
import { FoodCover } from "../components/FoodCover";
import { UserAvatar } from "../components/UserAvatar";
import { UserTitle } from "../components/UserTitle";
import { FoodReportDialog } from "../features/FoodReportDialog";
import { FoodRating } from "../features/FoodRating";
import { availabilityText } from "../features/DishAvailability";
import RestaurantMap from "../features/RestaurantMap";
import HeaderSearch from "./DesktopSearch";
import { baiduMarkerUrl } from "../features/map-geometry";
const DesktopSettingsPage = lazy(() =>
  import("./DesktopAccount").then((m) => ({ default: m.DesktopSettingsPage })),
);
const SettingsHome = lazy(() => import("../features/SettingsHome"));
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
import { PendingPage, pendingPages, secondaryTitles } from "./secondary";

const categoryNames: Record<string, string> = Object.fromEntries(
  foodCategories.map((c) => [c.id, c.name]),
);
export default function DesktopExperience({
  enabled,
  screen,
  overlay,
  children,
  responsivePage,
}: {
  enabled: boolean;
  screen: string;
  overlay: boolean;
  children: ReactNode;
  responsivePage?: ReactNode;
}) {
  const location = useLocation();
  const { session } = useApp();
  const workspace = !!session && profileSection(location.pathname) !== null;
  // Keep shared pages mounted as desktop navigation is added or removed.
  if (!enabled && !responsivePage) return children;
  return (
    <div
      className={enabled ? "pc-app" : undefined}
      inert={overlay || undefined}
    >
      {enabled && <DesktopHeader />}
      <main className={enabled ? "pc-main" : undefined}>
        <MotionRegion
          // Reapply inheritance after a modal closes; lazy subtrees can retain
          // Chromium's computed inert state even after the attribute is removed.
          style={
            { interactivity: overlay ? undefined : "inherit" } as CSSProperties
          }
          changeKey={
            workspace
              ? "profile-workspace"
              : desktopSettingsCategory(location.pathname)
                ? "/settings"
                : location.pathname.startsWith("/publish")
                  ? "/publish"
                  : routeMotionKey(location.pathname)
          }
          order={location.pathname === "/nearby" ? 1 : workspace ? 2 : 0}
        >
          <Suspense fallback={<ContentSkeleton kind="form" count={3} />}>
            {responsivePage ?? (
              <DesktopRoute screen={screen}>{children}</DesktopRoute>
            )}
          </Suspense>
        </MotionRegion>
      </main>
      {enabled && <DesktopFooter />}
    </div>
  );
}
function DesktopHeader() {
  const { session, api } = useApp(),
    location = useLocation();
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => unreadCount(api),
    enabled: !!session,
    refetchInterval: 60_000,
  });
  const active =
    location.pathname === "/notifications" ||
    location.pathname === "/announcements"
      ? "notifications"
      : location.pathname === "/nearby" ||
          location.pathname === "/restaurants" ||
          location.pathname === "/restaurants/directory"
        ? "nearby"
        : profileSection(location.pathname) !== null ||
            location.pathname.startsWith("/me") ||
            location.pathname.startsWith("/settings") ||
            location.pathname === "/favorites" ||
            location.pathname === "/history" ||
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
        <Link className="pc-brand" to="/" aria-label={`${BRAND_NAME}，回到发现`}>
          <BrandLogo className="pc-brand-symbol" />
          <span>
            <b>
              {BRAND_PREFIX}<span>今天吃什么</span>
            </b>
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
          <HeaderSearch />
          <ThemeToggle />
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
          <HeaderAccount />
        </div>
      </div>
    </header>
  );
}
function HeaderAccount() {
  const { user, session, signOut, toast } = useApp(),
    navigate = useNavigate(),
    location = useLocation(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => setOpen(false), [location.pathname, location.search]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
        if (!root.current?.contains(event.target as Node)) setOpen(false);
      },
      closeEscape = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        setOpen(false);
        trigger.current?.focus();
      };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);
  const avatar = mediaUrl(user?.avatar);
  if (!session)
    return (
      <LoginLink to="/auth" className="pc-user-avatar" aria-label="登录">
        <Icon name="me" size={20} />
      </LoginLink>
    );
  return (
    <div className="pc-account" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="pc-user-avatar pc-account-trigger"
        aria-label="打开账户菜单"
        aria-expanded={open}
        aria-controls="pc-account-popover"
        onClick={() => setOpen((value) => !value)}
      >
        {avatar ? (
          <img src={avatar} alt="" />
        ) : (
          (user?.displayName?.slice(0, 1) ?? <Icon name="me" size={20} />)
        )}
      </button>
      {open && (
        <div id="pc-account-popover" className="pc-account-popover">
          <div className="pc-account-summary">
            <strong>{user?.displayName || "我的账号"}</strong>
            <span>
              {user?.verified ? "学生身份已认证" : "今天也要好好吃饭"}
            </span>
          </div>
          <div className="pc-account-links">
            <Link to="/me">
              <Icon name="me" size={18} /> 个人主页
            </Link>
            <Link to="/settings">
              <Icon name="settings" size={18} /> 账号设置
            </Link>
            <WorkspaceSwitch />
          </div>
          <div className="pc-account-popover-footer">
            <button
              type="button"
              className="pc-account-logout"
              disabled={busy}
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                try {
                  await signOut();
                  navigate("/auth");
                } catch (error) {
                  setBusy(false);
                  toast(errorMessage(error), { tone: "error" });
                }
              }}
            >
              <Icon name="logout" size={18} />
              {busy ? "正在退出…" : "退出登录"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function DesktopFooter() {
  return (
    <footer className="pc-footer">
      <span>
        {BRAND_NAME} <span className="pc-footer-separator" />
        {BRAND_SLOGAN}
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
  const category = desktopSettingsCategory(location.pathname);
  const content = <DesktopPage screen={screen}>{children}</DesktopPage>;
  const page = category ? (
    <DesktopSettingsWorkspace category={category}>{content}</DesktopSettingsWorkspace>
  ) : content;
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
        <div className="pc-profile-space profile-overview">
          <ProfileSpaceHeader />
          {/* 外层只负责撑出滚动空间，白色卡片仍按内容高度收尾。 */}
          <div className="pc-profile-space-body">
            <div
              ref={content}
              id="profile-workspace-panel"
              className="pc-profile-space-content"
              role="region"
              aria-label="个人中心内容"
              tabIndex={-1}
            >
              <MotionRegion
                changeKey={
                  desktopSettingsCategory(location.pathname)
                    ? "/settings"
                    : location.pathname
                }
                order={profileSections.findIndex((item) => item.to === section)}
              >
                <Suspense fallback={<DesktopRouteSkeleton />}>
                  {children}
                </Suspense>
              </MotionRegion>
            </div>
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
  if (isHelpFeedbackPath(loc.pathname)) return <HelpFeedback />;
  if (isV4Path(loc.pathname))
    return <V4Routes key={routeMotionKey(loc.pathname)} />;
  if (/^\/foods\/\d+\/edit$/.test(loc.pathname)) return <EditFood />;
  if (isShopEditPath(loc.pathname)) return <EditRestaurant />;
  if (["/settings/username", "/settings/blocked"].includes(loc.pathname))
    return <ApiV2Routes key={loc.pathname} />;
  if (loc.pathname === "/settings/preferences") return <Preferences />;
  if (loc.pathname === "/search") return <Catalog />;
  if (loc.pathname === "/favorites")
    return (
      <DesktopGate verified={false}>
        <Catalog favorites />
      </DesktopGate>
    );
  if (loc.pathname === "/likes")
    return (
      <DesktopGate verified={false}>
        <LikedFoods />
      </DesktopGate>
    );
  if (loc.pathname === "/auth" || loc.pathname.startsWith("/auth/"))
    return <NotFound />;
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
    return mobileSettingsPages[loc.pathname]?.public || loc.pathname === "/feedback" ? (
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
  else if (screen === "G-History") content = <DesktopHistory />;
  else if (screen === "G-Settings" && loc.pathname === "/settings")
    content = <SettingsHome />;
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
    <DesktopGate verified={false}>
      {content}
    </DesktopGate>
  );
}
const CommentDestination = lazy(() =>
  import("../features/comments/Comments").then((m) => ({
    default: m.CommentDestination,
  })),
);

function DiscussionRedirect() {
  const loc = useLocation(),
    m = useMobile(),
    nav = useNavigate();
  const id =
    parseId(new URLSearchParams(loc.search).get("foodId") ?? undefined) ??
    m.foodId;
  const params = new URLSearchParams(loc.search);
  const commentId =
    !params.has("foodId") && loc.pathname === "/comments"
      ? parseId(params.get("commentId") ?? undefined)
      : undefined;
  useEffect(() => {
    // A resize may render the old phone route as a new hash arrives.
    // Do not let that route's deferred redirect replace a newer navigation.
    if (
      commentId ||
      window.location.hash.slice(1).split("?")[0] !== loc.pathname
    )
      return;
    nav(
      (() => {
        const search = new URLSearchParams(loc.search);
        search.delete("foodId");
        search.set("section", "comments");
        if (loc.pathname.endsWith("/write")) search.set("compose", "1");
        return `/foods/${id}?${search}`;
      })(),
      { replace: true },
    );
  }, [id, commentId, loc.pathname, loc.search, nav]);
  if (commentId) return <CommentDestination commentId={commentId} desktop />;
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
          <span className="pc-eyebrow">{BRAND_NAME}</span>
          <h1>{BRAND_SLOGAN}</h1>
          <img src="/prototype/assets/dishes/yuntun.svg" alt="一碗鲜虾云吞" />
        </aside>
      )}
      <div className="pc-source-content">{children}</div>
    </div>
  );
}
function DesktopGate({
  verified = true,
  allowBanned,
  children,
}: {
  verified?: boolean;
  allowBanned?: boolean;
  children: ReactNode;
}) {
  const { session, user, me } = useApp();
  const { pathname } = useLocation();
  if (!session) return <AccessWelcome />;
  if (me.isPending) return <DesktopRouteSkeleton />;
  if (me.error)
    return (
      <Status title="暂时没能读取账号" detail={errorMessage(me.error)}>
        <button className="pc-button" onClick={() => void me.refetch()}>
          再试一次
        </button>
      </Status>
    );
  if (user?.banned && !(allowBanned ?? bannedPageAllowed(pathname)))
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
  onImageError,
}: {
  food: Food;
  className?: string;
  style?: CSSProperties;
  hidden?: boolean;
  lazy?: boolean;
  priority?: boolean;
  orbitOffset?: number;
  onImageError?: () => void;
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
        <FoodCover
          crop={food.coverCrop}
          src={src}
          alt={food.name ?? "菜品"}
          onError={onImageError ?? (() => renew(src))}
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
  const discovery = useHomeDiscovery();
  const { hero: query, heroFoods: list } = discovery;
  const { session } = useApp(), m = useMobile(), [n, setN] = useState(0),
    pointer = useRef<{ id: number; x: number; radius: number } | null>(null),
    orbitMotion = useRef(createHeroOrbitScheduler()),
    copy = useRef<HTMLDivElement>(null);
  useEffect(() => () => orbitMotion.current.cancel(), []);
  const index = list.length ? ((n % list.length) + list.length) % list.length : 0,
    food = list[index], visual = food ? visualFor(food, isDemo) : null;
  useContentMotion(copy, food?.id ?? undefined, n, "y");
  useEffect(() => {
    document.title = `发现 · ${BRAND_NAME}`;
  }, []);
  const sheet = (
    <section className={`pc-discovery-sheet${food && visual ? "" : " is-standalone"}`}>
      <DiscoveryList masonry discovery={discovery} renderDishes={(foods) => (
        <div className="pc-food-grid">
          {foods.map((food) => <FoodCard key={food.id} food={food} />)}
        </div>
      )} />
    </section>
  );
  if (!food || !visual)
    return (
      <div className="pc-home">
        <RecommendationControls />
        {query.isPending && <PageSkeleton kind="home" />}
        {query.isError && discovery.kind !== "food" &&
          <QueryStatus query={query} skeleton="home"><span /></QueryStatus>}
        {sheet}
      </div>
    );
  return (
    <div className="pc-home">
      <RecommendationControls />
      <section
        className="pc-hero"
        data-food-stage={visual.stageTone}
        style={
          {
            "--stage": visual.stageSurface,
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
          <h1 title={food.name ?? undefined}>
            {food.name || `${visual.l1}${visual.l2}`}
          </h1>
          <Link
            to={`/restaurants/${food.restaurantId}`}
            className="pc-hero-shop"
          >
            {food.restaurantName}
            <Icon name="chevronRight" size={16} />
          </Link>
          {session && food.restaurantId && (
            <button
              type="button"
              className="pc-hero-dismiss"
              aria-haspopup="dialog"
              disabled={discovery.dismissing}
              onClick={() => discovery.requestDismiss(food)}
            >
              不想吃这家
            </button>
          )}
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
            orbitMotion.current.cancel();
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
            orbitMotion.current.update(e.currentTarget, angle);
          }}
          onPointerUp={(e) => {
            const start = pointer.current;
            if (start?.id !== e.pointerId) return;
            pointer.current = null;
            orbitMotion.current.cancel();
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
            orbitMotion.current.cancel();
            delete e.currentTarget.dataset.dragging;
            dragHeroOrbit(e.currentTarget);
          }}
          onPointerCancel={(e) => {
            if (pointer.current?.id !== e.pointerId) return;
            pointer.current = null;
            orbitMotion.current.cancel();
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
      {sheet}
    </div>
  );
}
function FoodCard({ food }: { food: Food }) {
  const v = visualFor(food, isDemo),
    m = useMobile();
  const photo = useFoodPhoto(mediaUrl(food.pictureUrl?.[0]));
  return (
    <Link
      to={`/foods/${food.id}`}
      className="pc-food-card"
      onClick={() => m.setFoodId(food.id!)}
    >
      <div className="pc-food-card-image" style={{ background: v.tileSurface }}>
        {photo.unavailable ? (
          <FoodPhotoFallback category={food.category} failed={photo.failed} />
        ) : (
          <Plate food={food} lazy onImageError={photo.onError} />
        )}
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
  const searchInput = useRef<HTMLInputElement>(null);
  const { area } = useArea();
  const m = useMobile();
  const {
    shops: query,
    keyword: q,
    committedKeyword: keyword,
    filters,
    page,
    setPage,
    changeKeyword: setQ,
    open,
    openFilters,
    closeFilters,
    apply,
  } = useNearbyBrowse(10);
  const selected = parseId(params.get("selected") ?? undefined);
  const setSelected = (id: number) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("selected", String(id));
        return next;
      },
      { replace: true, state: { preserveScroll: true } },
    );
  const shops = query.data?.items ?? [];
  const current = shops.find((shop) => shop.id === selected) ?? shops[0];
  return (
    <div className="pc-nearby">
      <PageHeading title="好吃的，就在附近">
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
            <div className="pc-nearby-list-title">
              <h2>
                附近的店 <span>{query.data?.totalItems ?? "—"}</span>
              </h2>
              <NearbyFilterTrigger
                active={hasNearbyFilters(filters)}
                open={open}
                onClick={openFilters}
                showLabel
              />
            </div>
            <div className="pc-search-field">
              <Icon name="search" size={20} />
              <NearbySearchInput
                ref={searchInput}
                label="附近搜店名"
                value={q}
                onCommit={setQ}
              />
              {q && (
                <button
                  type="button"
                  aria-label="清空搜索"
                  onClick={() => {
                    setQ("");
                    searchInput.current?.focus();
                  }}
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
            {((query.isFetching && !query.isPending) || q !== keyword) && (
              <span className="pc-small-note" role="status">
                正在更新附近的店…
              </span>
            )}
          </div>
          <div
            className="pc-nearby-list-scroll"
            aria-busy={query.isFetching || q !== keyword}
          >
            {
              <QueryStatus query={query} rows>
                {!shops.length && (
                  <Status title="没有符合条件的店铺">
                    <button className="pc-button light" onClick={openFilters}>
                      调整筛选
                    </button>
                  </Status>
                )}
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
                        <Icon name="store" size={22} />
                      )}
                    </div>
                    <span>
                      <strong title={shop.name ?? undefined}>
                        {shop.name}
                      </strong>
                      <small title={shop.address ?? undefined}>
                        {shop.address ?? "地址待补充"}
                      </small>
                    </span>
                    <Icon name="chevronRight" size={20} />
                  </button>
                ))}
                <NextPage
                  page={page}
                  hasNext={query.data?.hasNext}
                  onNext={() => setPage(page + 1)}
                  onPrevious={() => setPage(page - 1)}
                />
              </QueryStatus>
            }
          </div>
        </section>
        <section className="pc-map" aria-label="附近餐厅地图">
          <div className="pc-map-surface">
            <RestaurantMap
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
                <h2>{current.name}</h2>
                <p title={current.address ?? undefined}>
                  {current.address ?? "地址待补充"}
                </p>
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
      {open && (
        <NearbyFilterSheet
          filters={filters}
          keyword={q}
          pageSize={10}
          onApply={apply}
          onClose={closeFilters}
        />
      )}
    </div>
  );
}
function DesktopSearch() {
  return <Catalog />;
}
function DishGallery({ food, illustrated }: { food: Food; illustrated: boolean }) {
  const photos = food.pictureUrl ?? [];
  const [index, setIndex] = useState(0);
  const selected = index < photos.length ? index : 0;
  const src = mediaUrl(photos[selected]);
  const photo = useFoodPhoto(src);
  const illustration = selected === 0 && illustrated && !photo.unavailable;
  const frame = useRef<HTMLDivElement>(null);
  useContentMotion(frame, selected, selected, "opacity");

  return (
    <section className="pc-dish-gallery" aria-label="菜品图片">
      <div
        ref={frame}
        className={`pc-dish-photo pc-plate ${illustration ? "is-illustration" : "is-photo"}`}
      >
        {photo.unavailable ? (
          <FoodPhotoFallback category={food.category} failed={photo.failed} />
        ) : (
          <FoodCover
            src={src}
            crop={selected === 0 ? food.coverCrop : undefined}
            alt={food.name ?? "菜品照片"}
            onError={photo.onError}
            decoding="async"
            fetchPriority="high"
          />
        )}
        {!photo.unavailable && (
          <PhotoPreviewButton
            pictures={photos}
            name={food.name || "菜品"}
            startIndex={selected}
            onImageError={photo.renew}
          />
        )}
      </div>
      {photos.length > 1 && (
        <div className="pc-gallery-controls" role="group" aria-label="切换照片">
          <button
            type="button"
            aria-label="上一张照片"
            onClick={() => setIndex((selected + photos.length - 1) % photos.length)}
          >
            <Icon name="back" size={20} />
          </button>
          <span aria-live="polite" aria-atomic="true">
            {selected + 1} / {photos.length}
          </span>
          <button
            type="button"
            aria-label="下一张照片"
            onClick={() => setIndex((selected + 1) % photos.length)}
          >
            <Icon name="chevronRight" size={20} />
          </button>
        </div>
      )}
    </section>
  );
}
function DesktopDish() {
  const returnTo = useReturnTo("/");
  const { api, session, user, toast } = useApp(),
    m = useMobile(),
    loc = useLocation(),
    id = parseId(loc.pathname.split("/").pop()) ?? m.foodId,
    access = useActionAccess();
  const query = useQuery({
      queryKey: ["foods", "detail", id],
      queryFn: () => api.food(id),
      // A detail visit also records history; a cached page must not skip it.
      staleTime: 0,
    }),
    food = query.data,
    visual = food && visualFor(food, isDemo);
  const author = food && foodAuthor(food);
  const reactions = useFoodReaction({
    foodId: id,
    food,
    onError: (e) => {
      const message = errorMessage(e);
      if (message) toast(message, { tone: "error" });
    },
  });
  const favCelebration = useCelebration(260);
  const shop = useQuery({
    queryKey: ["restaurants", "detail", food?.restaurantId],
    queryFn: () => api.restaurant(food!.restaurantId!),
    enabled: !!food?.restaurantId,
  });
  const [reportOpen, setReportOpen] = useState(false);
  useEffect(() => {
    setReportOpen(false);
  }, [id]);
  useEffect(() => m.setFoodId(id), [id]);
  return (
    <QueryStatus query={query} skeleton="dish">
      {food && visual && (
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
          <article
            className="pc-dish-layout"
            aria-labelledby="pc-dish-title"
            style={{ "--dish-accent": visual.stage } as CSSProperties}
          >
            <div
              className="pc-dish-stage"
              data-food-stage={visual.stageTone}
              style={{ "--dish-stage": visual.stageSurface, "--dish-ink": visual.on } as CSSProperties}
            >
              <DishGallery key={id} food={food} illustrated={!!visual.asset} />
            </div>
            <div className="pc-dish-info" key={id}>
              <header className="pc-dish-byline">
                <div className="pc-contributor">
                  {author?.id ? (
                    <Link to={`/users/${author.id}`}>
                      <UserAvatar className="pc-user-avatar" avatar={food.user?.avatar} name={author.name} />
                      <b>{author.name ?? "校园食友"}</b>
                    </Link>
                  ) : (
                    <b>{author?.name ?? "校园食友"}</b>
                  )}
                  <UserTitle title={food.user?.title} />
                </div>
                <div className="pc-dish-tools">
                  <button
                    type="button"
                    className={`pc-icon-button pc-dish-favorite${favCelebration.celebrating ? " is-celebrating" : ""}`}
                    aria-label={food.isFavorite ? "取消收藏" : "收藏"}
                    aria-pressed={food.isFavorite === true}
                    disabled={
                      !!session &&
                      user?.verified === true &&
                      food.isFavorite == null
                    }
                    onClick={() => {
                      if (food.isFavorite !== true) favCelebration.trigger();
                      else favCelebration.stop();
                      void reactions.toggle("favorite");
                    }}
                  >
                    <ReactionIcon kind="favorite" size={20} />
                  </button>
                  <DishMoreActions
                    key={id}
                    food={food}
                    onReport={() => setReportOpen(true)}
                  />
                </div>
              </header>
              <section className="pc-dish-reading" tabIndex={0} aria-labelledby="pc-dish-title">
                <div className="pc-dish-copy">
                  <h1 id="pc-dish-title">{food.name}</h1>
                  <div className="pc-dish-facts">
                    <div
                      className={`pc-detail-price${food.price == null ? " is-unknown" : ""}`}
                    >
                      {money(food.price)}
                      <SupplementPrice food={{ ...food, id }} />
                    </div>
                    <p className="pc-dish-meta">
                      {[
                        food.category && food.category !== "side_dish" && categoryNames[food.category],
                        (food as typeof food & V2Food).signature && "招牌菜",
                        availabilityText(food),
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                {food.description?.trim() && (
                  <p className="pc-dish-description">{food.description}</p>
                )}
                {!!food.systemTags?.length && (
                  <ul className="pc-dish-tags" aria-label="口味">
                    {food.systemTags.map(tag => (
                      <li key={tag.id}>{tag.name}</li>
                    ))}
                  </ul>
                )}
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
                <FoodRating food={food} />
              </section>
              <div className="pc-dish-actions">
                <button
                  type="button"
                  className="pc-dish-like"
                  aria-label={food.isLiked ? "取消喜欢这道菜" : "喜欢这道菜"}
                  aria-pressed={food.isLiked === true}
                  disabled={
                    !!session && user?.verified === true && food.isLiked == null
                  }
                  onClick={() => void reactions.toggle("like")}
                >
                  <ReactionIcon kind="like" size={21} />
                  <b className="pc-dish-like-count">{food.likesCount ?? "—"}</b>
                </button>
                <Link
                  className="pc-button"
                  to={`/restaurants/${food.restaurantId}`}
                >
                  去这家店
                  <Icon name="navigate" size={18} />
                </Link>
              </div>
            </div>
          </article>
          <Suspense fallback={<ContentSkeleton kind="rows" count={3} />}>
            <FoodDiscussion key={id} food={{ ...food, id }} />
            <FoodExtras id={id} />
          </Suspense>
          {reportOpen && (
            <FoodReportDialog
              key={id}
              foodId={id}
              foodName={food.name}
              onClose={() => setReportOpen(false)}
            />
          )}
        </>
      )}
    </QueryStatus>
  );
}
function DesktopRestaurant() {
  const returnTo = useReturnTo("/nearby");
  const { api, session } = useApp(),
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
    shop = query.data as (Restaurant & V2Shop) | undefined;
  const featuredFood = foods.data?.items?.[0];
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
          <section className="pc-restaurant-hero has-reviews">
            <RestaurantMoreActions key={id} id={id} name={shop.name} desktop />
            {session ? (
              <RestaurantHeaderFavorite
                key={`favorite-${id}`}
                id={id}
                className="pc-shop-save"
                title={shop.isFavorite ? "取消收藏店铺" : "收藏店铺"}
              />
            ) : (
              <LoginLink
                to="/auth/password"
                className="pc-shop-save"
                aria-label="登录后收藏店铺"
                title="登录后收藏店铺"
              >
                <Icon name="bookmark" size={22} />
              </LoginLink>
            )}
            <div className="pc-restaurant-hero-copy">
              <h1>{shop.name}</h1>
              <p className="pc-restaurant-address">
                <Icon name="nearby" size={18} />
                <span>{shop.address ?? "地址待补充"}</span>
              </p>
              <ul className="pc-shop-facts" aria-label="店铺特点">
                {shopFactLabels(shop).map((fact, index) => (
                  <li key={`${index}-${fact}`}>{fact}</li>
                ))}
                {shopRatingScenes(shop).length > 1 &&
                  shop.ratingSummaryState !== "SYNC_PENDING" &&
                  shop.recommendationRate != null && (
                    <li>综合推荐率 {shop.recommendationRate}%</li>
                  )}
              </ul>
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
              ) : featuredFood ? (
                <Plate food={featuredFood} />
              ) : mediaUrl(shop.pictureUrl?.[0]) ? (
                <img src={mediaUrl(shop.pictureUrl?.[0])} alt="" />
              ) : (
                <img src="/assets/restaurants/shop.svg" alt="" />
              )}
              {!foods.isPending && (
                <PhotoPreviewButton
                  pictures={featuredFood ? featuredFood.pictureUrl : shop.pictureUrl}
                  name={featuredFood ? featuredFood.name || "菜品" : shop.name || "店铺"}
                />
              )}
            </div>
          </section>
          <DesktopRestaurantFeedback key={id} id={id} shop={shop} />
          <section className="pc-content-sheet is-standalone">
            <div className="pc-section-toolbar">
              <div>
                <h2>菜品</h2>
              </div>
              <span className="pc-menu-count">
                {foods.data?.totalItems ?? "—"} 道菜品
              </span>
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
    query = useQuery({
      queryKey: ["foods", "mine", page],
      queryFn: () => api.myFoods(page),
      enabled: !!user && tab !== "comments",
      placeholderData: keepPreviousData,
    });
  useEffect(() => {
    document.title = `${tab === "comments" ? "我的评论" : "我的上传"} · ${BRAND_NAME}`;
  }, [tab]);
  return (
    <section className="pc-profile-content profile-shares" data-tab={tab}>
      {tab === "uploads" && (
        <ProfilePageHead
          title="我的上传"
          count={
            query.data?.totalItems != null
              ? `${query.data.totalItems} 道`
              : undefined
          }
          detail="你分享给食友的菜品，随时可以回来补充和修改。"
        >
          <Link to="/publish" className="pp-button">
            <Icon name="add" size={17} />
            分享一道菜
          </Link>
        </ProfilePageHead>
      )}
      {tab !== "comments" && query.isPlaceholderData && (
        <p className="pc-tab-loading" role="status">
          正在切换内容…
        </p>
      )}
      <MotionRegion
        changeKey={
          tab === "comments"
            ? `comments:${page}`
            : query.isPlaceholderData
              ? undefined
              : `${tab}:${page}:${query.dataUpdatedAt}`
        }
        order={tab === "uploads" ? 0 : 1}
        aria-busy={tab !== "comments" && query.isPlaceholderData}
        className="pc-profile-tab-content"
      >
        {tab === "comments" ? (
          <Suspense
            fallback={
              <div className="comments-journal">
                <ProfilePageHead title="我的评论" />
                <ContentSkeleton kind="rows" count={3} />
              </div>
            }
          >
            <MyFoodComments journal />
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
                <ProfileEmpty
                  illustration="yuntun"
                  title={
                    page > 1 ? "这一页没有更多上传了" : "分享你的第一道好菜"
                  }
                  detail={
                    page > 1
                      ? "返回前一页，继续查看已发布的菜品。"
                      : "记下喜欢的味道，也给食友一份参考。"
                  }
                >
                  {page === 1 && (
                    <Link to="/publish" className="pp-button">
                      <Icon name="add" size={17} />
                      分享一道菜
                    </Link>
                  )}
                </ProfileEmpty>
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
