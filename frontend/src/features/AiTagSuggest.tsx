import { useState } from "react";
import { Sparkles } from "lucide-react";
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
  compact = false,
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
  compact?: boolean;
  className?: string;
}) {
  const { api, toast } = useApp(),
    [busy, setBusy] = useState(""),
    [note, setNote] = useState("");
  const report = (
    message: string,
    short = message,
    tone: "info" | "error" = "info",
  ) => {
    if (compact) toast(short, { tone });
    else setNote(message);
  };
  return (
    <div className={className}>
      {!compact && <b>AI 建议</b>}
      <button
        type="button"
        aria-label={compact ? "AI 帮填分类和口味" : undefined}
        aria-busy={!!busy}
        title={
          compact
            ? !name.trim()
              ? "先填写菜名"
              : "根据菜名和照片填写分类和口味"
            : undefined
        }
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
              report("AI 没有给出可用的建议。");
              return;
            }
            // The model is told to leave tastes empty when the dish has no
            // obvious one, so an empty list means "no need to pick". Never
            // clear tastes the user chose: photos cannot show spiciness.
            const sameCategory = !category || category === current.category;
            if (!tagIds.length) {
              const name = foodCategories.find((c) => c.id === category)?.name;
              const chosen = current.tagIds
                .map((id) => tagOptions.find((o) => o.id === id)?.name)
                .filter(Boolean)
                .join("、");
              const prefix = sameCategory
                ? name
                  ? `分类是「${name}」没错啦，`
                  : ""
                : `已按建议把分类改为「${name}」，`;
              if (!sameCategory) onApply(category, []);
              report(
                chosen
                  ? `💡 ${prefix}AI 没识别出明显口味，不过如果你吃着觉得「${chosen}」，按你的感觉来就好！`
                  : `💡 ${prefix}口味不用刻意选哦～`,
                sameCategory
                  ? "未识别出明显口味，保留当前选择。"
                  : "已填写分类，保留已选口味。",
              );
              return;
            }
            const sameTags =
              tagIds.length === current.tagIds.length &&
              tagIds.every((id) => current.tagIds.includes(id));
            if (sameCategory && sameTags) {
              report(
                "AI 看过了：现在的分类和口味不用改。",
                "当前分类和口味无需调整。",
              );
              return;
            }
            onApply(category, tagIds);
            report(
              "已按建议填写，可以再调整。",
              "已填写分类和口味，可继续调整。",
            );
          } catch (error) {
            report(errorMessage(error), errorMessage(error), "error");
          } finally {
            setBusy("");
          }
        }}
      >
        {compact && <Sparkles size={14} aria-hidden="true" />}
        {compact
          ? busy
            ? "分析中…"
            : "AI 帮填"
          : busy ||
            (pictures
              ? "根据菜名和照片填写分类和口味"
              : "根据菜名填写分类和口味")}
      </button>
      {!compact &&
        (note ? (
          <small role="status">{note}</small>
        ) : (
          !name.trim() && <small>先填写菜名</small>
        ))}
    </div>
  );
}
