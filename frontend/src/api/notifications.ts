import { ApiError, unavailable } from "./client";
import type { Api } from "./service";
import { parseId } from "./models";

export function commentLikeLink(
  kind?: string | null,
  domain?: string | null,
  targetId?: number | null,
) {
  const id = parseId(String(targetId ?? ""));
  if (
    kind?.toLowerCase() === "comment_like" &&
    ["comment", "comments"].includes(domain?.toLowerCase() ?? "") &&
    id
  )
    return `/comments?commentId=${id}`;
}
export async function unreadCount(api: Pick<Api, "unreadCards" | "unread">) {
  try {
    const value = (await api.unreadCards()).members;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      throw new ApiError(
        "未读计数格式不完整，请稍后重试。",
        "INVALID_RESPONSE",
      );
    return value;
  } catch (error) {
    if (unavailable(error)) return api.unread();
    throw error;
  }
}
