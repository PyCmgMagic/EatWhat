import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { rasterizeGlass } from "./glass-optics";
import "./liquid-glass.css";

// Sample the live backdrop through a convex capsule: a gently magnified centre
// flows into a steeper rim. No copied page content or captured frames are used.
function opticalMaps(width: number, height: number, density: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const raster = rasterizeGlass(width, height, density);
  canvas.width = raster.width;
  canvas.height = raster.height;
  const encode = (data: Uint8ClampedArray) => {
    const image = context.createImageData(raster.width, raster.height);
    image.data.set(data);
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
  };
  return {
    displacement: encode(raster.displacement),
    lighting: encode(raster.lighting),
    scale: raster.scale,
  };
}

export function LiquidGlass() {
  const id = `nav-glass-${useId().replace(/:/g, "")}`;
  const surface = useRef<HTMLSpanElement>(null);
  const [maps, setMaps] = useState<ReturnType<typeof opticalMaps>>();
  const [refracting, setRefracting] = useState(false);

  useEffect(() => {
    // DevTools can use an iPhone/Safari UA while still running Chromium.
    // Check its runtime marker too; real WebKit/Firefox keep the CSS fallback.
    const chromium =
      "chrome" in window ||
      /\b(Chrome|HeadlessChrome|Chromium|Edg)\//.test(navigator.userAgent);
    setRefracting(chromium);
    const element = surface.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const transparency = matchMedia("(prefers-reduced-transparency: reduce)");
    const contrast = matchMedia("(prefers-contrast: more)");
    const forced = matchMedia("(forced-colors: active)");
    let lastSize = "";
    const update = () => {
      if (transparency.matches || contrast.matches || forced.matches) {
        lastSize = "";
        setMaps(undefined);
        return;
      }
      // Layout dimensions ignore a pressed parent's transform.
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      const size = `${width}:${height}:${density}`;
      if (!width || !height || size === lastSize) return;
      lastSize = size;
      setMaps(opticalMaps(width, height, density));
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
      data-optics={maps ? "true" : undefined}
      data-refracting={maps && refracting ? "true" : undefined}
      style={
        {
          boxShadow: maps ? "none" : undefined,
          "--glass-refraction": `url("#${id}")`,
          "--glass-lighting": maps ? `url("${maps.lighting}")` : undefined,
        } as CSSProperties
      }
    >
      {maps && refracting && (
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
                href={maps.displacement}
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                result="bevel"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="bevel"
                scale={maps.scale}
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
