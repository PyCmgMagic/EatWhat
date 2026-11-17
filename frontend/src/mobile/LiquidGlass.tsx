import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

// Sample the live backdrop through a convex capsule: a gently magnified centre
// flows into a steeper rim. No copied page content or captured frames are used.
const refractionScale = 40;

function bevelMap(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const image = context.createImageData(width, height);
  const radius = height / 2;
  const bevel = Math.min(13, radius * 0.44);
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
      // Inward sampling enlarges the scene. The rim's curved normal adds the
      // compression at the edge that distinguishes glass from a uniform blur.
      const dx = -px * 0.045 - nx * bend * 11;
      const dy = -py * 0.2 - ny * bend * 11;
      const offset = (y * width + x) * 4;
      image.data[offset] = 255 * (0.5 + dx / refractionScale);
      image.data[offset + 1] = 255 * (0.5 + dy / refractionScale);
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
    // DevTools can use an iPhone/Safari UA while still running Chromium.
    // Check its runtime marker too; real WebKit/Firefox keep the CSS fallback.
    const chromium =
      "chrome" in window ||
      /\b(Chrome|HeadlessChrome|Chromium|Edg)\//.test(navigator.userAgent);
    if (!chromium) return;
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
                scale={refractionScale}
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
