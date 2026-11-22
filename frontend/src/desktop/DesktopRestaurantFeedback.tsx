import { useQueryClient } from "@tanstack/react-query";
import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Restaurant } from "../api/models";
import {
  shopRatingScenes,
  type RatingValue,
  type V2Shop,
} from "../api/v2-vocab";
import { LoginLink } from "../app/auth-dialog";
import { useApp } from "../app/state";
import { useCommand } from "../features/v4/shared";

type Shop = Restaurant & V2Shop;
type Scene = ReturnType<typeof shopRatingScenes>[number];
const voteOptions = [
  { value: "RECOMMEND", label: "推荐", icon: ThumbsUp },
  { value: "NOT_RECOMMEND", label: "不推荐", icon: ThumbsDown },
] as const;

function SceneReview({
  id,
  shop,
  scene,
}: {
  id: number;
  shop: Shop;
  scene: Scene;
}) {
  const { api, session } = useApp();
  const cache = useQueryClient();
  const task = useCommand();
  // Older shop details only carry an overall rating, without scene totals.
  const overall =
    !shop.dineIn && !shop.delivery && shopRatingScenes(shop).length === 1;
  const stat = shop[scene.key];
  const count = (overall ? shop.ratingCount : stat?.count) ?? 0;
  const rate = overall
    ? shop.recommendationRate
    : stat?.rate != null
      ? Math.round(stat.rate * 100)
      : null;
  const syncing = shop.ratingSummaryState === "SYNC_PENDING";
  const showRate = !syncing && count > 0 && rate != null;
  const mine = shop.myRatings?.[scene.key];

  function vote(value: RatingValue) {
    void task.run(
      () =>
        api.rateRestaurantScene(id, scene.id, mine === value ? null : value),
      () => cache.invalidateQueries({ queryKey: ["restaurants"] }),
    );
  }

  return (
    <div className="pc-shop-scene">
      <div className="pc-shop-score" aria-live="polite" aria-atomic="true">
        {showRate && (
          <strong>
            {rate}
            <small>%</small>
          </strong>
        )}
        <div>
          <h3>
            {overall ? "店铺" : scene.name}
            {showRate ? "推荐率" : "评价"}
          </h3>
          <span>
            {syncing
              ? "评价同步中"
              : count > 0
                ? `${count} 人评价`
                : "暂无评价"}
          </span>
        </div>
      </div>
      {session ? (
        <div
          className="pc-shop-votes"
          role="group"
          aria-label={`我的${scene.name}评价`}
          aria-busy={task.busy}
        >
          {voteOptions.map(({ value, label, icon }) => {
            const selected = mine === value;
            const Icon = selected ? Check : icon;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                title={selected ? "再次点击可撤销评价" : undefined}
                disabled={
                  task.busy ||
                  task.uncertain ||
                  shop.personalState === "SYNC_PENDING"
                }
                onClick={() => vote(value)}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <LoginLink
          className="pc-shop-review-login"
          to="/auth/password"
          aria-label={`登录后评价${scene.name}体验`}
        >
          登录后评价
        </LoginLink>
      )}
    </div>
  );
}

export function DesktopRestaurantFeedback({
  id,
  shop,
}: {
  id: number;
  shop: Shop;
}) {
  return (
    <section className="pc-shop-reviews" aria-label="食友评价">
      <h2 className="sr-only">食友评价</h2>
      {shopRatingScenes(shop).map((scene) => (
        <SceneReview key={scene.id} id={id} shop={shop} scene={scene} />
      ))}
    </section>
  );
}
