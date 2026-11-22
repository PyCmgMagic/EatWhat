type Exposure = {
  day: string;
  seen: number[];
  lastShown: Record<number, number>;
};
export type DemoExposure = Record<string, Exposure>;

/** The two preview transports share the same per-meal paging and pick behavior. */
export function demoRecommendationPage<T extends { id?: number | null }>(
  pool: T[],
  history: DemoExposure,
  viewer: number | undefined,
  mealTime: string,
  page: number,
  size: number,
  pick: boolean,
) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Shanghai",
  });
  const scope = `${viewer}:${mealTime}`;
  const previous = history[scope];
  const exposure: Exposure =
    previous?.day === today
      ? previous
      : { day: today, seen: [], lastShown: {} };
  const seen = new Set(exposure.seen);
  const ranked = viewer
    ? [...pool].sort(
        (a, b) =>
          (exposure.lastShown[a.id!] ?? 0) - (exposure.lastShown[b.id!] ?? 0),
      )
    : pool;
  let candidates = viewer
    ? ranked.filter((shop) => !seen.has(shop.id!))
    : ranked;
  const limit = pick ? 1 : size;
  if (viewer && (pick || page === 1) && candidates.length < limit) {
    candidates = [
      ...candidates,
      ...ranked.filter((shop) => seen.has(shop.id!)),
    ];
    seen.clear();
  }
  const start = viewer || pick ? 0 : (page - 1) * size;
  const items =
    pick && candidates.length
      ? [candidates[Math.floor(Math.random() * Math.min(5, candidates.length))]]
      : candidates.slice(start, start + limit);
  if (viewer && items.length) {
    for (const shop of items) {
      seen.add(shop.id!);
      exposure.lastShown[shop.id!] = Date.now();
    }
    history[scope] = { ...exposure, seen: [...seen] };
  }
  const remaining = Math.max(0, candidates.length - start - items.length);
  return {
    items,
    currentPage: page,
    totalItems: candidates.length,
    totalPages: viewer
      ? page + Math.ceil(remaining / size)
      : Math.ceil(candidates.length / size),
    hasNext: remaining > 0,
  };
}
