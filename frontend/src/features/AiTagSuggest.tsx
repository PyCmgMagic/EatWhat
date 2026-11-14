import { useState } from "react";
import { useApp } from "../app/state";
import { errorMessage } from "../api/client";
import type { Category } from "../api/models";
import { foodCategories, MAX_DISH_TAGS } from "../api/v2-vocab";
import "./latest.css";

/** The backend looks at no more than this many photos per suggestion. */
export const AI_MAX_PICTURES = 3;

/** A photo already uploaded (key) or still local (file); others are skipped. */
type DraftImage = { file?: File; key?: string };

/**
 * Keys of the first photos of a draft, for the AI suggestion. Photos not
 * uploaded yet are uploaded now; `save` gets the new keys (by file) so saving
 * the dish reuses them instead of uploading the same photo again.
 */
export async function draftPictureKeys(
  images: DraftImage[],
  uploadMany: (
    files: File[],
    biz: "foods",
    onComplete?: (index: number, key: string) => void,
  ) => Promise<string[]>,
  save: (keys: Map<File, string>) => void,
) {
  const first = images
    .filter((image) => image.key || image.file)
    .slice(0, AI_MAX_PICTURES);
  const pending = first.filter(
    (image): image is DraftImage & { file: File } => !image.key && !!image.file,
  );
  const keys = new Map<File, string>();
  if (pending.length) {
    await uploadMany(
      pending.map((image) => image.file),
      "foods",
      (index, key) => keys.set(pending[index].file, key),
    );
    save(keys);
  }
  return first
    .map((image) => image.key ?? (image.file && keys.get(image.file)))
    .filter((key): key is string => !!key);
}

/**
 * Backend v2 can suggest a dish's category and tastes with AI from its name,
 * description, shop and photos (only a suggestion, nothing is saved). When
 * the suggestion matches what is already chosen, it says so and changes
 * nothing.
 */
export function AiTagSuggest({
  restaurantId,
  foodId,
  name,
  description,
  pictures,
  tagOptions,
  current,
  onApply,
  disabled,
  className = "ew-feature ew-meals ew-ai-suggest",
}: {
  restaurantId?: number | null;
  /** Editing an existing dish: its current photos may be someone else's. */
  foodId?: number;
  name: string;
  description?: string;
  /** Up to three photo keys, uploading draft photos first if needed. */
  pictures?: () => Promise<string[]>;
  tagOptions: { id?: number | null; name?: string | null }[];
  current: { category?: string | null; tagIds: number[] };
  onApply: (category: Category | undefined, tagIds: number[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { api } = useApp(),
    [busy, setBusy] = useState(""),
    [note, setNote] = useState("");
  return (
    <div className={className}>
      <b>AI 建议</b>
      <button
        type="button"
        disabled={disabled || !!busy || !name.trim()}
        onClick={async () => {
          setNote("");
          try {
            setBusy(pictures ? "正在准备照片…" : "正在分析…");
            const keys = pictures ? await pictures() : [];
            setBusy("正在分析…");
            const v = await api.suggestDishTags({
              restaurantId: restaurantId ?? undefined,
              foodId,
              name: name.trim(),
              description: description?.trim() || undefined,
              pictures: keys.length ? keys : undefined,
            });
            const category = foodCategories.find((c) => c.name === v?.category)
              ?.id as Category | undefined;
            const tagIds = (v?.tags ?? [])
              .map((t) => tagOptions.find((o) => o.name === t)?.id)
              .filter((id): id is number => typeof id === "number")
              .slice(0, MAX_DISH_TAGS);
            if (!category && !tagIds.length) {
              setNote("AI 没有给出可用的建议。");
              return;
            }
            // No tastes in the reply means no opinion on them, not "none".
            const sameCategory = !category || category === current.category,
              sameTags =
                !tagIds.length ||
                (tagIds.length === current.tagIds.length &&
                  tagIds.every((id) => current.tagIds.includes(id)));
            if (sameCategory && sameTags) {
              setNote("AI 看过了：现在的分类和口味不用改。");
              return;
            }
            onApply(category, tagIds);
            setNote("已按建议填写，可以再调整。");
          } catch (error) {
            setNote(errorMessage(error));
          } finally {
            setBusy("");
          }
        }}
      >
        {busy ||
          (pictures
            ? "根据菜名和照片填写分类和口味"
            : "根据菜名填写分类和口味")}
      </button>
      {note ? (
        <small role="status">{note}</small>
      ) : (
        !name.trim() && <small>先填写菜名</small>
      )}
    </div>
  );
}
