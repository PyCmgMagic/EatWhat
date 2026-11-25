import { useState, type ImgHTMLAttributes } from "react";
import "./avatar-image.css";

export const DEFAULT_AVATAR_SRC = "/assets/avatars/default-pig.webp";

/** Accepts a resolved media URL or a local upload preview; failure stays local to that URL. */
export function AvatarImage({
  src,
  alt = "",
  className = "",
  onError,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const fallback = !src || src === failedSrc;
  return (
    <img
      {...props}
      src={fallback ? DEFAULT_AVATAR_SRC : src}
      alt={alt}
      className={`avatar-image ${className}`.trim()}
      data-default-avatar={fallback || undefined}
      decoding="async"
      onError={(event) => {
        if (!fallback) {
          setFailedSrc(src);
          onError?.(event);
        }
      }}
    />
  );
}
