import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin } from "vite";
import { parse } from "postcss";
import { applyLegacyPalette } from "./theme-styles.ts";

// Keep the generated source intact; emit one lazy module per artboard.
export function prototypeData(): Plugin {
  const source = normalizePath(
    fileURLToPath(
      new URL("../src/mobile/generated/trees.json", import.meta.url),
    ),
  );
  const index = "virtual:eatwhat-screens";
  const prefix = index + "/";
  let data:
    Record<string, { css: string; tree: unknown; title: string }> | undefined;
  const screens = () => (data ??= JSON.parse(readFileSync(source, "utf8")));
  return {
    name: "eatwhat-prototype-data",
    buildStart() {
      data = undefined;
      this.addWatchFile(source);
    },
    resolveId(id) {
      if (id === index || id.startsWith(prefix)) return "\0" + id;
    },
    load(id) {
      if (id.startsWith("\0" + index)) this.addWatchFile(source);
      if (id === "\0" + index)
        return (
          "export const screenModules = {" +
          Object.keys(screens()!)
            .map(
              (key) =>
                `${JSON.stringify(key)}:()=>import(${JSON.stringify(prefix + key)})`,
            )
            .join(",") +
          "};"
        );
      if (id.startsWith("\0" + prefix)) {
        const key = id.slice(prefix.length + 1);
        if (!Object.hasOwn(screens()!, key))
          this.error("Unknown prototype screen: " + key);
        const screen = screens()![key];
        const css = parse(screen.css);
        applyLegacyPalette(css);
        return (
          "export default " +
          JSON.stringify({ ...screen, css: css.toString() }) +
          ";"
        );
      }
    },
    handleHotUpdate({ file, server }) {
      if (normalizePath(file) !== source) return;
      data = undefined;
      for (const module of server.moduleGraph.idToModuleMap.values()) {
        if (module.id?.startsWith("\0" + index))
          server.moduleGraph.invalidateModule(module);
      }
      server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}
