import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = path.join(root, "frontend/dist");
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const entry = html.match(/<script[^>]*src="([^"]+)"/)[1].replace(/^\//, "");
const manifestPath = path.join(dist, ".vite/manifest.json");
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : {};
const initial = new Set([entry]);
for (const m of html.matchAll(/<link[^>]*href="([^"]+\.css)"/g))
  initial.add(m[1].replace(/^\//, ""));
const seen = new Set();
function include(key) {
  if (seen.has(key) || !manifest[key]) return;
  seen.add(key);
  const chunk = manifest[key];
  initial.add(chunk.file);
  chunk.css?.forEach((f) => initial.add(f));
  chunk.imports?.forEach(include);
}
Object.keys(manifest)
  .filter((k) => manifest[k].file === entry)
  .forEach(include);
const assets = [...initial].map((file) => {
  const data = fs.readFileSync(path.join(dist, file));
  return { file, bytes: data.length, gzip: gzipSync(data).length };
});
const sum = (extension, field) =>
  assets
    .filter((a) => a.file.endsWith(extension))
    .reduce((n, a) => n + a[field], 0);
const report = {
  date: new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
  assets,
  initialJsBytes: sum(".js", "bytes"),
  initialJsGzipBytes: sum(".js", "gzip"),
  initialCssBytes: sum(".css", "bytes"),
  initialCssGzipBytes: sum(".css", "gzip"),
};
fs.writeFileSync(
  path.join(
    root,
    "output",
    process.argv.includes("--baseline")
      ? "performance-baseline.json"
      : "performance-build.json",
  ),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(report);
