import { useState } from "react";
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
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

// A pick or a second tab can start another round between two list requests.
function distinctById<T extends { id?: number | null }>(items: T[]) {
  const seen = new Set<number>();
  return items.filter(({ id }) => {
    if (id == null) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function useHomeDiscovery(enabled = true) {
  const { api, toast } = useApp();
  const cache = useQueryClient();
  const { area, ready = true } = useArea();
  const { mealKey, mealTime, scene, noteServedMeal, confirm } = useMobile();
  const batchSize = recommendationBatchSize(useRemoteConfig().data);
  const { kind, setKind, sort, setSort } = useDiscoveryFilters();
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [dismissing, setDismissing] = useState(false);
  const filters = {
    mealTime,
    scene,
    gcjLng: area?.gcjLng,
    gcjLat: area?.gcjLat,
  };
  const firstPage: { page: number; mealTime?: string } = { page: 1, mealTime };
  const options = (key: DiscoveryKind) =>
    infiniteQueryOptions({
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
      initialPageParam: firstPage,
      queryFn: async ({ pageParam, signal }) => {
        const feed = await api.recommendFeed(
          batchSize,
          {
            ...filters,
            kind: key,
            ...pageParam,
            deviceId: guestDeviceId(),
          },
          signal,
        );
        if (!mealTime && key === "food" && pageParam.page === 1)
          noteServedMeal(feed.mealTime);
        return feed;
      },
      getNextPageParam: (last, _pages, previous) =>
        last.hasNext
          ? {
              page: previous.page + 1,
              mealTime: last.mealTime ?? previous.mealTime,
            }
          : undefined,
      refetchOnReconnect: false,
      refetchOnMount: false,
      enabled: enabled && ready,
    });
  const hero = useInfiniteQuery(options("food"));
  const selected = useInfiniteQuery({
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
                pages: prev.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((dish) => dish.restaurantId !== id),
                  shops: page.shops?.filter((shop) => shop.id !== id) ?? null,
                })),
              },
          );
          toast(`30 天内不再推荐${shop}`);
        } finally {
          setDismissing(false);
        }
      },
      "确认不推荐",
      "不想吃这家？",
      "点错了",
    );
  }
  const pages = feed.data?.pages ?? [];
  const shops = pages[0]?.shops
    ? distinctById(
        pages
          .flatMap((page) => page.shops ?? [])
          .filter((shop) => visible(shop.id)),
      )
    : null;
  const first = hero.data?.pages[0];
  const canSortByDistance = !!shops?.some(
    (shop) => shop.distanceMeters != null,
  );
  const activeSort =
    sort === "distance" && shops?.length && !canSortByDistance
      ? "recommended"
      : sort;
  return {
    hero,
    feed,
    refresh: () =>
      cache.resetQueries({ queryKey: options(kind).queryKey, exact: true }),
    pickMeal: pages[0]?.mealTime ?? mealTime,
    kind,
    setKind,
    sort: activeSort,
    setSort,
    canSortByDistance,
    requestDismiss,
    dismissing,
    heroFoods: first?.items.filter((dish) => visible(dish.restaurantId)) ?? [],
    heroHasShops: first?.shops?.some((shop) => visible(shop.id)),
    shops: shops && sortRecommendedShops(shops, activeSort, scene),
    dishes: distinctById(
      pages
        .flatMap((page) => page.items)
        .filter((dish) => visible(dish.restaurantId)),
    ),
  };
}
