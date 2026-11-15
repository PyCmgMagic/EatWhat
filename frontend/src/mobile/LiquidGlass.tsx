import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

// A rounded-rectangle normal map bends the live backdrop only at the bevel.
// The flat centre stays undistorted; there is no noise or screenshot of the page.
function bevelMap(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const image = context.createImageData(width, height);
  const radius = height / 2;
  const bevel = Math.min(12, radius * 0.45);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - width / 2;
      const py = y + 0.5 - height / 2;
      const qx = Math.abs(px) - (width / 2 - radius);
      const qy = Math.abs(py);
      const length = Math.hypot(Math.max(qx, 0), qy);
      const distance = radius - length;
      const t = Math.max(0, Math.min(1, 1 - distance / bevel));
      const bend = Math.sin(t * Math.PI * 0.5) ** 2;
      const nx = (Math.max(qx, 0) / (length || 1)) * Math.sign(px);
      const ny = (qy / (length || 1)) * Math.sign(py);
      const offset = (y * width + x) * 4;
      image.data[offset] = 128 + nx * bend * 127;
      image.data[offset + 1] = 128 + ny * bend * 127;
      image.data[offset + 2] = 128;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

export function LiquidGlass() {
  const id = `nav-glass-${useId().replace(/:/g, "")}`;
  const surface = useRef<HTMLSpanElement>(null);
  const [map, setMap] = useState<string>();

  useEffect(() => {
    // WebKit and Firefox don't render backdrop displacement reliably. Keep their
    // CSS glass fallback rather than selecting a filter they cannot display.
    if (!/\b(Chrome|Chromium|Edg)\//.test(navigator.userAgent)) return;
    const element = surface.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const transparency = matchMedia("(prefers-reduced-transparency: reduce)");
    const contrast = matchMedia("(prefers-contrast: more)");
    const forced = matchMedia("(forced-colors: active)");
    let lastSize = "";
    const update = () => {
      if (transparency.matches || contrast.matches || forced.matches) {
        lastSize = "";
        setMap(undefined);
        return;
      }
      // Layout dimensions ignore a pressed parent's transform.
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const size = `${width}:${height}`;
      if (!width || !height || size === lastSize) return;
      lastSize = size;
      setMap(bevelMap(width, height));
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    const preferences = [transparency, contrast, forced];
    preferences.forEach((preference) =>
      preference.addEventListener("change", update),
    );
    return () => {
      observer.disconnect();
      preferences.forEach((preference) =>
        preference.removeEventListener("change", update),
      );
    };
  }, []);

  return (
    <span
      ref={surface}
      className="design-glass-backdrop"
      aria-hidden="true"
      data-refracting={map ? "true" : undefined}
      style={{ "--glass-refraction": `url("#${id}")` } as CSSProperties}
    >
      {map && (
        <svg
          className="design-glass-filter"
          width="0"
          height="0"
          focusable="false"
        >
          <defs>
            <filter
              id={id}
              x="0"
              y="0"
              width="100%"
              height="100%"
              colorInterpolationFilters="sRGB"
            >
              <feImage
                href={map}
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                result="bevel"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="bevel"
                scale="16"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      )}
    </span>
  );
}
