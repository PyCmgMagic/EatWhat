import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useApp } from "../app/state";
import { useDebouncedSearch } from "../app/search";
import "./dish-duplicate-hint.css";

/** Shorter names match too many dishes ("面") to be a useful hint. */
const MIN_LENGTH = 2;

/**
 * While a dish is being named, tells the person this shop already has it.
 * A dish shared under dine-in is hidden under delivery when the shop has
 * delivery off, so people looking from delivery may upload it again. Only a
 * hint: publishing a different dish with a similar name is still allowed.
 */
export function DishDuplicateHint({
  restaurantId,
  name,
}: {
  restaurantId?: number | null;
  name: string;
}) {
  const { api } = useApp();
  const keyword = useDebouncedSearch(name.trim(), 400);
  const enabled = !!restaurantId && [...keyword].length >= MIN_LENGTH;
  const hits = useQuery({
    queryKey: ["foods", "duplicates", restaurantId, keyword],
    queryFn: ({ signal }) => api.foodDuplicates(restaurantId!, keyword, signal),
    enabled,
    staleTime: 30_000,
    // Keep the last hint while the next name is checked, so it does not blink.
    placeholderData: keepPreviousData,
  });
  // A failed check never blocks publishing: say nothing.
  const list = enabled ? (hits.data ?? []).filter((d) => d.id) : [];
  if (!list.length) return null;
  const same = list.find((d) => d.sameName);
  if (same)
    return (
      <p className="dish-duplicate-hint" role="status">
        这家店已经有「{same.name}」了，可能是别人在堂食里分享的，不用重复上传。
        <Link to={`/foods/${same.id}`}>去看看 →</Link>
      </p>
    );
  return (
    <p className="dish-duplicate-hint" role="status">
      这家店已有相似的菜：
      {list.map((d, i) => (
        <span key={d.id}>
          {i > 0 && "、"}
          <Link to={`/foods/${d.id}`}>{d.name}</Link>
        </span>
      ))}
      。是同一道菜就不用重复上传了。
    </p>
  );
}
