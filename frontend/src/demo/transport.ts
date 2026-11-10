import { readSession } from "../app/runtime";
import {
  handleComments,
  isCommentPath,
  seedComments,
  type DemoComments,
} from "./comments-v7";
import { demoGrowth, demoGrowthProgress, type DemoGrowth } from "./growth";
import type { Transport, Query } from "../api/client";
import { ApiError } from "../api/client";
import type {
  Food,
  Restaurant,
  User,
  CustomTag,
  Notification,
  Page,
  Hub,
  Schema,
} from "../api/models";

import { demoDishes } from "../mobile/catalog";
import { stageCode } from "../api/food-display";
import { wgsToGcj } from "../api/models";
import { parseHubImport } from "../api/sync-management";
import { demoSync, seedSync, type DemoSync } from "./sync";
import { handleV4, snapshotV4Recovery, type DemoV4 } from "./v4";
const tagWords = [
  "鲜虾大只",
  "平价",
  "汤鲜",
  "皮薄",
  "量大",
  "排队久",
  "出餐快",
  "偏咸",
  "好下饭",
  "适合一个人",
  "分量小",
  "辣得过瘾",
];
const seedNames = demoDishes.map((d, i) => [
  d.name,
  d.asset,
  d.price,
  d.category,
  d.restaurantId,
  i === 0 || i === 7 ? "天凉被破王" : "面馆观察员",
  i === 0 ? 143 : 127,
  tagWords[i],
]) as any[];
const restaurants: Restaurant[] = demoDishes
  .filter(
    (d, i, a) => a.findIndex((x) => x.restaurantId === d.restaurantId) === i,
  )
  .map((d) => ({
    id: d.restaurantId,
    name: d.shop,
    address: d.restaurantId === 6 ? "银座商城 3 层" : "万达金街 1 层",
    gcjLng: 117.134 + d.restaurantId * 0.0002,
    gcjLat: 36.667,
    hubId: 1,
    pictureUrl: [`/prototype/assets/dishes/${d.asset}.svg`],
  }));
