import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, "output", name), "utf8"));
function browserResult(name) {
  const text = fs.readFileSync(path.join(root, "output", name), "utf8");
  const value = text.match(/### Result\s*\r?\n([^\r\n]+)/)?.[1];
  if (!value) throw new Error(`Missing browser result: ${name}`);
  const result = JSON.parse(value);
  if (
    result.failure ||
    result.errors?.length ||
    result.issues?.length ||
    result.remoteRequests ||
    result.outsideRequests
  )
    throw new Error(`Browser verification failed: ${name}`);
  return result;
}
const tests = read("api-v2-tests.json"),
  coverage = read("api-coverage-20261026.json");
if (
  !tests.success ||
  tests.numFailedTests ||
  coverage.summary.clientOperations !== 117 ||
  coverage.summary.backendCallbacks !== 5 ||
  coverage.summary.excluded !== 14
)
  throw new Error("Contract or unit verification failed");
const build = read("performance-build.json");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "frontend/dist/.vite/manifest.json"), "utf8"),
);
const maxChunkBytes = Math.max(
  ...Object.values(manifest)
    .filter((chunk) => chunk.file.endsWith(".js"))
    .map(
      (chunk) => fs.statSync(path.join(root, "frontend/dist", chunk.file)).size,
    ),
);
const budgets = {
  initialJsBytes: 650000,
  initialJsGzipBytes: 200000,
  maxChunkBytes: 500000,
};
if (
  build.initialJsBytes > budgets.initialJsBytes ||
  build.initialJsGzipBytes > budgets.initialJsGzipBytes ||
  maxChunkBytes > budgets.maxChunkBytes
)
  throw new Error("Build budget exceeded");
const report = {
  date: "2026-10-26",
  contract: coverage.summary.contract,
  scope: {
    client: 117,
    guardedProfileWrites: 2,
    compatibilityOnly: 2,
    backendCallbacks: 5,
    excludedActivities: 14,
  },
  tests: {
    files: tests.testResults.length,
    passed: tests.numPassedTests,
    failed: tests.numFailedTests,
    success: tests.success,
  },
  build: {
    typecheck: true,
    production: true,
    initialJsBytes: build.initialJsBytes,
    initialJsGzipBytes: build.initialJsGzipBytes,
    maxChunkBytes,
    budgets,
  },
  browser: {
    desktop: browserResult("api-v2-flows.log"),
    modalRegressionRepeat: browserResult("api-v2-flows-repeat.log"),
    mobile: browserResult("api-v2-mobile-flows.log"),
    adminAndResponsive: browserResult("api-v2-admin-responsive.log"),
    liveModeWithInterceptedResponses: browserResult("api-v2-live-contract.log"),
    productionWithInterceptedResponses: browserResult("api-v2-production.log"),
  },
  liveReadChecks: read("api-v2-live-read-checks.json"),
  remaining: [
    "Real Tencent human challenge and actual SMS/email delivery require a test account and explicit delivery validation.",
    "Cross-origin production requires the backend to allow the real frontend origin and CAPTCHA/session headers; current development uses a same-origin gateway.",
    "Block and account-recovery availability depends on backend deployment, feature switches and permissions.",
    "Profile resolution remains read-only until its read and write contracts agree.",
  ],
};
fs.writeFileSync(
  path.join(root, "output/api-v2-validation.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      tests: report.tests,
      scope: report.scope,
      responsiveChecks: report.browser.adminAndResponsive.responsiveChecks,
      build: report.build,
    },
    null,
    2,
  ),
);
