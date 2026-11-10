import { ApiError, type RequestOptions } from "../api/client";
import { commentBody } from "../api/comments";
import { mediaUrl, type Food, type User } from "../api/models";

type Row = {
  id: number;
  gid: string;
  revisionId: string;
  foodId: number;
  rootId: number;
  replyToId: number | null;
  authorId: number;
  authorName: string;
  text: string;
  pictureKeys: string[];
  createdAt: string;
  likesCount: number;
  likedBy: number[];
  moderationStatus:
    "PENDING" | "APPROVED" | "REJECTED" | "SUPERSEDED" | "DELETED";
  hidden?: boolean;
  reasonCode: string | null;
};
export type DemoComments = {
  rows: Row[];
  commands: Record<string, { payload: string; result: unknown }>;
  nextId: number;
};
export function seedComments(foods: Food[], user: User): DemoComments {
  const rows: Row[] = [];
  let nextId = 1;
  const add = (
    foodId: number,
    text: string,
    authorId: number,
    authorName: string,
    status: Row["moderationStatus"] = "APPROVED",
    rootId?: number,
    pictures: string[] = [],
  ) => {
    const id = nextId++;
    rows.push({
      id,
      gid: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      foodId,
      rootId: rootId ?? id,
      replyToId: rootId ?? null,
      authorId,
      authorName,
      text,
      pictureKeys: pictures,
      createdAt: new Date(Date.now() - id * 3600000).toISOString(),
      likesCount: status === "APPROVED" ? 8 + id : 0,
      likedBy: [],
      moderationStatus: status,
      reasonCode: status === "REJECTED" ? "请补充与菜品相关的用餐感受" : null,
    });
    return id;
  };
  for (const food of foods) {
    if (!food.id) continue;
    const root = add(
      food.id,
      "分量很实在，趁热吃更好。饭点早点去，能少排一会儿队。",
      21,
      "小林",
      "APPROVED",
      undefined,
      [
        "/prototype/assets/photos/p_luosi.png",
        "/prototype/assets/photos/sq_luosi.png",
      ],
    );
    add(food.id, "和室友一起吃的，味道不错，下次还会来。", 22, "Momo");
    add(food.id, "配一份小菜刚刚好。", 23, "阿圆");
    add(food.id, "同意，刚出锅的时候最好吃。", 24, "阿哲", "APPROVED", root);
  }
  if (foods[0]?.id) {
    add(
      foods[0].id,
      "午饭吃到了，口味很合适。",
      user.id ?? 10,
      user.displayName || "校园食友",
      "PENDING",
    );
    add(
      foods[0].id,
      "这次的分量很足，下次还来。",
      user.id ?? 10,
      user.displayName || "校园食友",
      "APPROVED",
    );
    add(
      foods[0].id,
      "想补充一下之前的感受。",
      user.id ?? 10,
      user.displayName || "校园食友",
      "REJECTED",
    );
  }
  return { rows, commands: {}, nextId };
}
function page<T>(items: T[], q: RequestOptions["query"]) {
  const currentPage = Number(q?.page ?? 1),
    size = Number(q?.pageSize ?? 20);
  if (
    !Number.isInteger(currentPage) ||
    currentPage < 1 ||
    !Number.isInteger(size) ||
    size < 1 ||
    size > 100
  )
    throw new ApiError("分页参数无效。", 40001);
  return {
    items: items.slice((currentPage - 1) * size, currentPage * size),
    currentPage,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / size),
    hasNext: currentPage * size < items.length,
  };
}
const submission = (r: Row) => ({
  id: r.id,
  gid: r.gid,
  revisionId: r.revisionId,
  kind: r.rootId === r.id ? "COMMENT" : "REPLY",
  foodId: r.foodId,
  moderationStatus: r.moderationStatus,
  reasonCode: r.moderationStatus === "REJECTED" ? r.reasonCode : null,
  reasonMessage: r.moderationStatus === "REJECTED" ? r.reasonCode : null,
  text: r.moderationStatus === "DELETED" ? null : r.text,
  imageCount: r.moderationStatus === "DELETED" ? 0 : r.pictureKeys.length,
  createdAt: r.createdAt,
});
const images = (r: Row) =>
  r.pictureKeys.map((key, slot) => ({
    slot,
    url: mediaUrl(key) || key,
    expiresInSeconds: 300,
  }));
