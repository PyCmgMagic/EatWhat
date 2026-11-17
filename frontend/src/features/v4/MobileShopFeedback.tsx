import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../../api/client";
import { LoginLink } from "../../app/auth-dialog";
import { useApp } from "../../app/state";
import {
  ratingScenes,
  type RatingValue,
  type V2Shop,
} from "../../api/v2-vocab";
import { DesignIcon as Icon } from "../../mobile/ui";
import "./mobile-shop-feedback.css";

/** Scene-specific recommendation totals and the viewer's own vote. */
export function MobileShopFeedback({ id }: { id: number }) {
  const { api, session, toast } = useApp();
  const cache = useQueryClient();
  // 乐观投票：点下去马上亮，失败回滚并提示。
  const [optimistic, setOptimistic] = useState<
    Partial<Record<"dineIn" | "delivery", RatingValue | null>>
  >({});
  const [voting, setVoting] = useState(false);
  const [selectedScene, setSelectedScene] =
    useState<(typeof ratingScenes)[number]["id"]>("dine_in");
  const q = useQuery({
    queryKey: ["restaurants", "detail", id],
    queryFn: () => api.restaurant(id),
  });
  const shop = q.data;
  const v2 = shop as (typeof shop & V2Shop) | undefined;
  const scenes = ratingScenes.filter(
    (scene) =>
      scene.id === "dine_in" ||
      v2?.deliveryEnabled ||
      (v2?.delivery?.count ?? 0) > 0 ||
      Boolean(v2?.myRatings?.delivery),
  );
  const scene =
    scenes.find((item) => item.id === selectedScene) ?? ratingScenes[0];
  const stat = v2?.[scene.key];
  const count = stat?.count ?? 0;
  const rate =
    count > 0 && stat?.rate != null ? Math.round(stat.rate * 100) : null;
  const mine =
    scene.key in optimistic
      ? (optimistic[scene.key] ?? null)
      : (v2?.myRatings?.[scene.key] ?? null);
  const busy = !shop || voting;
  const vote = async (
    scene: (typeof scenes)[number],
    next: RatingValue | null,
  ) => {
    if (busy) return;
    setOptimistic((current) => ({ ...current, [scene.key]: next }));
    setVoting(true);
    try {
      await api.rateRestaurantScene(id, scene.id, next);
      await cache.invalidateQueries({ queryKey: ["restaurants"] });
    } catch (error) {
      toast(errorMessage(error), { tone: "error" });
    } finally {
      setVoting(false);
      setOptimistic({});
    }
  };

  return (
    <>
      <div className="shop-voice-heading">
        <h2>食友评价</h2>
        {shop &&
          (scenes.length > 1 ? (
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
          ) : (
            <span className="shop-voice-scene">{scene.name}</span>
          ))}
      </div>
      {q.isPending ? (
        <div
          className="shop-voice is-loading"
          aria-busy="true"
          aria-label="加载评价"
        >
          <span />
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
        <div className="shop-voice">
          <div
            className="shop-voice-score"
            aria-live="polite"
            aria-atomic="true"
          >
            {count > 0 ? (
              <>
                {rate != null && (
                  <p className="shop-voice-number">
                    <strong>
                      {rate}
                      <em>%</em>
                    </strong>
                    <span>推荐</span>
                  </p>
                )}
                <p className="shop-voice-count">{count} 人评价</p>
              </>
            ) : (
              <p className="shop-voice-empty">暂无评价</p>
            )}
          </div>
          <div className="shop-voice-vote" aria-busy={voting}>
            {session ? (
              <div
                className="shop-voice-options"
                role="group"
                aria-label={`我的${scene.name}评价`}
              >
                <button
                  type="button"
                  className="shop-voice-option is-yes"
                  aria-pressed={mine === "RECOMMEND"}
                  title={mine === "RECOMMEND" ? "取消推荐" : undefined}
                  disabled={busy}
                  onClick={() =>
                    void vote(scene, mine === "RECOMMEND" ? null : "RECOMMEND")
                  }
                >
                  <Icon name="heart" size={17} />
                  <span>推荐</span>
                </button>
                <button
                  type="button"
                  className="shop-voice-option is-no"
                  aria-pressed={mine === "NOT_RECOMMEND"}
                  title={mine === "NOT_RECOMMEND" ? "取消不推荐" : undefined}
                  disabled={busy}
                  onClick={() =>
                    void vote(
                      scene,
                      mine === "NOT_RECOMMEND" ? null : "NOT_RECOMMEND",
                    )
                  }
                >
                  <Icon name="closeCircle" size={17} />
                  <span>不推荐</span>
                </button>
              </div>
            ) : (
              <LoginLink className="shop-voice-login" to="/auth/password">
                登录后评价
              </LoginLink>
            )}
          </div>
        </div>
      )}
    </>
  );
}
