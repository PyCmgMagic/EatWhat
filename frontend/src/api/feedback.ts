import type { V2Schema } from "./backend-v2";
import type { Schema } from "./models";

export type FeedbackCategory = NonNullable<
  V2Schema["MessageRequest"]["category"]
>;
export type FeedbackCase = Schema["CaseViewResponse"] &
  Pick<V2Schema["CaseView"], "category">;
export type AdminFeedbackCase = Omit<Schema["AdminCaseViewResponse"], "view"> &
  Pick<
    V2Schema["AdminCase"],
    "submissionDevice" | "submitterName" | "resolvedBy" | "internalNote"
  > & {
    view?: FeedbackCase | null;
  };

export const feedbackCategories = {
  PROBLEM: "遇到问题",
  SUGGESTION: "提个建议",
  OTHER: "其他反馈",
} satisfies Record<FeedbackCategory, string>;

export const feedbackReasons: Readonly<Record<string, string>> = {
  WRONG_NAME: "店名不正确",
  WRONG_LOCATION: "位置不准确",
  CLOSED: "店铺已停业",
  DUPLICATE: "重复店铺",
  OTHER: "其他问题",
  NOT_REAL_PHOTO: "非真实照片",
  ADVERTISING: "广告信息",
  ILLEGAL_OR_UNFRIENDLY: "不友善或违规内容",
};

export function feedbackCategoryLabel(
  view?: Pick<FeedbackCase, "kind" | "category"> | null,
) {
  if (view?.kind === "FEEDBACK")
    return feedbackCategories[view.category ?? "OTHER"];
}
