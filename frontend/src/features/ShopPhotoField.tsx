import {
  Camera,
  ImageUp,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { errorMessage } from "../api/client";
import { validateFiles } from "../api/validation";
import { useFeedbackState } from "../components/feedback";
import { FieldMark } from "./FieldMark";
import { ShopPhotoEditor } from "./ShopPhotoEditor";
import type { ShopPhotoSelection } from "./shop-photo-edit";
import "./shop-photo-field.css";

export function ShopPhotoField({
  preview,
  photo,
  disabled,
  uploadPhase,
  uploadError,
  onChange,
}: {
  preview?: string;
  photo?: ShopPhotoSelection;
  disabled: boolean;
  uploadPhase?: "uploading" | "confirming";
  uploadError?: string;
  onChange: (photo?: ShopPhotoSelection) => void;
}) {
  const title = useId();
  const action = useId();
  const hint = useId();
  const card = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLButtonElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const revealPreview = useRef(false);
  const [, reportSelectionError] = useFeedbackState();
  const [editing, setEditing] = useState<ShopPhotoSelection>();
  const selected = !!preview && !!photo;

  useEffect(() => {
    if (!preview || !revealPreview.current) return;
    revealPreview.current = false;
    card.current?.scrollIntoView({ block: "nearest" });
  }, [preview]);

  useEffect(() => {
    if (!uploadError || disabled) return;
    const button = pick.current;
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: "center" });
  }, [uploadError, disabled]);

  return (
    <div className="shop-photo-field" role="group" aria-labelledby={title}>
      <div className="shop-photo-title" id={title}>
        门头照片 <FieldMark />
      </div>
      <div ref={card} className="shop-photo-card" data-preview={selected}>
        {selected && (
          <div className="shop-photo-preview">
            <img src={preview} alt="门头照片预览" />
          </div>
        )}
        <div className="shop-photo-actions">
          {selected && (
            <button
              ref={editButton}
              data-primary={!uploadError}
              type="button"
              disabled={disabled}
              aria-haspopup="dialog"
              onClick={() => setEditing(photo)}
            >
              <Pencil aria-hidden="true" size={16} />
              编辑照片
            </button>
          )}
          <button
            ref={pick}
            className="shop-photo-pick"
            data-primary={selected && !!uploadError}
            type="button"
            disabled={disabled}
            aria-labelledby={action}
            aria-describedby={hint}
            onClick={() => input.current?.click()}
          >
            {selected ? (
              <ImageUp aria-hidden="true" size={17} />
            ) : (
              <span className="shop-photo-camera">
                <Camera aria-hidden="true" size={23} />
              </span>
            )}
            <span className="shop-photo-pick-copy">
              <span id={action}>{selected ? "更换照片" : "添加照片"}</span>
              <small id={hint} hidden={selected}>
                JPG、PNG 或 WebP · 最大 10 MB
              </small>
            </span>
            {!selected && <Plus aria-hidden="true" size={19} />}
          </button>
          {selected && (
            <button
              type="button"
              className="shop-photo-remove"
              disabled={disabled}
              onClick={() => {
                onChange();
                pick.current?.focus();
              }}
            >
              <Trash2 aria-hidden="true" size={16} />
              移除照片
            </button>
          )}
        </div>
        {uploadPhase && (
          <p className="shop-photo-feedback" role="status">
            {uploadPhase === "confirming" ? "正在检查照片…" : "正在上传照片…"}
          </p>
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
            revealPreview.current = true;
            onChange({ file });
          } catch (err) {
            const message = errorMessage(err);
            reportSelectionError(
              selected ? `${message} 已保留当前照片。` : message,
            );
          }
        }}
      />
      {editing && (
        <ShopPhotoEditor
          photo={editing}
          origin={editButton.current}
          onClose={() => setEditing(undefined)}
          onApply={onChange}
        />
      )}
    </div>
  );
}
