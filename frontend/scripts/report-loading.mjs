import fs from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = root + "output/";
const log = fs.readFileSync(output + "loading-browser.log", "utf8");
const match = log.match(/### Result\s*\n([^\r\n]+)/);
if (!match) throw new Error("Missing loading validation result");
const browser = JSON.parse(match[1]);
if (
  browser.issues.length ||
  browser.errors.length ||
  browser.realBackendRequests
)
  throw new Error("Loading validation failed");
const regressions = Object.fromEntries(
  ["mobile", "tabs"].map((name) => {
    const text = fs.readFileSync(
      output + `loading-${name}-regression.log`,
      "utf8",
    );
    const result = text.match(/### Result\s*\n([^\r\n]+)/);
    if (!result) throw new Error(`Missing ${name} regression result`);
    const data = JSON.parse(result[1]);
    if (data.errors?.length || data.issues?.length)
      throw new Error(`${name} regression failed`);
    return [name, data];
  }),
);
const report = {
  date: "2026-10-24",
  mode: "Independent Chrome; delayed Mock transport, not real backend latency",
  responseDelayMs: [1000, 2500],
  browser,
  regressions,
  unitTests: { files: 18, passed: 89, failed: 0 },
  productionBuild: "passed; existing large chunk warning remains",
  limitations: [
    "No physical device or real backend performance verification",
    "Geometry checks cover navigation and the starts of primary sections, not a whole-site zero-CLS guarantee",
  ],
};
fs.writeFileSync(
  output + "loading-validation.json",
  JSON.stringify(report, null, 2) + "\n",
);
const validation = JSON.parse(
  fs.readFileSync(output + "frontend-validation.json", "utf8"),
);
validation.loadingExperience = {
  ...report,
  report: "output/loading-validation.json",
};
fs.writeFileSync(
  output + "frontend-validation.json",
  JSON.stringify(validation, null, 2) + "\n",
);
console.log(`Loading validation: ${browser.checks.length} checks passed.`);
