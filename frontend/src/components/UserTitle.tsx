import "../features/user-level.css";

/** 当前佩戴的称号，没有称号时什么也不显示。 */
export function UserTitle({ title }: { title?: string | null }) {
  if (!title) return null;
  return <span className="user-title-badge">{title}</span>;
}
