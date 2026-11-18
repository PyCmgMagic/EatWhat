import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import type { Food } from "../api/models";

export type FoodReactionKind = "like" | "favorite";

type LaneState = {
  inFlight: boolean;
  desired: boolean | null;
  confirmed: boolean | null;
};

type DishLanes = {
  like: LaneState;
  favorite: LaneState;
};

function createLane(): LaneState {
  return { inFlight: false, desired: null, confirmed: null };
}

function patchFoodReaction(
  food: Food,
  kind: FoodReactionKind,
  active: boolean,
): Food {
  if (kind === "favorite") return { ...food, isFavorite: active };
  const wasLiked = food.isLiked === true;
  const delta = active === wasLiked ? 0 : active ? 1 : -1;
  return {
    ...food,
    isLiked: active,
    likesCount:
      food.likesCount == null
        ? food.likesCount
        : Math.max(0, food.likesCount + delta),
  };
}

/**
 * Triggers a short keyframe pulse synchronously on activation so button
 * feedback starts in the tap frame instead of waiting for an effect tick.
 */
export function useCelebration(durationMs = 460) {
  const [celebrating, setCelebrating] = useState(false);
  const activeRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  useEffect(() => clearTimers, []);

  const start = () => {
    activeRef.current = true;
    setCelebrating(true);
    timerRef.current = window.setTimeout(() => {
      activeRef.current = false;
      setCelebrating(false);
      timerRef.current = null;
    }, durationMs);
  };

  const trigger = () => {
    clearTimers();
    if (!activeRef.current) {
      start();
      return;
    }
    activeRef.current = false;
    setCelebrating(false);
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      start();
    });
  };

  const stop = () => {
    clearTimers();
    activeRef.current = false;
    setCelebrating(false);
  };

  return { celebrating, trigger, stop };
}

/**
 * Applies dish like/favorite toggles optimistically in the detail cache and
 * serializes rapid taps per dish and reaction kind without disabling controls.
 */
export function useFoodReaction({
  foodId,
  food,
  onError,
}: {
  foodId: number | undefined;
  food: Food | undefined;
  onError?: (error: unknown) => void;
}) {
  const { api } = useApp();
  const cache = useQueryClient();
  const lanesByFood = useRef(new Map<number, DishLanes>());

  const laneFor = (id: number, kind: FoodReactionKind): LaneState => {
    let entry = lanesByFood.current.get(id);
    if (!entry) {
      entry = { like: createLane(), favorite: createLane() };
      lanesByFood.current.set(id, entry);
    }
    return entry[kind];
  };

  const toggle = async (kind: FoodReactionKind) => {
    if (!foodId) return;
    const detailKey = ["foods", "detail", foodId] as const;
    const current = cache.getQueryData<Food>(detailKey) ?? food;
    if (!current) return;

    const currentActive =
      kind === "like" ? current.isLiked === true : current.isFavorite === true;
    const nextActive = !currentActive;
    const lane = laneFor(foodId, kind);

    if (!lane.inFlight) lane.confirmed = currentActive;
    lane.desired = nextActive;

    void cache.cancelQueries({ queryKey: detailKey });
    cache.setQueryData<Food>(detailKey, (old) =>
      patchFoodReaction(old ?? current, kind, nextActive),
    );

    if (lane.inFlight) return;
    lane.inFlight = true;
    let synced = false;
    try {
      while (lane.desired !== null && lane.desired !== lane.confirmed) {
        const target = lane.desired;
        const prevConfirmed = lane.confirmed ?? !target;
        await (kind === "like"
          ? api.like(foodId, prevConfirmed)
          : api.favorite(foodId, prevConfirmed));
        lane.confirmed = target;
        synced = true;
      }
    } catch (error) {
      const rollbackTo = lane.confirmed;
      lane.desired = null;
      if (rollbackTo != null) {
        cache.setQueryData<Food>(detailKey, (old) =>
          old ? patchFoodReaction(old, kind, rollbackTo) : old,
        );
      }
      onError?.(error);
    } finally {
      lane.inFlight = false;
      lane.desired = null;
      lane.confirmed = null;
      if (synced) {
        void Promise.all([
          cache.invalidateQueries({
            queryKey: ["foods"],
            predicate: (q) =>
              q.queryKey[1] !== "mobile-recommend" &&
              q.queryKey[1] !== "mobile-recommend-category",
          }),
          cache.invalidateQueries({ queryKey: ["user"] }),
          cache.invalidateQueries({ queryKey: ["notifications"] }),
        ]);
      }
    }
  };

  return { toggle };
}
