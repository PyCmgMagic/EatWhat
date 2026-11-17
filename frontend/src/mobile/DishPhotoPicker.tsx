import { useId } from "react";
import { DesignIcon } from "./ui";
import "./dish-photo-picker.css";

export default function DishPhotoPicker({
  images,
  disabled,
  onAdd,
  onEdit,
  onRemove,
}: {
  images: readonly { url: string }[];
  disabled: boolean;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const titleId = useId();
  return (
    <section className="mobile-publish-photos" aria-labelledby={titleId}>
      <header>
        <h2 id={titleId}>照片</h2>
        <span aria-label={`已添加 ${images.length} 张照片，最多 9 张`}>
          {images.length} / 9
        </span>
      </header>
      <div className="mobile-publish-photo-grid">
        {images.map((image, index) => (
          <div key={image.url} className="mobile-publish-photo">
            <button
              type="button"
              className="mobile-publish-photo-edit"
              aria-label={`编辑第 ${index + 1} 张照片`}
              disabled={disabled}
              onClick={() => onEdit(index)}
            >
              <img src={image.url} alt="" />
              {index === 0 && (
                <span className="mobile-publish-photo-cover">封面</span>
              )}
              <span
                className="mobile-publish-photo-edit-mark"
                aria-hidden="true"
              >
                <DesignIcon name="edit" size={14} />
              </span>
            </button>
            <button
              type="button"
              className="mobile-publish-photo-remove"
              aria-label={`移除第 ${index + 1} 张照片`}
              disabled={disabled}
              onClick={() => onRemove(index)}
            >
              <span className="mobile-publish-photo-close" aria-hidden="true">
                <DesignIcon name="close" size={14} />
              </span>
            </button>
          </div>
        ))}
        {images.length < 9 && (
          <button
            type="button"
            className={`mobile-publish-photo-add${images.length ? "" : " is-empty"}`}
            aria-label="添加菜品照片"
            disabled={disabled}
            onClick={onAdd}
          >
            <DesignIcon name="add" size={24} />
            <span>添加照片</span>
          </button>
        )}
      </div>
    </section>
  );
}
