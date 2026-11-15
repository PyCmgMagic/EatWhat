import { useId } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../app/state";
import { useSessionDraft } from "../app/drafts";
import type { Schema } from "../api/models";
import { Modal } from "../components/ui";
import { useCommand } from "./v4/shared";
import "./food-report.css";

const reportReasons = [
  ["NOT_REAL_PHOTO", "非真实照片"],
  ["ADVERTISING", "广告信息"],
  ["ILLEGAL_OR_UNFRIENDLY", "不友善或违规内容"],
  ["OTHER", "其他问题"],
] as const;

export function FoodReportDialog({
  foodId,
  foodName,
  onClose,
}: {
  foodId: number;
  foodName?: string | null;
  onClose: () => void;
}) {
  const app = useApp(),
    task = useCommand(),
    reasonId = useId(),
    noteId = useId();
  const draftKey = `feedback:${app.user?.id}:report:FOOD:${foodId}`;
  const [draft, setDraft, clearDraft] = useSessionDraft(draftKey, {
    text: "",
    reason: "OTHER",
  });
  const textLimit = 2000;

  return (
    <Modal
      title="举报菜品"
      className="food-report-modal"
      onClose={onClose}
      dismissible={!task.busy}
    >
      <p className="food-report-description">
        正在举报 <strong>{foodName || "这道菜"}</strong>
        ，请选择问题类型。补充细节能帮助我们更快核实。
      </p>
      <form
        className="food-report-form"
        onSubmit={(event) => {
          event.preventDefault();
          void task.run(
            (command) =>
              app.api.createReport(
                {
                  targetType: "FOOD",
                  targetId: foodId,
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
          <label className="food-report-field" htmlFor={reasonId}>
            <span>问题类型</span>
            <select
              id={reasonId}
              className="field"
              value={draft.reason}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
            >
              {reportReasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="food-report-field" htmlFor={noteId}>
            <span>补充说明（可选）</span>
            <textarea
              id={noteId}
              className="field"
              value={draft.text}
              maxLength={textLimit}
              placeholder="补充一些细节，帮助我们更准确地了解问题…"
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
              state={{ feedbackSource: `/foods/${foodId}` }}
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
