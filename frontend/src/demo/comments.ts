import type { Food, User } from "../api/models";
import { demoDishes } from "../mobile/catalog";

export const DISCUSSION_STORAGE = "eatwhat-demo-comments-v1";
export type Reply = {
  id: string;
  userId: number;
  name: string;
  avatar?: string | null;
  text: string;
  images: string[];
  createdAt: number;
};
export type Comment = Reply & {
  helpful: number;
  liked: boolean;
  replies: Reply[];
};
export type Discussion = {
  foodId: number;
  foodName: string;
  restaurantName: string;
  picture?: string;
  comments: Comment[];
};
function records(): Record<string, Discussion> {
  const raw = localStorage.getItem(DISCUSSION_STORAGE);
  if (!raw) return {};
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("演示评论读取失败，请稍后重试。");
  return data;
}
function seed(food: Food): Comment[] {
  if (
    !demoDishes.some(
      (d) => food.pictureUrl?.[0] === `/prototype/assets/dishes/${d.asset}.svg`,
    )
  )
    return [];
  const now = Date.now(),
    noodles = /螺蛳粉/.test(food.name ?? "");
  const texts = noodles
    ? [
        "汤底够香，酸笋给得很大方。腐竹炸得脆，泡久了也不软。",
        "第一次吃别点特辣，中辣已经很够了。",
        "午饭早点去，刚出锅的时候最好吃，分量也很实在。",
      ]
    : /香锅/.test(food.name ?? "")
      ? [
          "配菜很丰富，麻辣味很足，两个人一起吃刚好。",
          "第一次可以从微辣开始，拌米饭很香。",
          "推荐加一份藕片，脆脆的很入味。",
        ]
      : /饺子|云吞/.test(food.name ?? "")
        ? [
            "皮薄馅足，趁热吃口感最好，汤也很鲜。",
            "一个人吃这一份刚刚好，下次还想再来。",
            "午饭高峰要等一小会儿，建议早点去。",
          ]
        : [
            "刚吃过，分量很实在，推荐趁热吃。",
            "和室友一起点的，味道不错，下次还会来。",
            "饭点稍微需要等一下，早点去更舒服。",
          ];
  return texts.map((text, i) => ({
    id: `seed-${food.id}-${i}`,
    userId: 21 + i,
    name: ["小林", "Momo", "阿圆"][i],
    text,
    images:
      noodles && i === 0
        ? [
            "/prototype/assets/photos/p_luosi.png",
            "/prototype/assets/photos/sq_luosi.png",
          ]
        : [],
    createdAt: now - [172800000, 86400000, 3600000][i],
    helpful: [46, 23, 8][i],
    liked: false,
    replies:
      i === 0
        ? [
            {
              id: `seed-reply-${food.id}-0`,
              userId: 24,
              name: "阿哲",
              text: noodles ? "同意，加个炸蛋更香。" : "同意，热乎乎的最好吃。",
              images: [],
              createdAt: now - 80000000,
            },
            {
              id: `seed-reply-${food.id}-1`,
              userId: 25,
              name: "饭点观察员",
              text: "已经加进下次想吃的清单了。",
              images: [],
              createdAt: now - 72000000,
            },
            {
              id: `seed-reply-${food.id}-2`,
              userId: 26,
              name: "小周",
              text: "谢谢推荐，明天午饭就试试。",
              images: [],
              createdAt: now - 3600000,
            },
          ]
        : [],
  }));
}
export function readDiscussion(food: Food): Discussion {
  const existing = records()[String(food.id)];
  return {
    foodId: food.id!,
    foodName: food.name ?? "这道菜",
    restaurantName: food.restaurantName ?? "餐厅信息待补充",
    picture: food.pictureUrl?.[0],
    comments: existing?.comments ?? seed(food),
  };
}
export function saveDiscussion(discussion: Discussion) {
  try {
    const all = records();
    all[String(discussion.foodId)] = discussion;
    localStorage.setItem(DISCUSSION_STORAGE, JSON.stringify(all));
  } catch {
    throw new Error("当前浏览器无法保存演示评论，请检查存储空间后重试。");
  }
}
export function addMessage(
  discussion: Discussion,
  user: User,
  text: string,
  images: string[],
  parentId?: string,
): Discussion {
  const content = text.trim();
  if (!content || content.length > 500)
    throw new Error("请填写 1–500 个字的用餐感受。");
  if (images.length > 3) throw new Error("每条评论最多添加 3 张图片。");
  if (!user.id) throw new Error("请先登录再评论。");
  const entry: Reply = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: user.userName ?? "同学",
    avatar: user.avatar,
    text: content,
    images,
    createdAt: Date.now(),
  };
  if (parentId) {
    if (!discussion.comments.some((c) => c.id === parentId))
      throw new Error("这条评论已不存在，请刷新后重试。");
    return {
      ...discussion,
      comments: discussion.comments.map((c) =>
        c.id === parentId ? { ...c, replies: [...c.replies, entry] } : c,
      ),
    };
  }
  return {
    ...discussion,
    comments: [
      { ...entry, helpful: 0, liked: false, replies: [] },
      ...discussion.comments,
    ],
  };
}
export function toggleHelpful(discussion: Discussion, id: string): Discussion {
  return {
    ...discussion,
    comments: discussion.comments.map((c) =>
      c.id === id
        ? {
            ...c,
            liked: !c.liked,
            helpful: Math.max(0, c.helpful + (c.liked ? -1 : 1)),
          }
        : c,
    ),
  };
}
export function myCommentEntries(userId: number) {
  return Object.values(records())
    .flatMap((d) =>
      d.comments.flatMap((c) =>
        [c, ...c.replies]
          .filter((entry) => entry.userId === userId)
          .map((entry) => ({
            ...entry,
            foodId: d.foodId,
            foodName: d.foodName,
            restaurantName: d.restaurantName,
            picture: d.picture,
            reply: entry.id !== c.id,
          })),
      ),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}
