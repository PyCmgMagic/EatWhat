import { useId } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app/state";
import { useSessionDraft } from "../app/drafts";
import type { Schema } from "../api/models";
import { Modal } from "../components/ui";
import { useCommand } from "./v4/shared";
import { ReportReasonField } from "./ReportReasonField";
import "./food-report.css";

const correctionReasons = [
  ["WRONG_NAME", "店名不正确"],
  ["WRONG_LOCATION", "位置不准确"],
  ["CLOSED", "店铺已停业"],
  ["DUPLICATE", "重复店铺"],
  ["OTHER", "其他问题"],
] as const;

export function RestaurantCorrectionDialog({
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
  const draftKey = `feedback:${app.user?.id}:catalog:RESTAURANT:${restaurantId}`;
  const [draft, setDraft, clearDraft] = useSessionDraft(draftKey, {
    text: "",
    reason: "WRONG_NAME",
  });
  const textLimit = 2000;

  return (
    <Modal
      title="店铺信息有误"
      className="food-report-modal restaurant-feedback-modal"
      onClose={onClose}
      dismissible={!task.busy}
    >
      <p className="food-report-description">
        正在反馈 <strong>{restaurantName || "这家店"}</strong>
      </p>
      <form
        className="food-report-form"
        onSubmit={(event) => {
          event.preventDefault();
          void task.run(
            (command) =>
              app.api.createCatalogError(
                {
                  restaurantId,
                  errorType:
                    draft.reason as Schema["FeedbackCatalogErrorInputRequest"]["errorType"],
                  note: draft.text.trim(),
                },
                command,
              ),
            () => {
              clearDraft();
              app.toast("店铺纠错已提交，可在反馈记录中查看处理进度。", {
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
            options={correctionReasons}
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
              placeholder="补充正确的店名、位置或其他信息"
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
              {task.busy ? "正在提交…" : "提交反馈"}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
