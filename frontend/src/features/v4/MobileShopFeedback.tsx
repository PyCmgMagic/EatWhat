import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../../api/client";
import { LoginLink } from "../../app/auth-dialog";
import { useApp } from "../../app/state";
import {
  priceBands,
  ratingScenes,
  type RatingValue,
  type V2Shop,
} from "../../api/v2-vocab";
import { DesignIcon as Icon } from "../../mobile/ui";
import "./mobile-shop-feedback.css";

/**
 * Mobile shop page: a single "vote card" that folds the friend rating, the
 * viewer's own vote and the shop's traits into one panel.
 */
export function MobileShopFeedback({ id }: { id: number }) {
  const { api, session, toast } = useApp();
  const cache = useQueryClient();
  // 乐观投票：点下去马上亮，失败回滚并提示。
  const [optimistic, setOptimistic] = useState<
    Partial<Record<"dineIn" | "delivery", RatingValue | null>>
  >({});
  const [voting, setVoting] = useState(false);
  const q = useQuery({
    queryKey: ["restaurants", "detail", id],
    queryFn: () => api.restaurant(id),
  });
  const shop = q.data;
  const v2 = shop as (typeof shop & V2Shop) | undefined;
  const scenes = ratingScenes.filter(
    (scene) => scene.id === "dine_in" || v2?.deliveryEnabled,
  );
  const primary = scenes[0] ?? ratingScenes[0];
  const stat = v2?.[primary.key];
  const count = stat?.count ?? 0;
  const rate = count ? Math.round((stat?.rate ?? 0) * 100) : null;
  const facts = shop
    ? [
        ...(v2?.categories ?? []),
        priceBands.find((band) => band.id === shop.priceBand)?.name,
        v2?.deliveryEnabled ? "可外卖" : "仅堂食",
      ].filter((fact): fact is string => Boolean(fact))
    : [];
  const deliveryStat = v2?.delivery;
  const secondaryText = deliveryStat?.count
    ? `外卖 ${Math.round((deliveryStat.rate ?? 0) * 100)}% · ${deliveryStat.count} 人`
    : "外卖还没有评价";
  const mine = scenes.map((scene) =>
    scene.key in optimistic
      ? (optimistic[scene.key] ?? null)
      : (v2?.myRatings?.[scene.key] ?? (null as RatingValue | null)),
  );
  const voted = Boolean(session) && mine.some(Boolean);
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

  if (q.isPending)
    return (
      <div className="shop-voice is-loading" aria-busy="true">
        <span />
        <span />
        <span />
      </div>
    );
  if (q.error && !shop)
    return (
      <div className="shop-voice" role="alert">
        <p className="shop-voice-caption">评价暂时没能加载。</p>
        <button
          type="button"
          className="shop-voice-retry"
          onClick={() => void q.refetch()}
        >
          重新加载
        </button>
      </div>
    );

  return (
    <div className="shop-voice">
      <div className="shop-voice-score">
        <p className="shop-voice-eyebrow">
          食友评价 · {primary.name}
          {scenes.length > 1 && (
            <span className="shop-voice-other">{secondaryText}</span>
          )}
        </p>
        {rate == null ? (
          <p className="shop-voice-empty">还没有食友投过票</p>
        ) : (
          <>
            <div className="shop-voice-number">
              <strong>
                {rate}
                <em>%</em>
              </strong>
              <p className="shop-voice-count">{count} 位食友投过票</p>
            </div>
            <div
              className="shop-voice-meter"
              role="img"
              aria-label={`推荐度 ${rate}%`}
            >
              <i style={{ width: `${rate}%` }} />
            </div>
          </>
        )}
        <p className="shop-voice-caption">
          {rate == null
            ? "你的这一票，会是这家店的第一条评价"
            : rate >= 80
              ? "大多数食友都推荐这家店，可以放心去"
              : rate >= 50
                ? "一半以上的食友觉得还不错"
                : "评价有点两极，翻翻菜品再决定"}
        </p>
      </div>

      <div className="shop-voice-vote">
        <p className="shop-voice-vote-label">你的这一票</p>
        {session ? (
          scenes.map((scene, index) => (
            <div className="shop-voice-group" key={scene.id}>
              {scenes.length > 1 && (
                <span className="shop-voice-scene">{scene.name}</span>
              )}
              <div
                className="shop-voice-options"
                role="group"
                aria-label={`我的${scene.name}评价`}
              >
                <button
                  type="button"
                  className="shop-voice-option is-yes"
                  aria-pressed={mine[index] === "RECOMMEND"}
                  disabled={busy}
                  onClick={() =>
                    void vote(
                      scene,
                      mine[index] === "RECOMMEND" ? null : "RECOMMEND",
                    )
                  }
                >
                  <Icon name="heart" size={17} />
                  <span>推荐</span>
                </button>
                <button
                  type="button"
                  className="shop-voice-option is-no"
                  aria-pressed={mine[index] === "NOT_RECOMMEND"}
                  disabled={busy}
                  onClick={() =>
                    void vote(
                      scene,
                      mine[index] === "NOT_RECOMMEND" ? null : "NOT_RECOMMEND",
                    )
                  }
                >
                  <Icon name="closeCircle" size={17} />
                  <span>不推荐</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <LoginLink className="shop-voice-login" to="/auth/password">
            <Icon name="heart" size={17} />
            登录后给这家店投票
          </LoginLink>
        )}
        <p className="shop-voice-hint">
          {!session
            ? "登录后就能投票，也会记住你的口味"
            : voted
              ? "已记下你的评价，再点一次可以取消"
              : "点一下，帮后面的食友少踩一次雷"}
        </p>
      </div>

      {!!facts.length && (
        <ul className="shop-voice-chips" aria-label="店铺特点">
          {facts.map((fact, index) => (
            <li key={`${fact}-${index}`}>{fact}</li>
          ))}
          {!!v2?.tags?.length && <li key="tags">口味：{v2.tags.join("、")}</li>}
        </ul>
      )}
    </div>
  );
}
