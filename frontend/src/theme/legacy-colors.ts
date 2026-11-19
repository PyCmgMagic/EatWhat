// The original screens use literal paint in both CSS and artboard styles.
// Give those declarations the same semantic palette without touching assets,
// layout, or their exact light-mode colours.
type Role = "text" | "surface" | "line";

function paintRole(property: string): Role | undefined {
  if (
    /^(color|caret-color|accent-color|text-decoration-color|fill|stroke)$/.test(
      property,
    )
  )
    return "text";
  if (/^(background|background-color|background-image)$/.test(property))
    return "surface";
  if (/^(border|outline|column-rule|scrollbar-color)/.test(property))
    return "line";
  if (
    !property.startsWith("--") ||
    /shadow|scrim|crop|stage|table-|map-|profile-(on|ghost)/.test(property)
  )
    return;
  if (/line|border|edge|handle/.test(property)) return "line";
  if (/-(?:top|bottom|bg)$/.test(property)) return "surface";
  if (
    /ink|muted|faint|focus|warn$|good$|bad$|info$|disabled-fg|forest|accent-deep|feature-accent|mark$/.test(
      property,
    )
  )
    return "text";
  return "surface";
}

function channels(color: string) {
  if (color === "white") return [255, 255, 255, 1];
  if (color === "black") return [0, 0, 0, 1];
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length <= 4) hex = [...hex].map((v) => v + v).join("");
    return [0, 2, 4, 6].map((i) =>
      i === 6
        ? hex.length === 8
          ? parseInt(hex.slice(6), 16) / 255
          : 1
        : parseInt(hex.slice(i, i + 2), 16),
    );
  }
  const parts = color
    .slice(color.indexOf("(") + 1, -1)
    .trim()
    .split(/[\s,/]+/);
  return [0, 1, 2, 3].map((i) => {
    const part = parts[i] ?? "1";
    return (
      parseFloat(part) * (part.endsWith("%") ? (i === 3 ? 0.01 : 2.55) : 1)
    );
  });
}

function pigment(r: number, g: number, b: number) {
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  if (chroma < 14) return "";
  if (g > r && g > b) return "green";
  if (b > r && b >= g) return "blue";
  if (chroma < 25) return "";
  if (r > g && g - b < (r - g) * 0.55) return "red";
  if (r - b > 30 && g - b > (r - g) * 0.55) return "gold";
  return "";
}

function legacyPaint(literal: string, role: Role) {
  const [r, g, b, alpha] = channels(literal.toLowerCase());
  const level = 0.299 * r + 0.587 * g + 0.114 * b;
  const hue = pigment(r, g, b);
  let token: string;
  if (role === "text") {
    token = hue ? hue + "-text" : level < 78 || level > 220 ? "ink" : "muted";
  } else if (role === "line") {
    token = level < 155 ? "outline" : "line";
  } else if (level < 90 && alpha < 0.7) {
    // Shadow veils over photographs and dialogs remain translucent black.
    return literal;
  } else if (hue) {
    token = hue + (level < 195 ? "-solid" : "-soft");
  } else if (level < 110) token = "action";
  else if (level < 228) token = "raised";
  else if (level < 246) token = "canvas";
  else token = level > 253 ? "surface" : "layer";

  if (alpha === 1) return `var(--night-${token}, ${literal})`;
  if (alpha === 0 || (role === "surface" && level > 245 && alpha < 0.25))
    return literal;
  // Keep the original opacity on translucent sheets and borders in both themes.
  const percent = Number((alpha * 100).toFixed(2));
  return `color-mix(in srgb, var(--night-${token}, rgb(${r} ${g} ${b})) ${percent}%, transparent)`;
}

const literalPaint =
  /url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)|"[^"]*"|'[^']*'|#[\da-f]{3,8}\b|(?<![\w-])(?:white|black)\b|rgba?\([\d\s.,%/]+\)/gi;

export function themeDeclaration(property: string, value: string): string {
  const role = paintRole(property);
  if (!role || /--night-|--stage-shade|--tile-shade|light-dark\(/.test(value))
    return value;
  // Ink tokens also serve as solid button fills in the single-theme CSS.
  if (role === "surface" && /^var\(--(?:[\w-]+-)?(?:ink|bad)\)$/.test(value)) {
    return `var(--night-${value.endsWith("-bad)") ? "red-solid" : "action"}, ${value})`;
  }
  if (role === "text" && /^var\(--(?:paper|white)\)$/.test(value)) {
    return `var(--night-ink, ${value})`;
  }
  if (role === "text" && /^var\(--(?:ad|profile)-accent\)$/.test(value)) {
    return `var(--night-gold-text, ${value})`;
  }
  return value.replace(literalPaint, (match) =>
    /^(url\(|["'])/i.test(match) ? match : legacyPaint(match, role),
  );
}
