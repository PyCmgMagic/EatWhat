import { useState } from "react";
import { useApp } from "../app/state";
import { errorMessage } from "../api/client";
import type { Category } from "../api/models";
import { foodCategories, MAX_DISH_TAGS } from "../api/v2-vocab";
import "./latest.css";

/**
 * Backend v2 can suggest a dish's category and tastes with AI (only a
 * suggestion, nothing is saved). Uses the same checkbox rows as the form.
 */
export function AiTagSuggest({
  restaurantId,
  name,
  description,
  tagOptions,
  onApply,
  disabled,
}: {
  restaurantId?: number | null;
  name: string;
  description?: string;
  tagOptions: { id?: number | null; name?: string | null }[];
  onApply: (category: Category | undefined, tagIds: number[]) => void;
  disabled?: boolean;
}) {
  const { api } = useApp(),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  return (
    <div className="ew-feature ew-meals ew-ai-suggest">
      <b>AI 建议</b>
      <button
        type="button"
        disabled={disabled || busy || !name.trim()}
        onClick={async () => {
          setBusy(true);
          setNote("");
          try {
            const v = await api.suggestDishTags({
              restaurantId: restaurantId ?? undefined,
              name: name.trim(),
              description: description?.trim() || undefined,
            });
            const category = foodCategories.find(
              (c) => c.name === v?.category,
            )?.id;
            const tagIds = (v?.tags ?? [])
              .map((t) => tagOptions.find((o) => o.name === t)?.id)
              .filter((id): id is number => typeof id === "number")
              .slice(0, MAX_DISH_TAGS);
            onApply(category, tagIds);
            setNote(
              category || tagIds.length
                ? "已按建议填写，可以再调整。"
                : "AI 没有给出可用的建议。",
            );
          } catch (error) {
            setNote(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "正在分析…" : "根据菜名填写分类和口味"}
      </button>
      {note ? (
        <small role="status">{note}</small>
      ) : (
        !name.trim() && <small>先填写菜名</small>
      )}
    </div>
  );
}
