import { BRAND_NAME } from "../app/brand";
import MobileProfile from "./MobileProfile";
import { bannedPageAllowed } from "../api/banned-access";
import { androidAppDownload } from "../features/settings-nav";
import { useFeedbackState } from "../components/feedback";
import { unreadCount } from "../api/notifications";
import { DishIllustration } from "../components/DishIllustration";
import { Select } from "../components/Select";
import { DiscoveryList } from "../features/DiscoveryList";
import { useHomeDiscovery } from "../features/useHomeDiscovery";
import { Frown } from "lucide-react";
import { useSendSignal } from "../features/useSendSignal";
import { useFoodReaction } from "../features/food-reactions";
import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { validateFoodDraft, normalizedTag } from "../api/content-rules";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useProfileDraft } from "../app/profile-draft";
import { useDebouncedSearch } from "../app/search";
import MobileNearby from "./MobileNearby";
import { isDemo } from "../app/runtime";
import { useArea } from "../app/area";
import {
  ApiError,
  duplicateFoodId,
  errorMessage,
  resultUncertain,
} from "../api/client";
import { classifyAuth } from "../api/service";
import {
  mediaUrl,
  money,
  parseId,
  hasCoordinates,
  type Food,
  type Category,
  type Restaurant,
} from "../api/models";
import { validateFiles } from "../api/validation";
import {
  foodCategories,
  MAX_DISH_TAGS,
  priceBands,
  type V2Shop,
} from "../api/v2-vocab";
import type { Bridge, Controller, NodeView, Values } from "./types";
import {
  useMobile,
  DesignIcon,
  PrimaryButton,
  Pending,
  FoodTile,
  ShopRow,
  MobileEmpty,
  type Draft,
} from "./ui";
import {
  ContentSkeleton,
  MobilePageSkeleton,
  Skeleton,
} from "../components/LoadingSkeleton";
import { demoDishes, stageSurface, visualFor } from "./catalog";
import { SceneToggle } from "../features/SceneToggle";
import { AiTagSuggest, draftPictureKeys } from "../features/AiTagSuggest";
import { DishDuplicateHint } from "../features/DishDuplicateHint";
import { screenRoutes, panelScreens, pendingScreens } from "./routes";
import { adjustPhoto, recommendPhotoStage, saveVisual } from "./photos";
import { applyPhotoEdit, draftStage } from "./draft-photo-edit";
import type { PhotoFraming } from "./photo-framing";
import {
  mealHours,
  mealName,
  mealOptions,
  mealSlotAt,
  publishDisplay,
} from "../api/food-display";
import { FoodManage } from "../features/Catalog";
import DishDetail from "./DishDetail";
import { PhotoPreviewButton } from "../components/PhotoPreviewButton";
import { MobileDishOptions } from "../features/DishAvailability";
import SheetHandle from "./SheetHandle";
import HomeSheetHandle from "./HomeSheetHandle";
import DishPhotoPicker from "./DishPhotoPicker";
import DishPhotoEditor from "./DishPhotoEditor";
import HomeOrbit, { dragHomePlates, homeOrbitDragAngle } from "./HomeOrbit";
import TagPanel from "./TagPanel";
import AvatarSourceSheet from "./AvatarSourceSheet";
import ProfileEditor from "./ProfileEditor";
import CropDialog from "../desktop/CropDialog";
import { PROFILE_SIGNATURE_LIMIT, profileClearError } from "../desktop/profile";
import { withDraftTag, withDraftTags } from "./draft-tags";
import { useActionAccess } from "../features/access";
import { useContentMotion } from "../motion/hooks";
import { instantMotion } from "../motion/runtime";
import { createHeroOrbitScheduler } from "../motion/hero-orbit";
import { peopleHref } from "../features/profile-people";
import { AccessWelcome } from "../components/AccessWelcome";
import { useDeviceLocation } from "../features/useDeviceLocation";
import { baiduMarkerUrl } from "../features/map-geometry";
import { RestaurantHeaderFavorite } from "../features/v4/RestaurantHeaderFavorite";
import { RestaurantMoreActions } from "../features/RestaurantMoreActions";
import { useReturnTo } from "../app/navigation";
import { useProfileReturnTo } from "../app/profile-navigation";
import "./restaurant-detail.css";
import { distanceText } from "../features/RecommendShops";
import { FoodReportDialog } from "../features/FoodReportDialog";
import { RestaurantCorrectionDialog } from "../features/RestaurantCorrectionDialog";
import { useShareLink } from "../features/useShareLink";
import { HomeSearchButton, HomeSearchOverlay } from "./HomeSearch";
import { PublishButton } from "../components/PublishButton";

const FoodExtras = React.lazy(() =>
  import("../features/v4/DetailExtras").then((module) => ({
    default: module.FoodExtras,
  })),
);
const RestaurantExtras = React.lazy(
  () => import("../features/v4/DetailExtras"),
);

