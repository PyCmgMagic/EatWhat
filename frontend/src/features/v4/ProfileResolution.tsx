import { useState } from "react";
import { useApp } from "../../app/state";
import {
  type SyncRecord,
  record,
  recordList,
  uuid,
} from "../../api/sync-management";
import { Card, Field, CommandState, useCommand } from "./shared";
export default function ProfileResolution({
  row,
  review,
  onDone,
  onRefresh,
}: {
  row: SyncRecord;
  review: boolean;
  onDone: () => void;
  onRefresh: () => void;
}) {
  const { api } = useApp(),
    [selected, setSelected] = useState(""),
    [ack, setAck] = useState(false),
    task = useCommand();
  let source: SyncRecord, heads: SyncRecord[];
  try {
    source = review ? record(row.conflict) : row;
    heads = recordList(source.heads);
  } catch {
    return (
      <Card>
        资料候选信息不完整，请重新读取。
        <button onClick={onRefresh}>重新读取</button>
      </Card>
    );
  }
  const expectedRevision = Number(source.revision);
  return (
    <Card title={review ? "资料授权复核" : "资料冲突处理"}>
      <p>
        选择要保留的资料候选。提交时校验当前修订号，版本变化时需要重新比较。
      </p>
      <Field label="保留的候选">
        <select
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setAck(false);
          }}
        >
          <option value="">请选择</option>
          {heads.map((h) => (
            <option key={String(h.id)} value={String(h.id)}>
              {String(h.id)}
            </option>
          ))}
        </select>
      </Field>
      {heads.map((h) => (
        <details key={String(h.id)} open={selected === h.id}>
          <summary>候选 {String(h.id)}</summary>
          <pre>{JSON.stringify(h.value, null, 2)}</pre>
        </details>
      ))}
      <label className="v4-check">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        已核对候选内容与修订 {expectedRevision}
      </label>
      <div className="v4-actions">
        <button onClick={onRefresh} disabled={task.busy}>
          重新读取
        </button>
        <button
          disabled={
            !ack ||
            !selected ||
            !Number.isSafeInteger(expectedRevision) ||
            task.busy ||
            task.uncertain
          }
          onClick={() =>
            void task.run(
              () => {
                const body = {
                  expectedRevision,
                  selectedHeadId: uuid(selected),
                };
                if (!heads.some((h) => h.id === body.selectedHeadId))
                  throw new Error("候选已变化，请重新读取。");
                return review
                  ? api.resolveProfileReview(uuid(row.eventId), body)
                  : api.resolveProfileConflict(uuid(row.conflictId), body);
              },
              () => onDone(),
            )
          }
        >
          确认保留此候选
        </button>
      </div>
      <CommandState task={task} />
    </Card>
  );
}