type State = {
  growth?: DemoGrowth;
  commentsV7?: DemoComments;
  v4?: DemoV4;
  sync?: DemoSync;
  syncContractVersion?: number;
  schemaVersion?: number;
  blocked?: number[];
  personalized?: boolean;
  policy?: { version: string; url: string; revision: number };
  accountReviews?: Schema["ReviewSummaryResponse"][];
  user: User;
  foods: Food[];
  restaurants: Restaurant[];
  tags: CustomTag[];
  notifications: Notification[];
  history: { id: number; time: number; type?: "food" | "restaurant" }[];
  following: number[];
  privacy: { following: boolean; follower: boolean };
  hubs?: Hub[];
  publicTags?: Schema["AdminFoodTagVOResponse"][];
  bannedUsers?: number[];
  banExpiries?: Record<string, string>;
  consent?: Schema["ConsentViewResponse"];
  preferences?: {
    likedTags: string[];
    dislikedTags: string[];
    updatedAt: number;
  };
};
const captchas = new Map<string, number>();
const recoveryTokens = new Map<string, number>();
const sms = new Map<string, { until: number; sent: number }>();
function filterFoods(foods: Food[], q: Query) {
  const allIds = (raw: unknown) =>
    Array.isArray(raw)
      ? [...new Set(raw.map(Number))]
      : raw == null
        ? []
        : [Number(raw)];
  let rows = foods.filter(
    (f) =>
      (!q.restaurantId || f.restaurantId === Number(q.restaurantId)) &&
      (!q.hubId || f.hubId === Number(q.hubId)) &&
      (!q.keyword ||
        (f.name ?? "")
          .toLowerCase()
          .includes(String(q.keyword).toLowerCase())) &&
      (!q.category ||
        f.category?.toLowerCase() === String(q.category).toLowerCase()) &&
      (q.minPrice == null ||
        (f.price != null && f.price >= Number(q.minPrice))) &&
      (q.maxPrice == null ||
        (f.price != null && f.price <= Number(q.maxPrice))) &&
      allIds(q.systemTagIds).every((id) =>
        f.systemTags?.some((t) => t.id === id),
      ) &&
      allIds(q.myCustomTagIds).every((id) =>
        f.myCustomTags?.some((t) => t.id === id),
      ) &&
      (!q.myCustomTagNames ||
        (q.myCustomTagNames as string[]).every((n) =>
          f.myCustomTags?.some((t) => t.name === n),
        )),
  );
  if (q.sort === "PRICE_ASC" || q.sort === "PRICE_DESC")
    rows = [...rows].sort((a, b) =>
      a.price == null
        ? b.price == null
          ? 0
          : 1
        : b.price == null
          ? -1
          : q.sort === "PRICE_ASC"
            ? a.price - b.price
            : b.price - a.price,
    );
  else if (q.sort === "POPULAR")
    rows = [...rows].sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0));
  else if (q.sort === "NEWEST")
    rows = [...rows].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return rows;
}
function seed(): State {
  return {
    user: {
      id: 10,
      displayName: "天凉被破王",
      userName: null,
      hasUsername: false,
      hasPassword: false,
      signature: "只吃好吃的，也只推荐好吃的",
      verified: true,
      role: "user",
      banned: false,
    },
    foods: seedNames.map(
      (
        [name, image, price, category, rid, uploaderName, likesCount, tag],
        i,
      ) => ({
        id: i + 1,
        accountId: i === 0 || i === 7 ? 10 : i + 20,
        name,
        category,
        categoryLabel: (
          {
            staple: "米面主食",
            snack: "小吃",
            dessert: "甜品",
            drink: "饮品",
            cold_dish: "清爽轻食",
          } as Record<string, string>
        )[category],
        price,
        restaurantId: rid,
        restaurantName: restaurants[rid - 1].name,
        uploaderName,
        pictureUrl: [`/prototype/assets/dishes/${image}.svg`],
        description:
          "忙碌的日子，也要给一顿饭留点时间。喜欢这份美味的口感和香气，推荐你下次路过的时候试试看。",
        likesCount,
        isLiked: false,
        isFavorite: [1, 3, 6].includes(i + 1),
        systemTags:
          i === 0
            ? tagWords.slice(0, 3).map((name, j) => ({
                id: j + 1,
                name,
                count: [31, 18, 12][j],
                taggedByMe: false,
              }))
            : [{ id: i + 1, name: tag, count: 4, taggedByMe: false }],
        myCustomTags: [1, 3].includes(i + 1)
          ? [{ id: 101, name: "一个人吃" }]
          : i === 5
            ? [{ id: 102, name: "考试周" }]
            : [],
        createdAt: Date.now() - i * 3600000,
      }),
    ),
    restaurants,
    tags: [
      { id: 101, name: "一个人吃", usageCount: 2 },
      { id: 102, name: "考试周", usageCount: 1 },
    ],
    notifications: [
      {
        id: 1,
        actorName: "阿圆不想早八",
        type: "like",
        targetType: "food",
        targetId: 1,
        read: false,
        createdAt: Date.now(),
        data: "喜欢了你分享的美味。",
      },
    ],
    history: [],
    following: [],
    privacy: { following: true, follower: true },
  };
}
function load(): State {
  try {
    const raw = JSON.parse(
      localStorage.getItem("eatwhat-demo-prototype-v3") || "null",
    );
    if (raw?.foods && raw?.user && raw?.restaurants && raw?.privacy) {
      if (!raw.schemaVersion) {
        raw.user.displayName ??= raw.user.userName || "校园食友";
        raw.user.hasUsername ??= false;
        if (!raw.user.hasUsername) raw.user.userName = null;
        raw.schemaVersion = 2;
      }
      return raw;
    }
  } catch {
    /* isolated demo can run without persistence */
  }
  return seed();
}
let state: State | undefined;
function current() {
  return state ?? (state = load());
}
function save() {
  try {
    localStorage.setItem(
      "eatwhat-demo-prototype-v3",
      JSON.stringify(current()),
    );
  } catch {
    throw new ApiError(
      "演示存储已满，当前修改未能持久保存，请清理演示数据。",
      "DEMO_STORAGE",
    );
  }
}
function recordRestaurantVisit(s: State, id: number) {
  // Loading a dish's restaurant data must not count as visiting that restaurant.
  if (location.hash?.split("?")[0] !== `#/restaurants/${id}`) return;
  s.history = [
    { id, time: Date.now(), type: "restaurant" },
    ...s.history.filter(
      (h) => h.id !== id || (h.type ?? "food") !== "restaurant",
    ),
  ];
}
function paginate<T>(items: T[], query?: Query): Page<T> {
  const page = Number(query?.page ?? 1),
    size = Number(query?.pageSize ?? 12);
  return {
    items: items.slice((page - 1) * size, page * size),
    currentPage: page,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / size),
    hasNext: page * size < items.length,
  };
}
export const demoTransport: Transport = async (path, options) => {
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const s = current(),
    q = options.query ?? {},
    b = (options.body ?? {}) as Record<string, unknown>,
    method = options.method ?? "GET";
  s.hubs ??= [
    { id: 1, name: "软件园校区 · 演示区域", gcjLng: 117.134, gcjLat: 36.667 },
  ];
  s.publicTags ??= tagWords.map((name, i) => ({
    id: i + 1,
    name,
    usageCount: 1,
  }));
  s.bannedUsers ??= [];
  s.banExpiries ??= {};
  s.bannedUsers = s.bannedUsers.filter(
    (id) => !s.banExpiries![id] || Date.parse(s.banExpiries![id]) > Date.now(),
  );
  s.schemaVersion = 2;
  s.blocked ??= [];
  s.personalized ??= true;
  s.policy ??= {
    version: "demo-policy-v1",
    url: "/api/policies/demo-policy-v1.html",
    revision: 1,
  };
  s.accountReviews ??= [
    {
      eventId: "11111111-1111-4111-8111-000000000090",
      subjectId: "11111111-1111-4111-8111-000000000040",
      field: "password",
      state: "PENDING",
    },
  ];
  if (
    [
      "/auth/phone/code",
      "/auth/password/code",
      "/user/getCode",
      "/auth/sendEmail",
      "/auth/getCode",
      "/auth/password-conflict/challenge",
    ].includes(path) ||
    /^\/user\/mobile\/commands\/[^/]+\/codes$/.test(path)
  ) {
    const randstr = options.headers?.["X-Captcha-Randstr"];
    const ticket = options.headers?.["X-Captcha-Ticket"];
    if (!randstr || !ticket) throw new ApiError("请完成人机验证。", 30015);
    const expires = captchas.get(randstr);
    captchas.delete(randstr);
    if (
      ticket !== `demo-ticket:${randstr}` ||
      !expires ||
      expires <= Date.now()
    )
      throw new ApiError("验证票据已失效，请重试。", 30016);
  }
  s.foods.forEach((f) => {
    const r = s.restaurants.find((r) => r.id === f.restaurantId);
    f.hubId ??= r?.hubId ?? 1;
    f.restaurantAddress ??= r?.address;
    f.restaurantGcjLng ??= r?.gcjLng;
    f.restaurantGcjLat ??= r?.gcjLat;
    f.mealTimes ??= ["breakfast", "lunch", "dinner", "night"];
    f.pictureKeys ??= f.pictureUrl ?? [];
    if (f.user !== null)
      f.user = f.accountId
        ? {
            id: f.accountId,
            displayName:
              f.accountId === s.user.id ? s.user.displayName : f.uploaderName,
          }
        : null;
  });
  const proof =
    b.recoveryCapability ??
    options.headers?.["X-Recovery-Capability"] ??
    options.headers?.["X-Lifecycle-Recovery"];
  const proofHash =
    typeof proof === "string" && crypto.subtle
      ? [
          ...new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(proof),
            ),
          ),
        ]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("")
      : undefined;
  if (
    [
      "/user/activity",
      "/user/growth",
      "/user/growth/ledger",
      "/admin/engagement/stats",
    ].includes(path)
  ) {
    if (
      path.startsWith("/admin/") &&
      new URLSearchParams(location.search).get("persona") !== "admin"
    )
      throw new ApiError("需要管理员身份。", 20004, 403);
    s.growth ??= { entries: [] };
    const result = demoGrowth(s.growth, path, q);
    save();
    return { code: 0, data: structuredClone(result), msg: "success" };
  }
  if (isCommentPath(path)) {
    s.commentsV7 ??= seedComments(s.foods, s.user);
    const persona = new URLSearchParams(location.search).get("persona");
    const data = handleComments(
      s.commentsV7,
      path,
      options,
      {
        user: { ...s.user, verified: persona !== "unverified" },
        authenticated: !!readSession(),
        admin: persona === "admin",
      },
      s.foods,
    );
    save();
    return structuredClone({ code: 0, data, msg: "ok", timestamp: Date.now() });
  }
  const v4 = handleV4(s, path, options, proofHash);
  if (v4 !== undefined) {
    const restaurantId = path.match(/^\/restaurant\/detail\/(\d+)$/)?.[1];
    if (restaurantId && (v4.code ?? 0) === 0)
      recordRestaurantVisit(s, Number(restaurantId));
    snapshotV4Recovery(s);
    save();
    return structuredClone({
      code: v4.code ?? 0,
      msg: "success",
      data: v4.data,
      timestamp: Date.now(),
    });
  }
  let result: unknown = null;
  const foodId = Number(path.match(/^\/foods\/(?:detail\/)?(\d+)/)?.[1]);
  const food = s.foods.find((f) => f.id === foodId);
  if (path === "/auth/captcha/config") {
    const nonce = crypto.randomUUID();
    captchas.set(nonce, Date.now() + 120000);
    for (const [key, expiry] of captchas)
      if (expiry < Date.now()) captchas.delete(key);
    result = {
      enabled: true,
      provider: "tencent-cloud-intl",
      appId: "1001",
      scriptUrl: "https://ca.turing.captcha.qcloud.com/TJNCaptcha-global.js",
      aidEncrypted: nonce,
      aidEncryptedType: "cbc",
      expiresAt: Math.floor(Date.now() / 1000) + 120,
    };
  } else if (path === "/auth/consent/policy")
    result = { version: s.policy.version, url: s.policy.url };
  else if (path === "/admin/consent/policy") {
    if (method === "PUT") {
      if (b.expectedRevision !== s.policy.revision)
        throw new ApiError(
          "政策配置已更新，请重新读取后比较。",
          "REVISION_CONFLICT",
          409,
        );
      s.policy = {
        version: String(b.version),
        url: String(b.url),
        revision: s.policy.revision + 1,
      };
      save();
    }
    result = s.policy;
  } else if (path === "/user/recommendation-settings") {
    if (method === "PUT") {
      s.personalized = b.personalized === true;
      save();
    }
    result = { personalized: s.personalized };
  } else if (path === "/user/blocks")
    result = paginate(
      s.blocked.map((userId) => ({ userId, displayName: "校园食友" })),
      q,
    );
  else if (/^\/user\/blocks\/\d+$/.test(path)) {
    const userId = Number(path.split("/").pop());
    if (userId === s.user.id) throw new ApiError("不能屏蔽自己。", 400, 400);
    if (method === "PUT" && !s.blocked.includes(userId)) s.blocked.push(userId);
    if (method === "DELETE")
      s.blocked = s.blocked.filter((id) => id !== userId);
    result = { blocked: s.blocked.includes(userId) };
    save();
  } else if (path === "/auth/username/set") {
    const key = "password:" + s.user.id,
      sent = sms.get(key);
    if (!sent || sent.until < Date.now() || b.code !== "123456")
      throw new ApiError("验证码无效或已过期。", 400);
    if (s.user.hasUsername)
      throw new ApiError("该账号已经设置登录名。", 409, 409);
    if (!/^[A-Za-z0-9_]{3,10}$/.test(String(b.userName)))
      throw new ApiError("登录名格式无效。", 400);
    sms.delete(key);
    s.user.userName = String(b.userName);
    s.user.hasUsername = true;
    if (b.newPassword) s.user.hasPassword = true;
    result = {
      userName: s.user.userName,
      hasUsername: true,
      hasPassword: s.user.hasPassword,
      reauthenticationRequired: false,
    };
    save();
  } else if (path === "/auth/password-conflict/challenge") {
    if (!String(b.identifier ?? "").trim())
      throw new ApiError("请输入账号标识。", 400);
    recoveryTokens.set("demo-recovery-token", Date.now() + 1800000);
  } else if (path === "/auth/password-conflict/reset") {
    const token = String(b.token),
      expires = recoveryTokens.get(token);
    if (!expires || expires <= Date.now())
      throw new ApiError("恢复令牌无效或已过期，请重新申请。", 400);
    if (String(b.newPassword).length < 8 || String(b.newPassword).length > 128)
      throw new ApiError("密码需要 8–128 个字符。", 400);
    recoveryTokens.delete(token);
    s.user.hasPassword = true;
    save();
  } else if (path === "/auth/security/account-reviews")
    result = s.accountReviews;
  else if (
    /^\/auth\/security\/account-reviews\/password-conflicts\/\d+\/reset$/.test(
      path,
    )
  ) {
    if (String(b.newPassword).length < 8)
      throw new ApiError("密码至少 8 个字符。", 400);
    save();
  } else if (
    /^\/auth\/security\/account-reviews\/[^/]+\/decision$/.test(path)
  ) {
    const eventId = path.split("/").at(-2);
    s.accountReviews = s.accountReviews.filter(
      (row) => row.eventId !== eventId,
    );
    save();
  } else if (path === "/user/getCode") {
    if (b.scene !== "bind" || !/^1[3-9][0-9]{9}$/.test(String(b.mobile)))
      throw new ApiError("手机号或验证码用途无效。", 400);
    const key = "bind:" + String(b.mobile),
      old = sms.get(key);
    if (old && Date.now() - old.sent < 60000)
      throw new ApiError("请等待 60 秒。", 429);
    sms.set(key, { until: Date.now() + 300000, sent: Date.now() });
  } else if (path === "/user/bindMobile") {
    const key = "bind:" + String(b.mobile),
      sent = sms.get(key);
    if (!sent || sent.until < Date.now() || b.code !== "123456")
      throw new ApiError("验证码无效或过期。", 400);
    sms.delete(key);
    s.user.phone = String(b.mobile);
    save();
  } else if (path === "/auth/getCode") {
    sms.set(String(q.mobile), { until: Date.now() + 300000, sent: Date.now() });
  } else if (path === "/auth/sdu")
    result = { url: "https://example.invalid/demo-sso", expiresIn: 300 };
  else if (path === "/auth/consent/withdraw-with-password") {
    if (!String(b.userName ?? "").trim() || !b.password)
      throw new ApiError("请输入用户名和密码。", 400);
    s.consent = {
      status: "WITHDRAWN",
      policyVersion: s.policy.version,
      identityReady: true,
      registrationAccepted: true,
      backfillStatus: "NOT_STARTED",
      cleanupStatus: "COMPLETED",
    };
    result = s.consent;
    save();
  } else if (path === "/auth/consent")
    result = {
      status: s.consent?.status ?? "NOT_GRANTED",
      identityReady: s.consent?.identityReady ?? false,
      policyVersion: s.consent?.policyVersion ?? s.policy.version,
    };
  else if (
    path === "/auth/consent/grant" ||
    path === "/auth/consent/withdraw"
  ) {
    if (path.endsWith("grant") && b.policyVersion !== s.policy.version)
      throw new ApiError(
        "政策版本已更新，请重新阅读。",
        "POLICY_VERSION_MISMATCH",
      );
    s.consent = {
      status: path.endsWith("grant") ? "GRANTED" : "WITHDRAWN",
      policyVersion: s.policy.version,
      identityReady: path.endsWith("grant"),
      registrationAccepted: true,
      backfillStatus: path.endsWith("grant")
        ? "ACCOUNT_COMPLETE_DOMAINS_PENDING"
        : "NOT_STARTED",
      cleanupStatus: path.endsWith("grant") ? "NOT_REQUIRED" : "COMPLETED",
    };
    result = s.consent;
    save();
  } else if (path === "/campus/list")
    result = [
      {
        id: 1,
        name: "软件园校区",
        gcjLng: 117.134,
        gcjLat: 36.667,
        isDefault: true,
        open: true,
      },
      {
        id: 2,
        name: "中心校区",
        gcjLng: 117.06,
        gcjLat: 36.675,
        isDefault: false,
        open: true,
      },
    ];
  else if (path === "/user/recommendation-profile/preferences") {
    if (method === "PUT") {
      s.preferences = {
        likedTags: b.likedTags as string[],
        dislikedTags: b.dislikedTags as string[],
        updatedAt: Date.now(),
      };
      save();
    } else if (method === "DELETE") {
      s.preferences = {
        likedTags: [],
        dislikedTags: [],
        updatedAt: Date.now(),
      };
      save();
    }
    result = s.preferences ?? { likedTags: [], dislikedTags: [], updatedAt: 0 };
  } else if (path === "/auth/phone/code" || path === "/auth/password/code") {
    const key =
        path === "/auth/phone/code"
          ? String(b.mobile)
          : "password:" + s.user.id,
      previous = sms.get(key);
    if (previous && Date.now() - previous.sent < 60000)
      throw new ApiError("请等待 60 秒后重新获取验证码。", 429);
    sms.set(key, { until: Date.now() + 300000, sent: Date.now() });
  } else if (path === "/auth/phone/login") {
    const key = String(b.mobile),
      sent = sms.get(key);
    if (!sent || sent.until < Date.now() || b.code !== "123456")
      throw new ApiError("验证码无效或已过期，演示验证码为 123456。", 400);
    sms.delete(key);
    const newUser = !s.user.phone;
    s.user.phone = key;
    save();
    result = {
      tokenName: "satoken",
      tokenValue: "isolated-demo-token",
      isLogin: true,
      newUser,
    };
  } else if (path === "/auth/password/reset") {
    const key = "password:" + s.user.id,
      sent = sms.get(key);
    if (!sent || sent.until < Date.now() || b.code !== "123456")
      throw new ApiError("验证码无效或已过期。", 400);
    sms.delete(key);
    s.user.hasPassword = true;
    save();
  } else if (path === "/auth/login" || path === "/auth/register")
    result = {
      tokenName: "satoken",
      tokenValue: "isolated-demo-token",
      isLogin: true,
    };
  else if (
    path === "/auth/checkUsername" ||
    path === "/auth/logout" ||
    path === "/auth/changePassword" ||
    path === "/auth/sendEmail"
  )
    result = null;
  else if (path === "/user/info") {
    const persona = new URLSearchParams(location.search).get("persona");
    result = {
      ...s.user,
      level: demoGrowthProgress((s.growth ??= { entries: [] })).level,
      totalExperience: demoGrowthProgress(s.growth).totalExperience,
      hasPassword: s.user.hasPassword ?? true,
      role: persona === "admin" ? "admin" : "user",
      verified: persona !== "unverified",
    };
  } else if (path === "/user/updateInfo") {
    Object.assign(s.user, b);
    if (b.displayName)
      s.foods
        .filter((f) => f.accountId === s.user.id)
        .forEach((f) => {
          f.uploaderName = String(b.displayName);
        });
    save();
  } else if (path === "/user/changePrivacy") {
    Object.assign(s.privacy, b);
    save();
  } else if (path === "/auth/verify")
    result = s.user.verified ? ["verify:sso"] : [];
  else if (path === "/api/location/provinces")
    result = [{ id: 1, name: "山东省" }];
  else if (path === "/api/location/provinces/1/cities")
    result = [
      { id: 1, provinceId: 1, name: "济南市" },
      { id: 2, provinceId: 1, name: "青岛市" },
    ];
  else if (path === "/hub/list") result = paginate(s.hubs, q);
  else if (path.startsWith("/hub/detail/")) {
    result =
      s.hubs.find((h) => h.id === Number(path.split("/").at(-1))) ?? null;
  } else if (path === "/hub/locate") {
    result =
      s.hubs.find(
        (h) =>
          Math.abs((h.gcjLng ?? 0) - Number(q.gcjLng)) < 0.03 &&
          Math.abs((h.gcjLat ?? 0) - Number(q.gcjLat)) < 0.03,
      ) ?? null;
  } else if (path.startsWith("/admin/sync/")) {
    if (
      path === "/admin/sync/catalog/import/hubs" &&
      method === "POST" &&
      parseHubImport(JSON.stringify(b)).hubs?.some(
        (hub) => hub.rebindCoveredRestaurants,
      )
    )
      throw new ApiError(
        "Mock 不执行餐厅空间归属重算；可关闭此选项演示目录导入，真实归属请在测试环境核对。",
        "DEMO_SPATIAL_UNSUPPORTED",
      );
    s.sync ??= seedSync();
    if (s.syncContractVersion !== 2) {
      const currentContract = seedSync();
      s.sync.profiles = currentContract.profiles;
      s.sync.profileReviews = currentContract.profileReviews;
      s.syncContractVersion = 2;
    }
    result = demoSync(s.sync, path, method, b);
    if (
      path === "/admin/sync/catalog/import/hubs" &&
      method === "POST" &&
      (result as { status: string }).status === "APPLIED"
    ) {
      const input = parseHubImport(JSON.stringify(b));
      s.sync.hubMappings ??= {};
      let created = 0,
        updated = 0;
      for (const item of input.hubs ?? []) {
        const mapping = `${input.sourceKey}:${item.sourceId}`,
          knownId = s.sync.hubMappings[mapping];
        const existing = s.hubs.find((hub) => hub.id === knownId);
        let gcj = item.centerGcj;
        if (
          !gcj &&
          item.centerWgs &&
          item.centerWgs.lng >= 72.004 &&
          item.centerWgs.lng <= 137.8347 &&
          item.centerWgs.lat >= 0.8293 &&
          item.centerWgs.lat <= 55.8271
        ) {
          const point = wgsToGcj(item.centerWgs.lng, item.centerWgs.lat);
          gcj = { lng: point.gcjLng, lat: point.gcjLat };
        }
        const values = {
          name: item.name,
          gcjLng: gcj?.lng,
          gcjLat: gcj?.lat,
          updatedAt: Date.now(),
        };
        if (existing) {
          Object.assign(existing, values);
          updated++;
        } else {
          const targetId = Math.max(0, ...s.hubs.map((hub) => hub.id ?? 0)) + 1;
          s.hubs.push({ id: targetId, ...values, createdAt: Date.now() });
          s.sync.hubMappings[mapping] = targetId;
          created++;
        }
      }
      Object.assign(result as object, { created, updated });
    }
    if (method !== "GET") save();
  } else if (path === "/admin/summary")
    result = {
      totalUsers: 2,
      totalFoods: s.foods.length,
      totalRestaurants: s.restaurants.length,
      todayUsers: 0,
      todayFoods: s.foods.filter((f) => f.id! > 100).length,
      todayRestaurants: 0,
      verifiedRate: 0.86,
    };
  else if (path === "/restaurant/list")
    result = paginate(
      s.restaurants.filter((r) =>
        (r.name || "").includes(String(q.keyword ?? "")),
      ),
      q,
    );
  else if (path.startsWith("/restaurant/edit/")) {
    const r = s.restaurants.find((r) => r.id === Number(path.split("/").pop()));
    if (!r) throw new ApiError("餐厅不存在。", 404);
    Object.assign(r, b);
    s.foods
      .filter((f) => f.restaurantId === r.id)
      .forEach((f) => (f.restaurantName = r.name));
    save();
  } else if (path.startsWith("/restaurant/delete/")) {
    s.restaurants = s.restaurants.filter(
      (r) => r.id !== Number(path.split("/").pop()),
    );
    save();
  } else if (path.startsWith("/foods/edit/")) {
    const f = s.foods.find((f) => f.id === Number(path.split("/").pop()));
    if (!f) throw new ApiError("菜品不存在。", 404);
    Object.assign(f, b);
    save();
  } else if (path.startsWith("/foods/delete/")) {
    s.foods = s.foods.filter((f) => f.id !== Number(path.split("/").pop()));
    save();
  } else if (path === "/admin/food-tags") {
    if (method === "GET") result = paginate(s.publicTags, q);
    else {
      s.publicTags.push({
        id: Date.now(),
        name: String(b.name),
        usageCount: 0,
      });
      result = s.publicTags.at(-1);
      save();
    }
  } else if (path.startsWith("/admin/food-tags/")) {
    const id = Number(path.split("/").pop());
    if (method === "DELETE") {
      s.publicTags = s.publicTags.filter((t) => t.id !== id);
      s.foods.forEach(
        (f) => (f.systemTags = f.systemTags?.filter((t) => t.id !== id)),
      );
    } else {
      const t = s.publicTags.find((t) => t.id === id);
      if (t) t.name = String(b.name);
      s.foods.forEach((f) =>
        f.systemTags
          ?.filter((t) => t.id === id)
          .forEach((t) => (t.name = String(b.name))),
      );
    }
    save();
  } else if (path === "/user/list")
    result = paginate(
      [
        {
          id: 10,
          userName: s.user.userName,
          displayName: s.user.displayName,
          role: "admin",
          verified: true,
          accountStatus: {
            accountStatus: s.bannedUsers.includes(10) ? "BANNED" : "NORMAL",
          },
        },
        {
          id: 21,
          userName: "xiaoyuan",
          displayName: "阿圆不想早八",
          role: "user",
          verified: true,
          accountStatus: {
            accountStatus: s.bannedUsers.includes(21) ? "BANNED" : "NORMAL",
          },
        },
      ],
      q,
    );
  else if (path.startsWith("/user/ban/")) {
    const id = Number(path.split("/").pop());
    s.bannedUsers = [...new Set([...s.bannedUsers, id])];
    if (typeof b.banUntil === "string") s.banExpiries[id] = b.banUntil;
    else delete s.banExpiries[id];
    save();
  } else if (path.startsWith("/user/unban/")) {
    delete s.banExpiries[Number(path.split("/").pop())];
    s.bannedUsers = s.bannedUsers.filter(
      (id) => id !== Number(path.split("/").pop()),
    );
    save();
  } else if (path === "/hub/add") {
    s.hubs.push({ ...b, id: Date.now() } as Hub);
    save();
  } else if (path.startsWith("/hub/edit/")) {
    const h = s.hubs.find((h) => h.id === Number(path.split("/").pop()));
    if (h) Object.assign(h, b);
    save();
  } else if (path.startsWith("/hub/delete/")) {
    s.hubs = s.hubs.filter((h) => h.id !== Number(path.split("/").pop()));
    save();
  } else if (path.startsWith("/hub/rebind-restaurants/"))
    result = s.restaurants.filter(
      (r) => r.hubId === Number(path.split("/").pop()),
    ).length;
  else if (path === "/restaurant/search" || path === "/restaurant/browse")
    result = paginate(
      s.restaurants.filter(
        (r) =>
          (r.name || "").includes(String(q.keyword ?? "")) &&
          (!q.hubId || r.hubId === Number(q.hubId)),
      ),
      q,
    );
  else if (path.startsWith("/restaurant/detail/")) {
    result = s.restaurants.find((r) => r.id === Number(path.split("/").pop()));
    if (!result) throw new ApiError("餐厅不存在。", 404, 404);
    const id = Number(path.split("/").pop());
    recordRestaurantVisit(s, id);
    save();
  } else if (path === "/restaurant/add") {
    const id = Date.now();
    s.restaurants.unshift({ ...b, id } as Restaurant);
    result = { id };
    save();
  } else if (path === "/foods/recommend") {
    const items = filterFoods(s.foods, q)
      .filter((f) => !s.blocked!.includes(f.accountId ?? 0))
      .filter((f) => !q.mealTime || f.mealTimes?.includes(q.mealTime as any))
      .slice(0, Number(q.size ?? q.limit ?? 8));
    result = items;
  } else if (/^\/foods\/by-user\/\d+$/.test(path))
    result = paginate(
      filterFoods(
        s.foods.filter((f) => f.accountId === Number(path.split("/").pop())),
        q,
      ),
      q,
    );
  else if (path === "/foods/favorites")
    result = paginate(
      filterFoods(
        s.foods.filter((f) => f.isFavorite),
        q,
      ),
      q,
    );
  else if (path === "/foods/my")
    result = paginate(
      s.foods.filter((f) => f.accountId === 10),
      q,
    );
  else if (path === "/foods/list")
    result = paginate(filterFoods(s.foods, q), q);
  else if (path === "/foods/tags/my") {
    s.tags.forEach(
      (t) =>
        (t.usageCount = s.foods.filter((f) =>
          f.myCustomTags?.some((x) => x.id === t.id),
        ).length),
    );
    result = paginate(s.tags, q);
  } else if (path === "/foods/tags/system")
    result = s.publicTags.map((t) => ({ id: t.id, name: t.name }));
  else if (path.startsWith("/foods/tags/my/")) {
    const id = Number(path.split("/").pop()),
      tag = s.tags.find((t) => t.id === id);
    if (method === "DELETE") {
      s.tags = s.tags.filter((t) => t.id !== id);
      s.foods.forEach(
        (f) => (f.myCustomTags = f.myCustomTags?.filter((t) => t.id !== id)),
      );
    } else if (tag) {
      tag.name = String(b.name);
      s.foods.forEach((f) =>
        f.myCustomTags
          ?.filter((t) => t.id === id)
          .forEach((t) => (t.name = tag.name)),
      );
    }
    save();
  } else if (path === "/foods/upload") {
    const r = s.restaurants.find((r) => r.id === b.restaurantId);
    const existing = s.foods.find(
      (f) => f.restaurantId === b.restaurantId && f.name === b.name,
    );
    if (existing)
      throw new ApiError("这家店已经有这道菜了。", 40016, undefined, {
        id: existing.id,
      });
    const id = Date.now();
    const custom = ((b.myCustomTagNames as string[]) ?? []).map((name) => {
      let tag = s.tags.find((t) => t.name === name);
      if (!tag) {
        tag = { id: Date.now() + s.tags.length + 1, name };
        s.tags.push(tag);
      }
      return { id: tag.id, name: tag.name };
    });
    s.foods.unshift({
      ...b,
      id,
      pictureKeys: b.pictureUrl,
      myCustomTags: custom,
      systemTags: ((b.systemTagIds as number[]) ?? []).map((id) => ({
        id,
        name: s.publicTags?.find((t) => t.id === id)?.name,
        count: 1,
        taggedByMe: true,
      })),
      accountId: 10,
      uploaderName: s.user.displayName,
      restaurantName: r?.name,
      isLiked: false,
      isFavorite: false,
      likesCount: 0,
      createdAt: Date.now(),
    } as Food);
    result = { id };
    save();
  } else if (/^\/foods\/my\/\d+$/.test(path)) {
    const id = Number(path.split("/").pop()),
      owned = s.foods.find((f) => f.id === id);
    if (!owned || owned.accountId !== s.user.id)
      throw new ApiError("只能管理自己的菜品。", 403, 403);
    if (method === "DELETE") s.foods = s.foods.filter((f) => f.id !== id);
    else if (method === "PUT") {
      Object.assign(owned, b);
      if (b.pictureUrl) owned.pictureKeys = b.pictureUrl as string[];
    }
    save();
  } else if (food) {
    if (path === `/foods/detail/${foodId}`) {
      s.history = [
        { id: foodId, time: Date.now() },
        ...s.history.filter(
          (h) => h.id !== foodId || (h.type ?? "food") !== "food",
        ),
      ];
      save();
      result = food;
    } else if (path.endsWith("/unlike")) {
      food.isLiked = false;
      food.likesCount = Math.max(0, (food.likesCount ?? 1) - 1);
      save();
    } else if (path.endsWith("/like")) {
      food.isLiked = true;
      food.likesCount = (food.likesCount ?? 0) + 1;
      save();
    } else if (path.endsWith("/unfavorite")) {
      food.isFavorite = false;
      save();
    } else if (path.endsWith("/favorite")) {
      food.isFavorite = true;
      save();
    } else if (path.endsWith("/tags") && method === "GET")
      result = {
        systemTags: food.systemTags ?? [],
        myCustomTags: food.myCustomTags ?? [],
      };
    else if (path.endsWith("/tags/custom")) {
      for (const name of b.names as string[]) {
        let tag = s.tags.find((t) => t.name === name);
        if (!tag) {
          tag = { id: Date.now() + s.tags.length, name, usageCount: 0 };
          s.tags.push(tag);
        }
        if (!food.myCustomTags?.some((t) => t.id === tag!.id))
          food.myCustomTags = [
            ...(food.myCustomTags ?? []),
            { id: tag.id, name: tag.name },
          ];
      }
      save();
    } else if (path.endsWith("/tags/system")) {
      for (const id of b.tagIds as number[]) {
        let tag = food.systemTags?.find((t) => t.id === id);
        if (tag) {
          tag.taggedByMe = true;
          tag.count = (tag.count ?? 0) + 1;
        } else
          food.systemTags = [
            ...(food.systemTags ?? []),
            {
              id,
              name: seedNames[id - 1]?.[7] ?? "美味",
              count: 1,
              taggedByMe: true,
            },
          ];
      }
      save();
    } else if (method === "DELETE" && path.includes("/tags/")) {
      const id = Number(path.split("/").pop());
      food.myCustomTags = food.myCustomTags?.filter((t) => t.id !== id);
      food.systemTags
        ?.filter((t) => t.id === id)
        .forEach((t) => {
          t.taggedByMe = false;
          t.count = Math.max(0, (t.count ?? 1) - 1);
        });
      save();
    } else
      throw new ApiError("这项功能正在准备中，敬请期待。", "DEMO_UNSUPPORTED");
  } else if (path === "/notification/list")
    result = paginate(s.notifications, q);
  else if (path === "/notification/unread/count")
    result = s.notifications.filter((n) => !n.read).length;
  else if (path.startsWith("/notification/read/")) {
    s.notifications
      .filter(
        (n) => path.endsWith("/all") || n.id === Number(path.split("/").pop()),
      )
      .forEach((n) => (n.read = true));
    save();
  } else if (path === "/history/browse" && method === "DELETE") {
    s.history = q.targetType
      ? s.history.filter((h) => (h.type ?? "food") !== q.targetType)
      : [];
    save();
  } else if (path === "/history/browse")
    result = paginate(
      s.history
        .filter((h) => (h.type ?? "food") === q.targetType)
        .map((h) => ({
          targetType: h.type ?? "food",
          targetId: h.id,
          viewedAt: h.time,
          ...((h.type ?? "food") === "food"
            ? { food: s.foods.find((f) => f.id === h.id) }
            : { restaurant: s.restaurants.find((r) => r.id === h.id) }),
        })),
      q,
    );
  else if (path === "/user/userInfo")
    result = {
      displayName:
        Number(q.userId) === 10 ? s.user.displayName : "阿圆不想早八",
      level:
        Number(q.userId) === s.user.id
          ? demoGrowthProgress((s.growth ??= { entries: [] })).level
          : 3,
      fansCount: 3,
      followingsCount: 6,
      earnedLikes: 96,
      fansVisible: s.privacy.follower,
      followingsVisible: s.privacy.following,
      isFollowingHim: s.following.includes(Number(q.userId)),
      uploadedFoodsCount: s.foods.filter(
        (f) => f.accountId === (Number(q.userId) || 10),
      ).length,
    };
  else if (path === "/user/follow") {
    s.following.push(Number(q.userId));
    save();
  } else if (path === "/user/unfollow") {
    s.following = s.following.filter((id) => id !== Number(q.userId));
    save();
  } else if (path === "/user/followers" || path === "/user/followings")
    result = paginate(
      s.following.map((id) => ({ id, displayName: "阿圆不想早八" })),
      q,
    );
  else throw new ApiError("这项功能正在准备中，敬请期待。", "DEMO_UNSUPPORTED");
  const output = structuredClone(result);
  if (
    method === "GET" &&
    path !== "/foods/recommend" &&
    (path.startsWith("/foods/") || path === "/history/browse")
  ) {
    const clearRecommendationMetadata = (value: unknown) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(clearRecommendationMetadata);
        return;
      }
      const object = value as Record<string, unknown>;
      if ("restaurantId" in object && "accountId" in object)
        for (const field of [
          "restaurantAddress",
          "restaurantGcjLng",
          "restaurantGcjLat",
          "hubId",
          "hubName",
        ])
          object[field] = null;
      Object.values(object).forEach(clearRecommendationMetadata);
    };
    clearRecommendationMetadata(output);
  }
  return structuredClone({
    code: 0,
    msg: "success",
    data: output,
    timestamp: Date.now(),
  });
};

export async function demoUpload(file: File, biz = "foods") {
  const { compressImage } = await import("../api/image-compression");
  const prepared = await compressImage(file, biz);
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.readAsDataURL(prepared);
  });
  const key = `${biz}/${crypto.randomUUID()}`;
  try {
    localStorage.setItem(`eatwhat-demo-media-v4:${key}`, data);
  } catch {
    throw new ApiError("演示图片存储已满，请清理演示图片。", "DEMO_STORAGE");
  }
  return key;
}