const needsVerification = new Set([
  "G-PickShop",
  "G-AddDish",
  "G-NewShop",
  "G-Crop",
  "G-MyTags",
  "G-PanelTag",
]);
const publicScreens = new Set([
  "G2-Home",
  "G-HomePhoto",
  "G-Dish",
  "G-Detail",
  "G-Nearby",
  "G-Search",
  "G-PanelPlace",
  "G-Login",
  "G-PasswordLogin",
  "G-PhoneLogin",
  "G-RegisterConfirm",
  "G-ForgotPassword",
  "G-DataNotice",
  "G-SettingsAbout",
  "G-Kit",
  "G-Icons",
  "G-Icon",
  "G-Nav",
  "G-PhotoPipeline",
]);
const homeScreens = new Set(["G2-Home", "G-HomePhoto"]);
const pickShopClasses: Record<number, string> = {
  2: "mobile-pick-shop-header",
  8: "mobile-pick-shop-title",
  9: "mobile-pick-shop-search",
  13: "mobile-pick-shop-area",
  27: "mobile-pick-shop-create",
};
const qstyle = (on: boolean) => ({
  on: on ? "true" : "false",
  bg: on ? "#231C18" : "#F4EFEB",
  fg: on ? "#FFFFFF" : "#231C18",
  w: on ? 600 : 400,
});
function clean(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function matches(view: NodeView, text: string) {
  return clean(view.text) === text;
}

function PlaceLocateButton({ disabled }: { disabled: boolean }) {
  const { area, selectionVersion, selectArea } = useArea();
  const { closePanel } = useMobile();
  const { locate, locating } = useDeviceLocation({
    selectionVersion,
    selectArea: (point) => {
      selectArea(point);
      closePanel();
    },
    disabled,
  });
  const active = area?.source === "device";
  return (
    <button
      type="button"
      className="mobile-place-locate"
      aria-pressed={active}
      data-active={active || undefined}
      disabled={disabled || locating}
      onClick={locate}
    >
      <DesignIcon name="locate" size={14} />
      {locating ? "正在定位…" : "使用我的位置"}
    </button>
  );
}

export function useDesignBridge(
  screen: string,
  controller: Controller,
  original: Values,
  reference: boolean,
): Bridge {
  const getSignal = useSendSignal();
  const app = useApp(),
    { api, user, session, toast } = app,
    m = useMobile(),
    nav = useNavigate(),
    location = useLocation(),
    cache = useQueryClient(),
    { area, selectArea, campusId, selectCampus } = useArea();
  // Latest draft, for callbacks that finish after later edits (photo uploads).
  const draftRef = useRef(m.draft);
  draftRef.current = m.draft;
  const photoEdit = m.draft.photoEdit;
  const coverEdit = !!photoEdit && photoEdit.targetUrl === m.draft.images[0]?.url;
  const dishPhotoInput = useRef<HTMLInputElement>(null);
  const photoOpening = useRef(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const homeOrbit = useRef<HTMLDivElement>(null);
  const orbitMotion = useRef({
    scheduler: createHeroOrbitScheduler(dragHomePlates),
    pointer: null as {
      id: number;
      x: number;
      y: number;
      plateWidth: number;
      axis: "x" | "y" | null;
    } | null,
  });
  useEffect(() => () => orbitMotion.current.scheduler.cancel(), []);
  const access = useActionAccess();
  const sharing = useShareLink();
  const profileReturnTo = useProfileReturnTo();
  const profileDraft = useProfileDraft();
  const profile =
    screen === "G-EditProfile" && !reference ? profileDraft : null;
  const foodBack = useReturnTo("/"),
    shopBack = useReturnTo("/nearby");
  const activeLocation = useRef(location.key);
  activeLocation.current = location.key;
  useEffect(() => {
    activeLocation.current = location.key;
    return () => {
      activeLocation.current = "unmounted";
    };
  }, [location.key]);
  const campusList = useQuery({
    queryKey: ["campuses"],
    queryFn: () => api.campuses(),
    enabled: !reference,
  });
  const [localBusy, setBusy] = useState(false),
    [duplicate, setDuplicate] = useState<number>(),
    [error, setError] = useFeedbackState(),
    [done, setDone] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [avatarCrop, setAvatarCrop] = useState<Draft["images"][number] | null>(
    null,
  );
  const tagAdding = useRef(false),
    publishLock = useRef(false);
  const publishUncertain = screen === "G-AddDish" && !!m.draft.publishUncertain;
  const busy =
    localBusy ||
    !!profile?.phase ||
    (screen === "G-AddDish" &&
      (!!m.draft.publishing || m.draft.images.some((photo) => photo.preparing)));
  const active = !reference && !!session,
    verified = active && user?.verified === true && !user?.banned;
  const browse = !reference;
  const foodId =
    parseId(location.pathname.match(/^\/foods\/(\d+)/)?.[1]) ?? m.foodId;
  const shopId =
    parseId(location.pathname.match(/^\/restaurants\/(\d+)/)?.[1]) ?? m.shopId;
  const draftPanel =
    screen === "G-PanelTag" && location.pathname === "/publish/dish";
  const otherId =
    parseId(location.pathname.match(/^\/users\/(\d+)/)?.[1]) ?? 21;
  const followingUserId = parseId(
    new URLSearchParams(location.search).get("userId") ?? undefined,
  );
  useEffect(
    () => setPage(1),
    [controller.state.tab, search, controller.state.q],
  );
  useEffect(() => setReportOpen(false), [screen, foodId]);
  useEffect(() => setCorrectionOpen(false), [screen, shopId]);
  useEffect(() => setAvatarCrop(null), [screen]);
  const discovery = useHomeDiscovery(browse && homeScreens.has(screen));
  const { hero: recommendations, heroFoods: recommendedFoods } = discovery;
  const recommendationCopy = useRef<HTMLElement>(null);
  const carouselFoods = screen === "G-HomePhoto" ? recommendedFoods.slice(0, 5) : recommendedFoods;
  const count = carouselFoods.length;
  const recommendationIndex = count ? (((controller.state.n ?? 0) % count) + count) % count : 0;
  const featuredFood = carouselFoods[recommendationIndex];
  useContentMotion(
    recommendationCopy,
    reference
      ? undefined
      : (featuredFood?.id ?? undefined),
    0,
    "y",
  );
  const detail = useQuery({
    queryKey: ["foods", "detail", foodId],
    queryFn: () => api.food(foodId),
    staleTime: 0,
    enabled:
      browse &&
      !draftPanel &&
      [
        "G-Dish",
        "G-PanelTag",
        "G-Comments",
        "G-WriteComment",
        "G-PanelReport",
      ].includes(screen),
  });
  const restaurant = useQuery({
    queryKey: ["restaurants", "detail", shopId],
    queryFn: () => api.restaurant(shopId),
    staleTime: 0,
    enabled:
      browse && ["G-Detail", "G-AddDish", "G-WrongInfo"].includes(screen),
  });
  const selectedShopName =
    restaurant.data?.name?.trim() ||
    (m.draft.restaurantId === shopId ? m.draft.shopName?.trim() : undefined);
  useEffect(() => {
    const name = restaurant.data?.name?.trim();
    if (
      !reference &&
      screen === "G-AddDish" &&
      name &&
      (m.draft.restaurantId !== shopId || m.draft.shopName !== name)
    )
      m.setDraft({ restaurantId: shopId, shopName: name });
  }, [reference, screen, shopId, restaurant.data?.name]);
  const restaurantFoods = useQuery({
    queryKey: ["foods", "restaurant", shopId, page],
    queryFn: () => api.foods(shopId, page),
    placeholderData: keepPreviousData,
    enabled: browse && screen === "G-Detail",
  });
  const dishRestaurant = useQuery({
    queryKey: ["restaurants", "detail", detail.data?.restaurantId],
    queryFn: () => api.restaurant(detail.data!.restaurantId!),
    enabled: browse && screen === "G-Dish" && !!detail.data?.restaurantId,
  });
  const favoriteTag = screen === "G-TagDishes" ? m.tagId : undefined;
  const favorites = useQuery({
    queryKey: ["foods", "favorites", page, favoriteTag],
    queryFn: () =>
      api.favorites(page, {
        myCustomTagIds: favoriteTag ? [favoriteTag] : undefined,
      }),
    enabled: active && screen === "G-TagDishes",
  });
  const myTags = useQuery({
    queryKey: ["my-tags", page],
    queryFn: () => api.myTags(page),
    enabled:
      verified &&
      ["G-MyTags", "G-PanelTag", "G-AddDish", "G-TagDishes"].includes(
        screen,
      ),
  });
  const systemTags = useQuery({
    queryKey: ["system-tags"],
    queryFn: () => api.systemTags(),
    enabled: verified && ["G-PanelTag", "G-AddDish"].includes(screen),
  });
  const tags = useQuery({
    queryKey: ["food-tags", foodId],
    queryFn: () => api.foodTags(foodId),
    enabled: verified && screen === "G-PanelTag" && !draftPanel,
  });
  // Read status during this hook's render. The lazy artboard may mount after a
  // request has failed; reading status only in its node callback misses updates.
  const systemTagSource = {
    pending: systemTags.isPending,
    error: systemTags.isError ? errorMessage(systemTags.error) : undefined,
    retry: () => void systemTags.refetch(),
  };
  const personalTagSource = {
    pending: myTags.isPending || (!draftPanel && tags.isPending),
    error:
      myTags.isError || (!draftPanel && tags.isError) ? "读取失败" : undefined,
    retry: () => {
      void myTags.refetch();
      if (!draftPanel) void tags.refetch();
    },
  };
  const personal = useQuery({
    queryKey: ["user", user?.id],
    queryFn: () => api.otherUser(user!.id!),
    enabled:
      active && !!user?.id && screen === "G-SettingsPrivacy",
  });
  const other = useQuery({
    queryKey: ["user", otherId],
    queryFn: () => api.otherUser(otherId),
    enabled: active && screen === "G-UserProfile",
  });
  const history = useQuery({
    queryKey: ["history", controller.state.tab ?? "dish", page],
    queryFn: () =>
      api.history(
        controller.state.tab === "shop" ? "restaurant" : "food",
        page,
      ),
    enabled: active && screen === "G-History",
  });
  const follows = useQuery({
    queryKey: [
      "social",
      followingUserId,
      controller.state.tab ?? "follow",
      page,
    ],
    queryFn: () =>
      api.followers(
        controller.state.tab === "fans" ? "followers" : "followings",
        followingUserId,
        page,
      ),
    enabled: active && screen === "G-Follows",
  });
  const notifications = useQuery({
    queryKey: ["notifications", "list", page],
    queryFn: () => api.notifications(page),
    enabled: active && screen === "G-Inbox",
  });
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => unreadCount(api),
    enabled: active && (homeScreens.has(screen) || screen === "G-Inbox"),
    refetchInterval: 60_000,
  });
  const [hubKeyword, setHubKeyword] = useState("");
  const debouncedHubKeyword = useDebouncedSearch(hubKeyword.trim());
  const hubs = useQuery({
    queryKey: ["hubs", 1, debouncedHubKeyword],
    queryFn: () => api.hubs(1, debouncedHubKeyword || undefined),
    enabled: browse && screen === "G-PanelPlace",
    placeholderData: (previous) => previous,
  });
  const pickingShop = screen === "G-PickShop";
  const queryKeyword = pickingShop
    ? search.trim()
    : String(controller.state.q ?? "");
  const debouncedKeyword = useDebouncedSearch(queryKeyword);
  const shopPage = pickingShop ? 1 : page;
  const shopLimit = pickingShop && !debouncedKeyword ? 5 : 12;
  const shops = useQuery({
    queryKey: [
      "restaurants",
      "mobile-search",
      area,
      debouncedKeyword,
      shopPage,
      shopLimit,
    ],
    queryFn: () => {
      const filters = {
        keyword: debouncedKeyword || undefined,
        page: shopPage,
        pageSize: shopLimit,
      };
      return area
        ? api.restaurantSearch({
            ...filters,
            gcjLng: area.gcjLng,
            gcjLat: area.gcjLat,
            hubId: area.hubId,
            sort: pickingShop && !debouncedKeyword ? "DISTANCE" : undefined,
          })
        : api.browseRestaurants(filters);
    },
    enabled: pickingShop ? verified : browse && screen === "G-Search",
    placeholderData: pickingShop ? undefined : keepPreviousData,
  });
  const relevant = homeScreens.has(screen)
    ? recommendations
    : screen === "G-Dish"
      ? detail
      : screen === "G-Detail"
        ? restaurant
        : screen === "G-MyTags"
          ? myTags
          : screen === "G-TagDishes"
            ? favorites
            : screen === "G-History"
              ? history
              : screen === "G-Follows"
                ? follows
                : screen === "G-Inbox"
                  ? notifications
                  : screen === "G-UserProfile"
                    ? other
                    : null;
  const values: Values = { ...original };
  const heroWithoutDish =
    homeScreens.has(screen) &&
    !recommendations.isPending &&
    carouselFoods.length === 0;
  // Shops without signature dishes are still listed below the empty plate.
  const homeWithoutRecommendations =
      heroWithoutDish && !discovery.heroHasShops,
    shopsWithoutDish = heroWithoutDish && !!discovery.heroHasShops;
  const liveFood = detail.data;
  const reactions = useFoodReaction({
    foodId,
    food: liveFood,
    onError: (e) => {
      setError(errorMessage(e));
      setDuplicate(duplicateFoodId(e));
      if (resultUncertain(e)) setUncertain(true);
    },
  });
  async function run(fn: () => Promise<unknown>, success?: string) {
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
      if (success) toast(success);
    } catch (e) {
      setError(errorMessage(e));
      setDuplicate(duplicateFoodId(e));
      if (resultUncertain(e)) setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  async function addPanelTag() {
    if (tagAdding.current || busy) return false;
    try {
      const name = normalizedTag(String(controller.state.draft ?? ""));
      const selected = draftPanel
        ? m.draft.tags
        : (tags.data?.myCustomTags ?? []).map((t) => t.name ?? "");
      const next = withDraftTag(selected, name);
      if (!draftPanel && (tags.isPending || tags.isError))
        throw new Error("请先重新读取这道菜的标签，再进行修改。");
      tagAdding.current = true;
      setBusy(true);
      setError("");
      const exists = selected.map(normalizedTag).includes(name);
      if (draftPanel) m.setDraft({ tags: next });
      else if (!exists) {
        await api.addCustomTags(foodId, [name]);
        await Promise.all([
          cache.invalidateQueries({ queryKey: ["food-tags", foodId] }),
          cache.invalidateQueries({ queryKey: ["my-tags"] }),
          cache.invalidateQueries({ queryKey: ["foods"] }),
        ]);
      }
      controller.setState({
        draft: "",
        tagStatus: exists ? `「${name}」已经选中` : `已添加「${name}」`,
      });
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      tagAdding.current = false;
      setBusy(false);
    }
  }
  const unavailable = (name: string) => {
    const feature = name
      .replace(/待接入|敬请期待/g, "")
      .replace(/（\s*）/g, "")
      .trim();
    m.notice(
      `${feature}${feature.endsWith("功能") ? "" : "功能"}正在准备中，敬请期待。`,
    );
  };
  async function toggleFavorite() {
    await reactions.toggle("favorite");
  }
  async function login(mockAccount = false) {
    await run(async () => {
      const reply = await api.login({
        userName:
          isDemo && mockAccount
            ? "mock_student"
            : String(controller.state.account ?? "").trim(),
        password:
          isDemo && mockAccount
            ? "mock-password"
            : String(controller.state.pwd ?? ""),
        device: "WEB",
      });
      const result = classifyAuth(reply);
      if (result.kind === "session") {
        await app.signIn(result.session);
        const next = new URLSearchParams(location.search).get("next");
        nav(
          next?.startsWith("/") &&
            !next.startsWith("//") &&
            !next.startsWith("/auth")
            ? next
            : "/",
        );
      } else throw new Error(result.message);
    });
  }
  function chooseFiles() {
    if (photoOpening.current || busy || publishUncertain) return;
    // A native camera can return without firing change or cancel.
    dishPhotoInput.current?.click();
  }
  async function openPhotoEditor(
    source: File,
    framing: PhotoFraming,
    targetUrl?: string,
  ) {
    if (photoOpening.current || busy || publishUncertain) return;
    photoOpening.current = true;
    setPhotoBusy(true);
    const page = location.key;
    try {
      if (targetUrl === undefined)
        validateFiles([source], draftRef.current.images.length);
      const candidates = await recommendPhotoStage(source, framing);
      if (activeLocation.current !== page) return;
      m.setDraft({
        photoEdit: {
          source,
          url: URL.createObjectURL(source),
          targetUrl,
          framing,
          candidates,
        },
      });
      nav("/publish/crop");
    } catch (e) {
      if (activeLocation.current === page) m.notice(errorMessage(e));
    } finally {
      photoOpening.current = false;
      setPhotoBusy(false);
    }
  }
  function editPhoto(index: number) {
    const image = draftRef.current.images[index];
    if (!image) return;
    void openPhotoEditor(
      image.original ?? image.file,
      image.framing ?? { x: 0, y: 0, zoom: 1 },
      image.url,
    );
  }
  function cancelPhotoEdit() {
    if (busy || !photoEdit) return;
    URL.revokeObjectURL(photoEdit.url);
    m.setDraft({ photoEdit: undefined });
    nav("/publish/dish");
  }
  function savePhotoEdit(framing: PhotoFraming, stageChoice?: string | null) {
    if (busy || !photoEdit) return;
    const page = location.key;
    void run(async () => {
      const result = await adjustPhoto(photoEdit.source, framing);
      if (
        activeLocation.current !== page ||
        draftRef.current.photoEdit !== photoEdit
      )
        return;
      const url = URL.createObjectURL(result.file);
      let images: Draft["images"];
      try {
        images = applyPhotoEdit(
          draftRef.current.images,
          photoEdit,
          result,
          url,
          framing,
        );
      } catch (failure) {
        URL.revokeObjectURL(url);
        throw failure;
      }
      m.setDraft({
        images,
        ...(coverEdit && stageChoice !== undefined
          ? { stage: stageChoice ?? undefined }
          : {}),
        photoEdit: undefined,
      });
      URL.revokeObjectURL(photoEdit.url);
      if (photoEdit.targetUrl?.startsWith("blob:"))
        URL.revokeObjectURL(photoEdit.targetUrl);
      nav("/publish/dish");
    });
  }
  async function publish() {
    if (
      publishLock.current ||
      busy ||
      photoBusy ||
      uncertain ||
      m.draft.publishing ||
      m.draft.publishUncertain ||
      !access(true)
    )
      return;
    publishLock.current = true;
    const publishingLocation = location.key;
    try {
      await run(async () => {
        const draft = {
          ...m.draft,
          tags: withDraftTags(m.draft.tags, m.draft.tagInput ?? ""),
          tagInput: "",
        };
        validateFoodDraft(draft);
        if (!draft.name.trim()) throw new Error("写一个菜名，再发布。");
        if (!draft.images.length) throw new Error("先加一张你拍的照片。");
        if (!shopId) throw new Error("先选一家店。");
        const price =
          draft.price.trim() === "" ? undefined : Number(draft.price);
        if (
          price !== undefined &&
          (!Number.isFinite(price) ||
            price < 0 ||
            price > 999 ||
            Math.abs(price * 10 - Math.round(price * 10)) > 0.000001)
        )
          throw new Error("价格为 0 至 999，最多保留一位有效小数。");
        if (
          draft.tags.length > 20 ||
          draft.tags.some(
            (tag) => !tag.trim() || [...normalizedTag(tag)].length > 10,
          )
        )
          throw new Error("最多添加 20 个个人标签，每个标签不超过 10 字。");
        m.setDraft({
          tags: draft.tags,
          tagInput: "",
          publishing: true,
          publishPhase: draft.images.some((image) => !image.key)
            ? "uploading"
            : "submitting",
        });
        let creating = false;
        try {
          const images = [...draft.images];
          const pending = images
            .map((image, index) => ({ image, index }))
            .filter(({ image }) => !image.key);
          if (pending.length)
            await app.uploadMany(
              pending.map(({ image }) => image.file),
              "foods",
              (index, key) => {
                images[pending[index].index] = {
                  ...images[pending[index].index],
                  key,
                };
                m.setDraft({ images: [...images] });
              },
            );
          // Photos uploaded earlier (for the AI suggestion) need it as well.
          const stage = draftStage(draft);
          for (const image of images)
            if (image.key) saveVisual(image.key, stage);
          m.setDraft({ publishPhase: "submitting" });
          creating = true;
          const created = await api.createFood({
            restaurantId: shopId,
            name: draft.name.trim(),
            price,
            description: draft.description || undefined,
            category: (draft.category || "staple") as Category,
            pictureUrl: images.map((i) => i.key!),
            systemTagIds: draft.systemTagIds,
            signature: !!draft.signature,
            mealTimes: draft.mealTimes ?? [],
            deliveryEnabled: !!draft.deliveryEnabled,
            ...publishDisplay(stage, images[0]?.stageCandidates),
            coverCrop: { centerX: 0.5, centerY: 0.5, diameter: 1 },
          });
          setDone(true);
          for (const image of draft.images) URL.revokeObjectURL(image.url);
          m.setDraft({
            name: "",
            price: "",
            category: "staple",
            description: "",
            images: [],
            tags: [],
            tagInput: "",
            systemTagIds: [],
            signature: false,
            mealTimes: [],
            deliveryEnabled: false,
            stage: undefined,
            crop: undefined,
            restaurantId: undefined,
            restaurantPicked: false,
            shopName: undefined,
            publishing: false,
            publishPhase: undefined,
            publishUncertain: false,
          });
          m.setFoodId(created.id);
          toast(
            created.revisionId
              ? "菜品已提交，等待审核。"
              : "菜已发布。",
          );
          if (activeLocation.current === publishingLocation)
            nav(created.revisionId ? "/me/shares" : `/foods/${created.id}`);
        } catch (error) {
          if (creating && resultUncertain(error))
            m.setDraft({ publishUncertain: true });
          throw error;
        } finally {
          m.setDraft({ publishing: false, publishPhase: undefined });
        }
      });
    } finally {
      publishLock.current = false;
    }
  }

  if (screen === "G-PanelPlace" && !reference) {
    // Selection comes from the shared meal state, hours from the backend slots.
    const look = (on: boolean) => ({
      on: on ? "true" : "false",
      bg: on ? "#F4EFEB" : "transparent",
      w: on ? 700 : 500,
      ring: on ? "#231C18" : "#D9D0C9",
      fill: on ? "#231C18" : "transparent",
      check: on ? 1 : 0,
    });
    values.auto = { ...look(m.mealAuto), pick: () => {} };
    values.meals = mealOptions.map((meal) => ({
      key: meal.id,
      name: meal.name,
      time: mealHours[meal.id],
      ...look(!m.mealAuto && m.mealTime === meal.id),
      pick: () => {},
    }));
  }
  if (homeScreens.has(screen) && !reference) {
    const list = carouselFoods,
      N = list.length,
      n = controller.state.n ?? 0,
      k = N ? ((n % N) + N) % N : 0,
      down = values.down,
      next = values.next;
    const visual = visualFor(list[k] ?? { name: "", category: "drink" }, isDemo);
    values.s = { ...visual, stage: visual.stageSurface };
    values.dots = list.map((_, i) => ({
      w: i === k ? 16 : 5,
      o: i === k ? 1 : 0.4,
    }));
    values.down = (e: React.PointerEvent<HTMLElement>) => {
      const state = orbitMotion.current;
      if (N < 2 || e.button !== 0 || state.pointer) return;
      const plate = homeOrbit.current?.querySelector<HTMLElement>(
        '[data-orbit-offset="0"]',
      );
      if (!plate?.offsetWidth) return;
      state.pointer = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        plateWidth: plate.offsetWidth,
        axis: null,
      };
      down(e);
    };
    values.move = (e: React.PointerEvent<HTMLElement>) => {
      const { pointer, scheduler } = orbitMotion.current;
      if (!pointer || pointer.id !== e.pointerId) return;
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      if (!pointer.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 6)
        pointer.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (pointer.axis === "x" && homeOrbit.current && !instantMotion()) {
        scheduler.update(
          homeOrbit.current,
          homeOrbitDragAngle(dx, pointer.plateWidth),
        );
      }
    };
    const endDrag = (steps: number) => {
      const state = orbitMotion.current;
      state.scheduler.cancel();
      state.pointer = null;
      controller.setState({
        n: (controller.state.n ?? 0) + steps,
        drag: 0,
        dragging: false,
      });
    };
    values.up = (e: React.PointerEvent<HTMLElement>) => {
      const pointer = orbitMotion.current.pointer;
      if (!pointer || pointer.id !== e.pointerId) return;
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      const horizontal =
        pointer.axis === "x" ||
        (pointer.axis === null && Math.abs(dx) > Math.abs(dy));
      endDrag(horizontal && Math.abs(dx) > 30 && N > 1 ? -Math.sign(dx) : 0);
    };
    values.cancelDrag = (e: React.PointerEvent<HTMLElement>) => {
      const { pointer } = orbitMotion.current;
      if (pointer && pointer.id === e.pointerId) endDrag(0);
    };
    values.next = () => {
      if (N < 2) return;
      orbitMotion.current.scheduler.cancel();
      orbitMotion.current.pointer = null;
      next();
    };
  }
  if (screen === "G-Login" && !reference) {
    values.agreed = true;
    values.notAgreed = !values.agreed;
  }
  if (screen === "G-PasswordLogin" && !reference) {
    values.msg = error;
    values.hasMsg = false;
    values.invalid = !!error;
    values.line = error ? "#A8321C" : "#E6DED8";
    values.locked = busy;
    values.canLogin = !busy;
  }
  if (screen === "G-Verify" && !reference) {
    values.verified = user?.verified === true;
    values.unverified = !values.verified;
    values.done = values.verified;
    values.send = () =>
      run(
        () => {
          const email = String(controller.state.email ?? "").trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            throw new Error("填写有效的学校邮箱。");
          return api.sendEmail(email, getSignal());
        },
        isDemo ? "演示模式不发送邮件" : "验证邮件已发送",
      );
  }
  if (screen === "G-Dish" && liveFood && !reference) {
    values.fav = liveFood.isFavorite === true;
    values.notFav = !values.fav;
    values.favOn = values.fav;
    values.flipFav = toggleFavorite;
  }
  if (screen === "G-ChangePassword" && !reference) {
    values.wrong = false;
    values.oldBad = false;
    values.oldLine = "#E6DED8";
    values.submit = () =>
      run(async () => {
        if (
          !controller.state.old ||
          String(controller.state.pwd ?? "").length < 6
        )
          throw new Error("填写当前密码，和至少 6 位的新密码。");
        await api.changePassword({
          oldPassword: controller.state.old,
          newPassword: controller.state.pwd,
        });
        controller.setState({ done: true });
      });
  }
  if (screen === "G-MyTags" && !reference) {
    const editing = controller.state.edit;
    values.n = myTags.data?.totalItems ?? 0;
    values.tags = (myTags.data?.items ?? []).map((t) => ({
      name: t.name,
      count: t.usageCount ?? 0,
      id: t.id,
      renaming: controller.state.renaming === t.id,
      showing: controller.state.renaming !== t.id,
      edit: editing,
      plain: !editing,
      draft: controller.state.draft ?? "",
      setDraft: (e: any) =>
        controller.setState({
          draft: [...e.target.value].slice(0, 10).join(""),
        }),
      rename: () => controller.setState({ renaming: t.id, draft: t.name }),
      save: () =>
        run(async () => {
          await api.renameTag(t.id!, String(controller.state.draft).trim());
          controller.setState({ renaming: -1 });
        }),
      remove: () =>
        m.confirm(`删除「${t.name}」会解除它与菜品的关联，收藏本身保留。`, () =>
          run(() => api.deleteTag(t.id!), "分类已删除"),
        ),
    }));
  }
  if (screen === "G-PanelTag" && !reference) {
    values.taste = (systemTags.data ?? []).map((t) => {
      const on = draftPanel
        ? m.draft.systemTagIds?.includes(t.id!)
        : tags.data?.systemTags?.some((x) => x.id === t.id && x.taggedByMe);
      return {
        name: t.name,
        on: on ? "true" : "false",
        bg: on ? "#FBEFD9" : "#FFFFFF",
        line: on ? "#231C18" : "#E6DED8",
        w: on ? 600 : 400,
        pick: () =>
          draftPanel
            ? m.setDraft({
                systemTagIds: on
                  ? (m.draft.systemTagIds ?? []).filter((id) => id !== t.id)
                  : [...(m.draft.systemTagIds ?? []), t.id!],
              })
            : run(() =>
                on
                  ? api.removeTag(foodId, t.id!)
                  : api.addSystemTags(foodId, [t.id!]),
              ),
      };
    });
    const attached = tags.data?.myCustomTags ?? [];
    const names = [
      ...new Set(
        [
          ...(draftPanel ? m.draft.tags : attached.map((t) => t.name ?? "")),
          ...(myTags.data?.items ?? []).map((t) => t.name ?? ""),
        ]
          .map(normalizedTag)
          .filter(Boolean),
      ),
    ];
    values.mine = names.map((name) => {
      const attachedTag = attached.find(
        (t) => normalizedTag(t.name ?? "") === name,
      );
      const on = draftPanel
        ? m.draft.tags.map(normalizedTag).includes(name)
        : !!attachedTag;
      return {
        name,
        ...qstyle(!!on),
        pick: () => {
          if (draftPanel) {
            try {
              m.setDraft({
                tags: on
                  ? m.draft.tags.filter((n) => normalizedTag(n) !== name)
                  : withDraftTag(m.draft.tags, name),
              });
              setError("");
            } catch (e) {
              setError(errorMessage(e));
            }
          } else
            void run(() =>
              on
                ? api.removeTag(foodId, attachedTag!.id!)
                : api.addCustomTags(foodId, [name]),
            );
        },
      };
    });
  }
  if (screen === "G-AddDish" && !reference) {
    const picked = Math.max(0, categoryCodes.indexOf(m.draft.category));
    values.cats = foodCategories.map((c, i) => {
      const on = i === picked;
      return {
        label: c.name,
        on: on ? "true" : "false",
        bg: on ? "#231C18" : "#F4EFEB",
        fg: on ? "#FFFFFF" : "#231C18",
        w: on ? 600 : 400,
        pick: () => {
          controller.setState({ cat: i });
          m.setDraft({ category: categoryCodes[i] });
        },
      };
    });
    values.desc = m.draft.description;
    values.descLen = m.draft.description.length;
    values.setDesc = (e: any) => {
      m.setDraft({ description: e.target.value.slice(0, 200) });
      controller.setState({ desc: e.target.value.slice(0, 200) });
    };
    values.tags = (systemTags.data ?? []).map((t) => ({
      label: t.name,
      ...qstyle(!!m.draft.systemTagIds?.includes(t.id!)),
      line: m.draft.systemTagIds?.includes(t.id!) ? "#231C18" : "#E6DED8",
      toggle: () =>
        m.setDraft({
          systemTagIds: m.draft.systemTagIds?.includes(t.id!)
            ? m.draft.systemTagIds.filter((id) => id !== t.id)
            : [...(m.draft.systemTagIds ?? []), t.id!],
        }),
    }));
  }
  if (pickingShop && !reference) {
    values.rows = (shops.data?.items ?? []).flatMap((shop) => {
      const id = shop.id;
      if (id == null) return [];
      const current = m.draft.restaurantPicked && m.draft.restaurantId === id;
      return [
        {
          id,
          name: shop.name,
          hub: shop.address ?? "",
          img: mediaUrl(shop.pictureUrl?.[0]) ?? "/assets/restaurants/shop.svg",
          tint: "#F4EFEB",
          bg: current ? "#FFF0C3" : "#F4EFEB",
          current,
          pick: () => {
            if (!access(true)) return;
            m.setShopId(id);
            m.setDraft({
              restaurantId: id,
              shopName: shop.name ?? "",
              restaurantPicked: true,
            });
            nav("/publish/dish");
          },
        },
      ];
    });
  }
  if (screen === "G-History" && !reference) {
    values.rows = (history.data?.items ?? []).map((h) => {
      const f = h.food ?? h.restaurant;
      return {
        title: f?.name ?? "内容暂不可用",
        sub: h.targetType === "food" ? "菜品" : "餐厅",
        time: relativeTime(h.viewedAt),
        hasImg: !!f?.pictureUrl?.[0],
        noImg: !f?.pictureUrl?.[0],
        img: mediaUrl(f?.pictureUrl?.[0]) ?? "",
        href:
          h.targetType === "food"
            ? `/foods/${h.targetId}`
            : `/restaurants/${h.targetId}`,
      };
    });
  }
  if (screen === "G-Follows" && !reference) {
    values.who = followingUserId ? "TA 的粉丝和关注" : "我的粉丝和关注";
    values.backTo = followingUserId
      ? `/users/${followingUserId}`
      : "G-Me.dc.html";
    values.rows = (follows.data?.items ?? []).map((p) => ({
      name: p.displayName,
      initial: p.displayName?.slice(0, 1) ?? "食",
      sign: "",
      label: "查看主页",
      bg: "#F4EFEB",
      fg: "#231C18",
      solid: false,
      light: true,
      flip: () => nav(`/users/${p.id}`),
      id: p.id,
    }));
    values.visible = true;
    values.hidden = false;
    values.followN =
      controller.state.tab === "fans" ? "" : (follows.data?.totalItems ?? "—");
    values.fansN =
      controller.state.tab === "fans" ? (follows.data?.totalItems ?? "—") : "";
  }
  if (screen === "G-UserProfile" && !reference) {
    values.following = other.data?.isFollowingHim === true;
    values.notFollowing = !values.following;
    values.flip = () => run(() => api.follow(otherId, values.following));
  }
  if (screen === "G-SettingsNotify" && !reference)
    values.types = (original.types ?? []).map((t: any) => ({
      ...t,
      flip: () => unavailable("通知设置"),
    }));
  if (screen === "G-Search" && !reference) {
    values.showResults = !!queryKeyword;
    values.showRecent = !queryKeyword;
    values.showNone = false;
    values.recent = (original.recent ?? []).map((r: any) => ({
      ...r,
      pick: () => controller.setState({ q: r.word, tab: "shop" }),
    }));
  }
  if (screen === "G-SettingsPrivacy" && !reference) {
    values.lists = [
      {
        id: "following",
        label: "公开我的关注列表",
        sub: "关掉后别人点开，看到的是「对方没有公开」",
        value: personal.data?.followingsVisible,
      },
      {
        id: "follower",
        label: "公开我的粉丝列表",
        sub: "关掉后别人点开，看到的是「对方没有公开」",
        value: personal.data?.fansVisible,
      },
    ].map((s) => ({
      ...s,
      on: s.value ? "true" : "false",
      track: s.value ? "#231C18" : "#E6DED8",
      align: s.value ? "flex-end" : "flex-start",
      shadow: "0 1px 3px rgba(0,0,0,.15)",
      flip: () =>
        s.value == null
          ? m.notice("未能读取当前隐私状态，请稍后重试。")
          : run(() => api.privacy({ [s.id]: !s.value })),
    }));
    values.perso = {
      ...original.perso,
      flip: () => unavailable("个性化推荐开关"),
    };
  }
  // Never execute the prototype's fake verification, auto-filled SMS or fake submission handlers.
  if (pendingScreens[screen] && !reference) {
    for (const key of ["send", "submit", "kickAll", "addPhoto"])
      if (values[key]) values[key] = () => unavailable(pendingScreens[screen]);
    if (screen === "G-Devices") {
      values.others = [];
      values.hasOthers = false;
      values.noOthers = false;
    }
    if (screen === "G-Blocked") {
      values.people = [];
      values.hasAny = false;
      values.none = true;
    }
  }

  const node = (view: NodeView): ReactNode | undefined => {
    if (reference) return referenceNode(view, m);
    const { node: n, props: p, text, scope } = view,
      st = p.style ?? {},
      tag = n.tag,
      id = n.id;
    if (screen === "G-Me" && id === 1) return <MobileProfile />;
    if (screen === "G-Crop" && id === 1 && photoEdit)
      return (
        <DishPhotoEditor
          key={photoEdit.url}
          edit={photoEdit}
          cover={
            coverEdit ? { name: m.draft.name, stage: m.draft.stage } : undefined
          }
          busy={busy}
          onCancel={cancelPhotoEdit}
          onApply={savePhotoEdit}
        />
      );
    if (screen === "G-Settings" && id === 25) return null;
    if (screen === "G-PanelTag" && id === 5) {
      const close = () => (m.panel ? m.closePanel() : nav(`/foods/${foodId}`));
      return (
        <TagPanel
          draft={draftPanel}
          system={values.taste.map((t: any) => ({
            name: t.name,
            selected: t.on === "true",
            toggle: () => void t.pick(),
          }))}
          personal={values.mine.map((t: any) => ({
            name: t.name,
            selected: t.on === "true",
            toggle: () => void t.pick(),
          }))}
          systemSource={systemTagSource}
          personalSource={personalTagSource}
          value={String(controller.state.draft ?? "")}
          onChange={(draft) => {
            controller.setState({ draft, tagStatus: "" });
            setError("");
          }}
          onAdd={addPanelTag}
          onDone={() => {
            if (String(controller.state.draft ?? "").trim())
              void addPanelTag().then((saved) => {
                if (saved) close();
              });
            else close();
          }}
          onClose={close}
          busy={busy}
          error={error}
          status={String(controller.state.tagStatus ?? "")}
        />
      );
    }
    if (tag === "span" && st.width === "36px" && st.height === "4px") {
      if (screen === "G-Detail") return null;
      if (panelScreens.has(screen))
        return (
          <SheetHandle
            mode="dismiss"
            label="面板"
            disabled={busy}
            onDismiss={() => (m.panel ? m.closePanel() : nav("/"))}
          />
        );
      if (screen === "G-Settings")
        return (
          <SheetHandle
            mode="dismiss"
            label="退出确认"
            disabled={busy}
            onDismiss={() => controller.setState({ asking: false })}
          />
        );
      if (screen === "G-EditProfile")
        return (
          <SheetHandle
            mode="dismiss"
            label="头像选项"
            disabled={busy}
            onDismiss={() => controller.setState({ sheet: false })}
          />
        );
      if (homeScreens.has(screen)) return <HomeSheetHandle />;
      const labels: Record<string, string> = {
        "G-AddDish": "发布表单",
        "G-UserProfile": "食友分享",
      };
      if (labels[screen]) return <SheetHandle label={labels[screen]} />;
    }
    if (typeof p["aria-label"] === "string")
      p["aria-label"] = p["aria-label"].replace(/待接入/g, "敬请期待");
    if (tag === "span" && clean(text) === "待接入")
      return <span {...p}>敬请期待</span>;
    if (screen === "G-Nearby" && id === 1) {
      return (
        <div {...p} className={`${p.className ?? ""} mobile-nearby-screen`}>
          <MobileNearby />
        </div>
      );
    }
    if (screen === "G-PasswordLogin" && tag === "a" && clean(text) === "登录") {
      const { href: _href, onClick: _onClick, ...attributes } = p;
      return (
        <button
          {...attributes}
          type="button"
          style={{ ...st, border: 0, cursor: "pointer" }}
          disabled={busy}
          onClick={() => void login()}
        >
          {view.children}
        </button>
      );
    }
    if (screen === "G-AddDish" && tag === "a" && clean(text) === "发布") {
      const { href: _href, onClick: _onClick, ...attributes } = p;
      return (
        <PublishButton
          {...attributes}
          label="发布"
          pending={busy}
          phase={m.draft.publishPhase}
          disabled={busy || photoBusy || uncertain || publishUncertain}
          style={{ ...st, border: 0, width: "100%" }}
          onClick={() => void publish()}
        />
      );
    }

    if (screen === "G-Login" && id === 24)
      p.style = { ...st, top: 600, overflowY: "auto" };
    if (
      (screen === "G-PasswordLogin" && id === 27) ||
      (screen === "G-Login" && id === 29)
    )
      return null;
    // Business navigation replaces every prototype cross-file link with SPA routes.
    if (tag === "a") {
      const target = String(p.href ?? "");
      p.href =
        "#" +
        (target === "G-Follows.dc.html"
          ? peopleHref(
              screen === "G-UserProfile" ? `/users/${otherId}` : "/me",
              location.search,
              clean(text).includes("粉丝") ? "fans" : "follow",
            )
          : resolveHref(target, m, screen));
      p.onClick = (event: any) => {
        event.preventDefault();
        navigateDesign(target, clean(text), p["aria-label"]);
      };
    }
    if (tag === "button" && !p.onClick && !p.disabled)
      p.onClick = () =>
        unavailable(p["aria-label"] ?? clean(text) ?? "这个功能");
    if (
      tag === "a" &&
      ((screen === "G-Dish" && id === 6) || (screen === "G-Detail" && id === 5))
    ) {
      const back = screen === "G-Dish" ? foodBack : shopBack;
      p.href = "#" + back;
      p.onClick = (event: React.MouseEvent) => {
        event.preventDefault();
        nav(back);
      };
    }
    if (screen === "G-Detail" && id === 8)
      return <RestaurantHeaderFavorite {...p} id={shopId} />;
    if (tag === "ul" && ["G-MyTags", "G-History", "G-Follows"].includes(screen))
      return (
        <ul {...p} style={{ ...st, bottom: 110, overflowY: "auto" }}>
          {view.children}
          {!(relevant?.data as any)?.items?.length && (
            <li style={{ listStyle: "none" }}>
              <MobileEmpty
                title={
                  screen === "G-History" ? "还没有浏览足迹" : "这里还没有内容"
                }
                illustration={screen === "G-History" ? "baozi" : undefined}
                detail={
                  screen === "G-History"
                    ? "看过的菜和店会留在这里，方便下次找回来。"
                    : undefined
                }
              />
            </li>
          )}
          <li style={{ listStyle: "none", padding: "0 20px" }}>
            <More />
          </li>
        </ul>
      );
    if (screen === "G-Devices" && tag === "span" && clean(text) === "iPhone 15")
      return <span {...p}>当前浏览器</span>;
    if (
      screen === "G-Devices" &&
      tag === "span" &&
      clean(text) === "这台设备，正在用"
    )
      return <span {...p}>更多设备管理功能正在准备中，敬请期待</span>;
    if (p.onClick && busy && tag === "button") p.disabled = true;
    if (st.fontFamily?.includes("Bricolage"))
      p.style = {
        ...st,
        fontFamily: "'Bricolage Grotesque Variable',sans-serif",
      };
    if (n.id === 1 && panelScreens.has(screen)) {
      p.style = { ...p.style, background: "transparent" };
    }
    if (panelScreens.has(screen) && n.attrs.role === "dialog")
      p["aria-modal"] = true;
    if (screen === "G-Comments" && id === 15)
      p.className = (p.className ?? "") + " mobile-scroll-region";
    // Make the original absolute-positioned drawers genuinely scrollable without shifting their first frame.
    if (
      st.position === "absolute" &&
      ((st.bottom === "0" && st.top) || n.attrs.role === "radiogroup")
    )
      p.className = (p.className ?? "") + " mobile-scroll-region";
    if (
      n.children.some(
        (c) =>
          typeof c !== "string" &&
          c.tag === "dc-import" &&
          c.attrs.name === "G-Nav",
      )
    )
      p.style = { ...st, zIndex: 30 };
    if (pendingScreens[screen] && tag === "h1" && !/待接入|敬请期待/.test(text))
      return React.createElement(
        "h1",
        p,
        ...view.children,
        <React.Fragment key="pending">
          {" "}
          <Pending />
        </React.Fragment>,
      );
    if (
      tag === "a" &&
      !/待接入|敬请期待/.test(text) &&
      typeof n.attrs.href === "string" &&
      pendingScreens[String(n.attrs.href).replace(".dc.html", "")]
    )
      return React.createElement(
        "a",
        p,
        ...view.children,
        <span key="pending" style={{ marginLeft: 8 }}>
          <Pending />
        </span>,
      );
    if (homeScreens.has(screen)) {
      if (tag === "a" && n.attrs.href === "G-Search.dc.html") return null;
      if (id === 1) {
        // Keep the carousel artwork, but let real text and the list set the
        // document height instead of fitting them into the prototype's viewport.
        const sheetIndex = n.children.findIndex(
          (child) =>
            typeof child !== "string" &&
            String(child.attrs.style).includes("top: 488px"),
        );
        const toolbarIndex = n.children.findIndex(
          (child) => typeof child !== "string" && child.tag === "header",
        );
        return (
          <div
            {...p}
            className={`${p.className ?? ""} mobile-home-screen${homeWithoutRecommendations ? " mobile-home-unavailable" : ""}`}
          >
            {view.children[toolbarIndex]}
            <div
              className="mobile-home-hero"
              data-food-stage={carouselFoods.length ? values.s.stageTone : undefined}
              style={{ background: values.s.stage }}
            >
              {view.children.slice(0, toolbarIndex)}
              <div className="mobile-home-preferences" style={{ color: values.s.on }}>
                <SceneToggle tone="stage" stage={values.s.stage} value={m.scene} onChange={m.setScene} />
              </div>
              {view.children.slice(toolbarIndex + 1, sheetIndex)}
            </div>
            {view.children.slice(sheetIndex)}
          </div>
        );
      }
      if (tag === "div" && st.top === "0" && st.height === "520px")
        p.className = "mobile-home-art";
      if (
        tag === "div" &&
        n.children.some(
          (child) =>
            typeof child !== "string" &&
            String(child.attrs.style).includes("top: 570px"),
        )
      )
        return (
          <HomeOrbit
            foods={carouselFoods}
            position={controller.state.n ?? 0}
            dragging={!!controller.state.dragging}
            orbitRef={homeOrbit}
            demo={isDemo}
          />
        );
      if (tag === "button" && n.attrs.onclick === "{{next}}")
        p.disabled = busy || carouselFoods.length < 2;
      if (tag === "a" && n.attrs.href === "G-Dish.dc.html" && featuredFood?.id)
        p.href = `#/foods/${featuredFood.id}`;
      if (n.attrs.role === "group") {
        p["aria-label"] = "左右滑动换一道菜";
        p.style = {
          ...p.style,
          top: "104px",
          bottom: "90px",
          height: "auto",
          touchAction: "pan-y pinch-zoom",
        };
        p.onPointerCancel = p.onLostPointerCapture = values.cancelDrag;
      }
      if (tag === "header")
        return (
          <header {...p} className="mobile-home-toolbar" style={{ color: values.s.on, backgroundColor: values.s.stage }}>
            {view.children}
          </header>
        );
      if (tag === "div" && st.top === "392px") p.className = "mobile-home-dots";
      if (tag === "div" && st.top === "414px" && !heroWithoutDish) {
        const food = featuredFood;
        return (
          <div {...p} className="mobile-home-actions" style={{ ...p.style, color: values.s.on }}>
            {view.children}
            {session && food?.restaurantId && (
              <button
                type="button"
                className="mobile-home-dismiss"
                aria-label="不想吃这家"
                aria-haspopup="dialog"
                title="不想吃这家"
                disabled={discovery.dismissing}
                onClick={() => discovery.requestDismiss(food)}
              >
                <Frown size={22} aria-hidden="true" />
              </button>
            )}
          </div>
        );
      }
      if (tag === "div" && st.top === "488px")
        p.className = "mobile-home-sheet";
      if (
        n.children.some(
          (child) => typeof child !== "string" && child.attrs.name === "G-Nav",
        )
      )
        return null;
      if (
        tag === "section" &&
        n.attrs["aria-label"] === "今天吃什么" &&
        !heroWithoutDish
      ) {
        const food = featuredFood;
        const distance = distanceText(food?.distanceMeters) || values.s.dist;
        return (
          <section {...p} className="mobile-home-copy" ref={recommendationCopy}>
            <h1>{food?.name}</h1>
            <p className={`mobile-home-price${food?.price == null ? " is-unknown" : ""}`}>{money(food?.price)}</p>
            <p className="mobile-home-shop">
              <DesignIcon name="store" size={16} />
              {food?.restaurantName || "餐厅信息待补充"}
            </p>
            {distance && (
              <p className="mobile-home-distance">
                <DesignIcon name="nearby" size={15} />
                <span title={area?.source === "device" ? "距你" : `距${area?.name || "所选位置"}`}>{distance}</span>
              </p>
            )}
          </section>
        );
      }
      if (shopsWithoutDish) {
        if (tag === "div" && st.top === "0" && st.height === "520px")
          return (
            <div {...p} className="mobile-home-art mobile-home-resting-stage">
              <span className="mobile-home-empty-plate" aria-hidden="true">
                <DesignIcon name="bowl" size={66} />
              </span>
            </div>
          );
        if (n.attrs.role === "group") return null;
        if (tag === "section" && n.attrs["aria-label"] === "今天吃什么")
          return (
            <section
              className="mobile-home-resting-copy"
              aria-label="今天吃什么"
            >
              <h1>
                今天
                <br />
                吃点什么？
              </h1>
              <p>
                下面这些店值得一试，
                <br />
                进店看看菜单吧。
              </p>
            </section>
          );
        if (tag === "div" && (st.top === "392px" || st.top === "414px"))
          return null;
      }
      if (homeWithoutRecommendations) {
        if (tag === "div" && st.top === "0" && st.height === "520px")
          return (
            <div {...p} className="mobile-home-art mobile-home-resting-stage">
              <span className="mobile-home-empty-plate" aria-hidden="true">
                <DesignIcon name="bowl" size={66} />
              </span>
            </div>
          );
        if (n.attrs.role === "group") return null;
        if (tag === "section" && n.attrs["aria-label"] === "今天吃什么")
          return (
            <section
              className="mobile-home-resting-copy"
              aria-label="今天吃什么"
            >
              <h1>
                今天
                <br />
                吃点什么？
              </h1>
              <p>
                灵感还没上桌，
                <br />
                先去附近发现好味道。
              </p>
            </section>
          );
        if (tag === "div" && st.top === "392px") return null;
        if (tag === "div" && st.top === "414px")
          return (
            <div className="mobile-home-resting-actions">
              <Link to="/nearby" className="design-button">
                <DesignIcon name="nearby" size={18} />
                逛逛附近
              </Link>
              <Link to="/publish" className="design-button light">
                <DesignIcon name="add" size={18} />
                分享一道菜
              </Link>
            </div>
          );
        if (tag === "div" && st.top === "488px") {
          p.className = `${p.className ?? ""} mobile-home-resting-sheet`;
          p.style = { ...p.style, top: 354, bottom: 104 };
        }
      }
      if (tag === "section" && n.attrs["aria-live"] === "polite")
        p.ref = recommendationCopy;
      if (st.transition && !st.transform) {
        p.style = {
          ...p.style,
          transition: st.transition
            .replace(/500ms/g, "240ms")
            .replace(/300ms/g, "180ms"),
        };
      }
      if (tag === "span" && String(n.attrs.style).includes("{{d.w}}")) {
        p.style = {
          ...p.style,
          width: 16,
          transform: `scaleX(${parseFloat(st.width) / 16})`,
          transition:
            "transform 180ms cubic-bezier(0.22,1,0.36,1), opacity 180ms ease-out, background-color 240ms ease-out",
        };
      }
      if (tag === "a" && n.attrs.href === "G-PanelPlace.dc.html")
        return (
          <a {...p} className="mobile-home-location" title={area?.name}>
            <span>{isDemo && area?.hubId === 1 ? "软件园" : (area?.name ?? "选地点")}</span>
            <small>{m.meal}</small>
            <DesignIcon name="chevronDown" size={14} />
          </a>
        );
      if (n.attrs.role === "tablist")
        return <DiscoveryList discovery={discovery} renderDishes={(foods) => (
          <div className="design-food-grid mobile-data-grid">
            {foods.map((food) => <FoodTile key={food.id} food={food} visual={visualFor(food, isDemo)} />)}
          </div>
        )} />;
      if (tag === "div" && st.gridTemplateColumns?.includes("repeat(2")) return null;
      if (tag === "a" && String(n.attrs["aria-label"]).startsWith("通知")) {
        return (
          <>
            <HomeSearchButton
              key="home-search"
              open={!!controller.state.searchOpen}
              onOpen={() => controller.setState({ searchOpen: true })}
            />
            <a {...p} className="mobile-home-inbox" aria-label={`消息通知，${unread.data ?? 0} 条未读`}>
              <span className="mobile-home-bell">{view.children}</span>
              <span className="mobile-home-action-label" aria-hidden="true">消息</span>
            </a>
          </>
        );
      }
      if (
        tag === "span" &&
        st.width === "8px" &&
        st.top === "10px" &&
        !unread.data
      )
        return null;
    }
    if (screen === "G-Dish" && liveFood && id === 1)
      return (
        <DishDetail
          key={liveFood.id}
          food={liveFood}
          restaurant={dishRestaurant.data}
          back={foodBack}
          demo={isDemo}
          sharedAt={relativeTime(liveFood.createdAt)}
          likeDisabled={
            !!session && user?.verified === true && liveFood.isLiked == null
          }
          favoriteDisabled={
            !!session && user?.verified === true && liveFood.isFavorite == null
          }
          onLike={() => reactions.toggle("like")}
          onFavorite={() => reactions.toggle("favorite")}
          onShare={() => void sharing.share(liveFood.name ?? BRAND_NAME)}
          onTags={() => {
            if (
              access({
                path: `/foods/${foodId}/tags/custom`,
                options: { method: "POST" },
              })
            )
              m.openPanel("G-PanelTag");
          }}
          onRestaurant={() => m.setShopId(liveFood.restaurantId!)}
          management={<FoodManage food={liveFood} anyone inMenu />}
          footer={
            <React.Suspense fallback={null}>
              <FoodExtras id={foodId} inline />
            </React.Suspense>
          }
        />
      );
    if (screen === "G-Detail" && restaurant.data) {
      const r = restaurant.data;
      if (id === 1)
        return (
          <div
            {...p}
            className={`${p.className ?? ""} mobile-restaurant-screen`}
            style={{
              ...p.style,
              width: "100%",
              height: "auto",
              minHeight: "100dvh",
              overflow: "clip",
            }}
          >
            <div className="mobile-restaurant-hero">
              {view.children[2]}
              <section className="mobile-restaurant-summary">
                {view.children[3]}
                {view.children[1]}
              </section>
            </div>
            {view.children[4]}
          </div>
        );
      if (id === 3) {
        const src = mediaUrl(r.pictureUrl?.[0]);
        p.src = src ?? "/assets/restaurants/shop.svg";
        p.className = "mobile-restaurant-art";
        p.style = undefined;
        if (src) return (
          <div className="mobile-restaurant-photo">
            <img {...p} alt={r.name || "店铺照片"} />
            <PhotoPreviewButton pictures={r.pictureUrl} name={r.name || "店铺"} />
          </div>
        );
      }
      if (id === 4)
        return (
          <header
            {...p}
            className="mobile-restaurant-toolbar"
            style={undefined}
          >
            {view.children[0]}
            <div className="mobile-restaurant-toolbar-actions">
              {view.children[1]}
              <RestaurantMoreActions
                key={`more-${shopId}`}
                id={shopId}
                name={r.name}
              />
            </div>
          </header>
        );
      if (id === 10) {
        p.onClick = () => void sharing.share(r.name ?? BRAND_NAME);
        p.style = { ...st, background: undefined };
      }
      if (id === 12) {
        const traits = r as typeof r & V2Shop;
        const [name, address, stats] = view.children;
        const facts = [
          ...(traits.categories ?? []),
          priceBands.find((band) => band.id === r.priceBand)?.name,
          traits.deliveryEnabled ? "可外卖" : "仅堂食",
          ...(traits.tags ?? []),
        ].filter((fact): fact is string => Boolean(fact));
        return (
          <>
            <div className="mobile-restaurant-copy">
              {name}
              {address}
            </div>
            {stats}
            <ul className="mobile-restaurant-traits" aria-label="店铺特点">
              {facts.map((fact, index) => (
                <li key={`${fact}-${index}`}>{fact}</li>
              ))}
            </ul>
          </>
        );
      }
      if (id === 17) {
        p.className = "mobile-restaurant-stats";
        p.style = undefined;
      }
      if (id === 23)
        return (
          <div {...p} className="mobile-restaurant-sheet" style={undefined}>
            {view.children[0]}
            {view.children[1]}
            {view.children[3]}
            {view.children[2]}
          </div>
        );
      if (id === 25)
        return (
          <div {...p} className="mobile-restaurant-actions" style={undefined}>
            {view.children}
          </div>
        );
      if (id === 21)
        return (
          <button
            type="button"
            aria-label="查看店铺评价与评分"
            className="mobile-restaurant-rating-link"
            onClick={() => {
              const panel = document.getElementById("restaurant-evaluation");
              const details = panel?.querySelector("details");
              if (details) details.open = true;
              panel?.scrollIntoView({
                block: "center",
                behavior: instantMotion() ? "instant" : "smooth",
              });
              (details?.querySelector("summary") ?? panel)?.focus({
                preventScroll: true,
              });
            }}
          >
            {r.ratingSummaryState === "READY"
              ? `${r.ratingCount ?? 0} 人评价${r.recommendationRate == null ? "" : ` · ${r.recommendationRate}% 推荐`}`
              : "查看评价"}
          </button>
        );
      if (id === 19)
        return <span {...p}>{restaurantFoods.data?.totalItems ?? "—"}</span>;
      if (id === 16)
        return isDemo ? (
          <span {...p}>
            距你 {demoDishes.find((d) => d.restaurantId === r.id)?.dist ?? "—"}
          </span>
        ) : null;
      if (id === 46)
        return (
          <React.Suspense fallback={<ContentSkeleton kind="rows" count={1} />}>
            <RestaurantExtras path={location.pathname} inline />
          </React.Suspense>
        );
      if (tag === "h1")
        return (
          <h1 {...p} className="mobile-restaurant-name" style={undefined}>
            {r.name}
          </h1>
        );
      if (tag === "span" && clean(text) === "万达金街 1 层")
        return (
          <span {...p} className="mobile-restaurant-address">
            {r.address ?? "地址待补充"}
          </span>
        );
      if (tag === "section" && id === 29)
        return (
          <section {...p} className="mobile-restaurant-menu">
            <h2>菜品</h2>
            <div className="design-food-grid mobile-restaurant-food-grid">
              {restaurantFoods.isPending && <ContentSkeleton count={2} />}
              {restaurantFoods.data?.items?.map((f) => (
                <FoodTile
                  key={f.id}
                  food={f}
                  meta="price"
                  visual={visualFor(f, isDemo)}
                />
              ))}
            </div>
            {restaurantFoods.isError && !restaurantFoods.data && (
              <MobileEmpty
                title="菜品暂时没加载成功"
                action={
                  <button
                    className="mobile-inline-link"
                    onClick={() => void restaurantFoods.refetch()}
                  >
                    重新加载
                  </button>
                }
              />
            )}
            {!restaurantFoods.isPending &&
              !restaurantFoods.isError &&
              !restaurantFoods.data?.items?.length && (
                <MobileEmpty title="这家店还没有分享的菜" />
              )}
            {(page > 1 || restaurantFoods.data?.hasNext) && (
              <nav
                className="mobile-restaurant-pagination"
                aria-label="菜品翻页"
              >
                <button
                  type="button"
                  disabled={page === 1 || restaurantFoods.isFetching}
                  onClick={() => setPage((current) => current - 1)}
                >
                  上一页
                </button>
                <span>第 {page} 页</span>
                <button
                  type="button"
                  disabled={
                    !restaurantFoods.data?.hasNext || restaurantFoods.isFetching
                  }
                  onClick={() => setPage((current) => current + 1)}
                >
                  下一页
                </button>
              </nav>
            )}
          </section>
        );
      if (tag === "button" && clean(text) === "导航去店里")
        p.onClick = () => {
          if (!hasCoordinates(r)) m.notice("这家店还没有可用的位置。");
          else window.open(baiduMarkerUrl(r), "_blank", "noopener,noreferrer");
        };
    }
    if (screen === "G-AddDish") {
      if (id === 1) {
        p.className = `${p.className} mobile-publish-screen`;
        p.style = { ...st, minHeight: 0 };
      }
      if (id === 51)
        return (
          <footer {...p} className="mobile-publish-footer" style={undefined}>
            {view.children}
          </footer>
        );
      const photoDisabled = busy || photoBusy || publishUncertain;
      const stage = draftStage(m.draft);
      const darkStage = ["#C9442B", "#A8321C", "#8F5B24"].includes(
        stage,
      );
      // The name and price row; the duplicate hint goes right under it.
      if (id === 26 && !reference)
        return (
          <>
            {React.createElement(tag, p, view.children)}
            <DishDuplicateHint restaurantId={shopId} name={m.draft.name} />
          </>
        );
      if (id === 40 && !reference)
        return (
          <>
            <div className="mobile-publish-ai-card">
              <div className="mobile-publish-ai-copy">
                <strong>AI 帮填分类与口味</strong>
                <span>
                  {m.draft.name.trim()
                    ? "结合菜名和照片自动匹配，填后可微调"
                    : "填好上方菜名后，可一键自动识别"}
                </span>
              </div>
              <AiTagSuggest
                compact
                className="mobile-publish-ai"
                restaurantId={shopId}
                name={m.draft.name}
                description={m.draft.description}
                tagOptions={systemTags.data ?? []}
                pictures={() =>
                  draftPictureKeys(m.draft.images, app.uploadMany, (keys) =>
                    m.setDraft({
                      images: draftRef.current.images.map((image) =>
                        !image.key && keys.has(image.file)
                          ? { ...image, key: keys.get(image.file) }
                          : image,
                      ),
                    }),
                  )
                }
                current={{
                  category: m.draft.category || "staple",
                  tagIds: m.draft.systemTagIds ?? [],
                }}
                disabled={busy || photoBusy || publishUncertain}
                onApply={(category, tagIds) => {
                  if (category) {
                    controller.setState({
                      cat: Math.max(0, categoryCodes.indexOf(category)),
                    });
                    m.setDraft({ category });
                  }
                  if (tagIds.length) m.setDraft({ systemTagIds: tagIds });
                }}
              />
            </div>
            {React.createElement(tag, p, ...view.children)}
          </>
        );
      if (id === 35)
        return (
          <div className="mobile-publish-note">
            <label htmlFor="dish-desc">说两句，选填</label>
            <div>
              <textarea
                id="dish-desc"
                rows={3}
                maxLength={200}
                value={values.desc}
                onChange={values.setDesc}
                disabled={busy || publishUncertain}
                aria-describedby="dish-desc-count"
                placeholder="好吃在哪，有什么要注意的"
              />
              <span id="dish-desc-count">{values.descLen} / 200</span>
            </div>
          </div>
        );
      if (id === 45)
        return (
          <div className="mobile-publish-tag-groups">
            <fieldset className="mobile-publish-tags">
              <legend>口味，最多 {MAX_DISH_TAGS} 个</legend>
              <div>
                {(systemTags.data ?? []).map((t) => {
                  const on = !!m.draft.systemTagIds?.includes(t.id!);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={on}
                      disabled={
                        !on &&
                        (m.draft.systemTagIds?.length ?? 0) >= MAX_DISH_TAGS
                      }
                      onClick={() =>
                        m.setDraft({
                          systemTagIds: on
                            ? m.draft.systemTagIds?.filter((id) => id !== t.id)
                            : [...(m.draft.systemTagIds ?? []), t.id!],
                        })
                      }
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <MobileDishOptions
              shopMeals={(restaurant.data as V2Shop | undefined)?.mealTimes}
              signature={!!m.draft.signature}
              onSignatureChange={(signature) => m.setDraft({ signature })}
              disabled={busy || publishUncertain}
              value={{
                mealTimes: m.draft.mealTimes ?? [],
                deliveryEnabled: !!m.draft.deliveryEnabled,
              }}
              onChange={(next) => m.setDraft(next)}
            />
          </div>
        );
      if (id === 21)
        return (
          <div {...p} className="mobile-publish-destination">
            <div className="mobile-publish-destination-label">
              <span>发布到</span>
              <div>
                <strong>
                  {selectedShopName ||
                    (restaurant.isPending
                      ? "正在读取店名…"
                      : "店名暂时无法读取")}
                </strong>
                {!selectedShopName && !restaurant.isPending && (
                  <button
                    type="button"
                    disabled={restaurant.isFetching}
                    onClick={() => void restaurant.refetch()}
                  >
                    {restaurant.isFetching ? "正在重试…" : "重新读取店名"}
                  </button>
                )}
              </div>
            </div>
            <Link to="/publish">换一家</Link>
          </div>
        );
      if (id === 19) {
        const [handle, destination, nameAndPrice, note, ...choices] =
          view.children;
        return (
          <div
            {...p}
            className="mobile-publish-fields"
            style={{
              ...st,
              bottom: "var(--publish-footer-height)",
              overflowY: "auto",
              paddingBottom: "calc(24px + var(--publish-keyboard-inset))",
            }}
          >
            {handle}
            {destination}
            <input
              ref={dishPhotoInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={photoDisabled || m.draft.images.length >= 9}
              onChange={(event) => {
                const source = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (source)
                  void openPhotoEditor(source, { x: 0, y: 0, zoom: 1 });
              }}
            />
            <DishPhotoPicker
              images={m.draft.images}
              disabled={photoDisabled}
              processing={photoBusy}
              onAdd={chooseFiles}
              onEdit={editPhoto}
              onMove={(source, target) => {
                const images = [...draftRef.current.images];
                const from = images.findIndex((image) => image.url === source);
                const to = images.findIndex((image) => image.url === target);
                if (from < 0 || to < 0 || from === to) return;
                const [photo] = images.splice(from, 1);
                images.splice(to, 0, photo);
                m.setDraft({ images });
              }}
              onRemove={(index) => {
                const image = draftRef.current.images[index];
                if (!image) return;
                const images = draftRef.current.images.filter(
                  (_, i) => i !== index,
                );
                m.setDraft({
                  images,
                  stage: images.length ? draftRef.current.stage : undefined,
                });
                if (image.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
              }}
            />
            {nameAndPrice}
            {choices}
            {note}
          </div>
        );
      }
      if (id === 2) {
        const cover = m.draft.images[0];
        return (
          <div
            {...p}
            style={{
              ...st,
              background: stageSurface(stage),
              color: darkStage ? "#fff" : undefined,
            }}
          >
            {cover ? (
              <img
                className="mobile-publish-preview"
                src={cover.url}
                alt="菜品封面预览"
              />
            ) : (
              <button
                type="button"
                className="mobile-publish-preview is-empty"
                disabled={photoDisabled}
                onClick={chooseFiles}
              >
                <DesignIcon name="camera" size={32} />
                {photoBusy ? "正在处理照片…" : "加一张照片"}
              </button>
            )}
          </div>
        );
      }
      if ([4, 5, 9].includes(id) && darkStage)
        p.style = { ...st, color: "#fff" };
      if (id === 10 || id === 17) return null;
      if (id === 29) {
        delete p.defaultValue;
        p.value = m.draft.name;
        p.maxLength = 64;
        p.onChange = (e: any) => m.setDraft({ name: e.target.value });
        p["aria-label"] = "菜名";
      }
      if (id === 34) {
        delete p.defaultValue;
        p.value = m.draft.price;
        p.placeholder = "选填";
        p.onChange = (e: any) => m.setDraft({ price: e.target.value });
      }
    }
    if (profile && id === 1 && user)
      return (
        <ProfileEditor
          form={profile.form}
          avatar={profile.avatar?.url || mediaUrl(user.avatar)}
          avatarOpen={Boolean(controller.state.sheet)}
          busy={busy}
          onChange={profile.change}
          onUndoAvatar={
            profile.avatar ? () => profile.setAvatar(null) : undefined
          }
          onAvatar={() => controller.setState({ sheet: true })}
          onSave={() => navigateDesign("G-Me.dc.html", "保存")}
          onCancel={() => navigateDesign("G-Me.dc.html", "取消")}
        />
      );
    if (screen === "G-Settings") {
      if (tag === "nav")
        return (
          <nav {...p} className="mobile-settings-menu">
            {view.children}
          </nav>
        );
      if (tag === "a" && n.attrs.href === "G-SettingsAbout.dc.html")
        return (
          <>
            <Link
              className="mobile-personalization-link"
              to="/settings/personalization"
              style={p.style}
            >
              <DesignIcon name="eye" size={22} />
              <span>个性化</span>
              <DesignIcon name="chevronRight" size={20} />
            </Link>
            <a href={androidAppDownload.href} style={p.style}>
              <DesignIcon name={androidAppDownload.icon} size={22} />
              <span style={{ flex: 1, fontSize: 16 }}>
                {androidAppDownload.name}
              </span>
              <DesignIcon name="chevronRight" size={20} />
            </a>
            <a {...p}>
              <DesignIcon name="info" size={22} />
              <span style={{ flex: 1 }}>关于</span>
              <DesignIcon name="chevronRight" size={20} />
            </a>
          </>
        );
      if (tag === "a" && n.attrs.href === "G-EditProfile.dc.html") {
        const avatar = mediaUrl(user?.avatar);
        return (
          <a {...p} className="mobile-settings-profile">
            <span className="mobile-settings-avatar" aria-hidden="true">
              {avatar ? (
                <img src={avatar} alt="" />
              ) : (
                user?.displayName?.slice(0, 1) || "食"
              )}
            </span>
            <span className="mobile-settings-identity">
              <strong>{user?.displayName || "同学"}</strong>
              <span>
                <DesignIcon name="verify" size={16} />
                {user?.verified ? "已认证" : "去认证"}
              </span>
            </span>
            <DesignIcon name="chevronRight" size={20} />
          </a>
        );
      }
      if (tag === "button" && clean(text) === "退出登录")
        return (
          <button
            {...p}
            style={{ ...p.style, bottom: 110, width: "calc(100% - 40px)" }}
          >
            {view.children}
          </button>
        );
    }
    if (screen === "G-Verify" && tag === "button") {
      if (clean(text).includes("山大统一认证"))
        p.onClick = () => {
          const url = import.meta.env.VITE_SDU_AUTH_URL;
          if (url) window.open(url, "_blank", "noopener,noreferrer");
          else unavailable("学校统一认证入口");
        };
      if (clean(text) === "我已完成，刷新一下")
        p.onClick = () => void app.me.refetch();
    }
    if (screen === "G-Inbox") {
      if (tag === "button" && clean(text) === "全部已读")
        p.onClick = () => run(() => api.readAll());
      if (id === 15)
        return (
          <div
            {...p}
            style={{ ...st, bottom: 32 }}
            className="mobile-scroll-region"
          >
            {notifications.data?.items?.map((n) => (
              <button
                key={n.id}
                className="mobile-notification"
                onClick={() => run(() => api.read(n.id!))}
              >
                <span
                  className="mobile-read-dot"
                  style={{ opacity: n.read ? 0 : 1 }}
                />
                <span className="mobile-avatar">
                  {n.actorName?.slice(0, 1) ?? "信"}
                </span>
                <span>
                  <strong>{n.actorName ?? "校园食友圈"}</strong>
                  <small>你的分享有了新互动</small>
                  <time>{relativeTime(n.createdAt)}</time>
                </span>
              </button>
            ))}
            {notifications.data?.items?.length === 0 && (
              <MobileEmpty title="暂时没有新消息" />
            )}
            <More />
          </div>
        );
      if (n.attrs.role === "tab")
        p.onClick = () => unavailable("消息按类型查询");
    }
    if (pickingShop) {
      if (id === 1)
        return (
          <div {...p} className="mobile-pick-shop-screen" style={undefined}>
            <div className="mobile-pick-shop-top">
              {view.children.slice(0, 4)}
            </div>
            <div className="mobile-pick-shop-body">
              {view.children.slice(4, 6)}
            </div>
          </div>
        );
      if (pickShopClasses[id]) {
        p.className = pickShopClasses[id];
        p.style = undefined;
      }
      if (id === 13)
        return area?.name ? (
          <span {...p}>当前查询区域：{area.name}</span>
        ) : null;
      if (tag === "input") {
        delete p.defaultValue;
        p.value = search;
        p.onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
          setSearch(e.target.value);
      }
      if (id === 15)
        return (
          <div
            className="mobile-pick-shop-list"
            role="group"
            aria-label="选择店铺"
          >
            {queryKeyword !== debouncedKeyword || shops.isPending ? (
              <ContentSkeleton kind="rows" count={3} />
            ) : shops.isError && !shops.data ? (
              <MobileEmpty
                title="店铺加载失败"
                action={
                  <button
                    type="button"
                    className="mobile-inline-link"
                    onClick={() => void shops.refetch()}
                  >
                    重新加载
                  </button>
                }
              />
            ) : values.rows.length ? (
              <>
                {view.children}
                {debouncedKeyword && shops.data?.hasNext && (
                  <p role="status" className="mobile-pick-shop-hint">
                    匹配店铺较多，可以补全店名或分店名。
                  </p>
                )}
              </>
            ) : (
              <MobileEmpty
                title={
                  debouncedKeyword ? "没有找到匹配的店铺" : "当前区域暂无店铺"
                }
              />
            )}
          </div>
        );
      if (n.attrs.role === "radio")
        return (
          <button
            type="button"
            className="mobile-pick-shop-row"
            style={{ ...st, height: "auto", padding: "8px 12px 8px 10px" }}
            aria-current={scope.r.current || undefined}
            onClick={scope.r.pick}
          >
            {view.children.slice(0, 2)}
            <DesignIcon name="chevronRight" size={18} />
          </button>
        );
      if (id === 21)
        return (
          <span {...p} className="mobile-pick-shop-name" title={scope.r.name}>
            {scope.r.name}
          </span>
        );
      if (id === 22)
        return (
          <span
            {...p}
            className="mobile-pick-shop-address"
            style={{ ...st, display: "block" }}
            title={scope.r.hub}
          >
            {scope.r.hub}
          </span>
        );
    }
    if (screen === "G-Search" && id === 43)
      return <div {...p}>{shopList()}</div>;
    if (screen === "G-Search" && id === 29)
      return (
        <MobileEmpty
          title="更多搜索方式，敬请期待"
          detail="可以切换到店名，找到店铺后查看它的菜。"
        />
      );
    if (screen === "G-Search" && tag === "span" && id === 24)
      return <span {...p}>—</span>;
    if (screen === "G-Search" && tag === "span" && id === 27)
      return <span {...p}>{shops.data?.totalItems ?? "—"}</span>;
    if (
      screen === "G-TagDishes" &&
      tag === "div" &&
      st.gridTemplateColumns?.includes("repeat(2")
    ) {
      const list = (favorites.data?.items ?? []).filter(
        (f) => !m.tagId || f.myCustomTags?.some((t) => t.id === m.tagId),
      );
      return (
        <div {...p} className="design-food-grid mobile-data-grid">
          <p
            style={{
              gridColumn: "1/-1",
              fontSize: 12,
              color: "var(--ink-muted)",
              margin: 0,
            }}
          >
            当前分类仅筛选本页收藏，更多筛选方式敬请期待。
          </p>
          {list.map((f) => (
            <FoodTile key={f.id} food={f} visual={visualFor(f, isDemo)} />
          ))}
          {!list.length && (
            <MobileEmpty
              illustration="yangzhi"
              title="这一页暂时没有这类收藏"
            />
          )}
          <More />
        </div>
      );
    }
    if (screen === "G-TagDishes" && tag === "h1")
      return (
        <h1 {...p}>
          {m.tagId
            ? (myTags.data?.items?.find((t) => t.id === m.tagId)?.name ??
              "我的标签")
            : "收藏的菜"}
        </h1>
      );
    if (screen === "G-TagDishes" && tag === "span" && text.includes("12 道菜"))
      return (
        <span {...p}>
          本页 {favorites.data?.items?.length ?? 0} 道菜，只有你看得见
        </span>
      );
    if (
      screen === "G-PanelPlace" &&
      n.attrs.role === "radiogroup" &&
      n.attrs["aria-label"] === "校区"
    ) {
      const campusActive = area?.source === "campus" && !!campusId;
      const isActiveHub = (h: { id?: number | null }) =>
        area?.source === "hub" && h.id != null && area.hubId === h.id;
      return (
        <div
          className="mobile-place-picker"
          role="group"
          aria-label="推荐校区与附近区域"
        >
          <Select
            aria-label="推荐校区"
            value={campusActive ? String(campusId) : ""}
            disabled={busy}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              if (Number.isFinite(next) && next > 0) selectCampus(next);
            }}
          >
            {!campusList.data ? (
              <option value="" disabled={campusList.isError}>
                {campusList.isError ? "校区暂时加载失败" : "正在加载校区…"}
              </option>
            ) : (
              !campusActive && (
                <option value="" disabled>
                  选择校区（当前使用附近区域）
                </option>
              )
            )}
            {campusList.data
              ?.filter((c) => c.open !== false && c.id != null)
              .map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
          </Select>
          <div className="mobile-place-hub-head">
            <span>附近区域</span>
            <PlaceLocateButton disabled={busy} />
          </div>
          {(hubKeyword ||
            (hubs.data?.items?.length ?? 0) > 6 ||
            hubs.data?.hasNext) && (
            <input
              type="search"
              className="mobile-place-search"
              placeholder="搜索商圈 / 区域"
              aria-label="搜索附近区域"
              value={hubKeyword}
              onChange={(event) => setHubKeyword(event.currentTarget.value)}
            />
          )}
          <div
            className="mobile-place-hubs"
            role="group"
            aria-label="附近区域"
            aria-busy={hubs.isFetching}
          >
            {hubs.isPending ? (
              <span className="mobile-place-empty">正在加载区域…</span>
            ) : hubs.isError ? (
              <button
                type="button"
                className="mobile-place-empty"
                onClick={() => void hubs.refetch()}
              >
                区域加载失败，点此重试
              </button>
            ) : !hubs.data?.items?.length ? (
              <span className="mobile-place-empty">
                {debouncedHubKeyword
                  ? `没有找到“${debouncedHubKeyword}”`
                  : "暂无可选区域"}
              </span>
            ) : null}
            {[...(hubs.data?.items ?? [])]
              .sort((a, b) => Number(isActiveHub(b)) - Number(isActiveHub(a)))
              .map((h) => (
                <button
                  type="button"
                  key={h.id}
                  className="mobile-place-chip"
                  aria-pressed={isActiveHub(h)}
                  data-active={isActiveHub(h) || undefined}
                  disabled={!h.id || busy}
                  onClick={() =>
                    void run(async () => {
                      const detail = await api.hubDetail(h.id!);
                      if (detail.id !== h.id || !hasCoordinates(detail))
                        throw new Error(
                          "区域详情缺少有效坐标，请重试或使用定位。",
                        );
                      selectArea({
                        name: detail.name ?? "所选区域",
                        gcjLng: detail.gcjLng!,
                        gcjLat: detail.gcjLat!,
                        hubId: detail.id!,
                        source: "hub",
                      });
                      m.closePanel();
                    })
                  }
                >
                  {h.name}
                </button>
              ))}
          </div>
          {hubs.data?.hasNext && (
            <span className="mobile-place-empty">
              只显示前 {hubs.data.items?.length ?? 0} 个，输入名称查找更多
            </span>
          )}
        </div>
      );
    }
    if (screen === "G-PanelPlace" && scope.m?.name && tag === "button")
      p.onClick = () => {
        m.setMeal(scope.m.name);
        m.closePanel();
      };
    if (
      screen === "G-PanelPlace" &&
      tag === "button" &&
      clean(text).startsWith("按现在的时间")
    )
      p.onClick = () => {
        m.setMealAuto();
        m.closePanel();
      };
    if (
      screen === "G-PanelPlace" &&
      tag === "span" &&
      clean(text).startsWith("现在是")
    )
      return (
        <span {...p}>
          现在是{m.mealAuto ? m.meal : mealName(mealSlotAt(Date.now()))}
          ，到点自动换
        </span>
      );
    if (
      screen === "G-PanelPlace" &&
      tag === "span" &&
      clean(text) === "其他校区开放后会出现在这里"
    )
      return <span {...p}>校区用于推荐，附近区域用于查找店铺。</span>;
    if (screen === "G-MyTags" && tag === "a" && scope.t?.id)
      p.onClick = (e: any) => {
        e.preventDefault();
        m.setTagId(scope.t.id);
        nav("/favorites?tag=" + scope.t.id);
      };
    if (
      screen === "G-SettingsAccount" &&
      tag === "span" &&
      /^188/.test(clean(text))
    )
      return (
        <span {...p}>
          {user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, "$1 **** $2") ??
            "未绑定"}
        </span>
      );
    if (
      screen === "G-SettingsAccount" &&
      tag === "span" &&
      clean(text) === "tianliang"
    )
      return <span {...p}>{user?.displayName ?? "—"}</span>;
    if (screen === "G-UserProfile") {
      const u = other.data;
      if (tag === "h1") return <h1 {...p}>{u?.displayName ?? "同学"}</h1>;
      if (tag === "span" && clean(text) === "哲")
        return <span {...p}>{u?.displayName?.slice(0, 1) ?? "食"}</span>;
      if (tag === "p" && clean(text) === "西门小吃街常驻选手")
        return <p {...p}>校园食友</p>;
      if (tag === "span" && ["312", "18", "56", "21"].includes(clean(text))) {
        const key = clean(text),
          val =
            key === "312"
              ? u?.earnedLikes
              : key === "18"
                ? u?.uploadedFoodsCount
                : key === "56"
                  ? u?.fansCount
                  : u?.followingsCount;
        return <span {...p}>{val ?? "—"}</span>;
      }
      if (
        !isDemo &&
        tag === "div" &&
        st.gridTemplateColumns?.includes("repeat(2")
      )
        return (
          <div {...p}>
            <MobileEmpty
              title="分享列表正在准备中"
              detail="敬请期待，也可以先关注这位同学。"
            />
          </div>
        );
    }
    if (!isDemo) {
      if (tag === "span" && /^\d+(?:\.\d+)?\s*(?:m|km)$/.test(clean(text)))
        return null;
      if (tag === "span" && clean(text) === "距你") return null;
      if (
        tag === "a" &&
        ["G-Topic.dc.html", "G-TopicArchive.dc.html"].includes(
          String(n.attrs.href),
        )
      )
        p.onClick = (e: any) => {
          e.preventDefault();
          nav(
            String(n.attrs.href).includes("Archive")
              ? "/topics"
              : "/topics/current",
          );
        };
    }
    return undefined;
  };

  function More() {
    const query = (
      screen === "G-Search"
        ? shops
        : relevant
    ) as { data?: { hasNext?: boolean }; isFetching?: boolean } | null;
    const hasNext = !!query?.data?.hasNext;
    if (!hasNext && page <= 1) return null;
    return (
      <div className="mobile-page-more">
        {page > 1 && (
          <PrimaryButton
            light
            disabled={query?.isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </PrimaryButton>
        )}
        {hasNext && (
          <PrimaryButton
            light
            disabled={query?.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </PrimaryButton>
        )}
      </div>
    );
  }
  function shopList() {
    if (shops.isPending) return <ContentSkeleton kind="rows" count={4} />;
    if (shops.error && !shops.data)
      return <div className="mobile-error">{errorMessage(shops.error)}</div>;
    return shops.data.items?.length ? (
      shops.data.items.map((r) => <ShopRow key={r.id} shop={r} />)
    ) : (
      <MobileEmpty title="还没找到这家店" detail="换个名字，或新建一家店。" />
    );
  }
  async function pickAvatar(source: "camera" | "library") {
    if (!profile || busy) return;
    const page = location.key;
    const files = await pickFiles(
      false,
      source === "camera" ? "user" : undefined,
    );
    if (!files.length || activeLocation.current !== page) return;
    await run(async () => {
      validateFiles(files, 0);
      setAvatarCrop({ file: files[0], url: "" });
    });
  }
  function navigateDesign(target: string, label: string, aria?: string) {
    if (target === "G-EditProfile.dc.html") {
      nav("/me/edit", {
        state: { returnTo: location.pathname + location.search },
      });
      return;
    }
    if (needsVerification.has(target.replace(".dc.html", "")) && !access(true))
      return;
    if (target === "G-Follows.dc.html") {
      nav(
        peopleHref(
          screen === "G-UserProfile" ? `/users/${otherId}` : "/me",
          location.search,
          label.includes("粉丝") ? "fans" : "follow",
        ),
        {
          state: { profilePeopleFrom: location.key },
          preventScrollReset: true,
        },
      );
      return;
    }
    if (
      (screen === "G-PhoneLogin" && target === "G-RegisterConfirm.dc.html") ||
      (screen === "G-RegisterConfirm" && target === "G-Verify.dc.html")
    ) {
      nav("/auth/register");
      return;
    }
    if (
      m.panel &&
      (["关闭", "关闭面板", "好了", "取消"].includes(aria ?? label) ||
        label === "好了")
    ) {
      m.closePanel();
      return;
    }
    if (screen === "G-PasswordLogin" && label === "登录") {
      void login();
      return;
    }
    if (profile && label === "保存") {
      if (busy || !user) return;
      void run(async () => {
        const { form, saved } = profile;
        const name = form.name.trim();
        if (name.length < 2 || name.length > 12) {
          document.getElementById("nick")?.focus();
          throw new Error("昵称需要 2–12 个字。");
        }
        if (form.signature.length > PROFILE_SIGNATURE_LIMIT)
          throw new Error(`个性签名最多填写 ${PROFILE_SIGNATURE_LIMIT} 个字。`);
        const clearError = profileClearError(form, saved);
        if (clearError) throw new Error(clearError);
        const today = new Date();
        const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        if (form.birthday && form.birthday > maxDate)
          throw new Error("生日不能晚于今天。");
        if ((await profile.save()) && activeLocation.current === location.key)
          nav(profileReturnTo);
      }, "个人资料已更新");
      return;
    }
    if (profile && label === "取消") {
      profile.reset();
      nav(profileReturnTo);
      return;
    }
    if (screen === "G-AddDish" && label === "发布") {
      void publish();
      return;
    }
    if (screen === "G-AddDish" && target === "G-Crop.dc.html") {
      chooseFiles();
      return;
    }
    if (screen === "G-Settings" && label === "退出") {
      void run(async () => {
        await app.signOut();
        nav("/auth");
      });
      return;
    }
    if (
      pendingScreens[screen] &&
      [
        "提交",
        "发送",
        "发布",
        "完成注册",
        "确认注销",
        "确认换绑",
        "重置密码",
      ].some((w) => label.includes(w))
    ) {
      unavailable(pendingScreens[screen]);
      return;
    }
    if (homeScreens.has(screen) && target === "G-Dish.dc.html") {
      const f = featuredFood;
      if (f?.id) {
        m.setFoodId(f.id);
        if (f.restaurantId) m.setShopId(f.restaurantId);
        nav(`/foods/${f.id}`);
      }
      return;
    }
    if (target.startsWith("#")) {
      m.notice("政策内容暂时无法查看，请稍后再试。");
      return;
    }
    if (target === "G-PanelReport.dc.html") {
      m.closePanel();
      setReportOpen(true);
      return;
    }
    if (target === "G-WrongInfo.dc.html") {
      setCorrectionOpen(true);
      return;
    }
    if (target === "G-PanelTag.dc.html") {
      m.setFoodId(foodId);
      m.openPanel("G-PanelTag");
      return;
    }
    const screenTarget = target.replace(".dc.html", "");
    if (panelScreens.has(screenTarget)) {
      m.openPanel(screenTarget);
      return;
    }
    if (screen === "G-NewShop" && target === "G-AddDish.dc.html") {
      void createShop();
      return;
    }
    if (target === "G-ChangePhone.dc.html" && !user?.phone) {
      nav("/settings/bind-phone");
      return;
    }
    if (target === "G-Verify.dc.html") {
      nav("/verify");
      return;
    }
    if (target === "G-AddDish.dc.html") {
      m.setShopId(shopId);
      // Entry from a restaurant page already has a readable destination.
      if (screen === "G-Detail")
        m.setDraft({
          restaurantId: shopId,
          shopName: restaurant.data?.name ?? "",
        });
    }
    nav(resolveHref(target, m, screen));
  }
  async function createShop() {
    await run(async () => {
      const name = String(controller.state.name ?? "").trim();
      if (!name) throw new Error("写一个店名。");
      if (!area) throw new Error("先选择区域，并填写餐厅准确坐标。");
      m.setDraft({ shopName: name });
      nav("/restaurants/new/details");
    });
  }

  if (reference)
    return {
      values: original,
      node: (v) => referenceNode(v, m),
      reference: true,
    };
  const accountPending =
    !publicScreens.has(screen) && !!session && app.me.isPending;
  const accountUnavailable =
    !publicScreens.has(screen) &&
    !!session &&
    !accountPending &&
    (app.me.isError || !user);
  const verificationRequired =
    !!session &&
    !!user &&
    needsVerification.has(screen) &&
    user.verified !== true;
  const denied =
    !accountPending &&
    !publicScreens.has(screen) &&
    (!session ||
      accountUnavailable ||
      verificationRequired ||
      (user?.banned && !bannedPageAllowed(location.pathname)));
  let before: ReactNode;
  if (accountUnavailable)
    before = (
      <div className="mobile-status" role="alert">
        <DesignIcon name="wifiOff" size={30} />
        <h2>暂时没能读取账号</h2>
        <p>
          {app.me.isError
            ? errorMessage(app.me.error)
            : "没有读取到账号信息，请重新加载。"}
        </p>
        <PrimaryButton
          disabled={app.me.isFetching}
          onClick={() => void app.me.refetch()}
        >
          {app.me.isFetching ? "正在重新加载…" : "重新加载账号"}
        </PrimaryButton>
      </div>
    );
  else if (denied && (!session || !user?.banned))
    before = (
      <div className="mobile-access-screen">
        <AccessWelcome canvas verification={verificationRequired} />
      </div>
    );
  else if (denied)
    before = (
      <div className="mobile-status" role="status">
        <DesignIcon name="verify" size={30} />
        <h2>账号暂时无法使用</h2>
        <p>{user?.banReason ?? "请联系管理员了解账号状态。"}</p>
        <PrimaryButton onClick={() => nav("/me")}>返回我的</PrimaryButton>
      </div>
    );
  if (
    !denied &&
    relevant?.isError &&
    !relevant.data &&
    !homeScreens.has(screen)
  )
    before = (
      <div className="mobile-status">
        <h2>这一份内容暂时没端上来</h2>
        <p>{errorMessage(relevant.error)}</p>
        <PrimaryButton onClick={() => void relevant.refetch()}>
          再试一次
        </PrimaryButton>
      </div>
    );
  if (accountPending || (!denied && relevant?.isPending))
    before = <MobilePageSkeleton screen={screen} />;
  if (!denied && screen === "G-Crop" && !photoEdit)
    before = (
      <div className="mobile-status">
        <h2>先选择一张照片</h2>
        <p>选好照片，就可以拖动、缩放，把主菜放进圆圈里。</p>
        <PrimaryButton onClick={() => nav("/publish/dish")}>
          返回加菜
        </PrimaryButton>
      </div>
    );
  const after = (
    <>
      {homeScreens.has(screen) && !reference && (
        <HomeSearchOverlay
          open={!!controller.state.searchOpen}
          onClose={() => controller.setState({ searchOpen: false })}
          onSearch={(keyword) =>
            nav(
              keyword ? `/search?q=${encodeURIComponent(keyword)}` : "/search",
            )
          }
        />
      )}
      {sharing.fallback}
      {!denied && profile && controller.state.sheet && (
        <AvatarSourceSheet
          busy={busy || !!avatarCrop}
          onPick={(source) => void pickAvatar(source)}
          onClose={() => controller.setState({ sheet: false })}
        />
      )}
      {profile && avatarCrop && (
        <CropDialog
          variant="avatar"
          image={avatarCrop}
          onClose={() => setAvatarCrop(null)}
          onApply={(result) => {
            setAvatarCrop(null);
            void run(async () => {
              if (
                (await profile.save(result.file)) &&
                activeLocation.current === location.key
              )
                controller.setState({ sheet: false });
            });
          }}
        />
      )}
      {reportOpen && (
        <FoodReportDialog
          key={`report-${foodId}`}
          foodId={foodId}
          foodName={detail.data?.name}
          onClose={() => setReportOpen(false)}
        />
      )}
      {correctionOpen && (
        <RestaurantCorrectionDialog
          key={`correction-${shopId}`}
          restaurantId={shopId}
          restaurantName={restaurant.data?.name}
          onClose={() => setCorrectionOpen(false)}
        />
      )}
      {isDemo && ["G-Login", "G-PasswordLogin"].includes(screen) && (
        <div
          className="mobile-mock-login"
          style={{ top: screen === "G-Login" ? 490 : 660 }}
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => void login(true)}
          >
            {busy ? "正在进入…" : "一键 Mock 登录"}
          </button>
          <p>本地模拟数据，无需账号和密码</p>
        </div>
      )}
      {((error && (duplicate || uncertain)) || publishUncertain) &&
        !["G-PasswordLogin", "G-PanelTag"].includes(screen) && (
          <div
            className="mobile-error-banner"
            data-screen={screen}
            role="alert"
          >
            {duplicate && (
              <Link to={`/foods/${duplicate}`}>
                查看已有菜品（草稿已保留） →
              </Link>
            )}
            {(uncertain || publishUncertain) && (
              <span>结果尚未确认，请先核实，避免重复提交。</span>
            )}
            <button onClick={() => setError("")} aria-label="关闭错误提示">
              <DesignIcon name="close" size={18} />
            </button>
          </div>
        )}
      {denied && <div className="mobile-denied-curtain" />}
      {screen === "G-PhoneLogin" && (
        <div className="mobile-supported-register">
          <p>使用手机验证码登录或注册。</p>
          <button
            className="mobile-inline-link"
            onClick={() => nav("/auth/register")}
          >
            手机登录 / 注册
          </button>
        </div>
      )}
    </>
  );
  return {
    values,
    node,
    before,
    after,
    busy,
    hideContent:
      !!denied ||
      accountPending ||
      !!relevant?.isPending ||
      (!!relevant?.isError && !relevant.data && !homeScreens.has(screen)) ||
      (screen === "G-Crop" && !photoEdit),
  };
}
// v2 dish categories, in the order of the publish chips.
const categoryCodes = foodCategories.map((c) => c.id as string);
function resolveHref(
  target: string,
  m: ReturnType<typeof useMobile>,
  screen: string,
) {
  if (target.startsWith("/")) return target;
  const key = target.split("?")[0].replace(".dc.html", "");
  if (key === "G-Dish") return `/foods/${m.foodId}`;
  if (key === "G-Detail") return `/restaurants/${m.shopId}`;
  if (key === "G-AddDish") return "/publish/dish";
  return screenRoutes[key] ?? "/";
}
function referenceNode(
  view: NodeView,
  m: ReturnType<typeof useMobile>,
): ReactNode | undefined {
  if (view.node.tag === "a") {
    view.props.onClick = (e: any) => {
      e.preventDefault();
      m.go(String(view.node.attrs.href).replace(".dc.html", ""));
    };
    view.props.href =
      "#/reference/" + String(view.node.attrs.href).replace(".dc.html", "");
  }
  return undefined;
}
async function pickFiles(multiple = true, capture?: "user"): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.multiple = multiple;
    if (capture) input.setAttribute("capture", capture);
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.addEventListener("cancel", () => resolve([]), { once: true });
    input.click();
  });
}
function relativeTime(value?: number | null) {
  if (!value) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });
}
