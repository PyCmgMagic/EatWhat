/**
 * Runs the original (APIv7) web UI against the backend v2 service.
 *
 * The old pages keep calling the APIv7 paths and reading APIv7 shapes. This
 * transport sits between them and the real network: it rewrites each request
 * to its v2 counterpart and turns the v2 reply back into the shape the old UI
 * expects. Features the v2 backend dropped answer with an empty result (lists
 * shown on page load) or with a 404 "retired" error, which the old UI already
 * treats as "unavailable".
 */
import {
  ApiError,
  type Envelope,
  type Query,
  type RequestOptions,
  type Transport,
} from "./client";

type Json = Record<string, any>;
type Page<T> = {
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  hasNext?: boolean;
  items?: T[];
};
type Call = (
  path: string,
  options?: RequestOptions & { method?: string },
) => Promise<any>;
type Handler = (ctx: {
  match: RegExpMatchArray;
  options: RequestOptions;
  query: Query;
  body: Json;
  call: Call;
  raw: Transport;
}) => Promise<unknown>;

// ------------------------------------------------------------ vocabularies

/** v2 dish categories (FoodTraits.CATEGORIES). */
export const FOOD_CATEGORIES = ["主食", "菜", "小吃", "汤", "饮品甜品", "特色"];
/** v2 taste tags shared by dishes and shops (RestaurantTraits.TAGS). */
export const TASTE_TAGS = ["辣", "麻", "甜", "酸", "清淡"];
const oldToNewCategory: Record<string, string> = {
  staple: "主食",
  side_dish: "菜",
  cold_dish: "菜",
  hot_pot: "菜",
  grill: "菜",
  snack: "小吃",
  soup: "汤",
  drink: "饮品甜品",
  dessert: "饮品甜品",
  other: "特色",
};
const newToOldCategory: Record<string, string> = {
  主食: "staple",
  菜: "side_dish",
  小吃: "snack",
  汤: "soup",
  饮品甜品: "drink",
  特色: "other",
};
export const toV2Category = (value: unknown) =>
  typeof value === "string"
    ? (oldToNewCategory[value] ??
      (FOOD_CATEGORIES.includes(value) ? value : "特色"))
    : undefined;
const tagId = (name: string) => TASTE_TAGS.indexOf(name) + 1;
const tagName = (id: unknown) => TASTE_TAGS[Number(id) - 1];

