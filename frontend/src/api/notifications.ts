import { ApiError, unavailable } from "./client";
import type { Api } from "./service";
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
