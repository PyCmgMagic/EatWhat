import { endpoints } from "../api/backend-v2-endpoints";
import type { Operation, V2Schema } from "../api/backend-v2";
import type { Envelope, RequestOptions } from "../api/client";
import { reactionSummary } from "./comment-reactions";

import {
  commentReactionOptions,
  type CommentReactionType,
} from "../api/comments";

type Shop = V2Schema["Restaurant"] & { id: number; name: string };
type DemoFood = V2Schema["FoodV2"] & {
  id: number;
  name: string;
  restaurantId: number;
};
type DemoComment = V2Schema["Comment"] & { id: number; foodId: number };
type Person = V2Schema["MyInfo"] & {
  id: number;
  phone: string;
  banned?: boolean;
  password?: string;
};
type Data = {
  shops: Shop[];
  people: Person[];
  policies: V2Schema["ConsentPolicy"][];
  agreed: Record<number, string>;
  hubs: V2Schema["Hub"][];
  history: Record<number, { revision: V2Schema["Revision"]; snapshot: Shop }[]>;
  favorites: Record<number, number[]>;
  ratings: Record<string, string>;
  preferences: Record<number, V2Schema["Preferences"]>;
  dismissed: Record<string, number>;
  follows: Record<number, number[]>;
  blocks: Record<number, number[]>;
  images: Record<string, string>;
  revokedDevices: number[];
  seen: Record<string, number[]>;
  foods: DemoFood[];
  foodLikes: Record<number, number[]>;
  foodFavorites: Record<number, number[]>;
  /** Dish id -> user id -> score (1-5). */
  foodRatings: Record<number, Record<number, number>>;
  comments: DemoComment[];
  commentLikes: Record<number, number[]>;
  commentReactions: Record<number, Record<number, CommentReactionType>>;
  feedback: V2Schema["CaseView"][];
  notifications: V2Schema["NotificationCard"][];
  pushCategories: Record<string, boolean>;
};

const storage = "eatwhat-v2-demo-data";
const campus = {
  id: 1,
  name: "软件园校区",
  gcjLng: 117.134,
  gcjLat: 36.667,
  isDefault: true,
};
const tags = {
  categories: [
    "米饭炒菜",
    "粉面",
    "火锅麻辣烫",
    "烧烤炸串",
    "汤粥",
    "面点快餐",
  ],
  tags: ["辣", "麻", "甜", "酸", "清淡"],
  dislikableTags: ["辣", "麻"],
};
const profiles = [
  {
    id: 1,
    displayName: "小山",
    phone: "13800000001",
    role: "user",
    verified: true,
    hasUsername: true,
    userName: "xiaoshan",
  },
  {
    id: 2,
    displayName: "管理员",
    phone: "13800000002",
    role: "admin",
    verified: true,
    hasUsername: true,
    userName: "admin",
  },
  {
    id: 3,
    displayName: "新食友",
    phone: "13800000003",
    role: "user",
    verified: false,
    hasUsername: false,
  },
];
const tokens: Record<string, number> = {
  "v2-demo-student": 1,
  "v2-demo-admin": 2,
  "v2-demo-user": 3,
};

function seed(): Data {
  const shops: Shop[] = [
    {
      id: 1,
      name: "一口面馆",
      address: "舜华路 188 号",
      pictureUrl: "/assets/noodles.jpg",
      categories: ["粉面"],
      tags: ["辣"],
    },
    {
      id: 2,
      name: "山边小饭桌",
      address: "齐鲁软件园北门",
      pictureUrl: "/assets/rice.jpg",
      categories: ["米饭炒菜"],
      tags: ["清淡"],
    },
    {
      id: 3,
      name: "街角饺子铺",
      address: "舜华路 216 号",
      pictureUrl: "/assets/dumplings.jpg",
      categories: ["面点快餐"],
    },
    {
      id: 4,
      name: "南门砂锅",
      address: "山大软件园南门",
      categories: ["火锅麻辣烫"],
      tags: ["麻"],
    },
    {
      id: 5,
      name: "转角咖啡",
      address: "银荷大厦一层",
      pictureUrl: "/assets/coffee.jpg",
      categories: [],
      kind: "drink",
    },
  ].map((item, index) => ({
    gcjLng: campus.gcjLng + index * 0.001,
    gcjLat: campus.gcjLat + index * 0.0007,
    hubId: 1,
    hubName: "软件园商圈",
    deliveryEnabled: index !== 2,
    kind: "food",
    mealTimes: ["breakfast", "lunch", "dinner", "night"],
    priceBand: "FROM_15_TO_30",
    dineIn: { rate: 0.9, count: 8 },
    delivery: { rate: 0.8, count: 5 },
    ...item,
  }));
  const foods: DemoFood[] = [
    {
      id: 1,
      restaurantId: 1,
      restaurantName: "一口面馆",
      accountId: 1,
      name: "招牌牛肉面",
      category: "主食",
      price: 22,
      description: "现切牛肉，清汤或微辣。",
      pictureUrls: ["/assets/noodles.jpg"],
      tags: ["辣"],
      signature: true,
      likeCount: 12,
      favoriteCount: 5,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now(),
    },
    {
      id: 2,
      restaurantId: 2,
      restaurantName: "山边小饭桌",
      accountId: 1,
      name: "番茄炒蛋盖饭",
      category: "主食",
      price: 16,
      pictureUrls: ["/assets/rice.jpg"],
      tags: ["酸"],
      signature: true,
      likeCount: 8,
      favoriteCount: 3,
      createdAt: Date.now() - 172800000,
      updatedAt: Date.now(),
    },
    {
      id: 3,
      restaurantId: 3,
      restaurantName: "街角饺子铺",
      accountId: 2,
      name: "三鲜水饺",
      category: "主食",
      price: 18,
      pictureUrls: ["/assets/dumplings.jpg"],
      tags: ["清淡"],
      signature: true,
      likeCount: 6,
      favoriteCount: 2,
      createdAt: Date.now() - 259200000,
      updatedAt: Date.now(),
    },
  ];
  // Delivery is set per dish; the seed dishes take over their shop's old flag.
  for (const food of foods)
    food.deliveryEnabled = !!shops.find((shop) => shop.id === food.restaurantId)
      ?.deliveryEnabled;
  return {
    shops,
    people: profiles.map((person) => ({
      ...person,
      hasPassword: true,
      password: "123456",
      fansVisible: true,
      followingsVisible: true,
    })),
    policies: [
      {
        id: 1,
        version: "demo-1",
        privacyText: "演示模式的账号与操作保存在当前浏览器。",
        crossBorderText: "演示模式使用本地样例。",
        publishedAt: Date.now(),
      },
    ],
    agreed: { 1: "demo-1", 2: "demo-1", 3: "demo-1" },
    hubs: [
      {
        id: 1,
        name: "软件园商圈",
        gcjLng: campus.gcjLng,
        gcjLat: campus.gcjLat,
      },
    ],
    history: Object.fromEntries(
      shops.map((shop) => [
        shop.id,
        [
          {
            revision: {
              id: 1,
              action: "create",
              createdAt: Date.now(),
              editor: { displayName: "小山" },
              changes: [{ field: "name", to: shop.name }],
            },
            snapshot: shop,
          },
        ],
      ]),
    ),
    favorites: { 1: [2] },
    ratings: {},
    preferences: {},
    dismissed: {},
    follows: { 1: [2], 2: [1] },
    blocks: {},
    images: {},
    revokedDevices: [],
    seen: {},
    foods,
    foodLikes: { 1: [1] },
    foodFavorites: { 1: [2] },
    foodRatings: {},
    comments: [
      {
        id: 1,
        foodId: 1,
        rootId: null,
        author: { id: 2, displayName: "管理员", title: "老吃家" },
        replyTo: null,
        text: "汤底很稳，晚饭也不会腻。",
        pictureUrls: ["/assets/noodles.jpg"],
        likeCount: 1,
        replyCount: 0,
        createdAt: Date.now() - 3600000,
      },
    ],
    commentLikes: {},
    commentReactions: {},
    feedback: [],
    notifications: [
      {
        id: 1,
        column: "SYSTEM",
        kind: "announcement",
        target: { domain: "announcements", id: 1 },
        day: new Date().toISOString().slice(0, 10),
        memberCount: 1,
        unreadMemberCount: 1,
        latestAt: Date.now(),
        actors: [],
        data: { title: "欢迎使用 v2 演示" },
      },
    ],
    pushCategories: {
      COMMENTS: true,
      LIKES_AND_FAVORITES: true,
      FOLLOWS: true,
      SYSTEM: true,
    },
  };
}

