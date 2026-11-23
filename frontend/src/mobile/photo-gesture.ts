import type { PhotoFraming } from "./photo-framing";

type Point = { x: number; y: number };
export const MAX_PHOTO_ZOOM = 3;

/** Points use the crop circle's coordinates, relative to its centre. */
export function createPhotoGesture() {
  const pointers = new Map<number, Point>();
  let crop: PhotoFraming = { x: 0, y: 0, zoom: 1 };
  let start:
    { crop: PhotoFraming; centre: Point; distance: number } | undefined;
  function measure() {
    const [a, b] = [...pointers.values()];
    return a
      ? {
          centre: b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a,
          distance: b ? Math.hypot(b.x - a.x, b.y - a.y) : 0,
        }
      : undefined;
  }
  function rebase() {
    const points = measure();
    start = points ? { ...points, crop } : undefined;
  }
  return {
    down(id: number, point: Point, framing: PhotoFraming) {
      if (pointers.has(id) || pointers.size === 2) return false;
      if (!pointers.size) crop = framing;
      pointers.set(id, point);
      rebase();
      return true;
    },
    move(
      id: number,
      point: Point,
      constrain: (framing: PhotoFraming) => PhotoFraming,
    ) {
      if (!pointers.has(id) || !start) return undefined;
      pointers.set(id, point);
      const points = measure()!;
      if (pointers.size === 2 && start.distance === 0) {
        if (points.distance > 0) rebase();
        return crop;
      }
      const requestedZoom =
        start.distance > 0
          ? (start.crop.zoom * points.distance) / start.distance
          : start.crop.zoom;
      const zoom = Math.max(1, Math.min(MAX_PHOTO_ZOOM, requestedZoom));
      const ratio = zoom / start.crop.zoom;
      crop = constrain({
        x: points.centre.x - (start.centre.x - start.crop.x) * ratio,
        y: points.centre.y - (start.centre.y - start.crop.y) * ratio,
        zoom,
      });
      // Discard movement past the zoom limit so reversing responds immediately.
      if (zoom !== requestedZoom) rebase();
      return crop;
    },
    up(id: number) {
      if (pointers.delete(id)) rebase();
    },
    reset() {
      pointers.clear();
      start = undefined;
    },
  };
}
