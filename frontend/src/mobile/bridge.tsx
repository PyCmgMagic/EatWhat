import WorkspaceSwitch from "../admin/WorkspaceSwitch";
import { useFeedbackState } from "../components/feedback";
import { BRAND_SLOGAN } from "../app/brand";
import { unreadCount } from "../api/notifications";
import { DishIllustration } from "../components/DishIllustration";
import {
  useRemoteConfig,
  recommendationBatchSize,
} from "../features/v4/Remote";
import { useSendSignal } from "../features/useSendSignal";
import React, { useEffect, useRef, useState, type ReactNode } from "react";
import {
  validateFoodDraft,
  normalizedTag,
  submissionPath,
} from "../api/content-rules";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useProfileDraft } from "../app/profile-draft";
import { useDebouncedSearch } from "../app/search";
import { NearbySearchInput } from "../features/NearbySearchInput";
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
  wgsToGcj,
  type Food,
  type Category,
  type Restaurant,
} from "../api/models";
import { validateFiles } from "../api/validation";
import { foodCategories, MAX_DISH_TAGS } from "../api/v2-vocab";
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
import { demoDishes, visualFor, stageColors } from "./catalog";
import { SceneToggle } from "../features/SceneToggle";
import { AiTagSuggest, draftPictureKeys } from "../features/AiTagSuggest";
import { DishDuplicateHint } from "../features/DishDuplicateHint";
import { screenRoutes, panelScreens, pendingScreens } from "./routes";
import { adjustPhoto, saveVisual } from "./photos";
import { photoFraming, type PhotoFraming } from "./photo-framing";
import { createPhotoGesture, MAX_PHOTO_ZOOM } from "./photo-gesture";
import {
  guestDeviceId,
  mealHours,
  mealName,
  mealOptions,
  mealSlotAt,
  publishDisplay,
} from "../api/food-display";
import { FoodManage } from "../features/Catalog";
import DishDetail from "./DishDetail";
import { DishAvailabilityFields } from "../features/DishAvailability";
import ProfileSheet from "./ProfileSheet";
import ProfileGrowth from "../features/ProfileGrowth";
import SheetHandle from "./SheetHandle";
import HomeOrbit from "./HomeOrbit";
import TagPanel from "./TagPanel";
import AvatarSourceSheet from "./AvatarSourceSheet";
import ProfileEditor from "./ProfileEditor";
import CropDialog from "../desktop/CropDialog";
import { PROFILE_SIGNATURE_LIMIT, profileClearError } from "../desktop/profile";
import { withDraftTag, withDraftTags } from "./draft-tags";
import { useActionAccess } from "../features/access";
import { useContentMotion } from "../motion/hooks";
import { instantMotion } from "../motion/runtime";
import { createHeroOrbitScheduler, heroOrbitStep } from "../motion/hero-orbit";
import { peopleHref } from "../features/profile-people";
import { AccessWelcome } from "../components/AccessWelcome";
import RestaurantMap from "../features/RestaurantMap";
import { baiduMarkerUrl } from "../features/map-geometry";
import { RestaurantHeaderFavorite } from "../features/v4/RestaurantHeaderFavorite";
import { RestaurantMoreActions } from "../features/RestaurantMoreActions";
import { useReturnTo } from "../app/navigation";
import { useDiscoveryCategory } from "../app/discovery-category";
import { useProfileReturnTo } from "../app/profile-navigation";
import "./restaurant-detail.css";
import { RecommendShopList } from "../features/RecommendShops";
import { FoodReportDialog } from "../features/FoodReportDialog";
import { RestaurantCorrectionDialog } from "../features/RestaurantCorrectionDialog";
import { useShareLink } from "../features/useShareLink";
import { useMyProfileCover } from "../features/useMyProfileCover";
import { MyFoodComments } from "../features/comments/Comments";
import { useFoodPhoto } from "../features/media";
import { FoodCover } from "../components/FoodCover";
import { SearchField } from "../components/SearchField";

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
  const orbitMotion = useRef({
    scheduler: createHeroOrbitScheduler(),
    angle: 0,
    startX: 0,
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
    [listCategory, setListCategory] = useState(
      screen === "G-Me" &&
        new URLSearchParams(location.search).get("tab") === "favorites"
        ? "收藏"
        : "",
    ),
    [search, setSearch] = useState("");
  const [homeCategory, setHomeCategory] = useDiscoveryCategory();
  const profileTab = new URLSearchParams(location.search).get("tab");
  const category = homeScreens.has(screen)
    ? homeCategory
    : screen === "G-Me"
      ? profileTab === "comments"
        ? "评论"
        : profileTab === "favorites"
          ? "收藏"
          : "上传"
      : listCategory;
  const setCategory = homeScreens.has(screen)
    ? setHomeCategory
    : setListCategory;
  const [mapShopId, setMapShopId] = useState<number>();
  const [reportOpen, setReportOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [avatarCrop, setAvatarCrop] = useState<Draft["images"][number] | null>(
    null,
  );
  const tagAdding = useRef(false),
    publishLock = useRef(false);
  const cropGesture = useRef(createPhotoGesture());
  const publishUncertain = screen === "G-AddDish" && !!m.draft.publishUncertain;
  const busy =
    localBusy ||
    !!profile?.phase ||
    (screen === "G-AddDish" && !!m.draft.publishing);
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
  const remote = useRemoteConfig(),
    batchSize = recommendationBatchSize(remote.data);
  const recommendations = useQuery({
    queryKey: [
      "foods",
      "mobile-recommend",
      campusId,
      m.mealKey,
      m.scene,
      area?.gcjLng,
      area?.gcjLat,
      "",
      batchSize,
    ],
    queryFn: async () => {
      const feed = await api.recommendFeed(batchSize, {
        campusId,
        mealTime: m.mealTime,
        scene: m.scene,
        gcjLng: area?.gcjLng,
        gcjLat: area?.gcjLat,
        deviceId: guestDeviceId(),
      });
      // Automatic: show the slot the backend actually used.
      if (!m.mealTime) m.noteServedMeal(feed.mealTime);
      return { items: feed.items, shops: feed.shops };
    },
    enabled: browse && homeScreens.has(screen),
  });
  // Dine-in lists the recommended shops; the carousel shows their dishes.
  const recommendedFoods = recommendations.data?.items,
    recommendedShops = recommendations.data?.shops ?? null;
  const categoryRecommendations = useQuery({
    queryKey: [
      "foods",
      // Not the main feed's key: that one now holds dishes and shops.
      "mobile-recommend-category",
      campusId,
      m.mealKey,
      m.scene,
      area?.gcjLng,
      area?.gcjLat,
      category,
      batchSize,
    ],
    queryFn: () =>
      api.recommend(batchSize, {
        campusId,
        mealTime: m.mealTime,
        scene: m.scene,
        gcjLng: area?.gcjLng,
        gcjLat: area?.gcjLat,
        category: category || undefined,
        deviceId: guestDeviceId(),
      }),
    enabled: browse && homeScreens.has(screen) && !!category,
    placeholderData: keepPreviousData,
  });
  const recommendationCopy = useRef<HTMLElement>(null),
    categoryContent = useRef<HTMLDivElement>(null);
  const recommendationIndex = recommendedFoods?.length
    ? (((controller.state.n ?? 0) % recommendedFoods.length) +
        recommendedFoods.length) %
      recommendedFoods.length
    : 0;
  useContentMotion(
    recommendationCopy,
    reference
      ? undefined
      : (recommendedFoods?.[recommendationIndex]?.id ?? undefined),
    0,
    "y",
  );
  useContentMotion(
    categoryContent,
    reference ? undefined : category,
    0,
    "opacity",
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
    enabled: active && (screen === "G-TagDishes" || screen === "G-Me"),
  });
  const myFoods = useQuery({
    queryKey: ["foods", "mine", page],
    queryFn: () => api.myFoods(page),
    enabled: active && screen === "G-Me",
  });
  const { cover: profileCover, fallback: defaultProfileCover } =
    useMyProfileCover(active && screen === "G-Me");
  const profileCoverSrc = mediaUrl(profileCover.pictureUrl?.[0]);
  const profilePhoto = useFoodPhoto(profileCoverSrc);
  const displayedProfileCover = profilePhoto.unavailable
    ? defaultProfileCover
    : profileCover;
  const myTags = useQuery({
    queryKey: ["my-tags", page],
    queryFn: () => api.myTags(page),
    enabled:
      verified &&
      ["G-Me", "G-MyTags", "G-PanelTag", "G-AddDish", "G-TagDishes"].includes(
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
      active && !!user?.id && ["G-Me", "G-SettingsPrivacy"].includes(screen),
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
  const hubs = useQuery({
    queryKey: ["hubs", page],
    queryFn: () => api.hubs(page),
    enabled: browse && screen === "G-PanelPlace",
  });
  const queryKeyword =
    screen === "G-Search" ? String(controller.state.q ?? "") : search;
  const debouncedKeyword = useDebouncedSearch(queryKeyword);
  const shops = useQuery({
    queryKey: ["restaurants", "mobile-search", area, debouncedKeyword, page],
    queryFn: () =>
      area
        ? api.restaurantSearch({
            keyword: debouncedKeyword || undefined,
            gcjLng: area!.gcjLng,
            gcjLat: area!.gcjLat,
            hubId: area?.hubId,
            page,
            pageSize: 12,
          })
        : api.browseRestaurants({
            keyword: debouncedKeyword || undefined,
            page,
            pageSize: 12,
          }),
    enabled: browse && ["G-Nearby", "G-PickShop", "G-Search"].includes(screen),
    placeholderData: keepPreviousData,
  });
  const relevant = homeScreens.has(screen)
    ? recommendations
    : screen === "G-Dish"
      ? detail
      : screen === "G-Detail"
        ? restaurant
        : screen === "G-Me"
          ? category === "收藏"
            ? favorites
            : myFoods
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
  const carouselFoods =
    screen === "G-HomePhoto"
      ? (recommendedFoods?.slice(0, 5) ?? [])
      : (recommendedFoods ?? []);
  const heroWithoutDish =
    homeScreens.has(screen) &&
    !recommendations.isPending &&
    carouselFoods.length === 0;
  // Shops without signature dishes are still listed below the empty plate.
  const homeWithoutRecommendations =
      heroWithoutDish && !recommendedShops?.length,
    shopsWithoutDish = heroWithoutDish && !!recommendedShops?.length;
  const liveFood = detail.data;
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
    if (!liveFood) return;
    await run(() => api.favorite(foodId, liveFood.isFavorite === true));
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
  async function chooseFiles(crop = true) {
    const files = await pickFiles(false);
    if (!files.length) return;
    try {
      validateFiles(files, m.draft.images.length);
      m.setDraft({
        images: [
          ...m.draft.images,
          ...files.map((file) => ({ file, url: URL.createObjectURL(file) })),
        ],
      });
      const suggested = await adjustPhoto(files[0], { x: 0, y: 0, zoom: 1 });
      m.setDraft({ candidates: suggested.colors });
      if (crop) nav("/publish/crop");
    } catch (e) {
      m.notice(errorMessage(e));
    }
  }
  async function publish() {
    if (
      publishLock.current ||
      busy ||
      uncertain ||
      m.draft.publishing ||
      m.draft.publishUncertain ||
      !access(true)
    )
      return;
    publishLock.current = true;
    const publishingLocation = location.key;
    m.setDraft({
      description: String(controller.state.desc ?? m.draft.description),
      category: categoryCodes[controller.state.cat ?? 0],
    });
    try {
      await run(async () => {
        const draft = {
          ...m.draft,
          tags: withDraftTags(m.draft.tags, m.draft.tagInput ?? ""),
          tagInput: "",
        };
        validateFoodDraft({
          ...draft,
          description: String(controller.state.desc ?? draft.description),
        });
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
        m.setDraft({ tags: draft.tags, tagInput: "", publishing: true });
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
          for (const image of images)
            if (image.key) saveVisual(image.key, draft.stage);
          creating = true;
          const created = await api.createFood({
            restaurantId: shopId,
            name: draft.name.trim(),
            price,
            description:
              String(controller.state.desc ?? draft.description) || undefined,
            category: categoryCodes[controller.state.cat ?? 0] as Category,
            pictureUrl: images.map((i) => i.key!),
            systemTagIds: draft.systemTagIds,
            signature: !!draft.signature,
            mealTimes: draft.mealTimes ?? [],
            deliveryEnabled: !!draft.deliveryEnabled,
            ...publishDisplay(draft.stage, draft.candidates),
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
            stage: "#F3C46E",
            crop: undefined,
            candidates: undefined,
            restaurantId: undefined,
            shopName: undefined,
            publishing: false,
            publishUncertain: false,
          });
          m.setFoodId(created.id);
          toast(
            created.revisionId
              ? "菜品已提交审核，可在我的提交查看进度。"
              : "菜已发布。",
          );
          if (activeLocation.current === publishingLocation)
            nav(submissionPath(created, `/foods/${created.id}`));
        } catch (error) {
          if (creating && resultUncertain(error))
            m.setDraft({ publishUncertain: true });
          throw error;
        } finally {
          m.setDraft({ publishing: false });
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
    values.tr =
      instantMotion() || controller.state.dragging
        ? "none"
        : "transform 360ms cubic-bezier(0.25,1,0.5,1), opacity 200ms ease-out";
    const list = carouselFoods,
      N = list.length,
      n = controller.state.n ?? 0,
      k = N ? ((n % N) + N) % N : 0,
      down = values.down,
      next = values.next;
    values.s = visualFor(list[k] ?? { name: "", category: "drink" }, isDemo);
    values.dots = list.map((_, i) => ({
      w: i === k ? 16 : 5,
      o: i === k ? 1 : 0.4,
    }));
    values.down = (e: React.PointerEvent<HTMLElement>) => {
      const state = orbitMotion.current;
      state.scheduler.cancel();
      state.angle = 0;
      state.startX = e.clientX;
      down(e);
    };
    values.move = (e: React.PointerEvent<HTMLElement>) => {
      if (!controller.state.dragging) return;
      const state = orbitMotion.current,
        target = e.currentTarget as HTMLElement,
        degrees = (e.clientX - state.startX) / 7.5;
      state.angle = Math.max(
        -heroOrbitStep * 1.1,
        Math.min(heroOrbitStep * 1.1, degrees),
      );
      state.scheduler.update(target, state.angle, 55);
    };
    values.up = () => {
      if (!controller.state.dragging) return;
      const state = orbitMotion.current,
        steps = state.angle < -4 ? 1 : state.angle > 4 ? -1 : 0;
      state.scheduler.cancel();
      state.angle = 0;
      controller.setState({
        n: (controller.state.n ?? 0) + steps,
        drag: 0,
        dragging: false,
      });
    };
    values.next = () => {
      orbitMotion.current.scheduler.cancel();
      orbitMotion.current.angle = 0;
      next();
    };
    if (N < 2) {
      values.next = values.down = values.move = values.up = () => {};
    }
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
  if (screen === "G-PickShop" && !reference) {
    const list = shops.data?.items ?? [],
      chosen = list.find((r) => r.id === m.shopId);
    values.chosen =
      chosen?.name ||
      (m.draft.restaurantId === m.shopId && m.draft.shopName) ||
      "选中的餐厅";
    values.rows = list.map((r) => ({
      id: r.id,
      name: r.name,
      dist: "",
      hub: r.address ?? "",
      tint: "#F4EFEB",
      img: mediaUrl(r.pictureUrl?.[0]) ?? "/prototype/assets/dishes/yuntun.svg",
      ...qstyle(r.id === m.shopId),
      bg: r.id === m.shopId ? "#FFF0C3" : "#F4EFEB",
      ring: r.id === m.shopId ? "#231C18" : "#D9D0C9",
      fill: r.id === m.shopId ? "#231C18" : "transparent",
      check: r.id === m.shopId ? 1 : 0,
      pick: () => {
        m.setShopId(r.id!);
        m.setDraft({ restaurantId: r.id!, shopName: r.name ?? "" });
      },
    }));
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
  if (screen === "G-Crop" && !reference) {
    const choices = m.draft.candidates ?? ["#8F5B24", "#A8321C", "#D9632B"];
    const selected = controller.state.color ?? 0;
    const names = [
      "暖汤",
      "芒果",
      "竹色",
      "辣橙",
      "番茄",
      "红油",
      "酱色",
      "瓷蓝",
      "抹茶",
    ];
    values.colors = choices.map((hex, i) => ({
      name: names[stageColors.indexOf(hex)],
      hex,
      on: i === selected ? "true" : "false",
      ring: i === selected ? 3 : 0,
      ring2: i === selected ? 5 : 0,
      pick: () => controller.setState({ color: i }),
    }));
    values.pick = {
      hex: choices[selected],
      on: ["#C9442B", "#A8321C", "#8F5B24"].includes(choices[selected])
        ? "#FFFFFF"
        : "#231C18",
    };
    const position = (crop: PhotoFraming) =>
      photoFraming(
        controller.state.photoWidth ?? 300,
        controller.state.photoHeight ?? 300,
        crop,
      ).crop;
    const setPosition = (crop: PhotoFraming) => {
      controller.setState({ ox: crop.x, oy: crop.y, zoom: crop.zoom });
    };
    const point = (event: React.PointerEvent<HTMLElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const scale = bounds.width / 390;
      return {
        x: (event.clientX - bounds.left) / scale - 195,
        y: (event.clientY - bounds.top) / scale - 200,
      };
    };
    values.down = (event: React.PointerEvent<HTMLElement>) => {
      if (busy || event.button !== 0) return;
      if (
        cropGesture.current.down(event.pointerId, point(event), {
          x: controller.state.ox ?? 0,
          y: controller.state.oy ?? 0,
          zoom: controller.state.zoom ?? 1,
        })
      ) {
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* A cancelled native pointer can disappear before capture. */
        }
      }
    };
    values.move = (event: React.PointerEvent<HTMLElement>) => {
      if (busy) {
        cropGesture.current.reset();
        return;
      }
      const crop = cropGesture.current.move(
        event.pointerId,
        point(event),
        position,
      );
      if (crop) setPosition(crop);
    };
    values.up = (event: React.PointerEvent<HTMLElement>) => {
      cropGesture.current.up(event.pointerId);
    };
    values.zoomTo = (event: any) => {
      cropGesture.current.reset();
      setPosition(
        position({
          x: controller.state.ox ?? 0,
          y: controller.state.oy ?? 0,
          zoom: Math.max(
            1,
            Math.min(MAX_PHOTO_ZOOM, Number(event.target.value)),
          ),
        }),
      );
    };
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
    // Entries for features backend v2 does not have (personal tags, push).
    if (
      (screen === "G-Me" && id === 28) ||
      (screen === "G-Settings" && id === 25)
    )
      return null;
    // With 我的标签 gone, 足迹 stands alone: drop the divider that separated
    // the two entries and let it take the whole row.
    if (
      screen === "G-Me" &&
      tag === "a" &&
      n.attrs.href === "G-History.dc.html"
    )
      p.style = {
        ...st,
        boxShadow: "none",
        paddingLeft: 0,
        gridColumn: "1 / -1",
      };
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
      const labels: Record<string, string> = {
        "G2-Home": "推荐内容",
        "G-HomePhoto": "推荐内容",
        "G-AddDish": "发布表单",
        "G-UserProfile": "食友分享",
      };
      if (labels[screen]) return <SheetHandle label={labels[screen]} />;
    }
    if (
      screen === "G-Crop" &&
      tag === "div" &&
      n.children.some(
        (child) =>
          typeof child !== "string" &&
          child.attrs["aria-label"] === "自动去掉背景",
      )
    )
      return null;
    if (typeof p["aria-label"] === "string")
      p["aria-label"] = p["aria-label"].replace(/待接入/g, "敬请期待");
    if (tag === "span" && clean(text) === "待接入")
      return <span {...p}>敬请期待</span>;
    if (screen === "G-Nearby" && id === 1) {
      const restaurants = shops.data?.items ?? [];
      const selected =
        restaurants.find((r) => r.id === mapShopId) ?? restaurants[0];
      return (
        <div {...p} className={`${p.className ?? ""} mobile-nearby-screen`}>
          <header className="mobile-nearby-toolbar">
            <div className="mobile-nearby-search">
              <DesignIcon name="search" size={20} />
              <NearbySearchInput
                type="search"
                label="搜店名或菜名"
                value={search}
                onCommit={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
              />
            </div>
            <button
              type="button"
              className="mobile-nearby-area"
              onClick={() => m.openPanel("G-PanelPlace")}
            >
              <DesignIcon name="nearby" size={16} />
              {area?.name ?? "选择查询区域"}
              <DesignIcon name="chevronDown" size={14} />
            </button>
          </header>
          <div className="mobile-nearby-map">
            <RestaurantMap
              autoLocate
              restaurants={restaurants}
              selectedId={selected?.id ?? undefined}
              onSelect={(r) => {
                setMapShopId(r.id ?? undefined);
                document
                  .getElementById(`mobile-restaurant-${r.id}`)
                  ?.scrollIntoView({ block: "nearest" });
              }}
            />
          </div>
          <section className="mobile-nearby-sheet" aria-label="附近店铺列表">
            <SheetHandle
              label="附近店铺列表"
              expandedBelow=".mobile-nearby-toolbar"
              coveredSiblings=".mobile-nearby-map"
            />
            <div className="mobile-nearby-heading">
              <h1>
                附近 <span>{shops.data?.totalItems ?? "—"}</span>
              </h1>
              <Link
                to="/restaurants/directory"
                className="mobile-nearby-directory"
              >
                更多筛选 <DesignIcon name="chevronRight" size={14} />
              </Link>
            </div>
            <div className="mobile-nearby-results">
              {shops.isError && !restaurants.length ? (
                <MobileEmpty
                  title="附近的店暂时没加载成功"
                  detail={errorMessage(shops.error)}
                  action={
                    <button
                      type="button"
                      className="mobile-inline-link"
                      onClick={() => void shops.refetch()}
                    >
                      重新加载店铺
                    </button>
                  }
                />
              ) : shops.isPending || !restaurants.length ? (
                shopList()
              ) : (
                restaurants.map((r) => (
                  <div
                    key={r.id}
                    id={`mobile-restaurant-${r.id}`}
                    className={`mobile-nearby-shop${selected?.id === r.id ? " is-selected" : ""}`}
                  >
                    <ShopRow
                      shop={r}
                      selected={selected?.id === r.id}
                      onSelect={() => setMapShopId(r.id ?? undefined)}
                    />
                    <Link
                      to={`/restaurants/${r.id}`}
                      aria-label={`查看${r.name ?? "店铺"}`}
                      onClick={() => r.id && m.setShopId(r.id)}
                    >
                      看菜单
                    </Link>
                  </div>
                ))
              )}
              <More />
            </div>
          </section>
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
        return (
          <div
            {...p}
            className={`${p.className ?? ""} mobile-home-screen${homeWithoutRecommendations ? " mobile-home-unavailable" : ""}`}
          >
            <div
              className="mobile-home-hero"
              style={{ background: values.s.stage }}
            >
              {view.children.slice(0, sheetIndex)}
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
            drag={controller.state.drag ?? 0}
            transition={values.tr}
            demo={isDemo}
          />
        );
      if (tag === "button" && n.attrs.onclick === "{{next}}")
        p.disabled = busy || carouselFoods.length < 2;
      if (tag === "a" && n.attrs.href === "G-Dish.dc.html") {
        const count = carouselFoods.length;
        const index = (((controller.state.n ?? 0) % count) + count) % count;
        const food = carouselFoods[index];
        if (food?.id) p.href = `#/foods/${food.id}`;
      }
      if (n.attrs.role === "group") {
        p.style = { ...p.style, top: "162px" };
        p.onPointerCancel = () => {
          orbitMotion.current.scheduler.cancel();
          orbitMotion.current.angle = 0;
          controller.setState({ drag: 0, dragging: false });
        };
      }
      if (tag === "header")
        return (
          <>
            <header {...p} className="mobile-home-toolbar">
              {view.children}
            </header>
            <SearchField
              className="mobile-home-search"
              onSearch={(keyword) =>
                nav(
                  keyword
                    ? `/search?q=${encodeURIComponent(keyword)}`
                    : "/search",
                )
              }
            />
          </>
        );
      if (tag === "div" && st.top === "392px") p.className = "mobile-home-dots";
      if (tag === "div" && st.top === "414px")
        p.className = "mobile-home-actions";
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
        const index =
          (((controller.state.n ?? 0) % carouselFoods.length) +
            carouselFoods.length) %
          carouselFoods.length;
        const food = carouselFoods[index];
        return (
          <section {...p} className="mobile-home-copy" ref={recommendationCopy}>
            <h1>{food?.name}</h1>
            <p className="mobile-home-shop">
              {food?.restaurantName || "餐厅信息待补充"}
            </p>
            {values.s.dist && (
              <p className="mobile-home-distance">{values.s.dist}</p>
            )}
            <p
              className={`mobile-home-price${food?.price == null ? " is-unknown" : ""}`}
            >
              {money(food?.price)}
            </p>
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minWidth: 0,
              flex: "1 1 0",
              flexWrap: "wrap",
              rowGap: 0,
            }}
          >
            <a
              {...p}
              title={area?.name}
              style={{
                ...p.style,
                minWidth: 0,
                flex: "1 1 120px",
                whiteSpace: "nowrap",
              }}
            >
              <DesignIcon name="nearby" size={16} />
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minWidth: 0,
                  lineHeight: 1.4,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isDemo && area?.hubId === 1
                    ? "软件园"
                    : (area?.name ?? "选地点")}
                </span>
                <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.8 }}>
                  {m.meal}
                </span>
              </span>
              <DesignIcon name="chevronDown" size={14} />
            </a>
            <SceneToggle
              tone="stage"
              stage={values.s?.stage}
              value={m.scene}
              onChange={m.setScene}
            />
          </div>
        );
      if (tag === "div" && st.gridTemplateColumns?.includes("repeat(2")) {
        if (!category && recommendedShops)
          return (
            <div
              {...p}
              ref={categoryContent}
              className="mobile-shop-feed"
              style={undefined}
              aria-busy={recommendations.isFetching}
            >
              <RecommendShopList
                shops={recommendedShops}
                onOpenShop={(shop) => shop.id && m.setShopId(shop.id)}
                onOpenFood={(dish) => {
                  if (dish.id) m.setFoodId(dish.id);
                  if (dish.restaurantId) m.setShopId(dish.restaurantId);
                }}
              />
              {!recommendedShops.length && (
                <MobileEmpty
                  title="暂时没有推荐"
                  detail="换个饭点或地点，也可以逛逛附近。"
                  action={
                    <button
                      className="mobile-inline-link"
                      disabled={recommendations.isFetching}
                      onClick={() => void recommendations.refetch()}
                    >
                      <DesignIcon name="shuffle" size={16} /> 刷新推荐
                    </button>
                  }
                />
              )}
            </div>
          );
        const listQuery = category ? categoryRecommendations : recommendations;
        const list =
            (category ? categoryRecommendations.data : recommendedFoods) ?? [],
          shown = category
            ? list.filter((f) => f.category === category)
            : isDemo
              ? [
                  list[4],
                  list[5],
                  ...list.filter((_, i) => i !== 4 && i !== 5),
                ].filter(Boolean)
              : list;
        return (
          <div
            {...p}
            ref={categoryContent}
            className="design-food-grid mobile-data-grid"
            aria-busy={listQuery.isFetching}
          >
            {listQuery.isFetching && !shown.length && (
              <ContentSkeleton count={2} />
            )}
            {shown.map((f) => (
              <FoodTile key={f.id} food={f} visual={visualFor(f, isDemo)} />
            ))}
            {listQuery.isError ? (
              <MobileEmpty
                title="推荐暂时没端上来"
                detail={errorMessage(listQuery.error)}
                action={
                  <button
                    className="mobile-inline-link"
                    disabled={listQuery.isFetching}
                    onClick={() => void listQuery.refetch()}
                  >
                    {listQuery.isFetching ? "正在加载推荐…" : "重新加载推荐"}
                  </button>
                }
              />
            ) : (
              !shown.length &&
              !listQuery.isFetching && (
                <MobileEmpty
                  title={category ? "这个分类还没有推荐" : "暂时没有推荐"}
                  detail="换个分类或饭点，也可以逛逛附近。"
                  action={
                    <button
                      className="mobile-inline-link"
                      onClick={() => void listQuery.refetch()}
                    >
                      <DesignIcon name="shuffle" size={16} /> 刷新推荐
                    </button>
                  }
                />
              )
            )}
          </div>
        );
      }
      if (n.attrs.role === "tab") {
        // The prototype draws five tabs; show v2's categories in those slots.
        const slot = ["今日推荐", "主食", "小吃", "饮品", "甜品"].indexOf(
          clean(text),
        );
        const tab = homeTabs[slot];
        if (tab) {
          const key = tab.key;
          p.onClick = () => setCategory(key);
          p["aria-selected"] = category === key;
          p.style = {
            ...st,
            fontWeight: category === key ? 900 : 400,
            fontSize: "15px",
            color: category === key ? "#231C18" : "#6E625B",
            whiteSpace: "nowrap",
          };
          return React.createElement(tag, p, tab.name);
        }
      }
      if (tag === "a" && String(n.attrs["aria-label"]).startsWith("通知"))
        p["aria-label"] = `通知，${unread.data ?? 0} 条未读`;
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
          food={liveFood}
          restaurant={dishRestaurant.data}
          back={foodBack}
          demo={isDemo}
          sharedAt={relativeTime(liveFood.createdAt)}
          likeDisabled={
            busy ||
            (!!session && user?.verified === true && liveFood.isLiked == null)
          }
          favoriteDisabled={
            busy ||
            (!!session &&
              user?.verified === true &&
              liveFood.isFavorite == null)
          }
          onLike={() => {
            void run(() => api.like(foodId, liveFood.isLiked === true));
          }}
          onFavorite={() => void toggleFavorite()}
          onShare={() => void sharing.share(liveFood.name ?? "山软今天吃什么")}
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
              <div className="mobile-restaurant-summary">
                {view.children[3]}
                {view.children[1]}
              </div>
            </div>
            {view.children[4]}
          </div>
        );
      if (id === 3) {
        p.className = "mobile-restaurant-art";
        p.style = undefined;
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
              <RestaurantMoreActions key={shopId} id={shopId} name={r.name} />
            </div>
          </header>
        );
      if (id === 10)
        p.onClick = () => void sharing.share(r.name ?? "山软今天吃什么");
      if (id === 12)
        return (
          <section {...p} className="mobile-restaurant-copy" style={undefined}>
            {view.children}
          </section>
        );
      if (id === 17) {
        p.className = "mobile-restaurant-stats";
        p.style = undefined;
      }
      if (id === 23)
        return (
          <div {...p} className="mobile-restaurant-sheet" style={undefined}>
            {view.children}
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
              panel?.scrollIntoView({
                block: "center",
                behavior: instantMotion() ? "instant" : "smooth",
              });
              (panel?.querySelector("select") ?? panel)?.focus({
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
      // The name and price row; the duplicate hint goes right under it.
      if (id === 26 && !reference)
        return (
          <>
            {React.createElement(tag, p, view.children)}
            <DishDuplicateHint restaurantId={shopId} name={m.draft.name} />
          </>
        );
      if (id === 45)
        return (
          <div className="mobile-publish-tag-groups">
            <AiTagSuggest
              className="mobile-publish-ai"
              restaurantId={shopId}
              name={m.draft.name}
              description={String(controller.state.desc ?? m.draft.description)}
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
                category: categoryCodes[controller.state.cat ?? 0],
                tagIds: m.draft.systemTagIds ?? [],
              }}
              disabled={busy || publishUncertain}
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
            <fieldset className="mobile-publish-tags">
              <legend>口味，最多 {MAX_DISH_TAGS} 个，可选</legend>
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
            <fieldset className="mobile-publish-tags">
              <legend>招牌菜</legend>
              <div>
                <button
                  type="button"
                  aria-pressed={!!m.draft.signature}
                  onClick={() => m.setDraft({ signature: !m.draft.signature })}
                >
                  这是这家店的招牌
                </button>
              </div>
            </fieldset>
            <DishAvailabilityFields
              variant="chips"
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
      if (id === 19)
        return (
          <div
            {...p}
            className="mobile-publish-fields"
            style={{ ...st, bottom: 96, overflowY: "auto", paddingBottom: 24 }}
          >
            {view.children}
          </div>
        );
      if (id === 2) {
        p.style = {
          ...st,
          background: m.draft.stage,
          cursor: m.draft.images.length ? "default" : "pointer",
        };
        if (!m.draft.images.length) {
          p.role = "button";
          p.tabIndex = 0;
          p["aria-label"] = "添加菜品照片";
          p.onClick = () => void chooseFiles();
          p.onKeyDown = (e: any) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void chooseFiles();
            }
          };
        }
      }
      if (
        [4, 5, 9].includes(id) &&
        ["#C9442B", "#A8321C", "#8F5B24"].includes(m.draft.stage)
      )
        p.style = { ...st, color: "#fff" };
      if (id === 15)
        return (
          <span {...p}>
            {m.draft.images.length}
            <span style={{ fontWeight: 600 }}> / 9</span>
          </span>
        );
      if (id === 18) p.style = { ...st, background: m.draft.stage };
      if (id === 10)
        return (
          <div
            {...p}
            style={{
              ...st,
              right: 20,
              overflowX: "auto",
              padding: "3px 0",
              top: 211,
            }}
          >
            {m.draft.images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                aria-label={`移除第 ${i + 1} 张照片`}
                onClick={() =>
                  m.setDraft({
                    images: m.draft.images.filter((_, j) => j !== i),
                  })
                }
                style={{
                  position: "relative",
                  flex: "0 0 56px",
                  width: 56,
                  height: 56,
                  padding: 0,
                  border: 0,
                  borderRadius: 16,
                  overflow: "hidden",
                  boxShadow: "0 0 0 3px #fff",
                }}
              >
                <img
                  src={img.url}
                  alt={`照片 ${i + 1}，点击移除`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </button>
            ))}
            <button
              type="button"
              aria-label="再加一张照片"
              onClick={() => void chooseFiles()}
              style={{
                flex: "0 0 56px",
                height: 56,
                border: "1.5px dashed #231c1873",
                borderRadius: 16,
                background: "#ffffff4d",
                color: "#231c18",
              }}
            >
              <DesignIcon name="add" size={22} />
            </button>
            <span
              style={{
                fontFamily: "Bricolage Grotesque Variable",
                fontSize: 14,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              {m.draft.images.length} / 9
            </span>
          </div>
        );
      if (tag === "img" && String(n.attrs.src).includes("yuntun")) {
        if (!m.draft.images.length) return null;
        p.src = m.draft.images[0].url;
        p.style = {
          ...st,
          borderRadius: "50%",
          objectFit: "cover",
          boxShadow: "0 0 0 8px white,0 22px 40px rgba(0,0,0,.3)",
        };
      }
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
        p.placeholder = "选填，不确定可不填";
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
          <div className="mobile-settings-actions">
            <Link to="/settings/preferences">
              口味偏好 · 让推荐更懂你
              <DesignIcon name="chevronRight" size={18} />
            </Link>
            <button
              {...p}
              style={{
                ...p.style,
                position: "static",
                width: "100%",
              }}
            >
              {view.children}
            </button>
          </div>
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
    if (screen === "G-PickShop") {
      if (id === 15) p.style = { ...p.style, bottom: 168, paddingBottom: 12 };
      if (id === 27) p.style = { ...p.style, top: "auto", bottom: 108 };
      if (tag === "span" && clean(text).includes("离你近的排在前面"))
        return <span {...p}>当前查询区域：{area?.name ?? "待选择"}</span>;
      if (tag === "input") {
        delete p.defaultValue;
        p.value = search;
        p.onChange = (e: any) => setSearch(e.target.value);
      }
      if (id === 15 && !shops.data?.items?.length)
        return <div {...p}>{shopList()}</div>;
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
    if (screen === "G-Me") {
      if (id === 1) {
        p.className += " mobile-profile-screen";
        p.style = {
          ...st,
          "--profile-stage": "#ffca44",
          "--profile-on": "#231c18",
        };
      }
      if (tag === "div" && st.top === "0" && st.height === "400px")
        return (
          <div {...p} className="mobile-profile-stage">
            <div className="mobile-profile-cover" aria-hidden="true">
              {displayedProfileCover === defaultProfileCover ? (
                <img
                  src={mediaUrl(defaultProfileCover.pictureUrl?.[0])}
                  alt=""
                  draggable={false}
                />
              ) : (
                <FoodCover
                  src={mediaUrl(displayedProfileCover.pictureUrl?.[0])}
                  crop={displayedProfileCover.coverCrop}
                  alt=""
                  onError={
                    displayedProfileCover === defaultProfileCover
                      ? undefined
                      : profilePhoto.onError
                  }
                />
              )}
            </div>
          </div>
        );
      if (tag === "div" && st.top === "372px")
        return (
          <ProfileSheet>
            {user?.role === "admin" && (
              <div className="mobile-admin-entry">
                <WorkspaceSwitch />
              </div>
            )}
            {view.children.slice(1)}
          </ProfileSheet>
        );
      if (tag === "section" && st.top === "100px")
        return (
          <section {...p} className="mobile-profile-identity">
            {view.children[0]}
            <div className="mobile-profile-title-row">
              {view.children[1]}
              <ProfileGrowth compact />
            </div>
            {view.children.slice(2)}
          </section>
        );
      if (tag === "a" && id === 5)
        return (
          <a {...p} aria-label="编辑资料">
            <DesignIcon name="edit" size={24} />
          </a>
        );
      if (tag === "a" && id === 6)
        return (
          <a {...p}>
            <DesignIcon name="settings" size={24} />
          </a>
        );
      if (id === 27)
        return (
          <div className="mobile-profile-shortcuts">
            <Link to="/favorites">
              <DesignIcon name="bookmark" size={25} />
              <span>
                <strong>收藏夹</strong>
                <span>收藏的菜和店</span>
              </span>
            </Link>
            <Link to="/history">
              <DesignIcon name="history" size={25} />
              <span>
                <strong>足迹</strong>
                <span>看过的菜和店</span>
              </span>
            </Link>
          </div>
        );
      if (tag === "div" && st.marginTop === "18px")
        p.className = "mobile-profile-statistics";
      // The application shell owns the same floating navigation as home.
      if (
        n.children.some(
          (child) => typeof child !== "string" && child.attrs.name === "G-Nav",
        )
      )
        return null;
      if (tag === "span" && clean(text) === "12 个，用来给菜分类")
        return (
          <span {...p}>{myTags.data?.totalItems ?? "—"} 个，用来给菜分类</span>
        );
      if (tag === "h1")
        return (
          <h1 {...p} className="mobile-profile-name">
            {user?.displayName || "同学"}
          </h1>
        );
      if (tag === "p" && clean(text) === "只吃好吃的，也只推荐好吃的")
        return (
          <p {...p} className="mobile-profile-signature">
            {user?.signature || BRAND_SLOGAN}
          </p>
        );
      if (tag === "span" && clean(text) === "天" && st.borderRadius === "50%") {
        const avatar = mediaUrl(user?.avatar);
        return (
          <span
            {...p}
            className="mobile-profile-avatar"
            style={{ ...st, overflow: "hidden" }}
          >
            {avatar ? (
              <img
                src={avatar}
                alt="我的头像"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              user?.displayName?.slice(0, 1) || "食"
            )}
          </span>
        );
      }
      if (tag === "span" && clean(text) === "37")
        return (
          <span {...p}>
            {id === 20
              ? (personal.data?.fansCount ?? "—")
              : (personal.data?.followingsCount ?? "—")}
          </span>
        );
      if (tag === "span" && clean(text) === "最近看过 26 家")
        return <span {...p}>看过的店和菜</span>;

      if (tag === "span" && ["187", "42", "16", "23"].includes(clean(text))) {
        const label = clean(text);
        const val =
          label === "187"
            ? personal.data?.earnedLikes
            : label === "42"
              ? personal.data?.uploadedFoodsCount
              : label === "16"
                ? personal.data?.fansCount
                : personal.data?.followingsCount;
        return (
          <span {...p}>
            {personal.isPending ? (
              <span className="ew-inline-skeleton" aria-label="正在加载统计" />
            ) : (
              (val ?? "—")
            )}
          </span>
        );
      }
      if (
        (tag === "button" && [39, 41, 43].includes(id)) ||
        n.attrs.role === "tab"
      ) {
        p.onClick = () => {
          const params = new URLSearchParams(location.search);
          params.delete("page");
          params.set(
            "tab",
            id === 43 ? "comments" : id === 41 ? "favorites" : "uploads",
          );
          nav(`/me?${params}`, { replace: true });
          setPage(1);
        };
        p["aria-selected"] =
          category === (id === 43 ? "评论" : id === 41 ? "收藏" : "上传");
        p.style = {
          ...st,
          fontWeight: p["aria-selected"] ? 900 : 400,
          color: p["aria-selected"] ? "#231C18" : "#6E625B",
        };
        if (id === 43) return <button {...p}>评论</button>;
        return (
          <button {...p}>
            {id === 41 ? "收藏" : "上传"}
            <span
              style={{
                fontFamily: "'Bricolage Grotesque Variable'",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {id === 41
                ? (favorites.data?.totalItems ?? "—")
                : (myFoods.data?.totalItems ?? "—")}
            </span>
          </button>
        );
      }
      if (tag === "div" && id === 45) {
        if (category === "评论")
          return (
            <div className="mobile-profile-comments">
              <MyFoodComments
                emptyState={
                  <div className="mobile-profile-comments-empty">
                    <span>
                      <DesignIcon name="comment" size={34} />
                    </span>
                    <h2>还没写过评论</h2>
                    <Link className="design-button light" to="/">
                      去发现
                    </Link>
                  </div>
                }
              />
            </div>
          );
        const query = category === "收藏" ? favorites : myFoods;
        if (query.isPending)
          return (
            <div {...p} className="design-food-grid mobile-data-grid">
              <ContentSkeleton kind="cards" count={2} />
            </div>
          );
        if (query.isError && !query.data)
          return (
            <div {...p} className="design-food-grid mobile-data-grid">
              <MobileEmpty
                title="暂时没能加载这些菜"
                detail={errorMessage(query.error)}
                action={
                  <PrimaryButton light onClick={() => void query.refetch()}>
                    重新加载
                  </PrimaryButton>
                }
              />
            </div>
          );
        const list = category.includes("收藏")
          ? favorites.data?.items
          : myFoods.data?.items;
        return (
          <div {...p} className="design-food-grid mobile-data-grid">
            {list?.map((f) => (
              <FoodTile
                key={f.id}
                food={f}
                meta="likes"
                visual={visualFor(f, isDemo)}
              />
            ))}
            {list?.length === 0 && (
              <MobileEmpty
                illustration={category === "收藏" ? "yangzhi" : "yuntun"}
                title={
                  category === "收藏" ? "还没有收藏的菜" : "还没有分享过菜"
                }
                detail={
                  category === "收藏"
                    ? "去发现，收下你想尝的好味道。"
                    : "分享今天吃到的好味道，记下你的第一餐。"
                }
                action={
                  <Link
                    className="design-button light"
                    to={category === "收藏" ? "/" : "/publish"}
                  >
                    {category === "收藏" ? "去发现" : "分享一道菜"}
                  </Link>
                }
              />
            )}
            <More />
          </div>
        );
      }
    }
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
              color: "#6E625B",
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
      screen === "G-Crop" &&
      tag === "img" &&
      String(n.attrs.src).includes("luosi") &&
      m.draft.images.length
    ) {
      const preview = String(n.attrs.src).includes("sq_luosi");
      const layout = photoFraming(
        controller.state.photoWidth ?? 300,
        controller.state.photoHeight ?? 300,
        {
          x: controller.state.ox ?? 0,
          y: controller.state.oy ?? 0,
          zoom: controller.state.zoom ?? 1,
        },
        preview ? 100 : 300,
      ).image;
      p.src = m.draft.images.at(-1)!.url;
      p.alt = preview ? "首页裁剪预览" : "所选照片";
      p.onLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
        const image = event.currentTarget;
        if (
          controller.state.photoWidth !== image.naturalWidth ||
          controller.state.photoHeight !== image.naturalHeight
        )
          controller.setState({
            photoWidth: image.naturalWidth,
            photoHeight: image.naturalHeight,
          });
      };
      p.style = {
        ...st,
        position: "absolute",
        left: (preview ? 0 : 45) + layout.left,
        top: (preview ? 0 : 50) + layout.top,
        width: layout.width,
        height: layout.height,
        maxWidth: "none",
        objectFit: "fill",
        transform: "none",
        userSelect: "none",
        pointerEvents: "none",
      };
    }
    if (screen === "G-Crop") {
      if (tag === "div" && n.attrs.role === "group") {
        p["aria-label"] = "照片取景，单指拖动、双指缩放";
        p.onLostPointerCapture = values.up;
      }
      if (tag === "span" && clean(text) === "拖动、缩放，把主菜放进圈里")
        return <span {...p}>单指拖动，双指缩放</span>;
      if (tag === "input" && p.type === "range") {
        p.min = 1;
        p.max = MAX_PHOTO_ZOOM;
      }
    }
    if (screen === "G-Crop" && tag === "span" && clean(text) === "柳州螺蛳粉")
      return <span {...p}>{m.draft.name || "你的这道菜"}</span>;
    if (
      screen === "G-PanelPlace" &&
      n.attrs.role === "radiogroup" &&
      n.attrs["aria-label"] === "校区"
    )
      return (
        <div {...p} role="group" aria-label="推荐校区与附近区域">
          <div role="radiogroup" aria-label="推荐校区">
            {campusList.data
              ?.filter((c) => c.open !== false)
              .map((c) => (
                <button
                  key={c.id}
                  role="radio"
                  aria-checked={campusId === c.id}
                  className="mobile-place-chip"
                  style={
                    campusId === c.id
                      ? { background: "#231c18", color: "white" }
                      : undefined
                  }
                  onClick={() => selectCampus(c.id!)}
                >
                  {c.name}
                </button>
              ))}
          </div>
          {hubs.data?.items?.map((h) => (
            <button
              key={h.id}
              className="mobile-place-chip"
              disabled={!h.id || busy}
              onClick={() =>
                void run(async () => {
                  const detail = await api.hubDetail(h.id!);
                  if (detail.id !== h.id || !hasCoordinates(detail))
                    throw new Error("区域详情缺少有效坐标，请重试或使用定位。");
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
          <button
            className="mobile-place-chip"
            disabled={busy}
            onClick={locate}
          >
            <DesignIcon name="locate" size={16} />
            使用我的位置
          </button>
        </div>
      );
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
    if (
      screen === "G-PanelFilter" &&
      tag === "a" &&
      clean(text).startsWith("看 ")
    )
      p.onClick = (e: any) => {
        e.preventDefault();
        m.notice(
          "当前餐厅搜索不支持价格、评分或只看收藏筛选，选择不会作为已生效条件。",
        );
      };
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
    const d = (
      ["G-Nearby", "G-PickShop", "G-Search"].includes(screen)
        ? shops.data
        : screen === "G-Me" && category === "收藏"
          ? favorites.data
          : relevant?.data
    ) as any;
    return d?.hasNext ? (
      <div className="mobile-page-more">
        <PrimaryButton light onClick={() => setPage((p) => p + 1)}>
          下一页
        </PrimaryButton>
      </div>
    ) : null;
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
  function locate() {
    void run(async () => {
      if (!navigator.geolocation)
        throw new Error("当前浏览器无法定位，请手选区域。");
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          resolve,
          () => reject(new Error("未获取到位置，请手动选择区域。")),
          { timeout: 10000, maximumAge: 60000 },
        ),
      );
      const coordinates = wgsToGcj(pos.coords.longitude, pos.coords.latitude);
      const hub = await api.locateHub(coordinates.gcjLng, coordinates.gcjLat);
      selectArea({
        name: hub?.name ? `${hub.name}附近` : "当前位置",
        ...coordinates,
        hubId: hub?.id ?? undefined,
        source: "device",
      });
      m.closePanel();
    });
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
    if (screen === "G-PickShop" && target === "G-AddDish.dc.html") {
      const selected = shops.data?.items?.find((r) => r.id === m.shopId);
      if (!selected) {
        m.notice("先选一家店。");
        return;
      }
      m.setDraft({ restaurantId: selected.id!, shopName: selected.name ?? "" });
      nav("/publish/dish");
      return;
    }
    if (screen === "G-AddDish" && target === "G-Crop.dc.html") {
      void chooseFiles();
      return;
    }
    if (
      screen === "G-Crop" &&
      target === "G-AddDish.dc.html" &&
      label !== "取消"
    ) {
      void run(async () => {
        const image = m.draft.images.at(-1);
        if (!image) throw new Error("先选择一张照片。");
        const result = await adjustPhoto(image.file, {
          x: controller.state.ox ?? 0,
          y: controller.state.oy ?? 0,
          zoom: controller.state.zoom ?? 1,
        });
        const images = [...m.draft.images];
        images[images.length - 1] = {
          file: result.file,
          url: URL.createObjectURL(result.file),
        };
        URL.revokeObjectURL(image.url);
        m.setDraft({
          images,
          stage: (m.draft.candidates ?? ["#8F5B24", "#A8321C", "#D9632B"])[
            controller.state.color ?? 0
          ],
        });
        nav("/publish/dish");
      });
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
      const list = carouselFoods,
        k = list.length
          ? (((controller.state.n ?? 0) % list.length) + list.length) %
            list.length
          : 0;
      const f = list[k];
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
    (!session || accountUnavailable || verificationRequired || user?.banned);
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
    screen !== "G-Me" &&
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
  if (accountPending || (!denied && screen !== "G-Me" && relevant?.isPending))
    before = <MobilePageSkeleton screen={screen} />;
  if (!denied && screen === "G-Crop" && !m.draft.images.length)
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
          key={foodId}
          foodId={foodId}
          foodName={detail.data?.name}
          onClose={() => setReportOpen(false)}
        />
      )}
      {correctionOpen && (
        <RestaurantCorrectionDialog
          key={shopId}
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
      {screen === "G-Crop" && (
        <span
          style={{
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 12,
            fontSize: 11,
            color: "rgba(255,255,255,.7)",
            textAlign: "center",
          }}
        >
          舞台色与裁剪后的照片将在发布时同步保存
        </span>
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
      (screen !== "G-Me" && !!relevant?.isPending) ||
      (screen !== "G-Me" &&
        !!relevant?.isError &&
        !relevant.data &&
        !homeScreens.has(screen)) ||
      (screen === "G-Crop" && !m.draft.images.length),
  };
}
// v2 dish categories, in the order of the publish chips.
const categoryCodes = foodCategories.map((c) => c.id as string);
const homeTabs = [
  { key: "", name: "今日推荐" },
  // Four slots: the prototype's staple / snack / drink picks, plus v2's 菜.
  ...foodCategories
    .filter((c) => ["staple", "side_dish", "snack", "drink"].includes(c.id))
    .map((c) => ({ key: c.id as string, name: c.name })),
];
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
