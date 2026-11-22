import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { isDemo } from "../app/runtime";
import { mediaUrl, type Food } from "../api/models";
import { stageCode } from "../api/food-display";
import { demoDishes, visualFor } from "../mobile/catalog";
import { useFoodPhoto } from "./media";

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
  const food =
    selectedFood ??
    uploads.data?.items?.find((item) => item.pictureUrl?.[0]) ??
    fallback;
  const photo = useFoodPhoto(mediaUrl(food.pictureUrl?.[0]));
  const cover = photo.unavailable ? fallback : food;
  const pending =
    !!session &&
    (!user?.id ||
      (enabled && (needsDefault ? uploads.isPending : selected.isPending)));
  return {
    cover,
    illustration: cover === fallback,
    src: mediaUrl(cover.pictureUrl?.[0]),
    onImageError: photo.onError,
    visual: pending
      ? {
          stage: "#E8E1D8",
          on: "#231C18",
          ghost: "rgba(35,28,24,0.08)",
          stageTone: "light",
        }
      : visualFor(cover, isDemo),
    uploadCount: uploads.data?.totalItems,
    pending,
  };
}
