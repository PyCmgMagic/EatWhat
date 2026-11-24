import { useId } from "react";
import { codePoints, restaurantDescriptionLimit } from "../api/content-rules";
import "./shop-description.css";

export function ShopDescriptionField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const countId = useId();
  const labelId = useId();
  const count = codePoints(value.trim());
  const invalid = count > restaurantDescriptionLimit;
  return (
    <label className="shop-description-field">
      <span>
        <span id={labelId}>店铺简介</span> <small>选填</small>
        <small id={countId} className="shop-description-count">
          {count} / {restaurantDescriptionLimit}
        </small>
      </span>
      <textarea
        name="description"
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-labelledby={labelId}
        aria-describedby={countId}
        aria-invalid={invalid}
        disabled={disabled}
      />
    </label>
  );
}

export function ShopDescription({ value }: { value?: string | null }) {
  return value ? <p className="shop-description">{value}</p> : null;
}
