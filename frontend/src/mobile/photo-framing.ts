export type PhotoFraming = { x: number; y: number; zoom: number };
export const PHOTO_FRAMING_SIZE = 300;

/** Drag offsets use a 300px crop circle, independent of the rendered size. */
export function photoFraming(
  width: number,
  height: number,
  crop: PhotoFraming,
  frame = PHOTO_FRAMING_SIZE,
) {
  const result = rectPhotoFraming(width, height, crop, 1, frame);
  const { x, y, width: size } = result.source;
  return { ...result, source: { x, y, size } };
}

/** For a rectangular frame, both drag axes use the same scale as its width. */
export function rectPhotoFraming(
  width: number,
  height: number,
  crop: PhotoFraming,
  aspect: number,
  frame = PHOTO_FRAMING_SIZE,
) {
  const zoom = Math.max(1, crop.zoom);
  const sourceWidth = Math.min(width, height * aspect) / zoom;
  const sourceHeight = sourceWidth / aspect;
  const scale = PHOTO_FRAMING_SIZE / sourceWidth;
  const maxX = ((width - sourceWidth) * scale) / 2;
  const maxY = ((height - sourceHeight) * scale) / 2;
  const x = Math.max(-maxX, Math.min(maxX, crop.x));
  const y = Math.max(-maxY, Math.min(maxY, crop.y));
  const displayWidth = (width / sourceWidth) * frame;
  const displayHeight = (height / sourceWidth) * frame;
  return {
    crop: { x, y, zoom },
    source: {
      x: (width - sourceWidth) / 2 - x / scale,
      y: (height - sourceHeight) / 2 - y / scale,
      width: sourceWidth,
      height: sourceHeight,
    },
    image: {
      left: (frame - displayWidth) / 2 + (x * frame) / PHOTO_FRAMING_SIZE,
      top:
        (frame / aspect - displayHeight) / 2 + (y * frame) / PHOTO_FRAMING_SIZE,
      width: displayWidth,
      height: displayHeight,
    },
  };
}
