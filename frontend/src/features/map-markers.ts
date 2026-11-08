export type ProjectedShop<T> = {
  key: string;
  x: number;
  y: number;
  lng: number;
  lat: number;
  value: T;
};
export type MarkerGroup<T> = {
  key: string;
  members: ProjectedShop<T>[];
  x: number;
  y: number;
  lng: number;
  lat: number;
  samePlace: boolean;
};

/** Group by screen distance, so zooming naturally reveals individual shops. */
export function groupMapMarkers<T>(
  points: ProjectedShop<T>[],
  distance = 48,
): MarkerGroup<T>[] {
  const sorted = points
    .filter((p) => [p.x, p.y, p.lng, p.lat].every(Number.isFinite))
    .sort((a, b) => a.key.localeCompare(b.key));
  const remaining = new Set(sorted);
  const groups: MarkerGroup<T>[] = [];
  for (const first of sorted) {
    if (!remaining.delete(first)) continue;
    const members = [first];
    for (let i = 0; i < members.length; i++) {
      for (const other of remaining) {
        if (
          Math.hypot(members[i].x - other.x, members[i].y - other.y) < distance
        ) {
          remaining.delete(other);
          members.push(other);
        }
      }
    }
    const mean = (key: "x" | "y" | "lng" | "lat") =>
      members.reduce((sum, p) => sum + p[key], 0) / members.length;
    const samePlace = members.every(
      (p) =>
        Math.hypot(
          (p.lng - first.lng) * Math.cos((first.lat * Math.PI) / 180),
          p.lat - first.lat,
        ) *
          111320 <=
        3,
    );
    groups.push({
      key: members
        .map((p) => p.key)
        .sort()
        .join(":"),
      members,
      x: mean("x"),
      y: mean("y"),
      lng: mean("lng"),
      lat: mean("lat"),
      samePlace,
    });
  }
  return groups;
}

export type MapRect = { x: number; y: number; width: number; height: number };
export type MapLabel = MapRect & {
  key: string;
  selected: boolean;
  markerX: number;
  markerY: number;
};
export function overlaps(a: MapRect, b: MapRect, gap = 4) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

/** Labels avoid our marker hit areas, controls and higher-priority labels. */
export function placeMapLabels(
  labels: MapLabel[],
  markers: MapRect[],
  bounds: { width: number; height: number },
  reserved: MapRect[] = [],
) {
  const placed = new Map<string, MapRect>();
  const occupied = [...markers, ...reserved];
  for (const label of [...labels].sort(
    (a, b) =>
      Number(b.selected) - Number(a.selected) || a.key.localeCompare(b.key),
  )) {
    const { markerX: x, markerY: y, width, height } = label;
    if (x < 0 || x > bounds.width || y < 0 || y > bounds.height) continue;
    const positions = [
      { x: x - width / 2, y: y - 48 - height, width, height },
      { x: x + 30, y: y - 24 - height / 2, width, height },
      { x: x - 30 - width, y: y - 24 - height / 2, width, height },
      { x: x - width / 2, y: y + 8, width, height },
    ];
    const fits = (r: MapRect) =>
      r.x >= 8 &&
      r.y >= 8 &&
      r.x + r.width <= bounds.width - 8 &&
      r.y + r.height <= bounds.height - 8;
    let rect = positions.find(
      (r) => fits(r) && !occupied.some((other) => overlaps(r, other)),
    );
    if (!rect && label.selected) {
      // A selected name remains available even when the map is very crowded.
      rect = positions
        .map((r) => ({
          ...r,
          x: Math.max(8, Math.min(bounds.width - width - 8, r.x)),
          y: Math.max(8, Math.min(bounds.height - height - 8, r.y)),
        }))
        .filter(fits)
        .find((r) => !reserved.some((other) => overlaps(r, other)));
    }
    if (rect) {
      placed.set(label.key, rect);
      occupied.push(rect);
    }
  }
  return placed;
}
