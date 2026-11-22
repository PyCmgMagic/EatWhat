import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Heart } from "lucide-react";
import { errorMessage } from "../../api/client";
import type { Restaurant } from "../../api/models";
import { LoginLink } from "../../app/auth-dialog";
import { useApp } from "../../app/state";
import {
  ratingScenes,
  shopRatingScenes,
  type RatingValue,
  type V2Shop,
} from "../../api/v2-vocab";
import { useCelebration } from "../food-reactions";
import { DesignIcon as Icon } from "../../mobile/ui";
import "./mobile-shop-feedback.css";

type SceneKey = "dineIn" | "delivery";

type LaneState = {
  inFlight: boolean;
  desired: RatingValue | null;
  confirmed: RatingValue | null;
};

function toRatingValue(value: string | null | undefined): RatingValue | null {
  return value === "RECOMMEND" || value === "NOT_RECOMMEND" ? value : null;
}

function computeSceneStats(
  stat: { count?: number | null; rate?: number | null } | null | undefined,
  serverMine: RatingValue | null,
  currentMine: RatingValue | null,
) {
  const baseCount = stat?.count ?? 0;
  const baseRate = stat?.rate ?? null;
  if (serverMine === currentMine) {
    const ratePct =
      baseCount > 0 && baseRate != null ? Math.round(baseRate * 100) : null;
    return { count: baseCount, ratePct, rawRate: baseRate };
  }
  const deltaCount =
    (currentMine != null ? 1 : 0) - (serverMine != null ? 1 : 0);
  const count = Math.max(0, baseCount + deltaCount);
  if (count === 0) return { count: 0, ratePct: null, rawRate: null };
  if (baseCount > 0 && baseRate == null) {
    return { count, ratePct: null, rawRate: null };
  }
  const basePositives =
    baseCount > 0 && baseRate != null ? Math.round(baseRate * baseCount) : 0;
  const deltaPos =
    (currentMine === "RECOMMEND" ? 1 : 0) -
    (serverMine === "RECOMMEND" ? 1 : 0);
  const rawRate = Math.max(
    0,
    Math.min(1, (basePositives + deltaPos) / count),
  );
  return { count, ratePct: Math.round(rawRate * 100), rawRate };
}

function patchShopRating(
  shop: Restaurant & V2Shop,
  sceneKey: SceneKey,
  next: RatingValue | null,
): Restaurant & V2Shop {
  const serverMine = toRatingValue(shop.myRatings?.[sceneKey]);
  const { count, ratePct, rawRate } = computeSceneStats(
    shop[sceneKey],
    serverMine,
    next,
  );
  const nextRatings = { ...(shop.myRatings ?? {}), [sceneKey]: next };
  return {
    ...shop,
    [sceneKey]: { count, rate: rawRate },
    myRatings: nextRatings,
    ...(sceneKey === "dineIn"
      ? { ratingCount: count, recommendationRate: ratePct }
      : {}),
  };
}

