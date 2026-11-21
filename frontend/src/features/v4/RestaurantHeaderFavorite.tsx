import { useEffect, type ButtonHTMLAttributes } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { useMobile, ReactionIcon } from "../../mobile/ui";
import { useCommand } from "./shared";

/** The first-screen action shares the detail query with the rating panel. */
export function RestaurantHeaderFavorite({
  id,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "id"> & { id: number }) {
  const { api } = useApp(),
    cache = useQueryClient();
  const mobile = useMobile(),
    task = useCommand();
  const query = useQuery({
    queryKey: ["restaurants", "detail", id],
    queryFn: () => api.restaurant(id),
  });
  const shop = query.data;
  useEffect(() => {
    if (task.error) mobile.notice(task.error);
  }, [task.error]);
  return (
    <button
      {...props}
      aria-label={shop?.isFavorite ? "取消收藏店铺" : "收藏店铺"}
      aria-pressed={!!shop?.isFavorite}
      style={{
        ...props.style,
        borderRadius: "50%",
        background: undefined,
      }}
      disabled={
        !shop ||
        task.busy ||
        task.uncertain ||
        shop.personalState === "SYNC_PENDING"
      }
      onClick={() => {
        void task.run(
          () =>
            shop?.isFavorite
              ? api.unfavoriteRestaurant(id)
              : api.favoriteRestaurant(id),
          async () => {
            await cache.invalidateQueries({ queryKey: ["restaurants"] });
          },
        );
      }}
    >
      <ReactionIcon kind="favorite" size={22} />
    </button>
  );
}
