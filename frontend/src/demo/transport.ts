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
};
function seed(): State {
  return {
    user: {
      id: 10,
      userName: "天凉被破王",
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
    if (raw?.foods && raw?.user && raw?.restaurants && raw?.privacy) return raw;
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
  let result: unknown = null;
  const foodId = Number(path.match(/^\/foods\/(?:detail\/)?(\d+)/)?.[1]);
  const food = s.foods.find((f) => f.id === foodId);
  if (path === "/auth/login" || path === "/auth/register")
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
      role: persona === "admin" ? "admin" : "user",
      verified: persona !== "unverified",
    };
  } else if (path === "/user/updateInfo") {
    Object.assign(s.user, b);
    save();
  } else if (path === "/user/changePrivacy") {
    Object.assign(s.privacy, b);
    save();
  } else if (path === "/auth/verify") result = ["demo"];
  else if (path === "/api/location/provinces")
    result = [{ id: 1, name: "山东省" }];
  else if (path === "/api/location/provinces/1/cities")
    result = [
      { id: 1, provinceId: 1, name: "济南市" },
      { id: 2, provinceId: 1, name: "青岛市" },
    ];
  else if (path === "/hub/list") result = paginate(s.hubs, q);
  else if (path === "/admin/summary")
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
          role: "admin",
          verified: true,
          accountStatus: {
            accountStatus: s.bannedUsers.includes(10) ? "BANNED" : "NORMAL",
          },
        },
        {
          id: 21,
          userName: "阿圆不想早八",
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
    s.bannedUsers.push(id);
    save();
  } else if (path.startsWith("/user/unban/")) {
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
  else if (path === "/restaurant/search")
    result = paginate(
      s.restaurants.filter((r) =>
        (r.name || "").includes(String(q.keyword ?? "")),
      ),
      q,
    );
  else if (path.startsWith("/restaurant/detail/")) {
    result = s.restaurants.find((r) => r.id === Number(path.split("/").pop()));
    if (!result) throw new ApiError("餐厅不存在。", 404, 404);
    const id = Number(path.split("/").pop());
    // Only a restaurant page visit is a footprint; fetching a dish's address is not.
    if (location.hash?.split("?")[0] === `#/restaurants/${id}`) {
      s.history = [
        { id, time: Date.now(), type: "restaurant" },
        ...s.history.filter(
          (h) => h.id !== id || (h.type ?? "food") !== "restaurant",
        ),
      ];
      save();
    }
  } else if (path === "/restaurant/add") {
    s.restaurants.unshift({ ...b, id: Date.now() } as Restaurant);
    save();
  } else if (path === "/foods/recommend")
    result = s.foods.slice(0, Number(q.limit ?? 10));
  else if (path === "/foods/favorites")
    result = paginate(
      s.foods.filter((f) => f.isFavorite),
      q,
    );
  else if (path === "/foods/my")
    result = paginate(
      s.foods.filter((f) => f.accountId === 10),
      q,
    );
  else if (path === "/foods/list")
    result = paginate(
      s.foods.filter(
        (f) =>
          f.restaurantId === Number(q.restaurantId) &&
          (!q.systemTagIds ||
            f.systemTags?.some((t) =>
              (q.systemTagIds as number[]).includes(t.id!),
            )) &&
          (!q.myCustomTagIds ||
            f.myCustomTags?.some((t) =>
              (q.myCustomTagIds as number[]).includes(t.id!),
            )),
      ),
      q,
    );
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
    s.foods.unshift({
      ...b,
      id: Date.now(),
      accountId: 10,
      uploaderName: s.user.userName,
      restaurantName: r?.name,
      isLiked: false,
      isFavorite: false,
      likesCount: 0,
      createdAt: Date.now(),
    } as Food);
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
    } else throw new ApiError("该操作尚未接入演示。", "DEMO_UNSUPPORTED");
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
      userName: Number(q.userId) === 10 ? s.user.userName : "阿圆不想早八",
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
      s.following.map((id) => ({ id, userName: "阿圆不想早八" })),
      q,
    );
  else
    throw new ApiError(
      "该功能需要连接真实服务，演示模式未发起网络请求。",
      "DEMO_UNSUPPORTED",
    );
  return structuredClone({
    code: 0,
    msg: "success",
    data: result,
    timestamp: Date.now(),
  });
};

export async function demoUpload(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.readAsDataURL(file);
  });
}
