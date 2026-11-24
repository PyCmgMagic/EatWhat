import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import type { components } from "../../api/backend-v2-schema";
import { Modal } from "../../components/ui";
import { useTask } from "../../components/useTask";
import {
  Async,
  Drawer,
  Field,
  Notice,
  Pager,
  Panel,
  Pill,
  dateTime,
} from "../kit";
import "../../features/v4/confirm-dialog.css";

type Draft = Required<components["schemas"]["PublishConsentPolicy"]>;
const historyKey = ["admin", "consent-policies"] as const;
const pageSize = 12;
const versionPattern = "[A-Za-z0-9._\\-]{1,32}";
const textLimit = 50_000;

export default function ConsentPolicies() {
  const { api } = useApp();
  const cache = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const publishButton = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState("");
  const task = useTask("政策已发布。");
  const history = useQuery({
    queryKey: [...historyKey, page],
    queryFn: () => api.adminConsentPolicies({ page, pageSize }),
  });

  return (
    <>
      <Panel title="发布新版本">
        <form
          ref={form}
          className="ew-admin-form"
          aria-label="发布新版本"
          aria-busy={task.isPending}
          onInput={() => formError && setFormError("")}
          onSubmit={(event) => {
            event.preventDefault();
            if (task.isPending || draft) return;
            const fields = new FormData(event.currentTarget);
            const version = String(fields.get("version") ?? "").trim();
            const privacyText = String(fields.get("privacyText") ?? "");
            const crossBorderText = String(fields.get("crossBorderText") ?? "");
            if (!privacyText.trim() || !crossBorderText.trim()) {
              setFormError("请填写两份正文。");
              return;
            }
            setDraft({ version, privacyText, crossBorderText });
          }}
        >
          <Field label="版本号" hint="1–32 位字母、数字、点、下划线或连字符。">
            <input
              name="version"
              required
              maxLength={32}
              pattern={versionPattern}
              readOnly={task.isPending}
            />
          </Field>
          <Field label="隐私政策正文" wide>
            <textarea
              name="privacyText"
              rows={8}
              required
              maxLength={textLimit}
              readOnly={task.isPending}
            />
          </Field>
          <Field label="数据跨境说明正文" wide>
            <textarea
              name="crossBorderText"
              rows={8}
              required
              maxLength={textLimit}
              readOnly={task.isPending}
            />
          </Field>
          {formError && (
            <div data-wide role="alert">
              <Notice tone="bad">{formError}</Notice>
            </div>
          )}
          <div className="ew-admin-form-actions">
            <button
              ref={publishButton}
              type="submit"
              className="ew-admin-btn is-primary"
              aria-disabled={task.isPending}
            >
              {task.isPending ? "发布中…" : "发布新版本"}
            </button>
          </div>
        </form>
      </Panel>
      <Panel
        title="历史版本"
        flush
        actions={
          <button
            type="button"
            className="ew-admin-btn is-small"
            disabled={history.isFetching}
            onClick={() => void history.refetch()}
          >
            刷新
          </button>
        }
      >
        <Async
          query={history}
          empty={!history.data?.items?.length}
          emptyTitle="还没有发布任何版本"
        >
          <ul className="ew-admin-notices">
            {history.data?.items?.map((item, index) => {
              const id = item.id;
              return (
                <li key={id}>
                  <div>
                    <h3>
                      {item.version}
                      {page === 1 && index === 0 && (
                        <Pill tone="good">当前版本</Pill>
                      )}
                    </h3>
                    <small>发布于 {dateTime(item.publishedAt)}</small>
                  </div>
                  {id != null && (
                    <button
                      type="button"
                      className="ew-admin-btn is-small"
                      aria-label={`查看版本 ${item.version}`}
                      onClick={() => setSelectedId(id)}
                    >
                      查看正文
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <Pager
            page={page}
            total={history.data?.totalItems}
            totalPages={history.data?.totalPages}
            hasNext={history.data?.hasNext}
            onChange={setPage}
          />
        </Async>
      </Panel>
      {selectedId != null && (
        <PolicyDetail id={selectedId} onClose={() => setSelectedId(null)} />
      )}
      {draft && (
        <Modal
          title={`发布版本 ${draft.version}？`}
          className="v4-confirm-dialog"
          returnFocus={publishButton.current}
          motionOrigin={publishButton.current}
          onClose={() => setDraft(null)}
        >
          {(dismiss) => (
            <>
              <p>
                发布后，这两份正文不可修改。用户需要同意新版后才能继续使用。
              </p>
              <div className="v4-confirm-actions">
                <button type="button" autoFocus onClick={dismiss}>
                  取消
                </button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => {
                    dismiss();
                    task.run(async () => {
                      try {
                        await api.publishConsentPolicy(draft);
                        form.current?.reset();
                        setPage(1);
                      } finally {
                        void cache.invalidateQueries({ queryKey: historyKey });
                      }
                    });
                  }}
                >
                  确认发布
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

function PolicyDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { api } = useApp();
  const detail = useQuery({
    queryKey: [...historyKey, "detail", id],
    queryFn: () => api.adminConsentPolicy(id),
    staleTime: Infinity,
  });
  const policy = detail.data;

  return (
    <Drawer
      wide
      title={policy ? `版本 ${policy.version}` : "政策正文"}
      subtitle={policy ? `发布于 ${dateTime(policy.publishedAt)}` : undefined}
      onClose={onClose}
    >
      <Async query={detail}>
        {policy && (
          <div className="ew-admin-stack">
            <section className="ew-admin-stack">
              <h3>隐私政策正文</h3>
              <p className="ew-admin-policy-text">{policy.privacyText}</p>
            </section>
            <section className="ew-admin-stack">
              <h3>数据跨境说明正文</h3>
              <p className="ew-admin-policy-text">{policy.crossBorderText}</p>
            </section>
          </div>
        )}
      </Async>
    </Drawer>
  );
}
