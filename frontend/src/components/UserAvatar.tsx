import { useState } from "react";
import { mediaUrl } from "../api/models";
import "./user-avatar.css";

export function UserAvatar({
  avatar,
  name,
  className,
}: {
  avatar?: string | null;
  name: string;
  className: string;
}) {
  const src = mediaUrl(avatar);
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <span className={`user-avatar ${className}`} aria-hidden="true">
      {src && src !== failedSrc ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        Array.from(name)[0] || "食"
      )}
    </span>
  );
}