let memory = seed();
let memoryOnly = false;
function load(): Data {
  if (memoryOnly) return memory;
  try {
    const raw = localStorage.getItem(storage);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Data>;
      const fresh = seed();
      return {
        ...fresh,
        ...saved,
        foods: saved.foods ?? fresh.foods,
        foodLikes: saved.foodLikes ?? fresh.foodLikes,
        foodFavorites: saved.foodFavorites ?? fresh.foodFavorites,
        foodRatings: saved.foodRatings ?? fresh.foodRatings,
        comments: saved.comments ?? fresh.comments,
        commentLikes: saved.commentLikes ?? fresh.commentLikes,
        feedback: saved.feedback ?? fresh.feedback,
        notifications: saved.notifications ?? fresh.notifications,
        pushCategories: saved.pushCategories ?? fresh.pushCategories,
      };
    }
  } catch {
    /* Use the in-memory demo. */
  }
  return memory;
}
function save(state: Data) {
  memory = state;
  if (memoryOnly) return;
  try {
    localStorage.setItem(storage, JSON.stringify(state));
  } catch {
    memoryOnly = true;
  }
}

export async function storeDemoImage(
  file: File,
  biz: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
      file.type,
    ) ||
    !file.size ||
    file.size > (biz === "avatar" ? 5 : 10) * 1024 * 1024
  )
    throw new Error("图片类型或大小无效。");
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("无法读取图片。"));
    reader.readAsDataURL(file);
  });
  signal?.throwIfAborted();
  const state = load();
  const key = biz + "/demo-" + crypto.randomUUID();
  state.images[key] = base64;
  save(state);
  return key;
}

const demoToggles = { telemetry: true, personalized: true };
const routes = Object.entries(endpoints).map(([name, rule]) => ({
  name: name as Operation,
  rule,
  pattern: new RegExp(
    "^" + rule.path.replace(/\{(\w+)\}/g, "(?<$1>[^/]+)") + "$",
  ),
}));