/** Scene-specific recommendation totals and the viewer's own vote. */
export function MobileShopFeedback({ id }: { id: number }) {
  const { api, session, toast } = useApp();
  const cache = useQueryClient();
  const [optimistic, setOptimistic] = useState<
    Partial<Record<SceneKey, RatingValue | null>>
  >({});
  const lanesRef = useRef<Partial<Record<SceneKey, LaneState>>>({});
  const yesCelebration = useCelebration(480);
  const noCelebration = useCelebration(420);
  const [selectedScene, setSelectedScene] =
    useState<(typeof ratingScenes)[number]["id"]>("dine_in");
  const q = useQuery({
    queryKey: ["restaurants", "detail", id],
    queryFn: () => api.restaurant(id),
  });
  const shop = q.data;
  const v2 = shop as (typeof shop & V2Shop) | undefined;
  const scenes = shopRatingScenes(v2);
  const scene =
    scenes.find((item) => item.id === selectedScene) ?? ratingScenes[0];
  const stat = v2?.[scene.key];
  const serverMine = toRatingValue(v2?.myRatings?.[scene.key]);
  const mine =
    scene.key in optimistic ? (optimistic[scene.key] ?? null) : serverMine;
  const { count, ratePct: rate } = computeSceneStats(stat, serverMine, mine);

  const vote = async (
    targetScene: (typeof scenes)[number],
    next: RatingValue | null,
  ) => {
    if (!shop) return;
    if (next === "RECOMMEND") {
      noCelebration.stop();
      yesCelebration.trigger();
    } else if (next === "NOT_RECOMMEND") {
      yesCelebration.stop();
      noCelebration.trigger();
    } else {
      yesCelebration.stop();
      noCelebration.stop();
    }

    const detailKey = ["restaurants", "detail", id] as const;
    const lane =
      lanesRef.current[targetScene.key] ??
      (lanesRef.current[targetScene.key] = {
        inFlight: false,
        desired: null,
        confirmed: serverMine,
      });
    if (!lane.inFlight) lane.confirmed = serverMine;
    lane.desired = next;

    setOptimistic((current) => ({ ...current, [targetScene.key]: next }));
    void cache.cancelQueries({ queryKey: detailKey });
    cache.setQueryData<Restaurant & V2Shop>(detailKey, (old) =>
      old ? patchShopRating(old, targetScene.key, next) : old,
    );

    if (lane.inFlight) return;
    lane.inFlight = true;
    let synced = false;
    try {
      while (lane.desired !== lane.confirmed) {
        const target = lane.desired ?? null;
        await api.rateRestaurantScene(id, targetScene.id, target);
        lane.confirmed = target;
        synced = true;
      }
    } catch (error) {
      const rollbackTo = lane.confirmed ?? null;
      lane.desired = rollbackTo;
      yesCelebration.stop();
      noCelebration.stop();
      setOptimistic((current) => {
        const nextMap = { ...current };
        delete nextMap[targetScene.key];
        return nextMap;
      });
      cache.setQueryData<Restaurant & V2Shop>(detailKey, (old) =>
        old ? patchShopRating(old, targetScene.key, rollbackTo) : old,
      );
      const message = errorMessage(error);
      if (message) toast(message, { tone: "error" });
    } finally {
      lane.inFlight = false;
      setOptimistic((current) => {
        if (!(targetScene.key in current)) return current;
        const nextMap = { ...current };
        delete nextMap[targetScene.key];
        return nextMap;
      });
      if (synced) {
        void cache.invalidateQueries({ queryKey: ["restaurants"] });
      }
    }
  };

  const myVote =
    mine === "RECOMMEND"
      ? "已推荐"
      : mine === "NOT_RECOMMEND"
        ? "已选不推荐"
        : null;

  return (
    <>
      <h2 className="sr-only">食友评价</h2>
      {q.isPending ? (
        <div
          className="shop-voice is-loading"
          aria-busy="true"
          aria-label="加载评价"
        >
          <span />
        </div>
      ) : q.error && !shop ? (
        <div className="shop-voice" role="alert">
          <p className="shop-voice-error">评价暂时没能加载</p>
          <button
            type="button"
            className="shop-voice-retry"
            onClick={() => void q.refetch()}
          >
            重新加载
          </button>
        </div>
      ) : (
        <details className="shop-voice">
          <summary className="shop-voice-entry">
            <Heart size={17} aria-hidden="true" />
            <span
              className="shop-voice-score"
              aria-live="polite"
              aria-atomic="true"
            >
              {rate != null ? (
                <span className="shop-voice-number">
                  <strong>{rate}%</strong> {scene.name}推荐
                </span>
              ) : (
                <span>{scene.name}评价</span>
              )}
              {count > 0 ? (
                <span className="shop-voice-count">{count} 人评价</span>
              ) : (
                <span className="shop-voice-empty">暂无评价</span>
              )}
            </span>
            <span className="shop-voice-action">
              <span className="when-closed">{myVote ?? "去评价"}</span>
              <span className="when-open">收起</span>
              <ChevronDown size={16} aria-hidden="true" />
            </span>
          </summary>
          <div className="shop-voice-panel">
            {scenes.length > 1 && (
              <div
                className="shop-voice-scenes"
                role="group"
                aria-label="评价场景"
              >
                {scenes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={scene.id === item.id}
                    onClick={() => setSelectedScene(item.id)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
            {count > 0 && rate != null && (
              <div className="shop-voice-meter" aria-hidden="true">
                <span style={{ width: `${rate}%` }} />
              </div>
            )}
            {session ? (
              <div
                className="shop-voice-options"
                role="group"
                aria-label={`我的${scene.name}评价`}
              >
                <button
                  type="button"
                  className={`shop-voice-option is-yes${yesCelebration.celebrating ? " is-celebrating" : ""}`}
                  aria-pressed={mine === "RECOMMEND"}
                  title={mine === "RECOMMEND" ? "取消推荐" : undefined}
                  disabled={!shop}
                  onClick={() =>
                    void vote(scene, mine === "RECOMMEND" ? null : "RECOMMEND")
                  }
                >
                  <span className="shop-voice-icon is-heart" aria-hidden="true">
                    <span className="shop-voice-layer is-outline">
                      <Icon name="heart" size={17} />
                    </span>
                    <span className="shop-voice-layer is-filled">
                      <Icon name="heartOn" size={17} />
                    </span>
                  </span>
                  <span>推荐</span>
                </button>
                <button
                  type="button"
                  className={`shop-voice-option is-no${noCelebration.celebrating ? " is-celebrating" : ""}`}
                  aria-pressed={mine === "NOT_RECOMMEND"}
                  title={mine === "NOT_RECOMMEND" ? "取消不推荐" : undefined}
                  disabled={!shop}
                  onClick={() =>
                    void vote(
                      scene,
                      mine === "NOT_RECOMMEND" ? null : "NOT_RECOMMEND",
                    )
                  }
                >
                  <span className="shop-voice-icon is-nope" aria-hidden="true">
                    <Icon name="closeCircle" size={17} />
                  </span>
                  <span>不推荐</span>
                </button>
              </div>
            ) : (
              <LoginLink className="shop-voice-login" to="/auth/password">
                登录后评价这家店
              </LoginLink>
            )}
            {session && myVote && (
              <p className="shop-voice-prompt">{myVote} · 再点一次可取消</p>
            )}
          </div>
        </details>
      )}
    </>
  );
}
