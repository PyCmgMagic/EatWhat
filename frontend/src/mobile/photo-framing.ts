export type PhotoFraming = { x: number; y: number; zoom: number };

/** Drag offsets use a 300px crop circle, independent of the rendered size. */
export function photoFraming(
  width: number,
  height: number,
  crop: PhotoFraming,
  frame = 300,
) {
  const shortest = Math.min(width, height);
  const zoom = Math.max(1, crop.zoom);
  const maxX = ((width / shortest) * 300 * zoom - 300) / 2;
  const maxY = ((height / shortest) * 300 * zoom - 300) / 2;
  const x = Math.max(-maxX, Math.min(maxX, crop.x));
  const y = Math.max(-maxY, Math.min(maxY, crop.y));
  const size = shortest / zoom;
  const displayWidth = (width / size) * frame;
  const displayHeight = (height / size) * frame;
  return {
    crop: { x, y, zoom },
    source: {
      x: (width - size) / 2 - (x * size) / 300,
      y: (height - size) / 2 - (y * size) / 300,
      size,
    },
    image: {
      left: (frame - displayWidth) / 2 + (x * frame) / 300,
      top: (frame - displayHeight) / 2 + (y * frame) / 300,
      width: displayWidth,
      height: displayHeight,
    },
  };
}
