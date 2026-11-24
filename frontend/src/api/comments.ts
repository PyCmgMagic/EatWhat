import {
  requiredData,
  type createRequester,
  type RequestOptions,
} from "./client";
import { boundedText } from "./content-rules";
import type { V2Schema } from "./backend-v2";
import type { Page, Schema } from "./models";

export type CommentReactionType = NonNullable<V2Schema["Reaction"]["reaction"]>;
export const commentReactionOptions = [
  { reaction: "THUMBS_UP", emoji: "👍", label: "赞同" },
  { reaction: "HEART", emoji: "❤️", label: "喜欢" },
  { reaction: "LAUGH", emoji: "😂", label: "笑哭" },
  { reaction: "SURPRISED", emoji: "😮", label: "惊讶" },
  { reaction: "SAD", emoji: "😢", label: "难过" },
  { reaction: "YUMMY", emoji: "😋", label: "好吃" },
] as const satisfies readonly {
  reaction: CommentReactionType;
  emoji: string;
  label: string;
}[];
export type CommentReaction = {
  reaction: CommentReactionType;
  count: number;
  selected: boolean;
};

/** authorTitle：作者当前佩戴的称号（后端 v2），没有时为 null。 */
export type CommentView = Schema["CommentViewResponse"] & {
  restaurantId?: number | null;
  rootId?: number | null;
  authorId?: number | null;
  authorAvatar?: string | null;
  authorTitle?: string | null;
  reactions?: CommentReaction[];
  replyCount?: number | null;
  isLiked?: boolean | null;
  replyTo?: { id?: number | null; displayName?: string | null } | null;
};
export type CommentSubmission = Schema["CommentQueriesSubmissionResponse"] & {
  restaurantId?: number | null;
};
export type CommentImage = Schema["CommentGalleryImageViewResponse"];
export type CommentSort = "MOST_USEFUL" | "NEWEST";
export type CommentVerdict = NonNullable<
  Schema["ReviewCommentDTORequest"]["verdict"]
>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value: number) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error("评论或菜品编号无效，请重新打开页面。");
  return value;
}
function command(value: string) {
  if (!uuid.test(value)) throw new Error("操作标识无效，请重新操作。");
  return value;
}
function pageQuery(page: number, pageSize: number) {
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  )
    throw new Error("评论页码或每页数量无效。");
  return { page, pageSize };
}
export function commentBody(body: Schema["CreateCommentReplyDTORequest"]) {
  const pictureKeys = body.pictureKeys ?? [];
  const text = boundedText(
    body.text ?? "",
    200,
    "评论",
    pictureKeys.length && body.replyToId == null ? 0 : 1,
  );
  if (
    pictureKeys.length > 3 ||
    pictureKeys.some((key) => !/^comments\/.+/.test(key))
  )
    throw new Error("评论最多添加 3 张已上传的评论图片。");
  if (body.replyToId != null) id(body.replyToId);
  if (body.campusId != null) id(body.campusId);
  return { ...body, text, pictureKeys };
}

