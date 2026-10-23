import { Link } from "react-router-dom";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useApp } from "../app/state";
import { errorMessage } from "../api/client";
import { money, type Food } from "../api/models";
import { Icon, Picture } from "./ui";
export function useFoodActions(food: Food) {
  const { api, toast } = useApp(),
    cache = useQueryClient();
  const busy = useIsMutating({ mutationKey: ["food-action", food.id] }) > 0;
  const mutation = useMutation({
    mutationKey: ["food-action", food.id],
    mutationFn: async (action: "like" | "favorite") => {
      if (!food.id) throw new Error("菜品编号无效。");
      if (action === "like") {
        if (food.isLiked == null)
          throw new Error("暂未获取到点赞状态，请刷新详情。");
        await api.like(food.id, food.isLiked);
      } else {
        if (food.isFavorite == null)
          throw new Error("暂未获取到收藏状态，请刷新详情。");
        await api.favorite(food.id, food.isFavorite);
      }
    },
    onSuccess: async (_, action) => {
      await cache.invalidateQueries({ queryKey: ["foods"] });
      toast(
        action === "favorite"
          ? food.isFavorite
            ? "已取消收藏"
            : "已放进想吃清单"
          : food.isLiked
            ? "已取消点赞"
            : "已记下这份喜欢",
      );
    },
    onError: (e) => toast(errorMessage(e)),
  });
  return {
    busy,
    like: () => mutation.mutate("like"),
    favorite: () => mutation.mutate("favorite"),
  };
}
export function FoodCard({ food, index = 0 }: { food: Food; index?: number }) {
  const actions = useFoodActions(food);
  return (
    <article
      className="food-card"
      style={{ animationDelay: `${Math.min(index, 7) * 35}ms` }}
    >
      <div className="food-image-wrap">
        <Link
          to={`/foods/${food.id}`}
          aria-label={`查看${food.name || "菜品"}`}
        >
          <Picture
            src={food.pictureUrl?.[0]}
            alt={food.name || "菜品图片"}
            className="food-image"
            eager={index < 4}
          />
        </Link>
        <button
          className={`save-button ${food.isFavorite ? "saved" : ""}`}
          disabled={actions.busy || food.isFavorite == null}
          onClick={actions.favorite}
          aria-label={`${food.isFavorite ? "取消收藏" : "收藏"}${food.name}`}
          aria-pressed={food.isFavorite ?? false}
        >
          <Icon name="bookmark" />
        </button>
        {index === 0 && <span className="photo-label">同学的心头好</span>}
      </div>
      <div className="food-body">
        <div className="food-name-row">
          <Link className="food-name" to={`/foods/${food.id}`}>
            {food.name || "未命名菜品"}
          </Link>
          <span
            className={`food-price ${food.price == null ? "unknown-price" : ""}`}
          >
            {money(food.price)}
          </span>
        </div>
        {food.restaurantId && (
          <Link className="food-place" to={`/restaurants/${food.restaurantId}`}>
            <Icon name="pin" />
            {food.restaurantName || "查看餐厅"}
          </Link>
        )}
        <div className="food-tags">
          {food.systemTags?.slice(0, 2).map((tag, i) => (
            <span
              key={tag.id ?? i}
              className={`food-tag ${i === 1 ? "warm" : ""}`}
            >
              {tag.name}
            </span>
          ))}
        </div>
        <div className="food-author">
          <span className="avatar">
            {food.uploaderName?.slice(0, 1) || "食"}
          </span>
          {food.accountId ? (
            <Link to={`/users/${food.accountId}`}>
              {food.uploaderName || "同学"}
            </Link>
          ) : (
            <span>{food.uploaderName || "同学"}</span>
          )}
          <button
            className={`like-button ${food.isLiked ? "liked" : ""}`}
            disabled={actions.busy || food.isLiked == null}
            onClick={actions.like}
            aria-label={`${food.isLiked ? "取消点赞" : "点赞"}${food.name}`}
            aria-pressed={food.isLiked ?? false}
          >
            <Icon name="heart" />
            {food.likesCount ?? "—"}
          </button>
        </div>
      </div>
    </article>
  );
}
export function FoodGrid({ foods }: { foods: Food[] }) {
  return (
    <div className="food-grid">
      {foods.map((food, i) => (
        <FoodCard key={food.id ?? i} food={food} index={i} />
      ))}
    </div>
  );
}
