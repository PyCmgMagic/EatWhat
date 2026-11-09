import { useState, type CSSProperties, type ImgHTMLAttributes } from "react";
import type { Food } from "../api/models";
import "./food-cover.css";

type Props = ImgHTMLAttributes<HTMLImageElement> & { crop?: Food["coverCrop"] };

/** The saved circle is measured on the original image, before it is fit into the plate. */
export function FoodCover({ crop, className, style, ...image }: Props) {
  const [size, setSize] = useState<{
    src: string | undefined;
    w: number;
    h: number;
  }>();
  const { centerX: x, centerY: y, diameter: d } = crop ?? {};
  if (
    typeof x !== "number" ||
    !(x >= 0 && x <= 1) ||
    typeof y !== "number" ||
    !(y >= 0 && y <= 1) ||
    typeof d !== "number" ||
    !(d > 0 && d <= 1) ||
    (x === 0.5 && y === 0.5 && d === 1)
  ) {
    return <img {...image} className={className} style={style} />;
  }
  let framing: CSSProperties | undefined;
  if (size && size.src === image.src && size.w && size.h) {
    const side = Math.min(size.w, size.h) * d;
    const left = Math.max(0, Math.min(size.w - side, size.w * x - side / 2));
    const top = Math.max(0, Math.min(size.h - side, size.h * y - side / 2));
    framing = {
      width: `${(100 * size.w) / side}%`,
      height: `${(100 * size.h) / side}%`,
      left: `${(-100 * left) / side}%`,
      top: `${(-100 * top) / side}%`,
    };
  }
  return (
    <span className={`food-cover-frame ${className ?? ""}`} style={style}>
      <img
        {...image}
        style={framing}
        onLoad={(event) => {
          const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
          setSize({ src: image.src, w, h });
          image.onLoad?.(event);
        }}
      />
    </span>
  );
}