const UPLOAD_KEY =
  /(?:^|\/)((?:avatar|restaurants|foods|comments|feedback)\/\d{4}\/\d{2}\/[^?#]+)/;
/** v2 stores object keys and returns `${publicBase}/${key}`; recover the key. */
export function pictureKey(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  if (!/^[a-z]+:\/\//i.test(value)) return value;
  try {
    const match = decodeURIComponent(new URL(value).pathname).match(UPLOAD_KEY);
    return match?.[1];
  } catch {
    return undefined;
  }
}
const keys = (values: unknown) =>
  Array.isArray(values)
    ? values.map(pictureKey).filter((k): k is string => !!k)
    : undefined;

const iso = (value: unknown) =>
  typeof value === "number" ? new Date(value).toISOString() : (value ?? null);
const millis = (value: unknown) => {
  if (value == null || value === "") return value === "" ? null : value;
  if (typeof value === "number") return value;
  const time = Date.parse(String(value));
  return Number.isNaN(time) ? value : time;
};
const page = <T, U>(value: Page<T> | null | undefined, map: (item: T) => U) =>
  value
    ? { ...value, items: (value.items ?? []).map(map) }
    : {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
        hasNext: false,
        items: [],
      };
const emptyPage = () => page<never, never>(null, (x) => x);
const omit = (query: Query, allowed: string[]) =>
  Object.fromEntries(
    Object.entries(query).filter(([key]) => allowed.includes(key)),
  ) as Query;

export function retired(feature = "这个功能"): never {
  throw new ApiError(`新版后端暂不提供${feature}。`, "FEATURE_RETIRED", 404);
}

// ------------------------------------------------------------ shapes

export function food(v: Json | null | undefined): Json | null {
  if (!v) return null;
  const pictures: string[] = v.pictureUrls ?? [];
  const tags: string[] = v.tags ?? [];
  return {
    ...v,
    accountId: v.accountId ?? null,
    uploaderName: null,
    user: v.accountId ? { id: v.accountId, displayName: null } : null,
    restaurantId: v.restaurantId ?? null,
    restaurantName: v.restaurantName ?? null,
    distanceMeters: v.distanceMeters ?? null,
    restaurantAddress: v.restaurantAddress ?? null,
    restaurantGcjLng: v.restaurantGcjLng ?? null,
    restaurantGcjLat: v.restaurantGcjLat ?? null,
    hubId: v.hubId ?? null,
    hubName: v.hubName ?? null,
    description: v.description ?? null,
    price: v.price ?? null,
    category: newToOldCategory[v.category] ?? "other",
    categoryLabel: v.category ?? null,
    pictureUrl: pictures,
    pictureKeys: keys(pictures) ?? [],
    systemTags: tags.map((name) => ({
      id: tagId(name),
      name,
      count: 1,
      taggedByMe: false,
    })),
    myCustomTags: [],
    isLiked: v.isLiked ?? null,
    isFavorite: v.isFavorite ?? null,
    likesCount: v.likeCount ?? 0,
    mealTimes: [],
    stageColor: null,
    stageAlternates: [],
    coverCrop: null,
  };
}

const rating = (value: unknown) =>
  value === "RECOMMEND" || value === "NOT_RECOMMEND" ? value : null;
export function restaurant(v: Json | null | undefined): Json | null {
  if (!v) return null;
  const dineIn = v.dineIn ?? { rate: null, count: 0 };
  const count = (dineIn.count ?? 0) + (v.delivery?.count ?? 0);
  const up =
    (dineIn.rate ?? 0) * (dineIn.count ?? 0) +
    (v.delivery?.rate ?? 0) * (v.delivery?.count ?? 0);
  return {
    ...v,
    accountId: v.accountId ?? null,
    permanentlyClosed: v.permanentlyClosed ?? false,
    operatingStatus: v.permanentlyClosed ? "CLOSED" : "OPEN",
    distanceMeters: v.distanceMeters ?? null,
    campusId: v.campusId ?? null,
    hubName: v.hubName ?? null,
    hubId: v.hubId ?? null,
    visibleFoodCount: v.visibleFoodCount ?? null,
    medianPrice: v.medianPrice ?? null,
    priceBand: v.priceBand ?? null,
    ratingCount: count,
    recommendationRate: count ? Math.round((up / count) * 100) : null,
    isFavorite: v.isFavorite ?? null,
    ratingSummaryState: "READY",
    personalState: v.myRatings === undefined ? "NOT_LOGGED_IN" : "READY",
    publicTastesState: "READY",
    myRating: rating(v.myRatings?.dineIn ?? v.myRatings?.delivery),
    signatureFoods: (v.signatureFoods ?? []).map((f: Json) => ({
      id: f.id,
      restaurantId: v.id,
      name: f.name,
      price: f.price ?? null,
      coverUrl: f.pictureUrl ?? null,
      stageColor: null,
      likesCount: f.likeCount ?? 0,
    })),
    matchedFoods: [],
    publicTastes: (v.tags ?? []).map((name: string) => ({
      restaurantId: v.id,
      tagId: tagId(name),
      name,
      taggerCount: 1,
    })),
    coverUrl: v.pictureUrl ?? null,
    stageColor: null,
    cityId: null,
    location:
      v.gcjLng != null && v.gcjLat != null
        ? { type: "Point", coordinates: [v.gcjLng, v.gcjLat], srid: 4326 }
        : null,
    POI: v.poi ?? null,
    pictureUrl: v.pictureUrl ? [v.pictureUrl] : [],
  };
}

function hub(v: Json | null | undefined) {
  if (!v) return null;
  return {
    ...v,
    center:
      v.gcjLng != null
        ? { type: "Point", coordinates: [v.gcjLng, v.gcjLat], srid: 4326 }
        : null,
    boundary: v.boundary ?? null,
  };
}

const likes = new Map<number, { liked: boolean; count: number }>();
function comment(v: Json) {
  if (typeof v.id === "number")
    likes.set(v.id, { liked: v.isLiked === true, count: v.likeCount ?? 0 });
  return {
    ...v,
    gid: `comment-${v.id}`,
    revisionId: null,
    kind: v.rootId ? "REPLY" : "ROOT",
    rootCommentGid: v.rootId ? `comment-${v.rootId}` : null,
    replyToGid: null,
    authorName: v.author?.displayName ?? null,
    likesCount: v.likeCount ?? 0,
    createdAt: iso(v.createdAt),
    images: (v.pictureUrls ?? []).map((url: string, slot: number) => ({
      slot,
      url,
      expiresInSeconds: null,
    })),
  };
}

const caseTarget = (t: Json | null | undefined) =>
  t
    ? {
        type:
          t.type ??
          (
            {
              foods: "FOOD",
              restaurant: "RESTAURANT",
              restaurants: "RESTAURANT",
              comments: "COMMENT",
              users: "USER",
            } as Json
          )[t.domain] ??
          t.domain,
        id: t.id,
      }
    : null;
const caseView = (v: Json) => ({
  ...v,
  gid: `case-${v.id}`,
  target: caseTarget(v.target),
});
const accepted = (v: Json) => ({ ...v, gid: `case-${v.id}` });

function card(v: Json) {
  return {
    ...v,
    id: String(v.id),
    target: v.target ? { ...v.target, gid: null, unavailable: false } : null,
    actors: (v.actors ?? []).map((a: Json) => ({
      ...a,
      gid: null,
      name: a.displayName ?? null,
    })),
    data: {
      schema: 1,
      kind: v.kind,
      target: v.target,
      day: v.day,
      memberCount: v.memberCount,
      detail: v.data ?? null,
    },
  };
}

function legacyNotification(v: Json) {
  const actor = v.actors?.[0];
  return {
    id: v.id,
    actorId: actor?.id ?? null,
    actorName: actor?.displayName ?? null,
    actorAvatar: actor?.avatar ?? null,
    type: v.kind,
    targetType: v.target?.domain ?? null,
    targetId: v.target?.id ?? null,
    data: v.data == null ? null : JSON.stringify(v.data),
    read: !v.unreadMemberCount,
    createdAt: v.latestAt,
  };
}

function me(v: Json | null) {
  if (!v) return v;
  return {
    level: null,
    totalExperience: null,
    banned: false,
    banReason: null,
    bannedAt: null,
    banUntil: null,
    hometownProvinceId: null,
    hometownCityId: null,
    ...v,
  };
}

function announcementOut(v: Json) {
  return {
    ...v,
    startsAt: iso(v.startsAt),
    endsAt: iso(v.endsAt),
    createdAt: iso(v.createdAt),
    updatedAt: iso(v.updatedAt),
  };
}
function announcementIn(body: Json) {
  return {
    ...body,
    startsAt: millis(body.startsAt),
    endsAt: millis(body.endsAt),
    notifyUsers: body.notifyUsers ?? false,
  };
}
const settingsOut = (v: Json | null) =>
  v && {
    ...v,
    updatedAt: iso(v.updatedAt),
    maintenance: v.maintenance && {
      ...v.maintenance,
      until: iso(v.maintenance.until),
    },
  };
const versionOut = (v: Json) => ({ ...v, updatedAt: iso(v.updatedAt) });

// ------------------------------------------------------------ requests

function foodBody(body: Json, create: boolean) {
  // v2 keeps one fixed set of taste tags; personal tags with the same name
  // carry over, other personal tags have nowhere to go.
  const named = [
    ...(Array.isArray(body.systemTagIds) ? body.systemTagIds.map(tagName) : []),
    ...(Array.isArray(body.myCustomTagNames) ? body.myCustomTagNames : []),
  ].filter((name) => TASTE_TAGS.includes(name));
  const tags =
    Array.isArray(body.systemTagIds) || Array.isArray(body.myCustomTagNames)
      ? [...new Set(named)].slice(0, 3)
      : undefined;
  return {
    ...(create ? { restaurantId: body.restaurantId } : {}),
    name: body.name,
    category: toV2Category(body.category),
    price: body.price ?? null,
    description: body.description ?? (create ? "" : undefined),
    pictures: keys(body.pictureUrl),
    ...(tags ? { tags } : create ? { tags: [] } : {}),
    ...(typeof body.signature === "boolean"
      ? { signature: body.signature }
      : create
        ? { signature: false }
        : {}),
  };
}
function restaurantBody(body: Json, current?: Json | null) {
  return {
    name: body.name,
    address: body.address,
    gcjLng: body.gcjLng,
    gcjLat: body.gcjLat,
    poi: body.POI ?? body.poi ?? current?.poi ?? null,
    picture: keys(body.pictureUrl)?.[0] ?? (current ? undefined : null),
    ...(body.permanentlyClosed === undefined
      ? {}
      : { permanentlyClosed: body.permanentlyClosed }),
    kind: current?.kind ?? "food",
    mealTimes: current?.mealTimes ?? ["lunch", "dinner"],
    priceBand: current?.priceBand ?? "FROM_15_TO_30",
    categories: current?.categories ?? [],
    tags: current?.tags ?? [],
    deliveryEnabled: current?.deliveryEnabled ?? false,
  };
}
const created = (v: Json | null) => ({
  id: v?.id,
  moderationStatus: null,
  revisionId: v?.revisionId ?? null,
});
function foodQuery(query: Query) {
  const q: Query = omit(query, ["restaurantId", "keyword", "page", "pageSize"]);
  if (typeof query.category === "string")
    q.category = toV2Category(query.category);
  if (query.sort === "NEWEST") q.sort = "NEWEST";
  return q;
}

/**
 * v2 merges several old categories (e.g. drink and dessert). When the old page
 * asked for one of them, label the matching dishes with the category it asked
 * for, because the pages filter the reply by that exact value again.
 */
function asCategory(dish: Json, asked: unknown) {
  return typeof asked === "string" &&
    asked &&
    toV2Category(asked) === dish.categoryLabel
    ? { ...dish, category: asked }
    : dish;
}

// ------------------------------------------------------------ routes

const pass: Handler = ({ match, options, call }) =>
  call(match.input!, { ...options });
const empty: Handler = async () => emptyPage();
const emptyList: Handler = async () => [];
const nothing: Handler = async () => null;
const gone =
  (feature?: string): Handler =>
  async () =>
    retired(feature);

const routes: [string, RegExp, Handler][] = [
  // ---- account & auth
  [
    "POST",
    /^\/auth\/login$/,
    ({ body, call, options }) =>
      withLoginConsent(call, body.policyVersion, (policyVersion) =>
        loginWithCaptcha(
          call,
          "/auth/login",
          {
            userName: body.userName ?? body.username,
            password: body.password,
            device: body.device ?? "WEB",
            policyVersion,
          },
          options,
        ),
      ),
  ],
  [
    "POST",
    /^\/auth\/register$/,
    ({ body, call, options }) =>
      withLoginConsent(
        call,
        body.policyVersion ?? body.consentPolicyVersion,
        (policyVersion) =>
          call("/auth/register", {
            ...options,
            body: {
              userName: body.userName ?? body.username,
              password: body.password,
              device: body.device ?? "WEB",
              policyVersion,
            },
          }),
      ),
  ],
  [
    "POST",
    /^\/auth\/phone\/login$/,
    async ({ body, call, options }) => ({
      ...(await withLoginConsent(
        call,
        body.policyVersion ?? body.consentPolicyVersion,
        (policyVersion) =>
          call("/auth/phone/login", {
            ...options,
            body: {
              mobile: body.mobile,
              code: body.code,
              device: body.device ?? "WEB",
              policyVersion,
            },
          }),
      )),
      newUser: false,
    }),
  ],
  [
    "POST",
    /^\/auth\/getCode$/,
    ({ query, call, options }) =>
      call("/auth/phone/code", {
        ...options,
        query: undefined,
        body: { mobile: query.mobile },
      }),
  ],
  [
    "POST",
    /^\/auth\/checkUsername$/,
    ({ query, body, call, options }) =>
      call("/auth/checkUsername", {
        ...options,
        query: undefined,
        body: { userName: body.userName ?? query.userName ?? query.username },
      }),
  ],
  [
    "POST",
    /^\/auth\/username\/set$/,
    async ({ body, call, options }) => {
      const userName = body.userName ?? body.username;
      await call("/auth/username/set", {
        ...options,
        body: { userName, code: body.code, newPassword: body.newPassword },
      });
      const user = await call("/user/info", { method: "GET" });
      return {
        userName,
        hasUsername: true,
        hasPassword: user?.hasPassword ?? !!body.newPassword,
        reauthenticationRequired: false,
      };
    },
  ],
  [
    "GET",
    /^\/auth\/verify$/,
    async ({ call }) => {
      const v = await call("/auth/verify");
      return v?.verified && v.method ? [`verify:${v.method}`] : [];
    },
  ],
  [
    "GET",
    /^\/auth\/sendEmail$/,
    ({ query, call, options }) =>
      call("/auth/sendEmail", {
        ...options,
        method: "POST",
        query: undefined,
        body: { email: query.email },
      }),
  ],
  [
    "GET",
    /^\/auth\/verifyEmail$/,
    ({ query, call, options }) =>
      call("/auth/verifyEmail", {
        ...options,
        method: "POST",
        query: undefined,
        body: { token: query.token },
      }),
  ],
  [
    "GET",
    /^\/auth\/consent$/,
    async ({ call }) => {
      const v = await call("/auth/consent");
      return {
        status: v?.required ? "NOT_GRANTED" : "GRANTED",
        identityReady: true,
        policyVersion: v?.agreedVersion ?? v?.currentVersion ?? null,
      };
    },
  ],
  [
    "GET",
    /^\/auth\/consent\/policy$/,
    async ({ call, options }) => {
      const v = await call("/auth/consent/policy", options);
      return { ...v, url: "/#/data-notice" };
    },
  ],
  [
    "POST",
    /^\/auth\/consent\/grant$/,
    async ({ body, call }) => {
      const v = await call("/auth/consent/grant", {
        body: { policyVersion: body.policyVersion },
      });
      return {
        status: "GRANTED",
        identityReady: true,
        policyVersion: v?.agreedVersion ?? body.policyVersion,
      };
    },
  ],
  [
    "POST",
    /^\/auth\/consent\/(withdraw|withdraw-with-password|offer-with-password)$/,
    gone("撤回或补充授权"),
  ],
  ["POST", /^\/auth\/password-conflict\//, gone("账号冲突找回")],
  ["GET", /^\/auth\/security\/account-reviews$/, emptyList],
  ["POST", /^\/auth\/security\//, gone("账号安全审核")],
  [
    "POST",
    /^\/auth\/sessions\/revoke-others$/,
    async ({ body, call }) => {
      await call("/auth/sessions/revoke-others", { method: "POST" });
      return { commandId: body.commandId ?? null, status: "COMPLETED" };
    },
  ],
  [
    "DELETE",
    /^\/auth\/sessions\/([^/]+)$/,
    async ({ match, call }) => {
      await call(match.input!, { method: "DELETE" });
      return { commandId: null, status: "COMPLETED" };
    },
  ],
  [
    "POST",
    /^\/auth\/sessions\/[^/]+\/(status|resume)$/,
    async () => ({
      commandId: null,
      status: "COMPLETED",
    }),
  ],
  ["GET", /^\/user\/info$/, async ({ call }) => me(await call("/user/info"))],
  [
    "PUT",
    /^\/user\/updateInfo$/,
    ({ body, call }) =>
      call("/user/updateInfo", {
        body: {
          displayName: body.displayName,
          avatar: pictureKey(body.avatar) ?? body.avatar,
          gender: body.gender,
          birthday: body.birthday,
          signature: body.signature,
        },
      }),
  ],
  [
    "GET",
    /^\/user\/userInfo$/,
    async ({ query, call }) => {
      const [v, dishes] = await Promise.all([
        call("/user/userInfo", { query }),
        call(`/foods/by-user/${Number(query.userId)}`, {
          query: { page: 1, pageSize: 1 },
        }).catch(() => null),
      ]);
      return (
        v && {
          level: null,
          earnedLikes: null,
          uploadedRestaurantsCount: null,
          uploadedFoodsCount: dishes?.totalItems ?? null,
          ...v,
        }
      );
    },
  ],
  [
    "POST",
    /^\/user\/getCode$/,
    ({ body, call, options }) =>
      call("/user/getCode", { ...options, body: { mobile: body.mobile } }),
  ],
  [
    "POST",
    /^\/user\/ban\/(\d+)$/,
    ({ match, call }) => call(match.input!, { method: "POST" }),
  ],
  [
    "PUT",
    /^\/user\/blocks\/(\d+)$/,
    async ({ match, call }) => {
      await call(match.input!, { method: "PUT" });
      return { blocked: true };
    },
  ],
  [
    "DELETE",
    /^\/user\/blocks\/(\d+)$/,
    async ({ match, call }) => {
      await call(match.input!, { method: "DELETE" });
      return { blocked: false };
    },
  ],
  [
    "GET",
    /^\/user\/list$/,
    async ({ query, call }) =>
      page(await call("/user/list", { query }), (u: Json) => ({
        ...u,
        verifiedEmail: null,
        updatedAt: u.createdAt,
        accountStatus: {
          accountStatus: u.banned ? "BANNED" : "NORMAL",
          bannedAt: null,
          banReason: null,
          banExpireAt: null,
        },
      })),
  ],
  [
    "GET",
    /^\/user\/recommendation-profile\/preferences$/,
    ({ call }) => call("/user/recommendation-profile/preferences"),
  ],
  [
    "PUT",
    /^\/user\/recommendation-profile\/preferences$/,
    async ({ body, call }) => {
      const current = await call("/user/recommendation-profile/preferences", {
        method: "GET",
      });
      return call("/user/recommendation-profile/preferences", {
        method: "PUT",
        body: {
          likedCategories: current?.likedCategories ?? [],
          priceBand: current?.priceBand,
          maxDistance: current?.maxDistance,
          likedTags: body.likedTags ?? [],
          dislikedTags: body.dislikedTags ?? [],
        },
      });
    },
  ],
  [
    "DELETE",
    /^\/user\/recommendation-profile\/preferences$/,
    async ({ call }) => {
      await call("/user/recommendation-profile/preferences", {
        method: "DELETE",
      });
      return { likedTags: [], dislikedTags: [], updatedAt: Date.now() };
    },
  ],
  [
    "GET",
    /^\/user\/recommendation-settings$/,
    async () => ({ personalized: true }),
  ],
  ["PUT", /^\/user\/recommendation-settings$/, gone("关闭个性化推荐")],
  ["POST", /^\/user\/activity$/, async () => null],
  ["GET", /^\/user\/growth(\/ledger)?$/, gone("等级与经验")],
  ["POST", /^\/user\/cancellation/, gone("注销账号")],
  [".*", /^\/user\/mobile\/commands/, gone("此版本的换绑手机号流程")],
  ["GET", /^\/api\/location\//, emptyList],

  // ---- dishes
  [
    "GET",
    /^\/foods\/detail\/(\d+)$/,
    async ({ match, call }) => {
      const dish = food(await call(match.input!));
      // v2 dishes carry only the poster's id; the old page shows their name.
      if (dish?.accountId) {
        const author = await call("/user/userInfo", {
          query: { userId: dish.accountId },
        }).catch(() => null);
        if (author?.displayName)
          dish.user = { id: dish.accountId, displayName: author.displayName };
      }
      return dish;
    },
  ],
  [
    "GET",
    /^\/foods\/(list|favorites|my)$/,
    async ({ match, query, call }) =>
      page(
        await call(match.input!, {
          query:
            match[1] === "list"
              ? foodQuery(query)
              : omit(query, ["page", "pageSize"]),
        }),
        (dish: Json) =>
          match[1] === "list"
            ? asCategory(food(dish)!, query.category)
            : food(dish),
      ),
  ],
  [
    "GET",
    /^\/foods\/by-user\/(\d+)$/,
    async ({ match, query, call }) =>
      page(
        await call(match.input!, { query: omit(query, ["page", "pageSize"]) }),
        food,
      ),
  ],
  [
    "GET",
    /^\/foods\/recommend$/,
    async ({ query, call }) => {
      const size = Number(query.size ?? 8);
      // A category tab lists dishes of that category. It must not call
      // /recommend: v2 marks every shop it returns as seen for today, so an
      // extra call would use up the next batch of the main recommendation.
      if (typeof query.category === "string" && query.category) {
        const list = await call("/foods/list", {
          query: {
            category: toV2Category(query.category),
            page: 1,
            pageSize: Math.max(size, 20),
          },
        });
        return (list?.items ?? [])
          .slice(0, size)
          .map((dish: Json) => asCategory(food(dish)!, query.category));
      }
      const [feed, latest] = await Promise.all([
        call("/recommend", {
          query: omit(query, ["campusId", "mealTime"]),
        }).catch(() => null),
        call("/foods/list", { query: { page: 1, pageSize: 50 } }),
      ]);
      const known = new Map<number, Json>(
        (latest?.items ?? []).map((dish: Json) => [dish.id, dish]),
      );
      const items: Json[] = [];
      // Signature dishes of the recommended shops come first, then new dishes.
      for (const shop of feed?.items ?? [])
        for (const dish of shop.signatureFoods ?? [])
          items.push(
            food({
              category: "特色",
              tags: [],
              likeCount: 0,
              ...known.get(dish.id),
              id: dish.id,
              name: dish.name,
              price: dish.price,
              pictureUrls: dish.pictureUrl
                ? [dish.pictureUrl]
                : (known.get(dish.id)?.pictureUrls ?? []),
              restaurantId: shop.id,
              restaurantName: shop.name,
              restaurantAddress: shop.address,
              restaurantGcjLng: shop.gcjLng,
              restaurantGcjLat: shop.gcjLat,
              hubId: shop.hubId,
              hubName: shop.hubName,
              distanceMeters: shop.distanceMeters,
            })!,
          );
      for (const dish of known.values())
        if (items.length < size && !items.some((item) => item.id === dish.id))
          items.push(food(dish)!);
      return items.slice(0, size);
    },
  ],
  [
    "POST",
    /^\/foods\/upload$/,
    async ({ body, call }) =>
      created(await call("/foods/upload", { body: foodBody(body, true) })),
  ],
  [
    "PUT",
    /^\/foods\/(?:edit|my)\/(\d+)$/,
    async ({ match, body, call }) =>
      created(
        await call(`/foods/edit/${match[1]}`, {
          method: "PUT",
          body: foodBody(body, false),
        }),
      ),
  ],
  [
    "DELETE",
    /^\/foods\/(?:delete|my)\/(\d+)$/,
    ({ match, call }) =>
      call(`/foods/delete/${match[1]}`, { method: "DELETE" }),
  ],
  ["POST", /^\/foods\/(\d+)\/(like|unlike|favorite|unfavorite)$/, pass],
  [
    "GET",
    /^\/foods\/tags\/system$/,
    async () => TASTE_TAGS.map((name, i) => ({ id: i + 1, name })),
  ],
  [
    "GET",
    /^\/foods\/(\d+)\/tags$/,
    async ({ match, call }) => {
      const dish = food(await call(`/foods/detail/${match[1]}`));
      return { systemTags: dish?.systemTags ?? [], myCustomTags: [] };
    },
  ],
  ["GET", /^\/foods\/tags\/my(\/\d+\/foods)?$/, empty],
  [".*", /^\/foods\/(tags\/my\/|\d+\/tags\/)/, gone("个人标签")],

  // ---- comments
  [
    "GET",
    /^\/foods\/(\d+)\/comments$/,
    async ({ match, query, call }) =>
      page(
        await call(match.input!, {
          query: {
            ...omit(query, ["page", "pageSize"]),
            sort: query.sort === "NEWEST" ? "NEWEST" : undefined,
          },
        }),
        comment,
      ),
  ],
  [
    "GET",
    /^\/comments\/(\d+)\/replies$/,
    async ({ match, query, call }) =>
      page(await call(match.input!, { query }), comment),
  ],
  [
    "POST",
    /^\/foods\/(\d+)\/comments(\/(\d+)\/replies)?$/,
    async ({ match, body, call }) => {
      const v = await call(match.input!, {
        method: "POST",
        body: match[2]
          ? { text: body.text, replyToId: body.replyToId }
          : { text: body.text, pictureKeys: body.pictureKeys ?? [] },
      });
      return {
        id: v?.id,
        commentGid: `comment-${v?.id}`,
        revisionId: null,
        moderationStatus: "APPROVED",
      };
    },
  ],
  [
    "GET",
    /^\/foods\/(\d+)\/gallery$/,
    async ({ match, query, call }) =>
      page(await call(match.input!, { query }), (p: Json) => ({
        commentId: p.commentId,
        commentGid: `comment-${p.commentId}`,
        createdAt: iso(p.createdAt),
        image: { slot: p.slot, url: p.url, expiresInSeconds: null },
      })),
  ],
  [
    "GET",
    /^\/comments\/(\d+)\/like$/,
    async ({ match }) => {
      const id = Number(match[1]);
      const state = likes.get(id);
      return {
        commentId: id,
        liked: state?.liked ?? false,
        likesCount: state?.count ?? 0,
        authorLikesCount: null,
      };
    },
  ],
  [
    "(PUT|DELETE)",
    /^\/comments\/(\d+)\/like$/,
    async ({ match, options, call }) => {
      const id = Number(match[1]);
      const liked = options.method === "PUT";
      await call(match.input!, { method: options.method });
      const before = likes.get(id) ?? { liked: !liked, count: 0 };
      const count = Math.max(
        0,
        before.count + (before.liked === liked ? 0 : liked ? 1 : -1),
      );
      likes.set(id, { liked, count });
      return {
        commentId: id,
        liked,
        likesCount: count,
        authorLikesCount: null,
      };
    },
  ],
  [
    "DELETE",
    /^\/comments\/(\d+)$/,
    async ({ match, call }) => {
      await call(match.input!, { method: "DELETE" });
      return {
        id: Number(match[1]),
        gid: `comment-${match[1]}`,
        deletionId: null,
        state: "DELETED",
      };
    },
  ],
  ["GET", /^\/(comments\/submissions|moderation\/submissions)\/my$/, empty],
  ["GET", /^\/admin\/(comments\/moderation|moderation)\/queue$/, empty],
  [".*", /^\/(admin\/)?(comments\/)?moderation\//, gone("内容审核")],

  // ---- shops, hubs, history
  [
    "GET",
    /^\/restaurant\/detail\/(\d+)$/,
    async ({ match, call }) => {
      const [shop, menu, signatures] = await Promise.all([
        call(match.input!),
        call("/foods/list", {
          query: { restaurantId: Number(match[1]), page: 1, pageSize: 100 },
        }).catch(() => null),
        call("/foods/list", {
          query: {
            restaurantId: Number(match[1]),
            signatureOnly: true,
            page: 1,
            pageSize: 6,
          },
        }).catch(() => null),
      ]);
      const prices: number[] = (menu?.items ?? [])
        .map((f: Json) => f.price)
        .filter((p: unknown): p is number => typeof p === "number")
        .sort((a: number, b: number) => a - b);
      const mid = prices.length >> 1;
      return restaurant({
        ...shop,
        visibleFoodCount: menu?.totalItems ?? null,
        medianPrice: prices.length
          ? prices.length % 2
            ? prices[mid]
            : (prices[mid - 1] + prices[mid]) / 2
          : null,
        signatureFoods: (signatures?.items ?? []).map((f: Json) => ({
          id: f.id,
          name: f.name,
          price: f.price,
          pictureUrl: f.pictureUrls?.[0] ?? null,
          likeCount: f.likeCount,
        })),
      });
    },
  ],
  [
    "GET",
    /^\/restaurant\/(list|browse|search|favorites)$/,
    async ({ match, query, call }) => {
      const q = { ...query };
      if (Array.isArray(q.categories)) delete q.categories;
      if (q.sort === "FOOD_COUNT" || q.sort === "RECOMMENDATION_RATE")
        delete q.sort;
      return page(await call(match.input!, { query: q }), restaurant);
    },
  ],
  [
    "POST",
    /^\/restaurant\/add$/,
    async ({ body, call }) =>
      created(await call("/restaurant/add", { body: restaurantBody(body) })),
  ],
  [
    "PUT",
    /^\/restaurant\/edit\/(\d+)$/,
    async ({ match, body, call }) => {
      const current = await call(`/restaurant/detail/${match[1]}`);
      return created(
        await call(match.input!, {
          method: "PUT",
          body: restaurantBody(body, current),
        }),
      );
    },
  ],
  [
    "PUT",
    /^\/restaurant\/(\d+)\/rating$/,
    async ({ match, body, call }) => {
      const v = await call(match.input!, {
        method: "PUT",
        body: {
          scene: "dine_in",
          rating:
            body.rating === "RECOMMEND" || body.rating === "GOOD"
              ? "RECOMMEND"
              : "NOT_RECOMMEND",
        },
      });
      return { rating: rating(v?.dineIn) };
    },
  ],
  [
    "DELETE",
    /^\/restaurant\/(\d+)\/rating$/,
    async ({ match, call }) => {
      const v = await call(match.input!, {
        method: "DELETE",
        query: { scene: "dine_in" },
      });
      return { rating: rating(v?.dineIn) };
    },
  ],
  [
    "GET",
    /^\/hub\/list$/,
    async ({ query, call }) => page(await call("/hub/list", { query }), hub),
  ],
  [
    "GET",
    /^\/hub\/(detail\/\d+|locate)$/,
    async ({ match, query, call }) => hub(await call(match.input!, { query })),
  ],
  [
    "POST",
    /^\/hub\/add$/,
    async ({ body, call }) => {
      await call("/hub/add", { body });
      return null;
    },
  ],
  ["POST", /^\/hub\/rebind-restaurants\/\d+$/, gone("重新归属店铺")],
  [
    "GET",
    /^\/history\/browse$/,
    async ({ query, call }) =>
      page(await call("/history/browse", { query }), (item: Json) => ({
        ...item,
        restaurant: item.restaurant
          ? {
              ...item.restaurant,
              pictureUrl: item.restaurant.pictureUrl
                ? [item.restaurant.pictureUrl]
                : [],
            }
          : null,
        food: item.food
          ? {
              ...item.food,
              pictureUrl: item.food.pictureUrls ?? [],
              likesCount: item.food.likeCount ?? 0,
            }
          : null,
      })),
  ],

  // ---- notifications & push
  [
    "GET",
    /^\/notification\/cards$/,
    async ({ query, call }) =>
      page(
        await call("/notification/cards", {
          query: {
            ...query,
            column:
              query.column === "INTERACTION"
                ? "LIKES_AND_FAVORITES"
                : query.column,
          },
        }),
        card,
      ),
  ],
  [
    "GET",
    /^\/notification\/cards\/unread\/count$/,
    ({ query, call }) =>
      call("/notification/cards/unread/count", {
        query: {
          column:
            query.column === "INTERACTION"
              ? "LIKES_AND_FAVORITES"
              : query.column,
        },
      }),
  ],
  [
    "GET",
    /^\/notification\/list$/,
    async ({ query, call }) =>
      page(await call("/notification/cards", { query }), legacyNotification),
  ],
  [
    "GET",
    /^\/notification\/unread\/count$/,
    async ({ call }) =>
      (await call("/notification/cards/unread/count"))?.members ?? 0,
  ],
  [
    "POST",
    /^\/notification\/read\/all$/,
    ({ call }) => call("/notification/cards/read-all", { method: "POST" }),
  ],
  [
    "POST",
    /^\/notification\/read\/(\d+)$/,
    ({ match, call }) =>
      call(`/notification/cards/${match[1]}/read`, { method: "POST" }),
  ],
  [
    "GET",
    /^\/push\/settings$/,
    async ({ call }) => {
      const v = await call("/push/settings");
      return Object.entries(v?.categories ?? {}).map(([category, enabled]) => ({
        category,
        enabled,
        revision: 0,
        closeFrontier: null,
      }));
    },
  ],
  [
    "POST",
    /^\/push\/settings\/(enable|disable)$/,
    async ({ match, body, query, call }) => {
      await call(match.input!, {
        method: "POST",
        body: { category: body.category ?? query.category },
      });
      return { commandId: null, state: "COMPLETED" };
    },
  ],
  [".*", /^\/push\//, gone("网页推送")],

  // ---- feedback
  [
    "POST",
    /^\/feedback\/(reports|messages|catalog-errors)$/,
    async ({ match, body, call }) =>
      accepted(await call(match.input!, { method: "POST", body })),
  ],
  [
    "GET",
    /^\/feedback\/mine$/,
    async ({ query, call }) =>
      page(await call("/feedback/mine", { query }), caseView),
  ],
  [
    "GET",
    /^\/feedback\/mine\/(\d+)$/,
    async ({ match, call }) => caseView(await call(match.input!)),
  ],

  // ---- admin
  [
    "GET",
    /^\/admin\/summary$/,
    async ({ call }) => {
      const total = (path: string) =>
        call(path, { query: { page: 1, pageSize: 1 } })
          .then((p) => p?.totalItems ?? null)
          .catch(() => null);
      const [summary, totalFoods, totalRestaurants] = await Promise.all([
        call("/admin/summary"),
        total("/foods/list"),
        total("/restaurant/list"),
      ]);
      return {
        ...summary,
        // APIv7 sent the share with at most 4 decimals.
        verifiedRate:
          typeof summary?.verifiedRate === "number"
            ? Math.round(summary.verifiedRate * 10000) / 10000
            : null,
        totalFoods,
        totalRestaurants,
        todayFoods: null,
        todayRestaurants: null,
      };
    },
  ],
  [
    "GET",
    /^\/admin\/feedback\/cases$/,
    async ({ query, call }) =>
      page(await call("/admin/feedback/cases", { query }), (c: Json) => ({
        ...c,
        view: caseView(c.view ?? {}),
        actions: [],
      })),
  ],
  [
    "GET",
    /^\/admin\/feedback\/cases\/(\d+)$/,
    async ({ match, call }) => {
      const c = await call(match.input!);
      return c && { ...c, view: caseView(c.view ?? {}), actions: [] };
    },
  ],
  [
    "POST",
    /^\/admin\/feedback\/cases\/(\d+)\/resolution$/,
    async ({ match, body, call }) => ({
      decisionId: null,
      ...(await call(match.input!, { method: "POST", body })),
    }),
  ],
  [
    "GET",
    /^\/admin\/remote-config$/,
    async ({ call }) => {
      const v = await call("/admin/remote-config");
      return (
        v && {
          ...v,
          siteMode: "single",
          settings: settingsOut(v.settings),
          versions: (v.versions ?? []).map(versionOut),
        }
      );
    },
  ],
  [
    "PUT",
    /^\/admin\/remote-config\/settings$/,
    async ({ body, call }) =>
      settingsOut(
        await call("/admin/remote-config/settings", {
          method: "PUT",
          body: {
            ...body,
            params: body.params ?? {},
            maintenance: body.maintenance && {
              ...body.maintenance,
              until: millis(body.maintenance.until),
            },
          },
        }),
      ),
  ],
  [
    "PUT",
    /^\/admin\/remote-config\/versions\/[^/]+$/,
    async ({ match, body, call }) =>
      versionOut(await call(match.input!, { method: "PUT", body })),
  ],
  [
    "GET",
    /^\/admin\/remote-config\/announcements$/,
    async ({ query, call }) =>
      page(
        await call("/admin/remote-config/announcements", { query }),
        announcementOut,
      ),
  ],
  [
    "(POST|PUT)",
    /^\/admin\/remote-config\/announcements(\/\d+)?$/,
    async ({ match, options, body, call }) =>
      announcementOut(
        await call(match.input!, {
          method: options.method,
          body: announcementIn(body),
        }),
      ),
  ],
  [
    "GET",
    /^\/admin\/remote-config\/audit$/,
    async ({ query, call }) =>
      page(await call("/admin/remote-config/audit", { query }), (a: Json) => ({
        ...a,
        occurredAt: iso(a.occurredAt),
      })),
  ],
  [
    "GET",
    /^\/admin\/food-tags$/,
    async () => ({
      currentPage: 1,
      totalPages: 1,
      totalItems: TASTE_TAGS.length,
      hasNext: false,
      items: TASTE_TAGS.map((name, i) => ({
        id: i + 1,
        name,
        usageCount: null,
      })),
    }),
  ],
  [".*", /^\/admin\/food-tags/, gone("编辑系统标签（口味标签由后端固定）")],
  ["GET", /^\/admin\/sync\//, emptyList],
  [".*", /^\/admin\/sync\//, gone("跨站同步")],
  [
    "GET",
    /^\/admin\/consent\/policy$/,
    async ({ call }) => {
      const list = await call("/admin/consent/policies", {
        query: { page: 1, pageSize: 1 },
      });
      const latest = list?.items?.[0];
      return latest
        ? { ...latest, url: "/#/data-notice", updatedAt: latest.publishedAt }
        : null;
    },
  ],
  [
    "PUT",
    /^\/admin\/consent\/policy$/,
    async ({ body, call }) =>
      call("/admin/consent/policies", {
        method: "POST",
        body: {
          version: body.version,
          privacyText: body.privacyText ?? body.text ?? "",
          crossBorderText: body.crossBorderText ?? "",
        },
      }),
  ],
  ["GET", /^\/topics\/current$/, nothing],
  ["GET", /^\/topics\/by-food\/\d+$/, emptyList],
  ["GET", /^\/topics\/history$/, empty],
  [".*", /^\/(admin\/)?topics(\/|$)/, gone("专题")],
  [".*", /^\/(admin\/)?activit(y|ies)(\/|$)/, gone("活动")],
  [".*", /^\/telemetry\/consent$/, async () => ({ granted: false })],
];

const CONSENT_CODES = ["20005", "20009"];
const currentPolicy = (call: Call) =>
  call("/auth/consent/policy", {
    method: "GET",
    public: true,
    cache: "no-store",
  });

/** Sign-in asks for the current policy version when it was never agreed. */
async function withLoginConsent<T>(
  call: Call,
  given: string | undefined,
  send: (policyVersion?: string) => Promise<T>,
): Promise<T> {
  // A token is a signed-in session; the old pages also check isLogin.
  const session = (v: any) =>
    v && typeof v === "object" && v.tokenValue ? { isLogin: true, ...v } : v;
  try {
    return session(await send(given));
  } catch (error) {
    if (
      !(error instanceof ApiError) ||
      !CONSENT_CODES.includes(String(error.code))
    )
      throw error;
    const policy = await currentPolicy(call);
    const { askPolicyConsent } = await import("../app/policy-consent");
    if (!policy?.version || !(await askPolicyConsent(policy, "login")))
      throw new ApiError("需要先同意隐私政策才能登录。", "POLICY_DECLINED");
    return session(await send(policy.version));
  }
}

async function loginWithCaptcha(
  call: Call,
  path: string,
  body: Json,
  options: RequestOptions,
) {
  try {
    return await call(path, { ...options, method: "POST", body });
  } catch (error) {
    if (!(error instanceof ApiError) || String(error.code) !== "30015")
      throw error;
    const { runBrowserCaptcha } = await import("./captcha");
    let result: unknown;
    await runBrowserCaptcha(
      (signal) =>
        call("/auth/captcha/config", {
          method: "GET",
          public: true,
          cache: "no-store",
          signal,
        }),
      async (headers, signal) => {
        result = await call(path, {
          ...options,
          method: "POST",
          body,
          headers,
          signal,
        });
      },
      options.signal,
    );
    return result;
  }
}

/** Wrap the live v2 transport so the APIv7 pages can talk to it unchanged. */
export function bridgeToV2(live: Transport): Transport {
  const call: Call = async (path, options = {}) => {
    // Omitted fields mean "unchanged" in v2; never send explicit undefineds.
    const body =
      options.body &&
      typeof options.body === "object" &&
      !Array.isArray(options.body)
        ? Object.fromEntries(
            Object.entries(options.body).filter(([, v]) => v !== undefined),
          )
        : options.body;
    const reply = await live(path, { ...options, body, raw: undefined });
    if (String(reply.code) !== "0")
      throw new ApiError(
        reply.msg || "操作未完成，请稍后重试。",
        reply.code,
        undefined,
        reply.data,
      );
    return reply.data;
  };
  return async (path, options) => {
    const method = (options.method ?? "GET").toUpperCase();
    const route = routes.find(
      ([m, pattern]) =>
        new RegExp(`^(?:${m})$`).test(method) && pattern.test(path),
    );
    // A handler's extra reads (e.g. the current shop before an edit) are GETs;
    // only the request for the original path keeps the original method.
    const scoped: Call = (p, o = {}) =>
      call(p, {
        method: p === path ? method : "GET",
        public: options.public,
        signal: options.signal,
        cache: options.cache,
        headers: options.headers,
        ...o,
      });
    const run = () =>
      route
        ? route[2]({
            match: path.match(route[1])!,
            options: { ...options, method },
            query: options.query ?? {},
            body: (options.body ?? {}) as Json,
            call: scoped,
            raw: live,
          })
        : // Same path and shape in v2: forward the request as it is.
          scoped(path, { query: options.query, body: options.body });
    try {
      let data: unknown;
      try {
        data = await run();
      } catch (error) {
        // A signed-in person must agree again when the policy changes.
        if (
          !(error instanceof ApiError) ||
          String(error.code) !== "20009" ||
          options.public ||
          /^\/auth\//.test(path)
        )
          throw error;
        const policy = await currentPolicy(scoped);
        const { askPolicyConsent } = await import("../app/policy-consent");
        if (!policy?.version || !(await askPolicyConsent(policy, "update")))
          throw error;
        await scoped("/auth/consent/grant", {
          method: "POST",
          body: { policyVersion: policy.version },
        });
        data = await run();
      }
      return { code: 0, msg: "ok", data: data ?? null, timestamp: Date.now() };
    } catch (error) {
      // Business failures go back as an envelope, as the real service does.
      if (error instanceof ApiError && error.status === undefined)
        return {
          code: error.code ?? -1,
          msg: error.message,
          data: (error.data ?? null) as never,
          timestamp: Date.now(),
        } satisfies Envelope<never>;
      throw error;
    }
  };
}
