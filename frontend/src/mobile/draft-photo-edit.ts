import { stagePalette } from "../api/food-display";
import type { PhotoFraming } from "./photo-framing";

export type DraftPhoto = {
  file: File;
  url: string;
  key?: string;
  original?: File;
  framing?: PhotoFraming;
  stageCandidates?: string[];
  preparing?: boolean;
};

export function draftStage({
  stage,
  images,
}: {
  stage?: string;
  images: readonly DraftPhoto[];
}) {
  return stage ?? images[0]?.stageCandidates?.[0] ?? stagePalette.broth;
}

/** A crop preview stays separate from the photos committed to the draft. */
export type DraftPhotoEdit = {
  source: File;
  url: string;
  targetUrl?: string;
  framing: PhotoFraming;
  candidates: string[];
};

export function applyPhotoEdit(
  images: readonly DraftPhoto[],
  edit: Pick<DraftPhotoEdit, "source" | "targetUrl">,
  result: { file: File; colors: string[] },
  url: string,
  framing: PhotoFraming,
): DraftPhoto[] {
  const photo: DraftPhoto = {
    file: result.file,
    url,
    original: edit.source,
    framing: { ...framing },
    stageCandidates: result.colors,
  };
  if (edit.targetUrl === undefined) {
    if (images.length >= 9) throw new Error("每次分享最多选择 9 张图片。");
    return [...images, photo];
  }
  const index = images.findIndex((image) => image.url === edit.targetUrl);
  if (index < 0) throw new Error("这张照片已被移除，请重新选择。");
  return images.map((image, i) => (i === index ? photo : image));
}