export function demoTransport(
  path: string,
  options: RequestOptions,
  token?: string,
): Envelope<unknown> {
  options.signal?.throwIfAborted();
  const found = routes.find(
    (route) =>
      route.rule.method === (options.method ?? "GET") &&
      route.pattern.test(path),
  );
  if (!found) return { code: 10004, msg: "此接口未开放。" };
  const { name, rule } = found;
  const params = found.pattern.exec(path)?.groups;
  const state = load();
  const uid = !options.public && token ? tokens[token] : undefined;
  const person = state.people.find((person) => person.id === uid);
  const current = state.policies[0];
  const fail = (code: number, msg: string) => ({ code, msg, data: null });
  const ok = (data: unknown = null) => ({ code: 0, data, msg: "ok" });
  if (rule.access !== "public" && !person) return fail(20001, "请先登录。");
  if (person?.banned) return fail(30002, "该账号已封禁。");
  if (
    person &&
    !("consentExempt" in rule) &&
    state.agreed[person.id] !== current?.version
  )
    return fail(20009, "请同意当前政策。");
  if (
    (rule.access === "admin" && person?.role !== "admin") ||
    (rule.access === "verified" && !person?.verified) ||
    (rule.access === "verifiedOrAdmin" &&
      !person?.verified &&
      person?.role !== "admin")
  )
    return fail(20004, "权限不足。");

  const q = options.query ?? {};
  // Payloads come from the typed API client. The mock still checks the fields
  // that affect user-visible flows, including OTPs and policy versions.
  const body = (options.body ?? {}) as Record<string, string> &
    V2Schema["RestaurantEditRequest"];
  const payload = (options.body ?? {}) as Record<string, unknown>;
  const text = (key: string) => String(payload[key] ?? "").trim();
  const list = (key: string) =>
    Array.isArray(payload[key]) ? (payload[key] as unknown[]).map(String) : [];
  const userId = Number(params?.userId ?? q.userId);
  const id = Number(params?.id);
  const foodId = Number(params?.foodId ?? id);
  const commentId = Number(params?.commentId ?? id);
  const shop = state.shops.find((shop) => shop.id === id);
  const target = state.people.find((person) => person.id === userId);
  const hasFavorite = (id: number) =>
    uid ? (state.favorites[uid] ?? []).includes(id) : null;
  const scoresOf = (foodId: number) =>
    Object.values(state.foodRatings[foodId] ?? {});
  /** Average to one decimal; null while nobody has rated the dish. */
  const foodRating = (foodId: number) => {
    const scores = scoresOf(foodId);
    return {
      score: scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) * 10) / scores.length) /
          10
        : null,
      count: scores.length,
    };
  };
  /** Bayesian average used for ordering: five votes of the site-wide mean. */
  const smoothed = (foodId: number) => {
    const all = Object.values(state.foodRatings).flatMap((byUser) =>
      Object.values(byUser),
    );
    const prior = all.length
      ? all.reduce((a, b) => a + b, 0) / all.length
      : 3.5;
    const scores = scoresOf(foodId);
    return (
      (scores.reduce((a, b) => a + b, 0) + 5 * prior) / (scores.length + 5)
    );
  };
  const viewerRating = (id: number) =>
    uid
      ? {
          dineIn: state.ratings[uid + ":" + id + ":dine_in"] ?? null,
          delivery: state.ratings[uid + ":" + id + ":delivery"] ?? null,
        }
      : null;
  const withViewer = (shop: Shop) => {
    const gcjLng = Number(q.gcjLng),
      gcjLat = Number(q.gcjLat);
    const distanceMeters =
      Number.isFinite(gcjLng) && Number.isFinite(gcjLat)
        ? Math.hypot(
            (shop.gcjLng! - gcjLng) * 89000,
            (shop.gcjLat! - gcjLat) * 111000,
          )
        : null;
    return {
      ...shop,
      isFavorite: hasFavorite(shop.id),
      myRatings: viewerRating(shop.id),
      distanceMeters,
      // Read-only summary: the shop delivers when one of its dishes does.
      deliveryEnabled: state.foods.some(
        (food) => food.restaurantId === shop.id && food.deliveryEnabled,
      ),
      // Featured dishes: best smoothed score first, signature dishes win ties,
      // then likes (the backend's rule for recommendation cards).
      signatureFoods: state.foods
        .filter((food) => food.restaurantId === shop.id)
        .sort(
          (a, b) =>
            smoothed(b.id) - smoothed(a.id) ||
            Number(b.signature ?? false) - Number(a.signature ?? false) ||
            (b.likeCount ?? 0) - (a.likeCount ?? 0),
        )
        .slice(0, 3)
        .map((food) => ({
          id: food.id,
          name: food.name,
          price: food.price,
          pictureUrl: food.pictureUrls?.[0] ?? null,
          stageColor: food.stageColor ?? null,
          coverCrop: food.coverCrop ?? null,
          signature: food.signature ?? false,
          rating: foodRating(food.id),
        })),
    };
  };
  const page = Math.max(1, Number(q.page) || 1);
  const size = Math.max(1, Number(q.pageSize) || 20);
  function paged<T>(items: T[]) {
    return {
      currentPage: page,
      items: items.slice((page - 1) * size, page * size),
      totalItems: items.length,
      totalPages: Math.ceil(items.length / size),
      hasNext: page * size < items.length,
    };
  }
  const keyword = String(q.keyword ?? "").toLowerCase();
  const matches = (value?: string) =>
    !keyword || !!value?.toLowerCase().includes(keyword);
  const write = (data?: unknown) => {
    save(state);
    return ok(data);
  };
  const user = person?.id ?? 0;
  const status = () => ({
    currentVersion: current?.version ?? null,
    agreedVersion: state.agreed[user] ?? null,
    required: state.agreed[user] !== current?.version,
  });
  // Search also finds shops by one of their dishes (v2 matchedFood).
  const dishMatch = (shop: Shop) =>
    keyword && !matches(shop.name) && !matches(shop.address)
      ? state.foods.find(
          (food) => food.restaurantId === shop.id && matches(food.name),
        )
      : undefined;
  const duplicatesOf = (shopName: unknown, lng: unknown, lat: unknown) => {
    const wanted = String(shopName ?? "")
      .trim()
      .toLowerCase();
    return state.shops
      .map((shop) => {
        const meters =
          lng != null &&
          lat != null &&
          shop.gcjLng != null &&
          shop.gcjLat != null
            ? Math.hypot(
                (Number(lng) - shop.gcjLng) *
                  111320 *
                  Math.cos((Number(lat) * Math.PI) / 180),
                (Number(lat) - shop.gcjLat) * 110540,
              )
            : 0;
        return { shop, meters };
      })
      .filter(
        ({ shop, meters }) =>
          !!wanted &&
          shop.name.trim().toLowerCase() === wanted &&
          meters <= 300,
      )
      .map(({ shop, meters }) => ({
        id: shop.id,
        name: shop.name,
        address: shop.address,
        distanceMeters: Math.round(meters),
        permanentlyClosed: !!shop.permanentlyClosed,
        reason: "name",
      }));
  };
  const candidateList = () => {
    let list = state.shops
      .map((shop) => {
        const dish = dishMatch(shop);
        return {
          ...withViewer(shop),
          ...(dish
            ? {
                matchedFood: {
                  id: dish.id,
                  name: dish.name,
                  price: dish.price ?? null,
                },
              }
            : {}),
        };
      })
      .filter(
        (shop) =>
          (!q.keyword ||
            matches(shop.name) ||
            matches(shop.address) ||
            !!shop.matchedFood) &&
          (!q.hubId || shop.hubId === Number(q.hubId)) &&
          (!q.kind || shop.kind === q.kind) &&
          (!q.priceBand || shop.priceBand === q.priceBand) &&
          (!Array.isArray(q.categories) ||
            !q.categories.length ||
            shop.categories?.some((tag) =>
              (q.categories as string[]).includes(tag),
            )) &&
          (!Array.isArray(q.tags) ||
            !q.tags.length ||
            shop.tags?.some((tag) => (q.tags as string[]).includes(tag))) &&
          (!(q.delivery || q.scene === "delivery") ||
            shop.deliveryEnabled ||
            !!shop.delivery?.count) &&
          (!q.recommendedOnly ||
            [shop.dineIn, shop.delivery].some(
              (stat) => (stat?.count ?? 0) >= 3 && (stat?.rate ?? 0) >= 0.7,
            )) &&
          (!q.radius ||
            (shop.distanceMeters != null &&
              shop.distanceMeters <= Number(q.radius))),
      );
    if (name === "favorites" || q.favoritesOnly)
      list = list.filter((shop) => shop.isFavorite);
    if (
      q.sort === "DISTANCE" ||
      (!q.sort && name !== "favorites" && q.gcjLng != null)
    )
      list.sort(
        (a, b) =>
          (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
      );
    else if (name === "favorites" && q.sort !== "NEWEST")
      list.sort(
        (a, b) =>
          (state.favorites[user] ?? []).indexOf(b.id) -
          (state.favorites[user] ?? []).indexOf(a.id),
      );
    else if (name !== "recommend" && name !== "pick") list.reverse();
    return list;
  };
  const idList = (source: Record<number, number[]>) => (source[user] ??= []);
  const relationTo = (id: number) => ({
    isFollowingMe: state.follows[id]?.includes(user) ?? false,
    isFollowingHim: state.follows[user]?.includes(id) ?? false,
  });
  const withFoodViewer = (food: DemoFood) => ({
    ...food,
    isLiked: uid ? idList(state.foodLikes).includes(food.id) : null,
    isFavorite: uid ? idList(state.foodFavorites).includes(food.id) : null,
    mealTimes: food.mealTimes ?? [],
    effectiveMealTimes: food.mealTimes?.length
      ? food.mealTimes
      : (state.shops.find((shop) => shop.id === food.restaurantId)?.mealTimes ??
        []),
    deliveryEnabled: food.deliveryEnabled ?? false,
    rating: foodRating(food.id),
    myRating: uid ? (state.foodRatings[food.id]?.[user] ?? null) : null,
  });
  const withCommentViewer = (comment: DemoComment) => ({
    ...comment,
    isLiked: uid ? idList(state.commentLikes).includes(comment.id) : null,
    reactions: reactionSummary(state.commentReactions[comment.id], uid),
  });
  const updateShop = (updated: Shop, action: string, restoredFrom?: number) => {
    const revisions = (state.history[updated.id] ??= []);
    const revisionId = (revisions[0]?.revision.id ?? 0) + 1;
    const previous = state.shops.find((item) => item.id === updated.id);
    revisions.unshift({
      revision: {
        id: revisionId,
        action,
        restoredFrom,
        editor: { displayName: person?.displayName },
        createdAt: Date.now(),
        changes: Object.entries(updated)
          .filter(
            ([key, value]) =>
              JSON.stringify(value) !==
              JSON.stringify(previous?.[key as keyof Shop]),
          )
          .map(([field, to]) => ({
            field,
            from: previous?.[field as keyof Shop],
            to,
          })),
      },
      snapshot: updated,
    });
    state.shops = [
      ...state.shops.filter((item) => item.id !== updated.id),
      updated,
    ].sort((a, b) => a.id - b.id);
    return { id: updated.id, revisionId };
  };

  switch (name) {
    case "captchaConfig":
      return ok({ enabled: false });
    case "currentPolicy":
      return ok({
        version: current?.version,
        privacyText: current?.privacyText,
        crossBorderText: current?.crossBorderText,
        publishedAt: current?.publishedAt,
      });
    case "consentStatus":
      return ok(status());
    case "grant":
      if (body.policyVersion !== current?.version)
        return fail(20009, "政策版本已更新。");
      state.agreed[user] = body.policyVersion;
      return write(status());
    case "logout":
    case "phoneCode":
    case "passwordCode":
    case "userCode":
    case "changeOldCode":
    case "sendEmail":
      return ok();
    case "phoneLogin":
    case "login":
    case "register": {
      if (
        (name !== "login" || body.policyVersion) &&
        current?.version !== body.policyVersion
      )
        return fail(body.policyVersion ? 20009 : 20005, "请同意当前政策。");
      if (name === "phoneLogin" && body.code !== "123456")
        return fail(30005, "验证码不正确。");
      const candidate = state.people.find((person) =>
        name === "phoneLogin"
          ? person.phone === body.mobile
          : person.phone === body.userName || person.userName === body.userName,
      );
      if (
        name === "login" &&
        (!candidate || candidate.password !== body.password)
      )
        return fail(30004, "账号或密码错误。");
      if (candidate?.banned) return fail(30002, "该账号已封禁。");
      const loginId = candidate?.id ?? 3;
      if (body.policyVersion) state.agreed[loginId] = body.policyVersion;
      return write({
        tokenName: "satoken",
        tokenValue: Object.keys(tokens).find((key) => tokens[key] === loginId),
      });
    }
    case "checkUsername":
      return state.people.some((person) => person.userName === body.userName)
        ? fail(30003, "登录名已占用。")
        : ok();
    case "me": {
      const { password: _password, banned: _banned, ...data } = person!;
      return ok(data);
    }
    case "verify":
      return ok({
        verified: person?.verified,
        phoneBound: !!person?.phone,
        usernameSet: person?.hasUsername,
        passwordSet: person?.hasPassword,
      });
    case "sdu":
    case "startSso":
      return ok({ url: "/#/verify", expiresIn: 600 });
    case "sduConfirm":
    case "verifyEmail":
      if (
        (name === "sduConfirm" && body.ticket !== "demo-ticket") ||
        (name === "verifyEmail" && body.token !== "demo-mail-token")
      )
        return fail(30012, "认证票据无效。");
      person!.verified = true;
      return write();
    case "postUserMobileChangeVerifyOld":
      if (!body.phoneVerificationToken && body.code !== "123456")
        return fail(30005, "旧手机号验证码不正确。");
      return ok();
    case "changeNewCode":
      if (
        body.oldCode &&
        body.oldCode !== "123456" &&
        !body.oldPhoneVerificationToken
      )
        return fail(30005, "旧手机号验证码不正确。");
      return ok();
    case "bindMobile":
    case "changeCommit":
      if (!body.phoneVerificationToken && body.code !== "123456")
        return fail(30005, "验证码不正确。");
      person!.phone = body.mobile;
      return write();
    case "changePassword":
    case "passwordReset":
    case "usernameSet":
      if (
        name !== "changePassword" &&
        !body.phoneVerificationToken &&
        body.code !== "123456"
      )
        return fail(30005, "验证码不正确。");
      if (name === "changePassword" && body.oldPassword !== person?.password)
        return fail(30004, "旧密码错误。");
      if (body.newPassword) {
        person!.hasPassword = true;
        person!.password = body.newPassword;
      }
      if (name === "usernameSet") {
        person!.userName = body.userName;
        person!.hasUsername = true;
      }
      return write();
    case "sessions":
      return ok({
        devices: [
          {
            sessionId: "demo-current",
            current: true,
            device: "WEB",
            name: "Chrome · macOS",
            issuedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
          },
          ...(!state.revokedDevices.includes(user)
            ? [
                {
                  sessionId: "demo-other",
                  current: false,
                  device: "IOS",
                  name: null,
                  lastActiveAt: new Date(Date.now() - 864e5).toISOString(),
                },
              ]
            : []),
        ],
        nextCursor: null,
      });
    case "revoke":
    case "revokeOthers":
      state.revokedDevices.push(user);
      return write();
    case "updateInfo":
      Object.assign(person!, {
        ...body,
        avatar: state.images[body.avatar] ?? person?.avatar,
      });
      return write();
    case "changePrivacy":
      person!.fansVisible = Boolean(body.follower);
      person!.followingsVisible = Boolean(body.following);
      return write();
    case "userInfo":
      return target
        ? ok({
            id: target.id,
            displayName: target.displayName,
            avatar: target.avatar,
            signature: target.signature,
            fansCount: user === userId || target.fansVisible
              ? Object.values(state.follows).filter((ids) =>
                  ids.includes(userId),
                ).length
              : null,
            followingsCount: user === userId || target.followingsVisible
              ? (state.follows[userId]?.length ?? 0)
              : null,
            followingsVisible: target.followingsVisible,
            fansVisible: target.fansVisible,
            ...relationTo(userId),
            blocked: idList(state.blocks).includes(userId),
          })
        : fail(30001, "用户不存在。");
    case "follow":
    case "unfollow":
      if (
        name === "follow" &&
        (!target || user === userId || state.blocks[user]?.includes(userId) || state.blocks[userId]?.includes(user))
      )
        return fail(40002, "无法关注这位食友。");
      state.follows[user] = idList(state.follows).filter((id) => id !== userId);
      if (name === "follow") state.follows[user].push(userId);
      return write();
    case "block":
    case "unblock":
      state.blocks[user] = idList(state.blocks).filter((id) => id !== userId);
      if (name === "block") {
        state.blocks[user].push(userId);
        state.follows[user] = idList(state.follows).filter(id => id !== userId);
        state.follows[userId] = (state.follows[userId] ?? []).filter(id => id !== user);
      }
      return write();
    case "blockStatus":
      return ok({ blocked: idList(state.blocks).includes(userId) });
    case "followers":
    case "followings":
    case "blocks": {
      const subject = userId || user;
      if (
        subject !== user &&
        ((name === "followers" && !target?.fansVisible) ||
          (name === "followings" && !target?.followingsVisible))
      ) return fail(20004, "对方没有公开这个列表");
      const ids =
        name === "blocks"
          ? idList(state.blocks)
          : name === "followings"
            ? (state.follows[subject] ?? [])
            : Object.keys(state.follows)
                .map(Number)
                .filter((id) => state.follows[id].includes(subject));
      return ok(
        paged(
          state.people
            .filter((person) => ids.includes(person.id))
            .map((person) => ({
              id: person.id,
              userId: person.id,
              displayName: person.displayName,
              ...(name !== "blocks" && {
                avatar: person.avatar,
                ...relationTo(person.id),
              }),
            })),
        ),
      );
    }
    case "preferences":
      return ok(state.preferences[user] ?? {});
    case "savePreferences":
      state.preferences[user] = body;
      return write(body);
    case "clearPreferences":
      delete state.preferences[user];
      return write();
    case "campuses":
      return ok([campus]);
    case "hubs":
      return ok(paged(state.hubs.filter((hub) => matches(hub.name))));
    case "hub":
      return ok(state.hubs.find((hub) => hub.id === id) ?? null);
    case "locate":
      return ok(state.hubs[0] ?? null);
    case "editHub":
    case "addHub": {
      const hubId =
        id || Math.max(0, ...state.hubs.map((hub) => hub.id ?? 0)) + 1;
      state.hubs = [
        ...state.hubs.filter((hub) => hub.id !== hubId),
        {
          id: hubId,
          name: body.name,
          gcjLng: body.gcjLng,
          gcjLat: body.gcjLat,
          boundary: body.boundaryGeoJson
            ? JSON.parse(body.boundaryGeoJson)
            : null,
        },
      ];
      return write(name === "addHub" ? { id: hubId } : null);
    }
    case "deleteHub":
      state.hubs = state.hubs.filter((hub) => hub.id !== id);
      return write();
    case "tags":
      return ok(tags);
    case "search":
    case "browse":
    case "favorites":
    case "restaurants":
      return ok(paged(candidateList()));
    case "recommend":
    case "pick": {
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Shanghai",
          hour: "2-digit",
          hourCycle: "h23",
        }).format(new Date()),
      );
      const mealTime =
        q.mealTime ??
        (hour >= 5 && hour < 10
          ? "breakfast"
          : hour >= 10 && hour < 15
            ? "lunch"
            : hour >= 15 && hour < 21
              ? "dinner"
              : "night");
      const seenKey =
        user +
        ":" +
        new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
      const pool = candidateList().filter(
        (shop) =>
          !shop.permanentlyClosed &&
          shop.kind === (q.kind ?? "food") &&
          (!["breakfast", "night"].includes(String(mealTime)) ||
            shop.mealTimes?.includes(String(mealTime))) &&
          !(state.dismissed[user + ":" + shop.id] > Date.now()) &&
          !shop.tags?.some((tag) =>
            state.preferences[user]?.dislikedTags?.includes(tag),
          ),
      );
      let seen = state.seen[seenKey] ?? [];
      let eligible = uid
        ? pool.filter((shop) => !seen.includes(shop.id))
        : pool;
      if (!eligible.length) {
        eligible = pool;
        seen = [];
      }
      const chosen =
        name === "pick"
          ? eligible.slice(0, 5)[
              Math.floor(Math.random() * Math.min(5, eligible.length))
            ]
          : undefined;
      const items = uid ? eligible.slice(0, size) : paged(eligible).items;
      if (uid) {
        state.seen[seenKey] = [
          ...seen,
          ...(name === "pick"
            ? chosen
              ? [chosen.id]
              : []
            : items.map((shop) => shop.id)),
        ];
        save(state);
      }
      return ok(
        name === "pick"
          ? { mealTime, restaurant: chosen ?? null }
          : {
              ...paged(eligible),
              items,
              mealTime,
              hasNext: uid
                ? eligible.length > items.length
                : page * size < eligible.length,
            },
      );
    }
    case "dismiss":
      state.dismissed[user + ":" + id] = Date.now() + 30 * 86400000;
      return write();
    case "restaurant":
      return shop ? ok(withViewer(shop)) : fail(40009, "店铺不存在。");
    case "favorite":
    case "unfavorite":
      state.favorites[user] = idList(state.favorites).filter(
        (item) => item !== id,
      );
      if (name === "favorite") state.favorites[user].push(id);
      return write();
    case "rate":
    case "unrate": {
      const key = user + ":" + id + ":" + (body.scene ?? q.scene);
      if (name === "rate") state.ratings[key] = body.rating;
      else delete state.ratings[key];
      return write(viewerRating(id));
    }
    case "getRestaurantDuplicates":
      return ok(duplicatesOf(q.name, q.gcjLng, q.gcjLat));
    case "editRestaurant":
    case "addRestaurant": {
      if (name === "addRestaurant" && !body.force) {
        const duplicates = duplicatesOf(body.name, body.gcjLng, body.gcjLat);
        if (duplicates.length)
          return {
            code: 40017,
            msg: "这家店可能已经有了",
            data: { duplicates },
          };
      }
      const shopId =
        shop?.id ?? Math.max(0, ...state.shops.map((item) => item.id)) + 1;
      const updated = {
        ...shop,
        ...body,
        id: shopId,
        name: body.name || shop?.name || "店铺",
        pictureUrl:
          body.picture === ""
            ? null
            : body.picture
              ? state.images[body.picture]
              : shop?.pictureUrl,
        hubId: state.hubs[0]?.id,
        hubName: state.hubs[0]?.name,
      };
      const revision = updateShop(updated, shop ? "edit" : "create");
      // RestaurantDtos.Created only returns id; revisionId belongs to Edited.
      return write(name === "addRestaurant" ? { id: updated.id } : revision);
    }
    case "history":
      return ok(paged((state.history[id] ?? []).map((item) => item.revision)));
    case "restore": {
      const revisionId = Number(params?.revisionId);
      const revision = state.history[id]?.find(
        (item) => item.revision.id === revisionId,
      );
      return revision
        ? write(updateShop(revision.snapshot, "restore", revisionId))
        : fail(10001, "历史记录不存在。");
    }
    case "deleteRestaurant":
      state.shops = state.shops.filter((shop) => shop.id !== id);
      delete state.history[id];
      return write();
    case "summary": {
      const verified = state.people.filter((person) => person.verified).length;
      return ok({
        totalUsers: state.people.length,
        todayUsers: 1,
        verifiedUsers: verified,
        verifiedRate: verified / state.people.length,
      });
    }
    case "users":
      return ok(
        paged(
          state.people
            .filter(
              (person) =>
                (!q.keyword ||
                  matches(person.displayName) ||
                  matches(person.userName) ||
                  matches(person.phone) ||
                  matches(person.studentId)) &&
                (!q.role || person.role === q.role) &&
                (q.verified === undefined ||
                  Boolean(person.verified) ===
                    (q.verified === true || q.verified === "true")) &&
                (q.banned === undefined ||
                  Boolean(person.banned) ===
                    (q.banned === true || q.banned === "true")),
            )
            .map(({ password: _password, ...person }) => person),
        ),
      );
    case "ban":
    case "unban":
    case "adminResetPassword":
      if (!target || target.role === "admin")
        return fail(20004, "不能操作该账号。");
      if (name === "adminResetPassword") {
        target.hasPassword = true;
        target.password = body.password;
      } else target.banned = name === "ban";
      return write();
    case "policies":
      return ok(
        paged(
          state.policies.map((policy) => ({
            ...policy,
            privacyText: null,
            crossBorderText: null,
          })),
        ),
      );
    case "policyDetail":
      return ok(state.policies.find((policy) => policy.id === id));
    case "publishPolicy":
      if (state.policies.some((policy) => policy.version === body.version))
        return fail(40004, "版本号已使用。");
      state.policies.unshift({
        id: (current?.id ?? 0) + 1,
        version: body.version,
        privacyText: body.privacyText,
        crossBorderText: body.crossBorderText,
        publishedBy: user,
        publishedAt: Date.now(),
      });
      return write(state.policies[0]);
    case "getFoodsOptions":
      return ok({
        categories: ["主食", "菜", "小吃", "汤", "饮品甜品", "特色"],
        tags: tags.tags,
        maxPictures: 6,
        maxTags: 3,
        maxSignatures: 3,
      });
    case "getFoodsList": {
      let foods = state.foods.filter(
        (food) =>
          (!q.restaurantId || food.restaurantId === Number(q.restaurantId)) &&
          (!q.keyword || matches(food.name)) &&
          (!q.category || food.category === q.category) &&
          (!q.signatureOnly || food.signature),
      );
      if (q.sort === "POPULAR")
        foods = foods.sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0));
      return ok(paged(foods.map(withFoodViewer)));
    }
    case "getFoodDuplicates": {
      const key = (value: unknown) =>
        String(value ?? "")
          .replace(/\s+/g, "")
          .toLowerCase();
      const wanted = key(q.keyword);
      if (!wanted) return fail(10001, "菜名应为 1–30 个字符");
      return ok(
        state.foods
          .filter(
            (food) =>
              food.restaurantId === Number(q.restaurantId) &&
              key(food.name).includes(wanted),
          )
          .sort(
            (a, b) =>
              Number(key(b.name) === wanted) - Number(key(a.name) === wanted) ||
              key(a.name).length - key(b.name).length ||
              a.id - b.id,
          )
          .slice(0, 5)
          .map((food) => ({
            id: food.id,
            name: food.name,
            category: food.category,
            price: food.price ?? null,
            pictureUrl: food.pictureUrls?.[0] ?? null,
            sameName: key(food.name) === wanted,
          })),
      );
    }
    case "getFoodsMy":
      return ok(
        paged(
          state.foods
            .filter((food) => food.accountId === user)
            .map(withFoodViewer),
        ),
      );
    case "getFoodsByUserByUserId":
      return ok(
        paged(
          state.foods
            .filter((food) => food.accountId === userId)
            .map(withFoodViewer),
        ),
      );
    case "getFoodsFavorites":
      return ok(
        paged(
          state.foods
            .filter((food) => idList(state.foodFavorites).includes(food.id))
            .map(withFoodViewer),
        ),
      );
    case "getFoodsLikes":
      return ok(
        paged(
          [...idList(state.foodLikes)]
            .reverse()
            .map((fid) => state.foods.find((item) => item.id === fid))
            .filter((item): item is DemoFood => !!item)
            .map(withFoodViewer),
        ),
      );
    case "getFoodsDetailById": {
      const food = state.foods.find((item) => item.id === id);
      return food ? ok(withFoodViewer(food)) : fail(40015, "菜品不存在。");
    }
    case "postFoodsUpload":
    case "putFoodsEditById": {
      const dishMeals = ["breakfast", "lunch", "dinner", "night"];
      const previous = state.foods.find((item) => item.id === id);
      const nextId =
        previous?.id ?? Math.max(0, ...state.foods.map((item) => item.id)) + 1;
      const pictureKeys = list("pictures");
      const next: DemoFood = {
        id: nextId,
        restaurantId: Number(payload.restaurantId ?? previous?.restaurantId),
        restaurantName:
          state.shops.find(
            (item) =>
              item.id ===
              Number(payload.restaurantId ?? previous?.restaurantId),
          )?.name ??
          previous?.restaurantName ??
          "店铺",
        accountId: previous?.accountId ?? user,
        name: text("name") || previous?.name || "菜品",
        category: text("category") || previous?.category || "特色",
        price:
          // The bridge sends null for "not changed", like an omitted field.
          payload.price == null || payload.price === ""
            ? previous?.price
            : Number(payload.price),
        description:
          payload.description === undefined
            ? previous?.description
            : text("description"),
        pictureUrls: pictureKeys.length
          ? pictureKeys.map((key) => state.images[key] ?? key)
          : (previous?.pictureUrls ?? []),
        tags:
          payload.tags === undefined ? (previous?.tags ?? []) : list("tags"),
        signature:
          payload.signature === undefined
            ? (previous?.signature ?? false)
            : Boolean(payload.signature),
        // Omitted: a new dish follows its shop and does not deliver.
        mealTimes:
          payload.mealTimes === undefined
            ? (previous?.mealTimes ?? [])
            : dishMeals.filter((meal) => list("mealTimes").includes(meal)),
        deliveryEnabled:
          payload.deliveryEnabled === undefined
            ? (previous?.deliveryEnabled ?? false)
            : Boolean(payload.deliveryEnabled),
        likeCount: previous?.likeCount ?? 0,
        favoriteCount: previous?.favoriteCount ?? 0,
        createdAt: previous?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      if (list("mealTimes").some((meal) => !dishMeals.includes(meal)))
        return fail(10001, "mealTimes 取值无效");
      state.foods = [
        ...state.foods.filter((item) => item.id !== nextId),
        next,
      ].sort((a, b) => a.id - b.id);
      return write({
        id: nextId,
        revisionId: previous ? Date.now() : undefined,
      });
    }
    case "deleteFoodsDeleteById":
      state.foods = state.foods.filter((food) => food.id !== id);
      return write();
    case "postFoodsByIdLike":
    case "postFoodsByIdUnlike":
    case "postFoodsByIdFavorite":
    case "postFoodsByIdUnfavorite": {
      const source = name.includes("Favorite")
        ? state.foodFavorites
        : state.foodLikes;
      source[user] = idList(source).filter((item) => item !== id);
      if (name === "postFoodsByIdLike" || name === "postFoodsByIdFavorite")
        source[user].push(id);
      return write();
    }
    case "rateFood":
    case "unrateFood": {
      if (!state.foods.some((food) => food.id === id))
        return fail(40015, "菜品不存在。");
      if (name === "rateFood") {
        const score = Number(payload.score);
        if (payload.score == null) return fail(10002, "score不能为空");
        if (!Number.isInteger(score) || score < 1 || score > 5)
          return fail(10001, "score 应为 1–5 的整数");
        (state.foodRatings[id] ??= {})[user] = score;
      } else delete state.foodRatings[id]?.[user];
      return write({
        myRating: state.foodRatings[id]?.[user] ?? null,
        rating: foodRating(id),
      });
    }
    case "getFoodsByIdHistory":
      return ok(
        paged([
          {
            id: 1,
            action: "create",
            editor: { id: 1, displayName: "小山" },
            changes: [],
            createdAt: state.foods.find((food) => food.id === id)?.createdAt,
          },
        ]),
      );
    case "postFoodsByIdHistoryByRevisionIdRestore":
      return ok({ id, revisionId: Date.now() });
    case "postFoodsSuggestTags":
      return ok({
        category: text("name").includes("汤") ? "汤" : "特色",
        tags: text("name").includes("辣") ? ["辣"] : ["清淡"],
      });
    case "getUserRecommendationProfileTaste":
      return ok({
        tags: [{ name: "清淡", score: 2.4 }],
        categories: [{ name: "粉面", score: 2.1 }],
        inferredTags: ["清淡"],
        inferredCategories: ["粉面"],
      });
    case "getFoodsByFoodIdComments":
      return ok(
        paged(
          state.comments
            .filter((comment) => comment.foodId === foodId && !comment.rootId)
            .map(withCommentViewer),
        ),
      );
    case "getCommentsByCommentId": {
      const target = state.comments.find((comment) => comment.id === commentId);
      const root = target?.rootId
        ? state.comments.find((comment) => comment.id === target.rootId)
        : target;
      const blocked = state.blocks[user] ?? [];
      if (
        !target ||
        !root ||
        [target, root].some(
          (comment) =>
            comment.author?.id != null && blocked.includes(comment.author.id),
        )
      )
        return fail(10001, "这条评论已删除或不可见");
      return ok(withCommentViewer(target));
    }
    case "getCommentsByCommentIdReplies":
      return ok(
        paged(
          state.comments
            .filter((comment) => comment.rootId === commentId)
            .map(withCommentViewer),
        ),
      );
    case "getCommentsMy":
      return ok(
        paged(
          state.comments
            .filter((comment) => comment.author?.id === user)
            .map(withCommentViewer),
        ),
      );
    case "postFoodsByFoodIdComments":
    case "postFoodsByFoodIdCommentsByCommentIdReplies": {
      const nextId =
        Math.max(0, ...state.comments.map((comment) => comment.id)) + 1;
      const rootId = name.includes("Replies") ? commentId : null;
      state.comments.unshift({
        id: nextId,
        foodId,
        rootId,
        author: {
          id: user,
          displayName: person?.displayName ?? "食友",
          avatar: person?.avatar,
        },
        replyTo: null,
        text: text("text"),
        pictureUrls: rootId
          ? []
          : list("pictureKeys").map((key) => state.images[key] ?? key),
        likeCount: 0,
        replyCount: 0,
        createdAt: Date.now(),
      });
      if (rootId) {
        const root = state.comments.find((comment) => comment.id === rootId);
        if (root) root.replyCount = (root.replyCount ?? 0) + 1;
      }
      return write({ id: nextId });
    }
    case "putCommentsByIdLike":
    case "deleteCommentsByIdLike":
      state.commentLikes[user] = idList(state.commentLikes).filter(
        (item) => item !== id,
      );
      if (name === "putCommentsByIdLike") state.commentLikes[user].push(id);
      return write();
    case "putCommentsByIdReactionsByReaction":
    case "deleteCommentsByIdReactionsByReaction": {
      const comment = state.comments.find((value) => value.id === id);
      if (!comment) return fail(10001, "评论不存在");
      const reaction = commentReactionOptions.find(
        (option) => option.reaction === params?.reaction,
      )?.reaction;
      if (!reaction) return fail(10001, "参数无效");
      const choices = (state.commentReactions[id] ??= {});
      if (name === "putCommentsByIdReactionsByReaction") {
        const author = comment.author?.id;
        if (author != null && (state.blocks[user]?.includes(author) || state.blocks[author]?.includes(user)))
          return fail(40002, "无法回应这条评论");
        choices[user] = reaction;
      } else if (choices[user] === reaction) {
        delete choices[user];
      }
      return write(reactionSummary(choices, user));
    }
    case "deleteCommentsByCommentId":
      state.comments = state.comments.filter(
        (comment) => {
          const keep = comment.id !== commentId && comment.rootId !== commentId;
          if (!keep) delete state.commentReactions[comment.id];
          return keep;
        },
      );
      return write();
    case "getFoodsByFoodIdGallery":
      return ok(
        paged(
          state.comments
            .filter((comment) => comment.foodId === foodId && !comment.rootId)
            .flatMap((comment) =>
              (comment.pictureUrls ?? []).map((url, slot) => ({
                commentId: comment.id,
                slot,
                url,
                author: comment.author,
                createdAt: comment.createdAt,
              })),
            ),
        ),
      );
    case "postFeedbackMessages":
    case "postFeedbackCatalogErrors":
    case "postFeedbackReports": {
      const nextId =
        Math.max(0, ...state.feedback.map((item) => item.id ?? 0)) + 1;
      const kind =
        name === "postFeedbackMessages"
          ? "FEEDBACK"
          : name === "postFeedbackCatalogErrors"
            ? "CATALOG_ERROR"
            : "REPORT";
      const record = {
        id: nextId,
        kind,
        status: "OPEN",
        target: payload.restaurantId
          ? { type: "RESTAURANT", id: Number(payload.restaurantId) }
          : payload.targetId
            ? { type: text("targetType"), id: Number(payload.targetId) }
            : null,
        reason: text("errorType") || text("reason") || null,
        text: text("text") || text("note"),
        screenshots: list("screenshotKeys").map((key, slot) => ({
          slot,
          url: state.images[key] ?? key,
        })),
        outcome: null,
        reply: "",
        createdAt: Date.now(),
        closedAt: null,
        submitterId: user,
      } as V2Schema["CaseView"];
      state.feedback.unshift(record);
      return write({
        id: nextId,
        kind,
        status: "OPEN",
        duplicate: false,
        createdAt: record.createdAt,
      });
    }
    case "getFeedbackMine":
      return ok(paged(state.feedback));
    case "getFeedbackMineById":
      return ok(state.feedback.find((item) => item.id === id) ?? null);
    case "getNotificationCards":
      return ok(paged(state.notifications));
    case "getNotificationCardsUnreadCount":
      return ok({
        cards: state.notifications.filter((item) => item.unreadMemberCount)
          .length,
        members: state.notifications.reduce(
          (sum, item) => sum + (item.unreadMemberCount ?? 0),
          0,
        ),
      });
    case "postNotificationCardsByIdRead": {
      const card = state.notifications.find((item) => item.id === id);
      if (card) card.unreadMemberCount = 0;
      return write();
    }
    case "postNotificationCardsReadAll":
      state.notifications.forEach((card) => {
        card.unreadMemberCount = 0;
      });
      return write();
    case "getHistoryBrowse": {
      const items = [
        ...state.foods.slice(0, 5).map((food, index) => ({
          targetType: "food",
          targetId: food.id,
          viewedAt: Date.now() - index * 3600000,
          restaurant: null,
          food: {
            id: food.id,
            restaurantId: food.restaurantId,
            name: food.name,
            pictureUrls: food.pictureUrls,
            likeCount: food.likeCount,
          },
        })),
        ...state.shops.slice(0, 3).map((restaurant, index) => ({
          targetType: "restaurant",
          targetId: restaurant.id,
          viewedAt: Date.now() - (index + 6) * 3600000,
          restaurant: {
            id: restaurant.id,
            name: restaurant.name,
            pictureUrl: restaurant.pictureUrl,
          },
          food: null,
        })),
      ];
      return ok(paged(items));
    }
    case "deleteHistoryBrowse":
      return write();
    case "getPushSettings":
      return ok({ categories: state.pushCategories });
    case "postPushSettingsEnable":
    case "postPushSettingsDisable":
      state.pushCategories[text("category")] =
        name === "postPushSettingsEnable";
      return write({ categories: state.pushCategories });
    case "postPushBindings":
      return ok({ bindingId: "demo-binding" });
    case "postPushBindingsByIdToken":
    case "postPushBindingsByIdUnbind":
      return ok();
    case "postDeviceRegister":
      // 演示数据只确认收到，不保存设备档案
      return text("installId") && text("platform")
        ? ok()
        : fail(10002, "参数缺失");
    case "postTelemetryEvents":
      return ok({
        accepted: list("events").length,
        duplicates: 0,
        enabled: demoToggles.telemetry,
      });
    // Endpoints added to backend v2 later; enough state for the pages.
    case "getTelemetryConsent":
    case "putTelemetryConsent":
    case "deleteTelemetryConsent":
      if (name !== "getTelemetryConsent")
        demoToggles.telemetry = name === "putTelemetryConsent";
      return ok({ enabled: demoToggles.telemetry, retentionDays: 90 });
    case "getUserRecommendationSettings":
    case "putUserRecommendationSettings":
      if (name === "putUserRecommendationSettings")
        demoToggles.personalized = payload.personalized !== false;
      return ok({ personalized: demoToggles.personalized });
    case "getUserLevel":
      return ok({
        level: 3,
        experience: 125,
        levelExperience: 100,
        nextLevel: 4,
        nextLevelExperience: 250,
        toNextLevel: 125,
        maxLevel: false,
        dailyUseExperience: 5,
        title: null,
        rules: [
          { source: "daily_use", name: "每日使用", amount: 5, dailyCap: 1 },
          { source: "verified", name: "完成学生认证", amount: 50, dailyCap: 1 },
          {
            source: "food_published",
            name: "发布菜品",
            amount: 15,
            dailyCap: 3,
          },
          {
            source: "restaurant_created",
            name: "新建店铺",
            amount: 10,
            dailyCap: 2,
          },
          {
            source: "content_edited",
            name: "完善店铺或菜品",
            amount: 3,
            dailyCap: 5,
          },
          {
            source: "restaurant_rated",
            name: "评价店铺",
            amount: 3,
            dailyCap: 3,
          },
          {
            source: "comment_posted",
            name: "发表评论",
            amount: 3,
            dailyCap: 3,
          },
          { source: "food_liked", name: "菜品被赞", amount: 2, dailyCap: 20 },
          {
            source: "comment_liked",
            name: "评论被赞",
            amount: 1,
            dailyCap: 10,
          },
        ],
      });
    case "getUserLevelLogs":
      return ok(
        paged(
          [0, 1, 2].map((i) => ({
            id: i + 1,
            source: "daily_use",
            sourceName: "每日使用",
            amount: 5,
            day: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
            createdAt: Date.now() - i * 86400000,
          })),
        ),
      );
    case "postAuthAccountDeleteCode":
      return ok();
    case "postAuthAccountDelete":
      if (
        person?.phone &&
        !body.phoneVerificationToken &&
        body.code !== "123456"
      )
        return fail(30005, "验证码不正确。");
      return ok({
        deleteAt: Date.now() + 7 * 86400000,
        deletionKey: "demo-deletion-key",
      });
    case "getRemoteConfig":
      return ok({
        configVersion: 1,
        flags: {},
        params: {},
        announcements: [],
        maintenance: { mode: "NONE" },
        versions: {},
        update: null,
      });
    case "getAdminEngagementStats":
      return ok({
        date: new Date().toISOString().slice(0, 10),
        dailyActiveUsers: 3,
        month: new Date().toISOString().slice(0, 7),
        monthlyActiveUsers: 18,
        rolling30Start: new Date(Date.now() - 29 * 86400000)
          .toISOString()
          .slice(0, 10),
        rolling30ActiveUsers: 27,
        timezone: "Asia/Shanghai",
      });
    case "getAdminEngagementStatsRange": {
      const days = [6, 5, 4, 3, 2, 1, 0].map((offset) => ({
        date: new Date(Date.now() - offset * 86400000)
          .toISOString()
          .slice(0, 10),
        activeUsers: Math.max(1, state.people.length - (offset % 2)),
      }));
      return ok({
        from: String(q.from ?? days[0].date),
        to: String(q.to ?? days[days.length - 1].date),
        days,
        timezone: "Asia/Shanghai",
      });
    }
    case "getAdminSummaryTrend": {
      const count = Math.min(90, Math.max(1, Number(q.days) || 7));
      const verified = state.people.filter((p) => p.verified).length;
      const days = Array.from({ length: count }, (_, idx) => {
        const offset = count - 1 - idx;
        return {
          date: new Date(Date.now() - offset * 86400000)
            .toISOString()
            .slice(0, 10),
          newUsers: idx === count - 1 ? 1 : 0,
          verifiedUsers: verified,
        };
      });
      return ok({ days, timezone: "Asia/Shanghai" });
    }
    case "getAdminContentStats": {
      const count = Math.min(90, Math.max(1, Number(q.days) || 7));
      const days = Array.from({ length: count }, (_, idx) => {
        const offset = count - 1 - idx;
        return {
          date: new Date(Date.now() - offset * 86400000)
            .toISOString()
            .slice(0, 10),
          foods: idx === count - 1 ? 1 : 0,
          restaurants: idx === count - 1 ? 1 : 0,
        };
      });
      return ok({
        totalFoods: state.foods.length,
        todayFoods: 1,
        totalRestaurants: state.shops.length,
        todayRestaurants: 1,
        days,
        timezone: "Asia/Shanghai",
      });
    }
    case "getAdminFeedbackCasesCounts": {
      const open = state.feedback.filter((item) => item.status === "OPEN");
      return ok({
        total: open.length,
        feedback: open.filter((item) => item.kind === "FEEDBACK").length,
        catalogError: open.filter((item) => item.kind === "CATALOG_ERROR")
          .length,
        report: open.filter((item) => item.kind === "REPORT").length,
      });
    }
    case "getAdminAiSettings":
    case "putAdminAiSettings":
      return ok({
        configured: true,
        enabled: true,
        baseUrl: "https://api.example.test/v1",
        apiKeyHint: "demo",
        model: "vision-demo",
        responseFormat: "json_schema",
        updatedBy: 2,
        updatedAt: Date.now(),
      });
    case "postAdminAiSettingsTest":
      return ok({ ok: true, category: "特色", tags: ["清淡"], failure: null });
    case "getAdminFeedbackCases":
    case "getAdminFeedbackCasesById": {
      const adminCase = (view: V2Schema["CaseView"]) => {
        const submitterId =
          (view as { submitterId?: number }).submitterId ?? user;
        const submitter = state.people.find((p) => p.id === submitterId);
        const targetId = view.target?.id;
        const targetName =
          view.target?.type === "RESTAURANT"
            ? state.shops.find((shop) => shop.id === targetId)?.name
            : view.target?.type === "FOOD"
              ? state.foods.find((food) => food.id === targetId)?.name
              : view.target?.type === "USER"
                ? state.people.find((p) => p.id === targetId)?.displayName
                : view.target?.type === "COMMENT"
                  ? state.comments.find((c) => c.id === targetId)?.text
                  : undefined;
        return {
          view,
          submitterId,
          submitterName: submitter?.displayName ?? "演示用户",
          targetName: targetName ?? "",
          targetUnavailable: !!view.target && !targetName,
          internalNote: (view as { internalNote?: string }).internalNote ?? "",
          resolvedBy: view.status === "CLOSED" ? user : null,
          catalogChangeRequired:
            view.kind === "CATALOG_ERROR" && view.outcome === "ACCEPTED",
        };
      };
      if (name === "getAdminFeedbackCasesById") {
        const found = state.feedback.find((item) => item.id === id);
        return found ? ok(adminCase(found)) : fail(10001, "记录不存在");
      }
      const wanted = String(q.status ?? "OPEN");
      const kind = q.kind ? String(q.kind) : "";
      const items = state.feedback.filter(
        (item) => item.status === wanted && (!kind || item.kind === kind),
      );
      if (wanted === "OPEN")
        items.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
      return ok(paged(items.map(adminCase)));
    }
    case "postAdminFeedbackCasesByIdResolution": {
      const found = state.feedback.find((item) => item.id === id);
      if (!found) return fail(10001, "记录不存在");
      if (found.status === "CLOSED") return fail(40002, "这条记录已经处理过了");
      const outcome = text("outcome");
      if (outcome === "RESOLVED" && found.kind !== "FEEDBACK")
        return fail(10001, "RESOLVED 只用于意见反馈");
      Object.assign(found, {
        status: "CLOSED",
        outcome,
        reply: text("reply"),
        internalNote: text("internalNote"),
        closedAt: Date.now(),
      });
      return write({
        id,
        status: "CLOSED",
        outcome,
        notified: true,
        catalogChangeRequired:
          found.kind === "CATALOG_ERROR" && outcome === "ACCEPTED",
      });
    }
    case "getAdminRemoteConfig":
      return ok({
        configVersion: 1,
        settings: {
          revision: 1,
          flags: {},
          params: {},
          maintenance: { mode: "NONE" },
        },
        versions: [],
      });
    case "putAdminRemoteConfigSettings":
      return ok({
        revision: 2,
        flags: {},
        params: {},
        maintenance: { mode: "NONE" },
      });
    case "putAdminRemoteConfigVersionsByPlatform":
      return ok({
        platform: params?.platform,
        revision: 1,
        minBuild: 0,
        latestBuild: 0,
      });
    case "getAdminRemoteConfigAnnouncements":
      return ok(paged([]));
    case "postAdminRemoteConfigAnnouncements":
    case "putAdminRemoteConfigAnnouncementsById":
      return ok({
        id: id || 1,
        level: "NORMAL",
        title: text("title"),
        content: text("content"),
        revision: 1,
      });
    case "deleteAdminRemoteConfigAnnouncementsById":
      return ok();
    case "getAdminRemoteConfigAudit":
      return ok(paged([]));
    // The carrier check needs a real SIM on mobile data; the demo has none.
    case "getAuthPhoneWebOneClickConfig":
    case "getAuthPhoneOneClickConfig":
      return ok({ enabled: false });
    case "getAuthPhoneVerificationConfig":
      return ok({ webEnabled: false, appEnabled: false });
    case "postAuthPhoneVerificationWebToken":
    case "postAuthPhoneVerification":
      return fail(20007, "演示模式未开启本机号码校验，请使用短信验证。");
    case "presign":
    case "presignBatch":
    case "complete":
      return fail(10004, "演示图片直接保存在当前浏览器。");
  }
  return fail(10004, "演示模式尚未实现此操作。");
}
