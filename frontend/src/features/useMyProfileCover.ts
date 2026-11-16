import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { type Food } from "../api/models";
import { stageCode } from "../api/food-display";
import { demoDishes } from "../mobile/catalog";

/** Keep the cover on the first page when the content tabs or pagination change. */
export function useMyProfileCover(enabled: boolean) {
  const { api, user, session } = useApp();
  const uploads = useQuery({
    queryKey: ["foods", "mine", 1],
    queryFn: () => api.myFoods(1),
    enabled,
  });
  const dish = demoDishes[(user?.id ?? 0) % demoDishes.length];
  const fallback: Food = {
    name: dish.name,
    pictureUrl: [`/prototype/assets/dishes/${dish.asset}.svg`],
    stageColor: stageCode(dish.stage),
  };
  return {
    cover:
      uploads.data?.items?.find((food) => !!food.pictureUrl?.[0]) ?? fallback,
    fallback,
    pending: !!session && (!user?.id || (enabled && uploads.isPending)),
  };
}
