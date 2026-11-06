import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const readResult = (file) => {
  const text = fs.readFileSync(path.join(root, "output", file), "utf8");
  const match = text.match(/### Result\s*\n([^\r\n]+)/);
  if (!match) throw new Error(`Missing browser result: ${file}`);
  return JSON.parse(match[1]);
};
const report = {
  date: "2026-10-24",
  mode: "Mock, independent Chrome; touch and keyboard are simulated",
  viewportSizes: [
    [320, 568],
    [390, 667],
    [430, 932],
    [600, 960],
    [768, 1024],
    [820, 1180],
    [1024, 768],
    [667, 375],
    [844, 390],
  ],
  routeCount: 44,
  audit: readResult("mobile-tablet-audit.log"),
  flows: readResult("mobile-tablet-flows.log"),
  interactions: readResult("responsive-interactions.log"),
  tabs: readResult("responsive-tabs-regression.log"),
  unitTests: { files: 18, passed: 89, failed: 0 },
  productionBuild: "passed; existing large chunk warning remains",
  limitations: [
    "Physical iOS/Android and other browsers pending; no real backend verification",
  ],
};
for (const result of [
  report.audit,
  report.flows,
  report.interactions,
  report.tabs,
]) {
  if (["failures", "issues", "errors"].some((key) => result[key]?.length)) {
    throw new Error(
      "Cannot publish a passing report with failed browser checks",
    );
  }
}
fs.writeFileSync(
  path.join(root, "output/mobile-tablet-validation.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const validationPath = path.join(root, "output/frontend-validation.json");
const validation = JSON.parse(fs.readFileSync(validationPath, "utf8"));
validation.mobileTabletUpgrade = {
  ...report,
  report: "output/mobile-tablet-validation.json",
};
fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2) + "\n");
console.log("Mobile/tablet validation report updated.");
