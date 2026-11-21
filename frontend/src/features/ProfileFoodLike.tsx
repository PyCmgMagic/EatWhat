import type { Food } from "../api/models";
import { useFoodActions } from "../components/FoodCard";
import { ReactionIcon } from "../mobile/ui";

export function ProfileFoodLike({ food }: { food: Food }) {
  const { like, busy } = useFoodActions(food);
  const liked = food.isLiked === true;
  return (
    <button
      type="button"
      className="profile-food-like"
      aria-label={`${liked ? "取消点赞" : "点赞"}${food.name || "这道菜"}`}
      aria-description={food.likesCount == null ? undefined : `${food.likesCount} 次获赞`}
      aria-pressed={liked}
      disabled={busy || !food.id || food.isLiked == null}
      onClick={like}
    >
      <ReactionIcon kind="like" size={16} />
      {food.likesCount ?? "—"}
    </button>
  );
}
