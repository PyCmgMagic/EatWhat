import { buildNumber, webVersion } from "../app/version";
import type { FeedbackCategory } from "../api/feedback";

// A simulated device for demo cases. No browser identifiers are stored.
export function demoFeedbackFields(kind: string, category?: FeedbackCategory) {
  return kind === "FEEDBACK"
    ? {
        category: category ?? "OTHER",
        submissionDevice: {
          platform: "web",
          model: "演示浏览器",
          appVersion: webVersion,
          appBuild: buildNumber === undefined ? null : String(buildNumber),
        },
      }
    : { category: null, submissionDevice: null };
}
