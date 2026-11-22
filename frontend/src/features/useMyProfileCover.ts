import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { type Food } from "../api/models";
import { stageCode } from "../api/food-display";
import { demoDishes } from "../mobile/catalog";

export function useMyProfileCover(enabled: boolean) {
  const { api, user, session } = useApp();
  const dish = demoDishes[(user?.id ?? 0) % demoDishes.length];
  const selectedId = user?.coverFoodId ?? undefined;
  const selected = useQuery({
    queryKey: ["foods", "my-cover", user?.id, selectedId],
    queryFn: () => api.myFoods(1, selectedId),
    enabled: enabled && !!selectedId,
  });
  const selectedFood = selected.data?.items?.find(
    (food) => food.id === selectedId && food.pictureUrl?.[0],
  );
  const needsDefault = !selectedId || (!selected.isPending && !selectedFood);
  const uploads = useQuery({
    queryKey: ["foods", "mine", 1],
    queryFn: () => api.myFoods(1),
    enabled: enabled && needsDefault,
  });
  const fallback: Food = {
    name: dish.name,
    pictureUrl: [`/prototype/assets/dishes/${dish.asset}.svg`],
    stageColor: stageCode(dish.stage),
  };
  return {
    cover:
      selectedFood ??
      uploads.data?.items?.find((food) => !!food.pictureUrl?.[0]) ??
      fallback,
    fallback,
    uploadCount: uploads.data?.totalItems,
    pending:
      !!session &&
      (!user?.id ||
        (enabled && (needsDefault ? uploads.isPending : selected.isPending))),
  };
}
