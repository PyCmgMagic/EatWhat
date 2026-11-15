import {
  requiredData,
  type createRequester,
  type RequestOptions,
} from "./client";
import { boundedText } from "./content-rules";
import type { Page, Schema } from "./models";

/** authorTitle：作者的满级称号（后端 v2），没有时为 null。 */
export type CommentView = Schema["CommentViewResponse"] & {
  authorTitle?: string | null;
};
export type CommentSubmission = Schema["CommentQueriesSubmissionResponse"];
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
  const text = boundedText(body.text ?? "", 200, "评论");
  const pictureKeys = body.pictureKeys ?? [];
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
