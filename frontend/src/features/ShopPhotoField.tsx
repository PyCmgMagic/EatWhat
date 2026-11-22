import { Camera } from "lucide-react";
import { useId, useRef, useState } from "react";
import { errorMessage } from "../api/client";
import { validateFiles } from "../api/validation";
import { FieldMark } from "./FieldMark";
import "./shop-photo-field.css";

export function ShopPhotoField({
  preview,
  disabled,
  onChange,
}: {
  preview?: string;
  disabled: boolean;
  onChange: (file?: File) => void;
}) {
  const hint = useId();
  const input = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  return (
    <div className="shop-photo-field" role="group" aria-label="门头照片">
      <div className="shop-photo-title">
        门头照片 <FieldMark />
      </div>
      <div className="shop-photo-actions">
        <button
          ref={pick}
          className="shop-photo-pick"
          type="button"
          disabled={disabled}
          aria-describedby={hint}
          onClick={() => input.current?.click()}
        >
          {preview ? (
            <img src={preview} alt="" />
          ) : (
            <Camera aria-hidden="true" size={22} />
          )}
          {preview ? "更换门头照片" : "选择门头照片"}
        </button>
        {preview && (
          <button
            type="button"
            className="shop-photo-remove"
            disabled={disabled}
            onClick={() => {
              onChange();
              setError("");
              pick.current?.focus();
            }}
          >
            移除照片
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        accept="image/jpeg,image/png,image/webp"
        aria-label="门头照片"
        disabled={disabled}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          try {
            validateFiles([file], 0);
            onChange(file);
            setError("");
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      />
      <small id={hint}>JPG、PNG 或 WebP，单张最多 10 MB</small>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
