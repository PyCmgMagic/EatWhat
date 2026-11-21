import type { V2Schema } from "./backend-v2";
import type { Schema } from "./models";

export type FeedbackCategory = NonNullable<
  V2Schema["MessageRequest"]["category"]
>;
export type FeedbackCase = Schema["CaseViewResponse"] &
  Pick<V2Schema["CaseView"], "category">;
export type AdminFeedbackCase = Omit<Schema["AdminCaseViewResponse"], "view"> &
  Pick<V2Schema["AdminCase"], "submissionDevice"> & {
    view?: FeedbackCase | null;
  };

export const feedbackCategories = {
  PROBLEM: "遇到问题",
  SUGGESTION: "提个建议",
  OTHER: "其他反馈",
} satisfies Record<FeedbackCategory, string>;

export function feedbackCategoryLabel(
  view?: Pick<FeedbackCase, "kind" | "category"> | null,
) {
  if (view?.kind === "FEEDBACK")
    return feedbackCategories[view.category ?? "OTHER"];
}
