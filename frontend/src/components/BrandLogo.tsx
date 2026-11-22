import "./brand-logo.css";

/** Keep the mark decorative when the product name is already beside it. */
export function BrandLogo({
  size = 44,
  className = "",
  alt = "",
}: {
  size?: number;
  className?: string;
  alt?: string;
}) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src="/assets/brand/logo.png"
      width={size}
      height={size}
      alt={alt}
      draggable={false}
    />
  );
}
