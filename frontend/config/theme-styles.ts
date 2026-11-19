import type { Plugin, Root } from "postcss";
import { themeDeclaration } from "../src/theme/legacy-colors.ts";

// Compile lazy route styles as well as the entry bundle. Switching themes
// only changes inherited CSS variables, even for pages loaded afterwards.
export const themeStyles: Plugin = {
  postcssPlugin: "eatwhat-theme",
  Once(root) {
    const file = root.source?.input.file?.replaceAll("\\", "/") ?? "";
    if (!file.includes("/src/") || file.endsWith("/theme/theme.css")) return;
    applyLegacyPalette(root);
  },
};
export function applyLegacyPalette(root: Root) {
  root.walkDecls((decl) => {
    decl.value = themeDeclaration(decl.prop, decl.value);
  });
}
