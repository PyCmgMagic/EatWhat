import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import "./publish-button.css";

export function PublishButton({
  label,
  pending,
  phase,
  children,
  className = "",
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  pending: boolean;
  phase?: "uploading" | "submitting";
}) {
  return (
    <button
      {...props}
      type={type}
      className={`publish-button ${className}`}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending && (
        <LoaderCircle
          className="publish-button-spinner"
          size={18}
          strokeWidth={2}
          aria-hidden="true"
        />
      )}
      {pending
        ? phase === "uploading"
          ? "正在上传照片…"
          : "正在发布…"
        : label}
      {!pending && children}
    </button>
  );
}
