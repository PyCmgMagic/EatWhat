import { useState } from "react";
import "./dish-illustration.css";

export type DishIllustrationName =
  | "yuntun"
  | "jiaozi"
  | "niunan"
  | "yangzhi"
  | "luosifen"
  | "tieguodun"
  | "xiangguo"
  | "niandoubao"
  | "danchaofan"
  | "baozi";

/** Decorative artwork; photo placeholders must use the labeled FoodPhotoFallback. */
export function DishIllustration({
  name,
  className = "",
}: {
  name: DishIllustrationName;
  className?: string;
}) {
  const src = ["danchaofan", "baozi"].includes(name)
    ? `/assets/dishes/${name}.svg`
    : `/prototype/assets/dishes/${name}.svg`;
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <div className={`dish-illustration ${className}`} aria-hidden="true">
      {failedSrc === src ? (
        // Keep recovery screens usable even when the artwork cannot be loaded.
        <svg viewBox="0 0 200 200" focusable="false">
          <circle cx="100" cy="100" r="86" fill="#F4EFEB" />
          <path
            d="M60 88h80c0 27-16 44-40 44S60 115 60 88Zm26 44v8h28v-8M87 69c-8-9 8-13 0-23m25 23c-8-9 8-13 0-23"
            fill="none"
            stroke="#8F5B24"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <img
          src={src}
          alt=""
          width="200"
          height="200"
          decoding="async"
          draggable={false}
          onError={() => setFailedSrc(src)}
        />
      )}
    </div>
  );
}
