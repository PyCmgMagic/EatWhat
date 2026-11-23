export type PhotoFraming = { x: number; y: number; zoom: number };
export const PHOTO_FRAMING_SIZE = 300;

/** Drag offsets use a 300px crop circle, independent of the rendered size. */
export function photoFraming(
  width: number,
  height: number,
  crop: PhotoFraming,
  frame = PHOTO_FRAMING_SIZE,
) {
  const shortest = Math.min(width, height);
  const zoom = Math.max(1, crop.zoom);
  const maxX = (((width / shortest) * zoom - 1) * PHOTO_FRAMING_SIZE) / 2;
  const maxY = (((height / shortest) * zoom - 1) * PHOTO_FRAMING_SIZE) / 2;
  const x = Math.max(-maxX, Math.min(maxX, crop.x));
  const y = Math.max(-maxY, Math.min(maxY, crop.y));
  const size = shortest / zoom;
  const displayWidth = (width / size) * frame;
  const displayHeight = (height / size) * frame;
  return {
    crop: { x, y, zoom },
    source: {
      x: (width - size) / 2 - (x * size) / PHOTO_FRAMING_SIZE,
      y: (height - size) / 2 - (y * size) / PHOTO_FRAMING_SIZE,
      size,
    },
    image: {
      left: (frame - displayWidth) / 2 + (x * frame) / PHOTO_FRAMING_SIZE,
      top: (frame - displayHeight) / 2 + (y * frame) / PHOTO_FRAMING_SIZE,
      width: displayWidth,
      height: displayHeight,
    },
  };
}
