import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useDiscoveryFilters,
  sortRecommendedShops,
  type DiscoveryKind,
} from "../app/discovery-category";
import { useArea } from "../app/area";
import { useApp } from "../app/state";
import { guestDeviceId } from "../api/food-display";
import type { Food } from "../api/models";
import { useMobile } from "../mobile/ui";
import { recommendationBatchSize, useRemoteConfig } from "./v4/Remote";

export function useHomeDiscovery(enabled = true) {
  const { api, toast } = useApp();
  const cache = useQueryClient();
  const { area, ready = true } = useArea();
  const { mealKey, mealTime, scene, noteServedMeal, confirm } = useMobile();
  const batchSize = recommendationBatchSize(useRemoteConfig().data);
  const { kind, setKind, sort, setSort } = useDiscoveryFilters();
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [dismissing, setDismissing] = useState(false);
  const options = (key: DiscoveryKind) => ({
    queryKey: [
      "foods",
      "mobile-recommend",
      mealKey,
      scene,
      area?.gcjLng,
      area?.gcjLat,
      key,
      batchSize,
    ],
    queryFn: async () => {
      const feed = await api.recommendFeed(batchSize, {
        kind: key,
        mealTime,
        scene,
        gcjLng: area?.gcjLng,
        gcjLat: area?.gcjLat,
        deviceId: guestDeviceId(),
      });
      if (!mealTime && key === "food") noteServedMeal(feed.mealTime);
      return feed;
    },
    enabled: enabled && ready,
  });
  const hero = useQuery(options("food"));
  const selected = useQuery({
    ...options(kind),
    enabled: enabled && ready && kind !== "food",
  });
  const feed = kind === "food" ? hero : selected;
  const visible = (id?: number | null) => !dismissed.includes(Number(id));
  function requestDismiss(food: Food) {
    const id = food.restaurantId;
    if (!id || dismissing) return;
    const name = food.restaurantName?.trim();
    const shop = name ? `「${name}」` : "这家店";
    confirm(
      `接下来 30 天，首页将不再推荐${shop}及其菜品。`,
      async () => {
        setDismissing(true);
        try {
          await api.dismissRecommendation(id);
          setDismissed((ids) => [...ids, id]);
          cache.setQueriesData<NonNullable<typeof hero.data>>(
            { queryKey: ["foods", "mobile-recommend"] },
            (prev) =>
              prev && {
                ...prev,
                items: prev.items.filter((dish) => dish.restaurantId !== id),
                shops: prev.shops?.filter((shop) => shop.id !== id) ?? null,
              },
          );
          toast(`30 天内不再推荐${shop}`);
        } finally {
          setDismissing(false);
        }
      },
      "确认不推荐",
      "不想吃这家？",
    );
  }
  const shops = feed.data?.shops?.filter((shop) => visible(shop.id));
  const canSortByDistance = !!shops?.some(
    (shop) => shop.distanceMeters != null,
  );
  const activeSort =
    sort === "distance" && !canSortByDistance ? "recommended" : sort;
  return {
    hero,
    feed,
    kind,
    setKind,
    sort: activeSort,
    setSort,
    canSortByDistance,
    requestDismiss,
    dismissing,
    heroFoods:
      hero.data?.items.filter((dish) => visible(dish.restaurantId)) ?? [],
    heroHasShops: hero.data?.shops?.some((shop) => visible(shop.id)),
    shops: shops && sortRecommendedShops(shops, activeSort, scene),
    dishes: feed.data?.items.filter((dish) => visible(dish.restaurantId)) ?? [],
  };
}
