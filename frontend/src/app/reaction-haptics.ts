import type { Api } from "../api/service";
import { instantMotion } from "../motion/runtime";

async function confirmToggle<T>(
  request: Promise<T>,
  active: boolean,
): Promise<T> {
  const page = window.location.href;
  const result = await request;
  if (
    page === window.location.href &&
    !document.hidden &&
    typeof navigator.vibrate === "function" &&
    !instantMotion()
  ) {
    try {
      navigator.vibrate(active ? 20 : 10);
    } catch {
      // An embedded browser can block vibration after the action succeeded.
    }
  }
  return result;
}

/** Attach feedback to user actions shared by the mobile and desktop screens. */
export function withReactionHaptics(api: Api): Api {
  return {
    ...api,
    like: (id, liked) => confirmToggle(api.like(id, liked), !liked),
    favorite: (id, saved) => confirmToggle(api.favorite(id, saved), !saved),
    favoriteRestaurant: (id) => confirmToggle(api.favoriteRestaurant(id), true),
    unfavoriteRestaurant: (id) =>
      confirmToggle(api.unfavoriteRestaurant(id), false),
    follow: (id, following) =>
      confirmToggle(api.follow(id, following), !following),
    likeComment: (id, key) => confirmToggle(api.likeComment(id, key), true),
    unlikeComment: (id, key) =>
      confirmToggle(api.unlikeComment(id, key), false),
    setCommentReaction: (id, reaction, selected) =>
      confirmToggle(api.setCommentReaction(id, reaction, selected), selected),
  };
}