function visible(s: DemoComments, r: Row) {
  const root = s.rows.find((row) => row.id === r.rootId);
  return (
    r.moderationStatus === "APPROVED" &&
    !r.hidden &&
    root?.moderationStatus === "APPROVED" &&
    !root.hidden
  );
}
function view(s: DemoComments, r: Row) {
  return {
    id: r.id,
    gid: r.gid,
    revisionId: r.revisionId,
    kind: r.rootId === r.id ? "COMMENT" : "REPLY",
    foodId: r.foodId,
    rootCommentGid: s.rows.find((x) => x.id === r.rootId)!.gid,
    replyToGid: r.replyToId
      ? (s.rows.find((x) => x.id === r.replyToId)?.gid ?? null)
      : null,
    authorName: r.authorName,
    text: r.text,
    likesCount: r.likesCount,
    createdAt: r.createdAt,
    images: images(r),
  };
}
function once(
  s: DemoComments,
  scope: string,
  key: string | undefined,
  payload: unknown,
  run: () => unknown,
) {
  if (!key || !/^[0-9a-f-]{36}$/i.test(key))
    throw new ApiError("缺少有效的操作标识。", 40001);
  const command = `${scope}:${key}`,
    serialized = JSON.stringify(payload),
    previous = s.commands[command];
  if (previous) {
    if (previous.payload !== serialized)
      throw new ApiError(
        "同一操作标识不能提交不同内容。",
        "IDEMPOTENCY_CONFLICT",
        409,
      );
    return previous.result;
  }
  const result = run();
  s.commands[command] = { payload: serialized, result };
  return result;
}
export function isCommentPath(path: string) {
  return (
    /^\/comments(?:\/|$)/.test(path) ||
    /^\/foods\/\d+\/(comments|gallery)(?:\/|$)/.test(path) ||
    path.startsWith("/admin/comments/")
  );
}
export function handleComments(
  s: DemoComments,
  path: string,
  options: RequestOptions,
  actor: { user: User; authenticated: boolean; admin: boolean },
  foods: Food[],
) {
  const method = options.method ?? "GET",
    q = options.query,
    b = (options.body ?? {}) as Record<string, unknown>;
  const userId = actor.user.id ?? 10;
  const login = () => {
    if (!actor.authenticated) throw new ApiError("请先登录。", 20001, 401);
    if (actor.user.banned) throw new ApiError("账号暂时无法操作。", 20004, 403);
  };
  const admin = () => {
    login();
    if (!actor.admin) throw new ApiError("需要管理员身份。", 20004, 403);
  };
  const rowFor = (id: number, publicOnly = false) => {
    const row = s.rows.find((r) => r.id === id);
    if (!row || (publicOnly && !visible(s, row)))
      throw new ApiError("评论已不可见。", 40004, 404);
    return row;
  };
  if (path === "/comments/submissions/my") {
    login();
    return page(
      s.rows
        .filter((r) => r.authorId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(submission),
      q,
    );
  }
  if (path === "/admin/comments/moderation/queue") {
    admin();
    return page(
      s.rows
        .filter((r) => r.moderationStatus !== "DELETED")
        .sort(
          (a, b) =>
            Number(b.moderationStatus === "PENDING") -
              Number(a.moderationStatus === "PENDING") ||
            b.createdAt.localeCompare(a.createdAt),
        )
        .map(submission),
      q,
    );
  }
  if (path === "/admin/comments/moderation/review") {
    admin();
    return once(s, `review:${userId}`, String(b.decisionId ?? ""), b, () => {
      const row = s.rows.find((r) => r.revisionId === b.revisionId);
      if (!row || row.moderationStatus === "DELETED")
        throw new ApiError(
          "提交已不可见，请刷新队列。",
          "REVISION_CONFLICT",
          409,
        );
      switch (b.verdict) {
        case "APPROVE":
        case "RESTORE":
          row.moderationStatus = "APPROVED";
          row.hidden = false;
          row.reasonCode = null;
          break;
        case "REJECT":
          row.moderationStatus = "REJECTED";
          row.reasonCode = String(b.reasonCode || "未通过审核");
          break;
        case "HIDE":
          row.hidden = true;
          break;
        case "DELETE":
          row.moderationStatus = "DELETED";
          break;
        default:
          throw new ApiError("审核结论无效。", 40001);
      }
      return {
        decisionId: b.decisionId,
        revisionId: row.revisionId,
        moderationStatus: row.moderationStatus,
      };
    });
  }
  const foodMatch = path.match(
    /^\/foods\/(\d+)\/(comments|gallery)(?:\/(\d+)\/replies)?$/,
  );
  if (foodMatch) {
    const foodId = Number(foodMatch[1]),
      rootId = Number(foodMatch[3]);
    if (!foods.some((f) => f.id === foodId))
      throw new ApiError("菜品已不可见。", 40004, 404);
    if (method === "GET") {
      const rows = s.rows.filter((r) => r.foodId === foodId && visible(s, r));
      if (foodMatch[2] === "gallery")
        return page(
          rows.flatMap((r) =>
            images(r).map((image) => ({
              commentId: r.id,
              commentGid: r.gid,
              createdAt: r.createdAt,
              image,
            })),
          ),
          q,
        );
      const roots = rows
        .filter((r) => r.rootId === r.id)
        .sort(
          q?.sort === "NEWEST"
            ? (a, b) => b.createdAt.localeCompare(a.createdAt)
            : (a, b) =>
                b.likesCount - a.likesCount ||
                b.createdAt.localeCompare(a.createdAt),
        );
      return page(
        roots.map((r) => view(s, r)),
        q,
      );
    }
    login();
    const body = commentBody(b);
    if (body.pictureKeys.length && actor.user.verified !== true)
      throw new ApiError("请先完成学生认证。", 20004, 403);
    if (rootId) {
      const root = rowFor(rootId, true);
      if (root.foodId !== foodId || root.rootId !== root.id)
        throw new ApiError("回复目标无效。", 40001);
      if (body.replyToId && rowFor(body.replyToId, true).rootId !== rootId)
        throw new ApiError("回复目标不在同一讨论中。", 40001);
    }
    return once(
      s,
      `${method}:${path}:${userId}`,
      options.headers?.["Idempotency-Key"],
      body,
      () => {
        const id = s.nextId++;
        const row: Row = {
          id,
          gid: crypto.randomUUID(),
          revisionId: crypto.randomUUID(),
          foodId,
          rootId: rootId || id,
          replyToId: rootId ? (body.replyToId ?? rootId) : null,
          authorId: userId,
          authorName: actor.user.displayName || "校园食友",
          text: body.text,
          pictureKeys: body.pictureKeys,
          createdAt: new Date().toISOString(),
          likesCount: 0,
          likedBy: [],
          moderationStatus: "PENDING",
          reasonCode: null,
        };
        s.rows.unshift(row);
        return {
          id,
          commentGid: row.gid,
          revisionId: row.revisionId,
          moderationStatus: row.moderationStatus,
        };
      },
    );
  }
  const replies = path.match(/^\/comments\/(\d+)\/replies$/);
  if (replies) {
    const root = rowFor(Number(replies[1]), true);
    return page(
      s.rows
        .filter(
          (r) => r.rootId === root.id && r.id !== root.id && visible(s, r),
        )
        .map((r) => view(s, r)),
      q,
    );
  }
  const like = path.match(/^\/comments\/(\d+)\/like$/);
  if (like) {
    login();
    const row = rowFor(Number(like[1]), true);
    const result = () => ({
      commentId: row.id,
      liked: row.likedBy.includes(userId),
      likesCount: row.likesCount,
      authorLikesCount: s.rows
        .filter((r) => r.authorId === row.authorId)
        .reduce((n, r) => n + r.likesCount, 0),
    });
    if (method === "GET") return result();
    return once(
      s,
      `${method}:${path}:${userId}`,
      options.headers?.["Idempotency-Key"],
      {},
      () => {
        const liked = row.likedBy.includes(userId);
        if (method === "PUT" && !liked) {
          row.likedBy.push(userId);
          row.likesCount++;
        }
        if (method === "DELETE" && liked) {
          row.likedBy = row.likedBy.filter((id) => id !== userId);
          row.likesCount--;
        }
        return result();
      },
    );
  }
  const deletion = path.match(/^\/comments\/(\d+)$/);
  if (deletion && method === "DELETE") {
    login();
    const row = rowFor(Number(deletion[1]));
    if (row.authorId !== userId)
      throw new ApiError("只能删除自己的评论。", 20004, 403);
    return once(
      s,
      `${method}:${path}:${userId}`,
      options.headers?.["Idempotency-Key"],
      {},
      () => {
        row.moderationStatus = "DELETED";
        return {
          id: row.id,
          gid: row.gid,
          deletionId: options.headers?.["Idempotency-Key"],
          state: "DELETED",
        };
      },
    );
  }
  throw new ApiError("评论接口未找到。", 40004, 404);
}
