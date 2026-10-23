import React, { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { useArea } from "../app/area";
import { ApiError, errorMessage, resultUncertain } from "../api/client";
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
import type { Bridge, Controller, NodeView, Values } from "./types";
import {
  useMobile,
  DesignIcon,
  PrimaryButton,
  Pending,
  FoodTile,
  ShopRow,
  MobileEmpty,
} from "./ui";
import { demoDishes, visualFor, stageColors } from "./catalog";
import { screenRoutes, panelScreens, pendingScreens } from "./routes";
import { adjustPhoto, saveVisual } from "./photos";

const needsVerification = new Set([
  "G2-Home",
  "G-HomePhoto",
  "G-Dish",
  "G-Detail",
  "G-PickShop",
  "G-AddDish",
  "G-NewShop",
  "G-Crop",
  "G-MyTags",
  "G-TagDishes",
  "G-History",
  "G-PanelTag",
]);
const publicScreens = new Set([
  "G-Login",
  "G-PasswordLogin",
  "G-PhoneLogin",
  "G-RegisterConfirm",
  "G-ForgotPassword",
  "G-Reconsent",
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
  const app = useApp(),
    { api, user, session, toast } = app,
    m = useMobile(),
    nav = useNavigate(),
    location = useLocation(),
    cache = useQueryClient(),
    { area, selectArea } = useArea();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [page, setPage] = useState(1),
    [category, setCategory] = useState(""),
    [search, setSearch] = useState(""),
    [expanded, setExpanded] = useState(false);
  const active = !reference && !!session,
    verified = active && user?.verified === true && !user?.banned;
  const foodId =
    parseId(location.pathname.match(/^\/foods\/(\d+)/)?.[1]) ?? m.foodId;
  const shopId =
    parseId(location.pathname.match(/^\/restaurants\/(\d+)/)?.[1]) ?? m.shopId;
  const otherId =
    parseId(location.pathname.match(/^\/users\/(\d+)/)?.[1]) ?? 21;
  const followingUserId = parseId(
    new URLSearchParams(location.search).get("userId") ?? undefined,
  );
  useEffect(
    () => setPage(1),
    [controller.state.tab, search, controller.state.q],
  );
  const recommendations = useQuery({
    queryKey: ["foods", "mobile-recommend"],
    queryFn: () => api.recommend(8),
    enabled: verified && homeScreens.has(screen),
  });
  const detail = useQuery({
    queryKey: ["foods", "detail", foodId],
    queryFn: () => api.food(foodId),
    enabled:
      verified &&
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
    enabled:
      verified && ["G-Detail", "G-AddDish", "G-WrongInfo"].includes(screen),
  });
  const restaurantFoods = useQuery({
    queryKey: ["foods", "restaurant", shopId, page],
    queryFn: () => api.foods(shopId, page),
    enabled: verified && screen === "G-Detail",
  });
  const dishRestaurant = useQuery({
    queryKey: ["restaurants", "detail", detail.data?.restaurantId],
    queryFn: () => api.restaurant(detail.data!.restaurantId!),
    enabled: verified && screen === "G-Dish" && !!detail.data?.restaurantId,
  });
  const favorites = useQuery({
    queryKey: ["foods", "favorites", page],
    queryFn: () => api.favorites(page),
    enabled: verified && (screen === "G-TagDishes" || screen === "G-Me"),
  });
  const myFoods = useQuery({
    queryKey: ["foods", "mine", page],
    queryFn: () => api.myFoods(page),
    enabled: verified && screen === "G-Me",
  });
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
    enabled: verified && screen === "G-PanelTag",
  });
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
    enabled: verified && screen === "G-History",
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
    queryFn: () => api.unread(),
    enabled: active && (homeScreens.has(screen) || screen === "G-Inbox"),
    refetchInterval: 60_000,
  });
  const hubs = useQuery({
    queryKey: ["hubs", page],
    queryFn: () => api.hubs(page),
    enabled: active && screen === "G-PanelPlace",
  });
  const queryKeyword =
    screen === "G-Search" ? String(controller.state.q ?? "") : search;
  const shops = useQuery({
    queryKey: ["restaurants", "mobile-search", area, queryKeyword, page],
    queryFn: () =>
      api.restaurantSearch({
        keyword: queryKeyword || undefined,
        gcjLng: area!.gcjLng,
        gcjLat: area!.gcjLat,
        hubId: area?.hubId,
        page,
        pageSize: 12,
      }),
    enabled:
      active &&
      !!area &&
      ["G-Nearby", "G-PickShop", "G-Search"].includes(screen),
  });
  const consent = useQuery({
    queryKey: ["consent-policy"],
    queryFn: () => api.consentPolicy(),
    enabled: !reference && screen === "G-Reconsent",
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
      ? (recommendations.data?.slice(0, 5) ?? [])
      : (recommendations.data ?? []);
  const liveFood = detail.data;
  const draftPanel =
    screen === "G-PanelTag" && location.pathname === "/publish/dish";
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
      if (resultUncertain(e)) setUncertain(true);
    } finally {
      setBusy(false);
    }
  }
  const unavailable = (name: string) =>
    m.notice(`${name}待接入。当前接口文档未提供完整协议，本次不会提交数据。`);
  async function toggleFavorite() {
    if (!liveFood || liveFood.isFavorite == null) return;
    await run(() => api.favorite(foodId, liveFood.isFavorite!));
  }
  async function login(mockAccount = false) {
    await run(async () => {
      const reply = await api.login({
        username:
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
        nav(new URLSearchParams(location.search).get("next") ?? "/");
      } else if (result.kind === "consent") {
        m.setDraft({});
        sessionProof = result.proof;
        nav("/auth/consent");
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
    if (uncertain) return;
    m.setDraft({
      description: String(controller.state.desc ?? m.draft.description),
      category: categoryCodes[controller.state.cat ?? 0],
    });
    await run(async () => {
      const draft = m.draft;
      if (!draft.name.trim()) throw new Error("写一个菜名，再发布。");
      if (!draft.images.length) throw new Error("先加一张你拍的照片。");
      if (!shopId) throw new Error("先选一家店。");
      const images = [...draft.images];
      for (let i = 0; i < images.length; i++) {
        if (images[i].key) continue;
        const key = await app.upload(images[i].file, "foods");
        images[i] = { ...images[i], key };
        m.setDraft({ images: [...images] });
        saveVisual(key, draft.stage);
      }
      const price = draft.price.trim() === "" ? undefined : Number(draft.price);
      if (price !== undefined && (!Number.isFinite(price) || price < 0))
        throw new Error("价格填 0 或更大的数字。");
      await api.createFood({
        restaurantId: shopId,
        name: draft.name.trim(),
        price,
        description:
          String(controller.state.desc ?? draft.description) || undefined,
        category: categoryCodes[controller.state.cat ?? 0] as Category,
        pictureUrl: images.map((i) => i.key!),
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
        stage: "#F3C46E",
        crop: undefined,
        candidates: undefined,
        restaurantId: undefined,
        shopName: undefined,
        publishing: false,
        publishUncertain: false,
      });
      m.notice(
        draft.tags.length
          ? "菜已发布。创建接口暂未返回新编号，请到我的分享找到它，再保存标签。"
          : "菜已发布。请到我的分享查看刚提交的内容。",
      );
      nav("/me?tab=uploads");
    });
  }

  if (homeScreens.has(screen) && !reference) {
    const list = carouselFoods,
      N = list.length,
      n = controller.state.n ?? 0,
      k = N ? ((n % N) + N) % N : 0;
    if (list[k]) values.s = visualFor(list[k], isDemo);
    values.dots = list.map((_, i) => ({
      w: i === k ? 16 : 5,
      o: i === k ? 1 : 0.4,
    }));
    for (let i = 0; i < 8; i++) {
      let d = N ? (((i - n) % N) + N) % N : 0;
      if (d > N / 2) d -= N;
      const theta = d * 55 + (controller.state.drag ?? 0);
      values["p" + i] = {
        t: `rotate(${theta.toFixed(2)}deg) translateY(-430px) scale(${(1 - 0.15 * Math.min(1, Math.abs(theta) / 55)).toFixed(3)})`,
        o: !list[i] || Math.abs(d) >= 2 ? 0 : 1,
      };
    }
  }
  if (screen === "G-PasswordLogin" && !reference) {
    values.msg = error;
    values.hasMsg = !!error;
    values.invalid = !!error;
    values.line = error ? "#A8321C" : "#E6DED8";
    values.locked = busy;
    values.canLogin = !busy;
  }
  if (screen === "G-EditProfile" && !reference) {
    const invalid =
      String(controller.state.nick ?? "").trim().length < 3 ||
      String(controller.state.nick ?? "").trim().length > 10;
    values.nickBad = invalid ? "true" : "false";
    values.nickTip = invalid
      ? "昵称需要 3–10 个字"
      : "3–10 个字，可以和别人重名";
    values.setNick = (e: any) =>
      controller.setState({ nick: e.target.value.slice(0, 10) });
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
          return api.sendEmail(email);
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
        controller.setState({ draft: e.target.value.slice(0, 64) }),
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
        ? m.draft.tags.includes(t.name!)
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
                tags: on
                  ? m.draft.tags.filter((n) => n !== t.name)
                  : [...m.draft.tags, t.name!],
              })
            : run(() =>
                on
                  ? api.removeTag(foodId, t.id!)
                  : api.addSystemTags(foodId, [t.id!]),
              ),
      };
    });
    values.mine = (myTags.data?.items ?? []).map((t) => {
      const on = draftPanel
        ? m.draft.tags.includes(t.name!)
        : tags.data?.myCustomTags?.some((x) => x.id === t.id);
      return {
        name: t.name,
        ...qstyle(!!on),
        pick: () =>
          draftPanel
            ? m.setDraft({
                tags: on
                  ? m.draft.tags.filter((n) => n !== t.name)
                  : [...m.draft.tags, t.name!],
              })
            : run(() =>
                on
                  ? api.removeTag(foodId, t.id!)
                  : api.addCustomTags(foodId, [t.name!]),
              ),
      };
    });
    values.addMine = () =>
      run(async () => {
        const name = String(controller.state.draft ?? "").trim();
        if (!name) return;
        if (draftPanel) m.setDraft({ tags: [...m.draft.tags, name] });
        else await api.addCustomTags(foodId, [name]);
        controller.setState({ writing: false, draft: "" });
      });
  }
  if (screen === "G-AddDish" && !reference) {
    values.cats = (original.cats ?? []).map((c: any, i: number) => ({
      ...c,
      pick: () => {
        controller.setState({ cat: i });
        m.setDraft({ category: categoryCodes[i] });
      },
    }));
    values.desc = m.draft.description;
    values.descLen = m.draft.description.length;
    values.setDesc = (e: any) => {
      m.setDraft({ description: e.target.value.slice(0, 200) });
      controller.setState({ desc: e.target.value.slice(0, 200) });
    };
    values.tags = (systemTags.data ?? []).map((t) => ({
      label: t.name,
      ...qstyle(m.draft.tags.includes(t.name!)),
      line: m.draft.tags.includes(t.name!) ? "#231C18" : "#E6DED8",
      toggle: () =>
        m.setDraft({
          tags: m.draft.tags.includes(t.name!)
            ? m.draft.tags.filter((n) => n !== t.name)
            : [...m.draft.tags, t.name!],
        }),
    }));
  }
  if (screen === "G-PickShop" && !reference) {
    const list = shops.data?.items ?? [],
      chosen = list.find((r) => r.id === m.shopId);
    values.chosen = chosen?.name ?? "所选餐厅";
    values.rows = list.map((r) => ({
      id: r.id,
      name: r.name,
      dist: "",
      hub: r.address ?? "",
      tint: "#F4EFEB",
      img: mediaUrl(r.pictureUrl?.[0]) ?? "/prototype/assets/dishes/yuntun.svg",
      ...qstyle(r.id === m.shopId),
      ring: r.id === m.shopId ? "#231C18" : "#D9D0C9",
      fill: r.id === m.shopId ? "#231C18" : "transparent",
      check: r.id === m.shopId ? 1 : 0,
      pick: () => m.setShopId(r.id!),
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
      name: p.userName,
      initial: p.userName?.slice(0, 1) ?? "食",
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
      flip: () => unavailable("通知偏好同步"),
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
    values.toggleCut = () => unavailable("自动去背景");
    values.cutLabel = "false";
    values.cutTrack = "rgba(255,255,255,0.25)";
    const originalMove = original.move;
    values.move = (event: any) => {
      originalMove?.(event);
      if (controller.state.dragging) {
        const max = 150 * (Math.max(1, controller.state.zoom ?? 1) - 1);
        controller.setState((state: any) => ({
          ox: Math.max(-max, Math.min(max, state.ox)),
          oy: Math.max(-max, Math.min(max, state.oy)),
        }));
      }
    };
    values.zoomTo = (event: any) => {
      const zoom = Number(event.target.value),
        max = 150 * (zoom - 1);
      controller.setState({
        zoom,
        ox: Math.max(-max, Math.min(max, controller.state.ox ?? 0)),
        oy: Math.max(-max, Math.min(max, controller.state.oy ?? 0)),
      });
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
    // Business navigation replaces every prototype cross-file link with SPA routes.
    if (tag === "a") {
      const target = String(p.href ?? "");
      p.href = "#" + resolveHref(target, m, screen);
      p.onClick = (event: any) => {
        event.preventDefault();
        navigateDesign(target, clean(text), p["aria-label"]);
      };
    }
    if (tag === "button" && !p.onClick && !p.disabled)
      p.onClick = () =>
        unavailable(p["aria-label"] ?? clean(text) ?? "这个功能");
    if (tag === "ul" && ["G-MyTags", "G-History", "G-Follows"].includes(screen))
      return (
        <ul {...p} style={{ ...st, bottom: 30, overflowY: "auto" }}>
          {view.children}
          {!(relevant?.data as any)?.items?.length && (
            <li style={{ listStyle: "none" }}>
              <MobileEmpty title="这里还没有内容" />
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
      return <span {...p}>设备会话列表待接入，暂不能查询其他登录</span>;
    if (p.onClick && busy && tag === "button") p.disabled = true;
    if (st.fontFamily?.includes("Bricolage"))
      p.style = {
        ...st,
        fontFamily: "'Bricolage Grotesque Variable',sans-serif",
      };
    if (n.id === 1 && panelScreens.has(screen)) {
      p.style = { ...p.style, background: "transparent" };
    }
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
    if (
      (pendingScreens[screen] || screen === "G-DataNotice") &&
      tag === "h1" &&
      !text.includes("待接入")
    )
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
      !text.includes("待接入") &&
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
      if (tag === "a" && n.attrs.href === "G-PanelPlace.dc.html")
        return (
          <a {...p}>
            <DesignIcon name="nearby" size={16} />
            {isDemo && area?.hubId === 1 ? "软件园" : (area?.name ?? "选地点")}
            <span style={{ fontWeight: 400, opacity: 0.8 }}>{m.meal}</span>
            <DesignIcon name="chevronDown" size={14} />
          </a>
        );
      if (
        screen === "G-HomePhoto" &&
        tag === "img" &&
        String(n.attrs.src).includes("/sq_")
      ) {
        const idx = [
          "sq_luosi",
          "sq_tieguo",
          "sq_niandou",
          "sq_hongshao",
          "sq_paigu",
        ].findIndex((s) => String(n.attrs.src).includes(s));
        const food = carouselFoods[idx];
        if (!food) return null;
        p.src = mediaUrl(food.pictureUrl?.[0]);
        p.alt = food.name;
      }
      if (tag === "img" && st.top === "570px") {
        const index = demoDishes.findIndex((d) =>
          String(n.attrs.src).includes("/" + d.asset + "."),
        );
        const f = recommendations.data?.[index];
        p.src = f ? mediaUrl(f.pictureUrl?.[0]) : undefined;
        if (!f) return null;
        if (!visualFor(f, isDemo).asset)
          p.style = {
            ...st,
            borderRadius: "50%",
            objectFit: "cover",
            boxShadow: "0 0 0 8px white,0 22px 40px rgba(0,0,0,.3)",
          };
      }
      if (tag === "div" && st.gridTemplateColumns?.includes("repeat(2")) {
        const list = recommendations.data ?? [],
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
          <div {...p} className="design-food-grid mobile-data-grid">
            {shown.slice(0, expanded ? undefined : 2).map((f) => (
              <FoodTile key={f.id} food={f} visual={visualFor(f, isDemo)} />
            ))}
            {!shown.length && <MobileEmpty title="这一组里还没有这个口味" />}
            {!expanded && shown.length > 2 && (
              <div style={{ gridColumn: "1/-1", marginTop: 60 }}>
                <PrimaryButton light onClick={() => setExpanded(true)}>
                  再看几道
                </PrimaryButton>
              </div>
            )}
          </div>
        );
      }
      if (n.attrs.role === "tab") {
        const key = (
          {
            今日推荐: "",
            主食: "staple",
            小吃: "snack",
            饮品: "drink",
            甜品: "dessert",
          } as Record<string, string>
        )[clean(text)];
        p.onClick = () => setCategory(key);
        p["aria-selected"] = category === key;
        p.style = {
          ...st,
          fontWeight: category === key ? 900 : 400,
          fontSize: category === key ? "17px" : "15px",
          color: category === key ? "#231C18" : "#6E625B",
        };
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
    if (screen === "G-Dish" && liveFood) {
      const vis = visualFor(liveFood, isDemo);
      if (id === 2) p.style = { ...st, background: vis.stage };
      if ([5, 16, 6, 9, 14].includes(id)) p.style = { ...st, color: vis.on };
      if (tag === "img" && String(n.attrs.src).includes("yuntun")) {
        p.src = mediaUrl(liveFood.pictureUrl?.[0]);
        p.alt = liveFood.name;
        if (!vis.asset)
          p.style = {
            ...st,
            borderRadius: "50%",
            objectFit: "cover",
            boxShadow: "0 0 0 8px white,0 22px 40px rgba(0,0,0,.3)",
          };
      }
      if (tag === "h1")
        return (
          <h1 {...p} style={{ ...st, color: vis.on }}>
            <span style={{ display: "block" }}>{vis.l1}</span>
            <span style={{ display: "block" }}>{vis.l2}</span>
          </h1>
        );
      if (tag === "span" && clean(text) === "¥18")
        return (
          <span {...p} style={{ ...st, color: vis.on }}>
            {money(liveFood.price)}
          </span>
        );
      if (matches(view, "袁记云饺") && tag === "span")
        return <span {...p}>{liveFood.restaurantName}</span>;
      if (tag === "span" && clean(text) === "320 m")
        return vis.dist ? <span {...p}>{vis.dist}</span> : null;
      if (tag === "span" && clean(text) === "万达金街 1 层")
        return (
          <span {...p}>{dishRestaurant.data?.address ?? "地址待补充"}</span>
        );
      if (tag === "a" && String(n.attrs.href) === "G-Comments.dc.html")
        p["aria-label"] = "评论（待接入）";
      if (tag === "span" && id === 38) return <span {...p}>—</span>;
      if (tag === "a" && String(n.attrs.href) === "G-Detail.dc.html")
        p.onClick = (e: any) => {
          e.preventDefault();
          m.setShopId(liveFood.restaurantId!);
          nav(`/restaurants/${liveFood.restaurantId}`);
        };
      if (clean(text) === "分享" || p["aria-label"] === "分享")
        p.onClick = () =>
          shareCurrent(liveFood.name ?? "山软今天吃什么", m.notice);
      if (id === 32) {
        p.onClick = () => run(() => api.like(foodId, liveFood.isLiked!));
        p["aria-pressed"] = liveFood.isLiked === true;
        p.disabled = busy || liveFood.isLiked == null;
        return (
          <button {...p}>
            <DesignIcon
              name={liveFood.isLiked ? "heartOn" : "heart"}
              size={20}
            />
            <span style={{ fontFamily: "'Bricolage Grotesque Variable'" }}>
              {liveFood.likesCount ?? "—"}
            </span>
          </button>
        );
      }
      if (id === 43)
        return (
          <div {...p}>
            {liveFood.systemTags?.map((t, i) => (
              <button
                key={t.id}
                className="mobile-taste-word"
                onClick={() => m.openPanel("G-PanelTag")}
                style={{
                  fontSize: [28, 22, 19, 16][Math.min(i, 3)],
                  fontWeight: [900, 700, 600, 500][Math.min(i, 3)],
                }}
              >
                {t.name}
                <span>{t.count ?? "—"}</span>
              </button>
            ))}
            <button
              className="mobile-add-tag"
              onClick={() => m.openPanel("G-PanelTag")}
            >
              + 加标签
            </button>
          </div>
        );
      if (id === 54)
        return (
          <section {...p}>
            <Link
              to={`/users/${liveFood.accountId}`}
              className="mobile-contributor"
            >
              <span className="mobile-avatar">
                {liveFood.uploaderName?.slice(0, 1) ?? "食"}
              </span>
              <strong>{liveFood.uploaderName ?? "同学"}</strong>
              <small>{relativeTime(liveFood.createdAt)}上传</small>
            </Link>
            <p
              style={{
                margin: 0,
                fontSize: 15,
                lineHeight: "24px",
                whiteSpace: "pre-wrap",
              }}
            >
              {liveFood.description || "分享者还没有留下描述。"}
            </p>
          </section>
        );
      if (id === 17)
        return (
          <span {...p}>
            {
              (
                {
                  staple: "主食",
                  drink: "饮品",
                  snack: "小吃",
                  dessert: "甜品",
                  soup: "汤",
                  hot_pot: "火锅",
                  grill: "烧烤",
                  cold_dish: "凉菜",
                  side_dish: "配菜",
                  other: "其他",
                } as Record<string, string>
              )[liveFood.category ?? "other"]
            }
          </span>
        );
    }
    if (screen === "G-Detail" && restaurant.data) {
      const r = restaurant.data;
      if (id === 19)
        return <span {...p}>{restaurantFoods.data?.totalItems ?? "—"}</span>;
      if (id === 16)
        return isDemo ? (
          <span {...p}>
            距你 {demoDishes.find((d) => d.restaurantId === r.id)?.dist ?? "—"}
          </span>
        ) : null;
      if (id === 46 && !isDemo)
        return (
          <section {...p}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
              大家怎么说 <Pending />
            </h2>
            <p style={{ fontSize: 13, color: "#6e625b" }}>
              餐厅口味聚合待接入，可在具体菜品中查看标签。
            </p>
          </section>
        );
      if (tag === "h1") return <h1 {...p}>{r.name}</h1>;
      if (tag === "span" && clean(text) === "万达金街 1 层")
        return <span {...p}>{r.address ?? "地址待补充"}</span>;
      if (tag === "section" && id === 29)
        return (
          <section {...p}>
            <h2
              style={{
                margin: 0,
                padding: "0 20px",
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              招牌
            </h2>
            <div className="mobile-food-carousel">
              {restaurantFoods.data?.items?.map((f) => (
                <FoodTile
                  key={f.id}
                  food={f}
                  meta="price"
                  visual={visualFor(f, isDemo)}
                />
              ))}
            </div>
            <More />
          </section>
        );
      if (tag === "button" && clean(text) === "导航去店里")
        p.onClick = () => {
          if (!hasCoordinates(r)) m.notice("这家店还没有可用的位置。");
          else
            window.open(
              `https://uri.amap.com/marker?position=${r.gcjLng},${r.gcjLat}&name=${encodeURIComponent(r.name ?? "餐厅")}&coordinate=gaode`,
              "_blank",
              "noopener,noreferrer",
            );
        };
    }
    if (screen === "G-AddDish") {
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
        p.onChange = (e: any) => m.setDraft({ price: e.target.value });
      }
      if (tag === "span" && clean(text) === "袁记云饺")
        return <span {...p}>{restaurant.data?.name ?? "所选餐厅"}</span>;
      if (tag === "button" && clean(text) === "+ 自己写")
        p.onClick = () => {
          m.openPanel("G-PanelTag");
        };
    }
    if (screen === "G-EditProfile") {
      if (tag === "input" && p.id === "nick") p.maxLength = 10;
      if (tag === "label" && p.htmlFor === "nick")
        return (
          <label {...p}>
            昵称<span>{String(controller.state.nick ?? "").length} / 10</span>
          </label>
        );
      if (tag === "button" && ["拍一张", "从相册选"].includes(clean(text)))
        p.onClick = () => void pickAvatar();
      if (id === 11 && user?.avatar) {
        p.style = { ...st, overflow: "hidden" };
        return (
          <button {...p} onClick={() => void pickAvatar()}>
            <img
              src={mediaUrl(user.avatar)}
              alt="头像"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </button>
        );
      }
    }
    if (screen === "G-Settings" && tag === "span" && clean(text) === "已认证")
      return <span {...p}>{user?.verified ? "已认证" : "去认证"}</span>;
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
    if (screen === "G-Nearby") {
      if (tag === "input") {
        p.value = search;
        p.onChange = (e: any) => {
          setSearch(e.target.value);
          setPage(1);
        };
        delete p.defaultValue;
      }
      if (id === 59)
        return (
          <div {...p} className="mobile-scroll-region mobile-data-grid">
            <span className="mobile-drawer-handle" />
            <div className="mobile-nearby-heading">
              <h1>
                附近 <span>{shops.data?.totalItems ?? "—"}</span>
              </h1>
              <span>按所选区域查询</span>
            </div>
            {shopList()}
            <More />
          </div>
        );
      if (tag === "button" && p["aria-label"] === "回到我的位置")
        p.onClick = locate;
      if (
        tag === "button" &&
        p["aria-label"] &&
        /袁记|饭庄|一点点|研究所|小站|点心/.test(p["aria-label"])
      )
        p.onClick = () => {
          const r = shops.data?.items?.find((r) => r.name === p["aria-label"]);
          if (r?.id) {
            m.setShopId(r.id);
            nav(`/restaurants/${r.id}`);
          } else m.notice("地图底图目前是设计示意，真实地图图层待接入。");
        };
      if (
        tag === "a" &&
        n.attrs["aria-label"] === "袁记云饺，已选中" &&
        !isDemo
      )
        return null;
      if (
        tag === "button" &&
        ["万达金街", "银座商城", "校内食堂", "西门小吃街"].includes(clean(text))
      )
        p.onClick = () => m.openPanel("G-PanelPlace");
    }
    if (screen === "G-PickShop") {
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
          title="菜品全站搜索待接入"
          detail="可以切换到店名，找到店铺后查看它的菜。"
        />
      );
    if (screen === "G-Search" && tag === "span" && id === 24)
      return <span {...p}>—</span>;
    if (screen === "G-Search" && tag === "span" && id === 27)
      return <span {...p}>{shops.data?.totalItems ?? "—"}</span>;
    if (screen === "G-Me") {
      if (tag === "span" && clean(text) === "12 个，用来给菜分类")
        return (
          <span {...p}>{myTags.data?.totalItems ?? "—"} 个，用来给菜分类</span>
        );
      if (tag === "h1") return <h1 {...p}>{user?.userName ?? "同学"}</h1>;
      if (tag === "p" && clean(text) === "只吃好吃的，也只推荐好吃的")
        return <p {...p}>{user?.signature ?? "认真吃饭，认真生活。"}</p>;
      if (tag === "span" && clean(text) === "天")
        return <span {...p}>{user?.userName?.slice(0, 1) ?? "食"}</span>;
      if (id === 9 && user?.avatar)
        return (
          <span {...p} style={{ ...st, overflow: "hidden" }}>
            <img
              src={mediaUrl(user.avatar)}
              alt="我的头像"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </span>
        );
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
        return <span {...p}>{val ?? "—"}</span>;
      }
      if (
        (tag === "button" && [39, 41, 43].includes(id)) ||
        n.attrs.role === "tab"
      ) {
        p.onClick = () => {
          if (id === 43) unavailable("评论");
          else setCategory(id === 41 ? "收藏" : "上传");
        };
        p["aria-selected"] =
          category === (id === 41 ? "收藏" : "上传") ||
          (!category && id === 39);
        p.style = {
          ...st,
          fontWeight: p["aria-selected"] ? 900 : 400,
          color: p["aria-selected"] ? "#231C18" : "#6E625B",
        };
        if (id !== 43)
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
                title="还没有收进来一道菜"
                detail="去发现，或者分享你今天吃到的好味道。"
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
            分类只筛选本页收藏 <Pending name="全量分类待接入" />
          </p>
          {list.map((f) => (
            <FoodTile key={f.id} food={f} visual={visualFor(f, isDemo)} />
          ))}
          {!list.length && <MobileEmpty title="这一页暂时没有这类收藏" />}
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
      p.src = m.draft.images.at(-1)!.url;
      p.alt = "所选照片";
      p.style = {
        ...st,
        left: 45,
        top: 50,
        width: 300,
        height: 300,
        objectFit: "cover",
        transformOrigin: "150px 150px",
      };
    }
    if (screen === "G-Crop" && tag === "input" && p.type === "range") p.min = 1;
    if (screen === "G-Crop" && tag === "span" && clean(text) === "柳州螺蛳粉")
      return <span {...p}>{m.draft.name || "你的这道菜"}</span>;
    if (
      screen === "G-PanelPlace" &&
      n.attrs.role === "radiogroup" &&
      n.attrs["aria-label"] === "校区"
    )
      return (
        <div {...p}>
          {hubs.data?.items?.map((h) => (
            <button
              key={h.id}
              className="mobile-place-chip"
              disabled={!hasCoordinates(h)}
              onClick={() => {
                selectArea({
                  name: h.name ?? "所选区域",
                  gcjLng: h.gcjLng!,
                  gcjLat: h.gcjLat!,
                  hubId: h.id ?? undefined,
                  source: "hub",
                });
                m.closePanel();
              }}
            >
              {h.name}
            </button>
          ))}
          <button className="mobile-place-chip" onClick={locate}>
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
        nav("/favorites");
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
      return <span {...p}>{user?.userName ?? "—"}</span>;
    if (screen === "G-UserProfile") {
      const u = other.data;
      if (tag === "h1") return <h1 {...p}>{u?.userName ?? "同学"}</h1>;
      if (tag === "span" && clean(text) === "哲")
        return <span {...p}>{u?.userName?.slice(0, 1) ?? "食"}</span>;
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
              title="TA 的分享列表待接入"
              detail="可以先关注这位同学。"
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
          unavailable("专题目录");
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
    if (!area)
      return (
        <MobileEmpty
          title="先选一个区域"
          detail="按区域中心，找附近的店。"
          action={
            <PrimaryButton onClick={() => m.openPanel("G-PanelPlace")}>
              选择地点
            </PrimaryButton>
          }
        />
      );
    if (shops.isPending)
      return <div className="mobile-loading">在找附近的店</div>;
    if (shops.error)
      return <div className="mobile-error">{errorMessage(shops.error)}</div>;
    return shops.data.items?.length ? (
      shops.data.items.map((r) => <ShopRow key={r.id} shop={r} />)
    ) : (
      <MobileEmpty title="还没找到这家店" detail="换个名字，或新建一家店。" />
    );
  }
  function locate() {
    if (!navigator.geolocation) {
      m.notice("当前浏览器无法定位，请手选区域。");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          selectArea({
            name: "当前位置",
            ...wgsToGcj(pos.coords.longitude, pos.coords.latitude),
            source: "device",
          });
          m.closePanel();
        } catch (e) {
          m.notice(errorMessage(e));
        }
      },
      () => m.notice("没有获取到位置，可以手动选区域。"),
      { timeout: 10000 },
    );
  }
  async function pickAvatar() {
    const files = await pickFiles(false);
    if (!files.length) return;
    await run(async () => {
      validateFiles(files, 0);
      const key = await app.upload(files[0], "avatar");
      await api.updateProfile({ avatar: key });
      await app.me.refetch();
      controller.setState({ sheet: false });
    });
  }
  function navigateDesign(target: string, label: string, aria?: string) {
    if (target === "G-Follows.dc.html") {
      nav(
        `/follows?tab=${label.includes("粉丝") ? "fans" : "follow"}${screen === "G-UserProfile" ? `&userId=${otherId}` : ""}`,
      );
      return;
    }
    if (
      (screen === "G-PhoneLogin" && target === "G-RegisterConfirm.dc.html") ||
      (screen === "G-RegisterConfirm" && target === "G-Verify.dc.html")
    ) {
      unavailable("手机号验证码注册");
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
    if (screen === "G-EditProfile" && label === "保存") {
      void run(async () => {
        const name = String(controller.state.nick ?? "").trim();
        if (name.length < 3 || name.length > 10)
          throw new Error("昵称需要 3–10 个字。");
        await api.updateProfile({
          userName: name,
          signature: String(controller.state.sign ?? ""),
        });
        await app.me.refetch();
        nav("/me");
      });
      return;
    }
    if (screen === "G-AddDish" && label === "发布") {
      void publish();
      return;
    }
    if (screen === "G-PickShop" && target === "G-AddDish.dc.html") {
      if (!shops.data?.items?.some((r) => r.id === m.shopId)) {
        m.notice("先选一家店。");
        return;
      }
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
      m.notice("政策正文尚待部署方提供。");
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
    if (target === "G-AddDish.dc.html") m.setShopId(shopId);
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
  const denied =
    !publicScreens.has(screen) &&
    (!session ||
      !user ||
      (needsVerification.has(screen) && user.verified !== true) ||
      user.banned);
  let before: ReactNode;
  if (denied)
    before = (
      <div className="mobile-status" role="status">
        <DesignIcon name="verify" size={30} />
        <h2>
          {!session
            ? "先登录，认识同校的你"
            : user?.banned
              ? "账号暂时无法使用"
              : "先完成学生认证"}
        </h2>
        <p>
          {!session
            ? "登录后就能收藏喜欢的菜，也能分享这一餐。"
            : user?.banned
              ? (user.banReason ?? "请联系管理员了解账号状态。")
              : "完成认证后，可以浏览菜品、收藏和发布。"}
        </p>
        <PrimaryButton
          onClick={() =>
            nav(
              !session
                ? `/auth/password?next=${encodeURIComponent(location.pathname)}`
                : user?.banned
                  ? "/me"
                  : "/verify",
            )
          }
        >
          {!session ? "登录" : user?.banned ? "返回我的" : "去认证"}
        </PrimaryButton>
      </div>
    );
  if (!denied && relevant?.isError)
    before = (
      <div className="mobile-status">
        <h2>这一份内容暂时没端上来</h2>
        <p>{errorMessage(relevant.error)}</p>
        <PrimaryButton onClick={() => void relevant.refetch()}>
          再试一次
        </PrimaryButton>
      </div>
    );
  if (!denied && relevant?.isPending)
    before = (
      <div className="mobile-status">
        <p>正在端上这一份好味道</p>
      </div>
    );
  if (!denied && homeScreens.has(screen) && recommendations.data?.length === 0)
    before = (
      <div className="mobile-status">
        <h2>今天的推荐还在等一道菜</h2>
        <p>先去看看附近的店，或者分享你的私藏。</p>
        <PrimaryButton onClick={() => nav("/nearby")}>找一家店</PrimaryButton>
      </div>
    );
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
      {isDemo && ["G-Login", "G-PasswordLogin"].includes(screen) && (
        <div
          className="mobile-mock-login"
          style={{ top: screen === "G-Login" ? 520 : 560 }}
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
      {screen === "G-Nearby" && !isDemo && (
        <span
          style={{
            position: "absolute",
            left: 20,
            top: 426,
            padding: "4px 10px",
            fontSize: 11,
            borderRadius: 14,
            background: "#fff",
            color: "#6e625b",
          }}
        >
          示意地图 <Pending name="地图图层待接入" />
        </span>
      )}
      {screen === "G-EditProfile" && (
        <Link
          style={{
            position: "absolute",
            left: 20,
            bottom: 32,
            fontSize: 14,
            fontWeight: 600,
          }}
          to="/me/details"
        >
          性别、生日和家乡
        </Link>
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
          舞台色保存在本机，云端同步待接入
        </span>
      )}
      {!isDemo && pendingScreens[screen] && (
        <span className="mobile-demo-content-note">
          本页为设计示例，真实功能待接入
        </span>
      )}
      {error && screen !== "G-PasswordLogin" && (
        <div className="mobile-error-banner" role="alert">
          {error}
          {uncertain && <span>结果尚未确认，请先核实，避免重复提交。</span>}
          <button onClick={() => setError("")} aria-label="关闭错误提示">
            <DesignIcon name="close" size={18} />
          </button>
        </div>
      )}
      {denied && <div className="mobile-denied-curtain" />}
      {screen === "G-PhoneLogin" && (
        <div className="mobile-supported-register">
          <Pending />
          <p>手机号验证码注册暂未提供接口</p>
          <button
            className="mobile-inline-link"
            onClick={() => nav("/auth/username-register")}
          >
            使用用户名和密码注册
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
      !!relevant?.isPending ||
      !!relevant?.isError ||
      (screen === "G-Crop" && !m.draft.images.length) ||
      (homeScreens.has(screen) && recommendations.data?.length === 0),
  };
}
const categoryCodes = [
  "staple",
  "snack",
  "drink",
  "dessert",
  "soup",
  "hot_pot",
  "grill",
  "cold_dish",
  "side_dish",
  "other",
];
let sessionProof: string | undefined;
export function setConsentProof(proof: string | undefined) {
  sessionProof = proof;
}
export function getConsentProof() {
  return sessionProof;
}
export function clearConsentProof() {
  sessionProof = undefined;
}
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
async function pickFiles(multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.multiple = multiple;
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
async function shareCurrent(title: string, notice: (s: string) => void) {
  try {
    if (navigator.share) await navigator.share({ title, url: location.href });
    else {
      await navigator.clipboard.writeText(location.href);
      notice("链接已复制，可以分享给同学。");
    }
  } catch {
    /* User can cancel the system share sheet. */
  }
}
