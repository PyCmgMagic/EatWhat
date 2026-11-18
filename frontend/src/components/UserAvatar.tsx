import { useState } from "react";
import { Link } from "react-router-dom";
import { mediaUrl, parseId } from "../api/models";
import "./user-avatar.css";

export function UserAvatar({
  avatar,
  name,
  className,
  profileId,
  onClick,
}: {
  avatar?: string | null;
  name: string;
  className: string;
  profileId?: number | null;
  onClick?: () => void;
}) {
  const src = mediaUrl(avatar);
  const [failedSrc, setFailedSrc] = useState<string>();
  const id = parseId(String(profileId));
  const classes = `user-avatar ${className}`;
  const content =
    src && src !== failedSrc ? (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailedSrc(src)}
      />
    ) : (
      Array.from(name)[0] || "食"
    );
  return id ? (
    <Link
      className={classes}
      to={`/users/${id}`}
      aria-label={`查看${name}的主页`}
      onClick={onClick}
    >
      {content}
    </Link>
  ) : (
    <span className={classes} aria-hidden="true">
      {content}
    </span>
  );
}
