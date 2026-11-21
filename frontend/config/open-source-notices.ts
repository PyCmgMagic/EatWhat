import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import lockfile from "../package-lock.json" with { type: "json" };

/** Read the locked production dependencies and the notices shipped with each package. */
export function openSourceNotices(): Plugin {
  const id = "virtual:open-source-notices";
  const root = fileURLToPath(new URL("../", import.meta.url));
  return {
    name: "eatwhat-open-source-notices",
    resolveId(source) {
      if (source === id) return "\0" + id;
    },
    load(source) {
      if (source !== "\0" + id) return;
      const notices = [];
      for (const [path, pkg] of Object.entries(lockfile.packages)) {
        if (!path || ("dev" in pkg && pkg.dev)) continue;
        const dir = join(root, path);
        if (!existsSync(dir)) continue;
        const texts = readdirSync(dir, { withFileTypes: true })
          .filter(
            (file) =>
              file.isFile() &&
              /^(licen[cs]e|notice|copying|ofl)([. _-]|$)/i.test(file.name),
          )
          .map((file) => readFileSync(join(dir, file.name), "utf8").trim());
        notices.push({
          name: path.split("node_modules/").pop(),
          version: pkg.version,
          license: "license" in pkg ? pkg.license : undefined,
          text: texts.join("\n\n"),
        });
      }
      return "export default " + JSON.stringify(notices);
    },
  };
}
