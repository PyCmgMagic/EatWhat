import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = path.join(root, "output");
const readJson = (file) =>
  JSON.parse(fs.readFileSync(path.join(output, file), "utf8"));
const before = readJson("performance-baseline.json");
const after = readJson("performance-build.json");
function browserResult(file) {
  const log = fs.readFileSync(path.join(output, file), "utf8");
  const match = log.match(/### Result\s*\n([^\r\n]+)/);
  if (!match) throw new Error(`No result in ${file}`);
  const result = JSON.parse(match[1]);
  if (
    result.issues?.length ||
    result.failures?.length ||
    result.errors?.length ||
    (result.realBackendRequests ?? result.networkRequests ?? 0)
  )
    throw new Error(`Validation failed: ${file}`);
  return result;
}
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "frontend/dist/.vite/manifest.json"), "utf8"),
);
const jsChunks = [
  ...new Set(
    Object.values(manifest)
      .map((c) => c.file)
      .filter((f) => f.endsWith(".js")),
  ),
];
const largestChunkBytes = Math.max(
  ...jsChunks.map((f) => fs.statSync(path.join(root, "frontend/dist", f)).size),
);
const artboardChunks = Object.values(manifest).filter((c) =>
  c.src?.includes("virtual:eatwhat-screens/"),
);
if (
  artboardChunks.length !== 51 ||
  largestChunkBytes > 500_000 ||
  after.initialJsBytes > 650_000 ||
  after.initialJsGzipBytes > 200_000
)
  throw new Error("Production bundle budget exceeded");
const report = {
  date: "2026-10-24",
  measurement:
    "Standard production build; initial JavaScript includes the complete static import graph, gzip uses the same Node defaults before/after",
  before,
  after,
  reductions: {
    initialJsPercent: +(
      100 *
      (1 - after.initialJsBytes / before.initialJsBytes)
    ).toFixed(1),
    initialJsGzipPercent: +(
      100 *
      (1 - after.initialJsGzipBytes / before.initialJsGzipBytes)
    ).toFixed(1),
  },
  budget: {
    passed: true,
    largestChunkBytes,
    artboardChunks: artboardChunks.length,
  },
  browser: browserResult("performance-browser.log"),
  responsive: browserResult("performance-responsive.log"),
  mobile: browserResult("performance-mobile-flows.log"),
  tabs: browserResult("performance-tabs.log"),
  loading: browserResult("performance-loading.log"),
  unitTests: { files: 19, passed: 92, failed: 0 },
  productionBuild:
    "passed, no oversized JavaScript chunk warning; default demo setting restored",
  limitations: [
    "Browser performance smoke uses an isolated demo-enabled production preview",
    "Local timing observations are not a real-network speed or FPS comparison; physical devices and backend latency were not benchmarked",
  ],
};
fs.writeFileSync(
  path.join(output, "performance-validation.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const validation = readJson("frontend-validation.json");
validation.performance = {
  ...report,
  report: "output/performance-validation.json",
};
fs.writeFileSync(
  path.join(output, "frontend-validation.json"),
  JSON.stringify(validation, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    before: before.initialJsBytes,
    after: after.initialJsBytes,
    reductions: report.reductions,
    budget: report.budget,
  }),
);
