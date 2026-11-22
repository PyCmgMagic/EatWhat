import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Star } from "lucide-react";
import { useApp } from "../app/state";
import { accessPromptPresented, errorMessage } from "../api/client";
import type { Food } from "../api/models";
import type { DishRating, FoodRated, V2Food } from "../api/v2-vocab";
import { Modal } from "../components/ui";
import { useActionAccess } from "./access";
import { playRatingMotion, stopRatingMotion } from "./food-rating-motion";
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
  const { api } = useApp();
  const cache = useQueryClient();
  const access = useActionAccess();
  // Zero clears the rating. Null means there is no request in flight.
  const [pending, setPending] = useState<number | null>(null);
  const [cleared, setCleared] = useState(false);
  const [hover, setHover] = useState(0);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const stars = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = stars.current;
    return () => stopRatingMotion(row);
  }, [trigger]);
  const [error, setError] = useState("");
  const id = food.id,
    { rating, myRating } = food as Food & V2Food;
  if (!id) return null;
  const mine = myRating ?? 0;
  const busy = pending !== null;
  const selected = pending ?? mine;
  const lit = hover || selected;
  const count = rating?.count ?? 0;
  let status = cleared ? "已撤销评分" : "点选即保存";
  if (mine) status = `已评 ${mine} 分 · 再点第 ${mine} 颗星可撤销`;
  if (busy) status = pending === 0 ? "正在撤销…" : `正在保存 ${pending} 分…`;

  const select = async (score: number) => {
    if (busy) return;
    const remove = score === mine;
    if (
      !access({
        path: `/foods/${id}/rating`,
        options: { method: remove ? "DELETE" : "PUT" },
      })
    )
      return;
    setHover(0);
    setError("");
    playRatingMotion(stars.current, mine, remove ? 0 : score);
    setPending(remove ? 0 : score);
    try {
      const next: FoodRated = remove
        ? await api.unrateFood(id)
        : await api.rateFood(id, score);
      // Only this dish changes. The recommendation feed is left alone: asking
      // for it again would use up the next batch of today's recommendations.
      cache.setQueryData<Food>(["foods", "detail", id], (old) =>
        old ? { ...old, rating: next.rating, myRating: next.myRating } : old,
      );
      setCleared(next.myRating == null);
    } catch (cause) {
      stopRatingMotion(stars.current);
      if (!accessPromptPresented(cause)) setError(errorMessage(cause));
    } finally {
      setPending(null);
    }
  };
  return (
    <section className="food-rating" aria-label="菜品评分">
      <button
        type="button"
        className="food-rating-entry"
        aria-haspopup="dialog"
        aria-expanded={!!trigger}
        onClick={(event) => {
          setHover(0);
          setCleared(false);
          setTrigger(event.currentTarget);
        }}
      >
        <span className="food-rating-summary">
          <Star size={17} strokeWidth={1.8} aria-hidden="true" />
          {count > 0 && rating?.score != null ? (
            <>
              <strong>
                <span className="sr-only">食友评分 </span>
                {rating.score.toFixed(1)}
              </strong>
              <small>{count} 人已评</small>
            </>
          ) : (
            <span>暂无评分</span>
          )}
        </span>
        <span className="food-rating-action">
          {error ? "重试评分" : mine ? `我的 ${mine} 分` : "评分"}
          <ChevronRight size={16} aria-hidden="true" />
        </span>
      </button>
      {trigger && (
        <Modal
          title="给这道菜评分"
          className="food-rating-dialog"
          returnFocus={trigger}
          motionOrigin={trigger}
          onClose={() => setTrigger(null)}
        >
          <div
            ref={stars}
            className="food-rating-stars"
            role="group"
            aria-label="我的评分"
            onPointerLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                className={score <= lit ? "is-on" : undefined}
                aria-label={`打 ${score} 分`}
                aria-pressed={selected === score}
                data-preview={hover === score || undefined}
                aria-description={
                  mine === score ? "再次选择可撤销评分" : SCORE_LABELS[score]
                }
                aria-disabled={busy}
                title={
                  mine === score
                    ? "撤销评分"
                    : `${score} 分 · ${SCORE_LABELS[score]}`
                }
                onPointerEnter={(event) => {
                  if (!busy && event.pointerType === "mouse") setHover(score);
                }}
                onKeyDown={() => setHover(0)}
                onClick={() => void select(score)}
              >
                <span className="food-rating-mark" aria-hidden="true">
                  <Star
                    className="food-rating-glyph"
                    size={30}
                    strokeWidth={1.65}
                  />
                  <svg className="food-rating-sparks" viewBox="0 0 52 52">
                    <path d="m40 3 1.4 4.2L46 9l-4.6 1.5L40 15l-1.5-4.5L34 9l4.5-1.8Z" />
                    <path d="m7 19 1.1 3L11 23l-2.9 1L7 27l-1-3-3-1 3-1Z" />
                    <circle cx="46" cy="30" r="1.6" />
                  </svg>
                </span>
                <span aria-hidden="true">{SCORE_LABELS[score]}</span>
              </button>
            ))}
          </div>
          <p className="food-rating-status" role={error ? "alert" : "status"}>
            {error || status}
          </p>
        </Modal>
      )}
    </section>
  );
}
