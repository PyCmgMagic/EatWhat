import type { Schema } from "../api/models";

export type HistoryItem = Schema["BrowseHistoryItemDTOResponse"];
export type HistoryKind = "food" | "restaurant";
export function historyTime(
  value: number | null | undefined,
  now = Date.now(),
) {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return undefined;
  const milliseconds = value! < 100_000_000_000 ? value! * 1000 : value!;
  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) && milliseconds <= now + 300_000
    ? date
    : undefined;
}
export function historyEntry(item: HistoryItem, requested: HistoryKind) {
  const kind = item.targetType == null ? requested : item.targetType;
  const content =
    kind === "food"
      ? item.food
      : kind === "restaurant"
        ? item.restaurant
        : undefined;
  const id = item.targetId ?? content?.id;
  const valid =
    Number.isSafeInteger(id) &&
    (id ?? 0) > 0 &&
    !!content?.name &&
    (content.id == null || content.id === id);
  return {
    kind,
    content,
    href: valid
      ? `/${kind === "food" ? "foods" : "restaurants"}/${id}`
      : undefined,
  };
}
export function historyGroups(items: HistoryItem[], now = Date.now()) {
  const dayKey = (date: Date) =>
    `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const today = new Date(now),
    yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map<
    string,
    { key: string; label: string; items: HistoryItem[] }
  >();
  for (const item of [...items].sort(
    (a, b) =>
      (historyTime(b.viewedAt, now)?.getTime() ?? 0) -
      (historyTime(a.viewedAt, now)?.getTime() ?? 0),
  )) {
    const date = historyTime(item.viewedAt, now),
      key = date ? dayKey(date) : "unknown";
    const label = !date
      ? "时间待确认"
      : key === dayKey(today)
        ? "今天"
        : key === dayKey(yesterday)
          ? "昨天"
          : `${date.getFullYear() === today.getFullYear() ? "" : date.getFullYear() + "年"}${date.getMonth() + 1}月${date.getDate()}日`;
    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()];
}
