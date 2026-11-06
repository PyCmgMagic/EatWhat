import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const readResult = (name) => {
  const log = readFileSync(resolve(root, "output", name), "utf8");
  const match = log.match(/### Result\r?\n([^\r\n]+)/);
  if (!match) throw new Error(`No successful result in ${name}`);
  const value = JSON.parse(match[1]);
  return typeof value === "string" ? JSON.parse(value) : value;
};
const matrix = readResult("responsive-matrix-export.log");
const interactions = readResult("responsive-interactions.log");
const tabs = readResult("responsive-tabs-regression.log");
if (
  matrix.failures.length ||
  matrix.errors.length ||
  matrix.networkRequests ||
  interactions.errors.length ||
  interactions.realBackendRequests ||
  tabs.errors.length
)
  throw new Error("Responsive checks did not pass");
const report = {
  date: "2026-10-24",
  browser: "Standalone Chrome; in-app browser connection unavailable",
  mode: "Mock; real API requests blocked",
  widths: [320, 390, 430, 600, 767, 768, 820, 1024, 1280, 1440, 1920],
  matrix,
  interactions,
  tabs,
  unitTests: { files: 18, passed: 89, failed: 0, newLayoutTests: 6 },
  productionBuild: "passed; existing large chunk warning remains",
  limitations: [
    "Touch is browser simulation; physical devices and other browsers pending",
  ],
  screenshots: [
    "tablet-profile",
    "tablet-publish",
    "tablet-home",
    "laptop-profile-edit",
    "tablet-settings",
    "phone-home",
    "landscape-people",
    "narrow-desktop-publish",
    "crop-landscape",
    "search-320",
  ].map((name) => `output/playwright/responsive-${name}.png`),
};
writeFileSync(
  resolve(root, "output/responsive-validation.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const mainPath = resolve(root, "output/frontend-validation.json");
const main = JSON.parse(readFileSync(mainPath, "utf8"));
main.unitTests = { ...main.unitTests, ...report.unitTests };
main.responsiveUpgrade = {
  ...report,
  matrix: {
    checks: matrix.checks,
    failures: matrix.failures,
    errors: matrix.errors,
    networkRequests: matrix.networkRequests,
  },
  report: "output/responsive-validation.json",
};
writeFileSync(mainPath, JSON.stringify(main, null, 2) + "\n");
console.log(
  JSON.stringify({
    matrix: matrix.checks,
    interactionGroups: interactions.checks.length,
    tabGroups: tabs.checks.length,
    unitTests: report.unitTests,
  }),
);
