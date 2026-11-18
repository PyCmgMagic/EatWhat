import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useApp } from "../app/state";
import { accessPromptPresented, errorMessage } from "../api/client";
import type { Food } from "../api/models";
import type { DishRating, FoodRated, V2Food } from "../api/v2-vocab";
import { useActionAccess } from "./access";
import "./food-rating.css";

/** "4.6 分 · 12 人评分"; empty until somebody has rated the dish. */
export function ratingText(rating?: DishRating | null) {
  const count = rating?.count ?? 0;
  if (!count || rating?.score == null) return "";
  return `${rating.score.toFixed(1)} 分 · ${count} 人评分`;
}

const SCORE_LABELS: Record<number, string> = {
  1: "不合口味",
  2: "一般",
  3: "还行",
  4: "推荐",
  5: "超赞",
};

/**
 * The dish's average score and the viewer's own 1-5 rating. A like means
 * "I want to eat this"; the rating is the opinion after eating it.
 */
export function FoodRating({ food }: { food: Food }) {
  const { api, toast } = useApp(),
    cache = useQueryClient(),
    access = useActionAccess(),
    [busy, setBusy] = useState(false),
    [hover, setHover] = useState(0);
  const id = food.id,
    { rating, myRating } = food as Food & V2Food;
  if (!id) return null;
  const mine = myRating ?? 0,
    count = rating?.count ?? 0,
    activeScore = hover || mine;
  const send = async (score: number | null) => {
    if (busy) return;
    if (
      !access({
        path: `/foods/${id}/rating`,
        options: { method: score == null ? "DELETE" : "PUT" },
      })
    )
      return;
    setBusy(true);
    try {
      const next: FoodRated =
        score == null
          ? await api.unrateFood(id)
          : await api.rateFood(id, score);
      // Only this dish changes. The recommendation feed is left alone: asking
      // for it again would use up the next batch of today's recommendations.
      cache.setQueryData<Food>(["foods", "detail", id], (old) =>
        old ? { ...old, rating: next.rating, myRating: next.myRating } : old,
      );
      toast(score == null ? "已撤销评分" : `已打 ${score} 分`, {
        tone: "success",
      });
    } catch (error) {
      if (!accessPromptPresented(error))
        toast(errorMessage(error), { tone: "error" });
    } finally {
      setBusy(false);
      setHover(0);
    }
  };
  return (
    <section className="food-rating" aria-label="菜品评分">
      <div className="food-rating-top">
        <div className="food-rating-summary">
          {count && rating?.score != null ? (
            <>
              <div className="food-rating-score">
                <strong>{rating.score.toFixed(1)}</strong>
                <span>/ 5</span>
              </div>
              <div className="food-rating-meta">
                <span>食友评分</span>
                <small>{count} 人已评</small>
              </div>
            </>
          ) : (
            <div className="food-rating-empty">
              <strong>暂无评分</strong>
              <span>吃过这道菜？点亮星星打个分</span>
            </div>
          )}
        </div>
        <div className="food-rating-status">
          {hover ? (
            <span className="food-rating-hint">
              {hover} 分 · {SCORE_LABELS[hover]}
            </span>
          ) : mine ? (
            <>
              <span className="food-rating-mine-badge">
                已评 {mine} 分 · {SCORE_LABELS[mine]}
              </span>
              <button
                type="button"
                className="food-rating-undo"
                disabled={busy}
                onClick={() => void send(null)}
              >
                撤销
              </button>
            </>
          ) : (
            <span className="food-rating-hint">点击星星评分</span>
          )}
        </div>
      </div>
      <div
        className="food-rating-stars"
        role="group"
        aria-label="我的评分"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            className={score <= activeScore ? "is-on" : undefined}
            aria-label={`打 ${score} 分`}
            aria-pressed={mine === score}
            disabled={busy}
            onMouseEnter={() => setHover(score)}
            onClick={() => {
              if (score !== mine) void send(score);
            }}
          >
            <Star size={22} strokeWidth={1.85} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