export function createCommentsApi(request: ReturnType<typeof createRequester>) {
  const data = async <T>(path: string, options?: RequestOptions) =>
    requiredData(await request<T | null>(path, options));
  const write = <T>(
    path: string,
    method: string,
    key: string,
    body?: unknown,
  ) =>
    data<T>(path, {
      method,
      body,
      headers: { "Idempotency-Key": command(key) },
    });
  return {
    commentDetail: (commentId: number, signal?: AbortSignal) =>
      data<CommentView>(`/comments/${id(commentId)}`, { signal }),
    foodComments: (
      foodId: number,
      sort: CommentSort = "MOST_USEFUL",
      page = 1,
      pageSize = 20,
      signal?: AbortSignal,
    ) =>
      data<Page<CommentView>>(`/foods/${id(foodId)}/comments`, {
        query: { ...pageQuery(page, pageSize), sort },
        signal,
      }),
    createFoodComment: (
      foodId: number,
      body: Schema["CreateCommentDTORequest"],
      key: string,
    ) =>
      write<Schema["NativeCommentSubmissionsAcceptedResponse"]>(
        `/foods/${id(foodId)}/comments`,
        "POST",
        key,
        commentBody(body),
      ),
    replyToComment: (
      foodId: number,
      rootId: number,
      body: Schema["CreateCommentReplyDTORequest"],
      key: string,
    ) =>
      write<Schema["NativeCommentSubmissionsAcceptedResponse"]>(
        `/foods/${id(foodId)}/comments/${id(rootId)}/replies`,
        "POST",
        key,
        commentBody(body),
      ),
    restaurantComments: (
      restaurantId: number,
      sort: CommentSort = "MOST_USEFUL",
      page = 1,
      pageSize = 20,
      signal?: AbortSignal,
    ) =>
      data<Page<CommentView>>(`/restaurant/${id(restaurantId)}/comments`, {
        query: { ...pageQuery(page, pageSize), sort },
        signal,
      }),
    createRestaurantComment: (
      restaurantId: number,
      body: Schema["CreateCommentDTORequest"],
      key: string,
    ) =>
      write<Schema["NativeCommentSubmissionsAcceptedResponse"]>(
        `/restaurant/${id(restaurantId)}/comments`,
        "POST",
        key,
        commentBody(body),
      ),
    replyToRestaurantComment: (
      restaurantId: number,
      rootId: number,
      body: Schema["CreateCommentReplyDTORequest"],
      key: string,
    ) =>
      write<Schema["NativeCommentSubmissionsAcceptedResponse"]>(
        `/restaurant/${id(restaurantId)}/comments/${id(rootId)}/replies`,
        "POST",
        key,
        commentBody(body),
      ),
    commentReplies: (
      commentId: number,
      page = 1,
      pageSize = 20,
      signal?: AbortSignal,
    ) =>
      data<Page<CommentView>>(`/comments/${id(commentId)}/replies`, {
        query: pageQuery(page, pageSize),
        signal,
      }),
    foodCommentGallery: (
      foodId: number,
      page = 1,
      pageSize = 20,
      signal?: AbortSignal,
    ) =>
      data<Page<CommentImage>>(`/foods/${id(foodId)}/gallery`, {
        query: pageQuery(page, pageSize),
        signal,
      }),
    myCommentSubmissions: (page = 1, pageSize = 20, signal?: AbortSignal) =>
      data<Page<CommentSubmission>>("/comments/submissions/my", {
        query: pageQuery(page, pageSize),
        signal,
      }),
    deleteComment: (commentId: number, key: string) =>
      write<Schema["NativeCommentDeletesDeletedResponse"]>(
        `/comments/${id(commentId)}`,
        "DELETE",
        key,
      ),
    commentLike: (commentId: number, signal?: AbortSignal) =>
      data<Schema["NativeCommentLikesResultResponse"]>(
        `/comments/${id(commentId)}/like`,
        { signal },
      ),
    likeComment: (commentId: number, key: string) =>
      write<Schema["NativeCommentLikesResultResponse"]>(
        `/comments/${id(commentId)}/like`,
        "PUT",
        key,
      ),
    unlikeComment: (commentId: number, key: string) =>
      write<Schema["NativeCommentLikesResultResponse"]>(
        `/comments/${id(commentId)}/like`,
        "DELETE",
        key,
      ),
    setCommentReaction: (
      commentId: number,
      reaction: CommentReactionType,
      selected: boolean,
    ) =>
      data<CommentReaction[]>(
        `/comments/${id(commentId)}/reactions/${reaction}`,
        { method: selected ? "PUT" : "DELETE" },
      ),
    commentModerationQueue: (page = 1, pageSize = 20, signal?: AbortSignal) =>
      data<Page<CommentSubmission>>("/admin/comments/moderation/queue", {
        query: pageQuery(page, pageSize),
        signal,
      }),
    reviewComment: (body: Schema["ReviewCommentDTORequest"]) => {
      command(body.decisionId ?? "");
      command(body.revisionId ?? "");
      return data<Schema["CommentReviewResultResponse"]>(
        "/admin/comments/moderation/review",
        { method: "POST", body },
      );
    },
  };
}
