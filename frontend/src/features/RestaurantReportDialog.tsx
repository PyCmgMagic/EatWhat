import { useId } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app/state";
import { useSessionDraft } from "../app/drafts";
import type { Schema } from "../api/models";
import { Modal } from "../components/ui";
import { useCommand } from "./v4/shared";
import { ReportReasonField } from "./ReportReasonField";
import "./food-report.css";

/**
 * The backend only accepts NOT_REAL_PHOTO for dishes and comments, so a shop
 * report offers the three reasons that apply to a place.
 */
const reportReasons = [
  ["ADVERTISING", "广告信息"],
  ["ILLEGAL_OR_UNFRIENDLY", "不友善或违规内容"],
  ["OTHER", "其他问题"],
] as const;

export function RestaurantReportDialog({
  restaurantId,
  restaurantName,
  onClose,
}: {
  restaurantId: number;
  restaurantName?: string | null;
  onClose: () => void;
}) {
  const app = useApp(),
    task = useCommand(),
    noteId = useId();
  const draftKey = `feedback:${app.user?.id}:report:RESTAURANT:${restaurantId}`;
  const [draft, setDraft, clearDraft] = useSessionDraft(draftKey, {
    text: "",
    reason: "OTHER",
  });
  const textLimit = 2000;

  return (
    <Modal
      title="举报店铺"
      className="food-report-modal restaurant-feedback-modal"
      onClose={onClose}
      dismissible={!task.busy}
    >
      <p className="food-report-description">
        正在举报 <strong>{restaurantName || "这家店"}</strong>
      </p>
      <form
        className="food-report-form"
        onSubmit={(event) => {
          event.preventDefault();
          void task.run(
            (command) =>
              app.api.createReport(
                {
                  targetType: "RESTAURANT",
                  targetId: restaurantId,
                  reason:
                    draft.reason as Schema["FeedbackReportInputRequest"]["reason"],
                  note: draft.text.trim(),
                },
                command,
              ),
            () => {
              clearDraft();
              app.toast("举报已提交，可在反馈记录中查看处理进度。", {
                tone: "success",
              });
              onClose();
            },
          );
        }}
      >
        <fieldset disabled={task.busy || task.uncertain}>
          <ReportReasonField
            value={draft.reason}
            options={reportReasons}
            onChange={(reason) =>
              setDraft((current) => ({ ...current, reason }))
            }
          />
          <label className="food-report-field" htmlFor={noteId}>
            <span>补充说明（可选）</span>
            <textarea
              id={noteId}
              className="field"
              value={draft.text}
              maxLength={textLimit}
              placeholder="补充问题细节"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  text: event.target.value,
                }))
              }
            />
          </label>
          <div className="food-report-meta">
            <span>
              {[...draft.text].length} / {textLimit}
            </span>
            <Link
              to="/feedback/mine"
              state={{ feedbackSource: `/restaurants/${restaurantId}` }}
            >
              反馈记录
            </Link>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              {task.busy ? "正在提交…" : "提交举报"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
