import { expect, it } from "vitest";
import { themeDeclaration } from "./legacy-colors";

it("adapts the same paint to its role and retains the original light fallback", () => {
  expect(themeDeclaration("background", "white")).toBe(
    "var(--night-surface, white)",
  );
  expect(themeDeclaration("color", "white")).toBe("var(--night-ink, white)");
  expect(themeDeclaration("border", "1px solid #efe9e4")).toBe(
    "1px solid var(--night-line, #efe9e4)",
  );
  expect(themeDeclaration("background", "var(--pc-ink)")).toBe(
    "var(--night-action, var(--pc-ink))",
  );
});

it("preserves SVG colours, fragment references and shadows while adapting adjacent paint", () => {
  const svg = "url(\"data:image/svg+xml,<svg fill='#fff'/>\")";
  expect(themeDeclaration("background", svg + " #fff")).toBe(
    svg + " var(--night-surface, #fff)",
  );
  expect(themeDeclaration("fill", "url(#abc)")).toBe("url(#abc)");
  expect(themeDeclaration("box-shadow", "0 4px 8px #0004")).toBe(
    "0 4px 8px #0004",
  );
});

it("keeps authored theme pairs and scrims while adapting translucent paper", () => {
  const stage = "color-mix(in srgb, #ffcb45, #1b1512 var(--stage-shade, 0%))";
  expect(themeDeclaration("background", stage)).toBe(stage);
  expect(themeDeclaration("background", "rgba(35,28,24,.45)")).toBe(
    "rgba(35,28,24,.45)",
  );
  expect(themeDeclaration("background", "rgb(255 255 255 / 80%)")).toBe(
    "color-mix(in srgb, var(--night-surface, rgb(255 255 255)) 80%, transparent)",
  );
});

it("classifies surface gradient variables and pastel semantic tints accurately", () => {
  expect(themeDeclaration("--ink-top", "#3b312b")).toBe(
    "var(--night-action, #3b312b)",
  );
  expect(themeDeclaration("--tag-selected", "#fbefd9")).toBe(
    "var(--night-gold-soft, #fbefd9)",
  );
  expect(themeDeclaration("background", "#e4ecd8")).toBe(
    "var(--night-green-soft, #e4ecd8)",
  );
  expect(themeDeclaration("background", "#e2eaf3")).toBe(
    "var(--night-blue-soft, #e2eaf3)",
  );
  expect(themeDeclaration("background", "#e6ded8")).toBe(
    "var(--night-raised, #e6ded8)",
  );
});
