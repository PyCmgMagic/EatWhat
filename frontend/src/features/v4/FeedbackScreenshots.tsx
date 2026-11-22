import { useLayoutEffect, useRef, useState } from "react";
import { FoodPhotoPicker, type EditableFoodPhoto } from "../FoodPhotoPicker";
import { verifyPhoto } from "../../mobile/photos";

export async function checkScreenshots(files: File[]) {
  const valid: File[] = [];
  const unreadable: string[] = [];
  for (const file of files) {
    try {
      await verifyPhoto(file);
      valid.push(file);
    } catch {
      unreadable.push(file.name);
    }
  }
  return { valid, unreadable };
}

export function FeedbackScreenshots({
  files,
  disabled,
  onAdd,
  onRemove,
  compact = false,
}: {
  files: File[];
  disabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  compact?: boolean;
}) {
  const urls = useRef(new Map<File, string>());
  const [photos, setPhotos] = useState<EditableFoodPhoto[]>([]);

  // The draft keeps Files while this view owns their temporary preview URLs.
  useLayoutEffect(() => {
    const previews = urls.current;
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
      previews.clear();
    };
  }, []);
  useLayoutEffect(() => {
    const previews = urls.current;
    const selected = new Set(files);
    for (const [file, url] of previews) {
      if (selected.has(file)) continue;
      URL.revokeObjectURL(url);
      previews.delete(file);
    }
    setPhotos(
      files.map((file) => {
        const url = previews.get(file) ?? URL.createObjectURL(file);
        previews.set(file, url);
        return { file, url };
      }),
    );
  }, [files]);

  return (
    <FoodPhotoPicker
      photos={photos}
      feedback
      compact={compact}
      disabled={disabled}
      onAdd={onAdd}
      onRemove={onRemove}
    />
  );
}
