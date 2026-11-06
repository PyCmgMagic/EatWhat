import ProfileResolution from "../features/v4/ProfileResolution";
import { Select } from "../components/Select";
import { useRef, useState } from "react";
import { useContentMotion } from "../motion/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { ApiError, errorMessage, resultUncertain } from "../api/client";
import type { Schema } from "../api/models";
import {
  catalogResolution,
  decisionResolution,
  objectResolution,
  parseHubImport,
  record,
  recordList,
  requireApplied,
  uuid,
  type SyncRecord,
} from "../api/sync-management";
import { Empty, ErrorState, Loading } from "../components/ui";
import "./admin-sync.css";

const tabs = [
  ["catalog", "目录冲突"],
  ["objects", "对象版本"],
  ["decisions", "目录决策"],
  ["catalog-reviews", "目录授权复核"],
  ["profiles", "资料冲突"],
  ["profile-reviews", "资料授权复核"],
  ["import", "导入区域"],
] as const;
type Tab = (typeof tabs)[number][0];
type Selection = { tab: Tab; row: SyncRecord };
const shown = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "—";
const rowId = (row: SyncRecord, tab: Tab) =>
  shown(tab.endsWith("reviews") ? row.eventId : row.conflictId);
const disabledMessage = (error: unknown) =>
  error instanceof ApiError && [404, 405, 501].includes(error.status ?? 0)
    ? new Error("同步管理功能正在准备中，敬请期待。")
    : error;

export default function AdminSync() {
  const { api, toast } = useApp();
  const [tab, setTab] = useState<Tab>("catalog"),
    [selected, setSelected] = useState<Selection>(),
    [edition, setEdition] = useState(0),
    [error, setError] = useState(""),
    [reading, setReading] = useState(false),
    [writing, setWriting] = useState(false),
    [filter, setFilter] = useState("");
  const query = useQuery({
    queryKey: ["admin-sync", tab],
    queryFn: async () => {
      const result =
        tab === "catalog"
          ? await api.catalogConflicts()
          : tab === "objects"
            ? await api.objectConflicts()
            : tab === "decisions"
              ? await api.catalogDecisions()
              : tab === "catalog-reviews"
                ? await api.catalogReviews()
                : tab === "profiles"
                  ? await api.profileConflicts()
                  : await api.profileReviews();
      return recordList(result);
    },
    enabled: tab !== "import",
    retry: false,
  });
  async function choose(row: SyncRecord) {
    if (reading || writing) return;
    setReading(true);
    setError("");
    try {
      const snapshot =
        tab === "decisions"
          ? record(await api.catalogDecision(uuid(row.conflictId)))
          : row;
      setSelected({ tab, row: snapshot });
      setEdition((value) => value + 1);
    } catch (cause) {
      setError(errorMessage(disabledMessage(cause)));
    } finally {
      setReading(false);
    }
  }
  async function refreshSelection() {
    const old = selected;
    setError("");
    const fresh = await query.refetch();
    if (fresh.error) {
      setError(errorMessage(disabledMessage(fresh.error)));
      return;
    }
    if (old) {
      const current = fresh.data?.find(
        (row) => rowId(row, tab) === rowId(old.row, tab),
      );
      if (current) await choose(current);
      else {
        setSelected(undefined);
        toast("记录已离开当前列表，请核对服务端处理结果。");
      }
    }
  }
  const detail = useRef<HTMLElement>(null);
  useContentMotion(
    detail,
    selected
      ? `${selected.tab}:${rowId(selected.row, selected.tab)}:${edition}`
      : "empty",
    0,
    "opacity",
  );
  const rows = (query.data ?? []).filter(
    (row) =>
      !filter.trim() ||
      JSON.stringify(row).toLowerCase().includes(filter.trim().toLowerCase()),
  );
  return (
    <section className="sync-workbench">
      <header className="sync-heading">
        <div>
          <span className="sync-eyebrow">跨站数据 · 管理工作台</span>
          <h2>核对版本，再做决定。</h2>
          <p>查看各站点的候选记录，保留清晰的处理依据。</p>
        </div>
        <span className="sync-count">
          {tab === "import"
            ? "区域目录"
            : `${query.data?.length ?? "—"} 条记录`}
        </span>
      </header>
      <nav className="sync-tabs" aria-label="同步管理分类">
        {tabs.map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={id === tab}
            disabled={writing || reading}
            onClick={() => {
              setTab(id);
              setSelected(undefined);
              setFilter("");
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "import" ? (
        <HubImport onBusy={setWriting} />
      ) : (
        <>
          <div className="sync-toolbar">
            <input
              aria-label="筛选同步记录"
              placeholder="搜索编号、内容或来源"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <button
              type="button"
              disabled={query.isFetching || reading || writing}
              onClick={() => void refreshSelection()}
            >
              {query.isFetching ? "正在读取…" : "刷新记录"}
            </button>
          </div>
          {error && (
            <p role="alert" className="sync-error">
              {error}
            </p>
          )}
          <div className="sync-columns">
            <div className="sync-records">
              {query.isPending ? (
                <Loading />
              ) : query.isError ? (
                <ErrorState
                  error={disabledMessage(query.error)}
                  retry={() => void query.refetch()}
                />
              ) : !rows.length ? (
                <Empty title="当前没有匹配的记录">
                  可以刷新列表，或调整搜索条件。
                </Empty>
              ) : (
                rows.map((row, index) => (
                  <button
                    type="button"
                    className={`sync-record ${selected && rowId(selected.row, tab) === rowId(row, tab) ? "is-selected" : ""}`}
                    disabled={reading || writing}
                    key={rowId(row, tab) + index}
                    onClick={() => void choose(row)}
                  >
                    <span className="sync-record-top">
                      <span>
                        {shown(row.kind ?? row.fieldGroup ?? "跨站记录")}
                      </span>
                      <em>
                        {shown(
                          row.status ??
                            (row.revision != null
                              ? `修订 ${row.revision}`
                              : "待复核"),
                        )}
                      </em>
                    </span>
                    <strong>
                      {shown(
                        row.naturalKey ??
                          row.reason ??
                          row.objectGid ??
                          row.subjectId ??
                          row.conflictId ??
                          row.eventId,
                      )}
                    </strong>
                    <small>{rowId(row, tab)}</small>
                    <span className="sync-record-link">
                      核对版本 <span>↗</span>
                    </span>
                  </button>
                ))
              )}
            </div>
            <aside className="sync-detail" ref={detail}>
              {selected ? (
                <ResolutionEditor
                  key={
                    selected.tab + rowId(selected.row, selected.tab) + edition
                  }
                  selected={selected}
                  onBusy={setWriting}
                  onRefresh={() => void refreshSelection()}
                  onDone={() => {
                    setSelected(undefined);
                    void query.refetch();
                  }}
                />
              ) : (
                <div className="sync-intro">
                  <span>◎</span>
                  <h3>从左侧选择一条记录</h3>
                  <p>
                    各站点的候选版本、来源和内容摘要会显示在这里。提交时会带上当前版本，避免覆盖其他管理员的处理。
                  </p>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function ResolutionEditor({
  selected,
  onRefresh,
  onDone,
  onBusy,
}: {
  selected: Selection;
  onRefresh: () => void;
  onDone: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const { api, toast } = useApp(),
    lock = useRef(false);
  const { tab, row } = selected;
  const [decision, setDecision] = useState(""),
    [winner, setWinner] = useState(""),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState(false),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [needsReload, setNeedsReload] = useState(false),
    [error, setError] = useState("");
  const source =
    tab === "profile-reviews"
      ? (() => {
          try {
            return record(row.conflict);
          } catch {
            return null;
          }
        })()
      : row;
  const options: string[] = (() => {
    try {
      if (tab === "catalog")
        return recordList(row.candidates).map((item) => uuid(item.gid));
      if (tab === "objects")
        return recordList(row.heads).map((item) => uuid(item.operationId));
      if (tab === "decisions")
        return Array.isArray(row.candidateOperations)
          ? row.candidateOperations.map((value) => uuid(value))
          : [];
    } catch {
      /* Incomplete snapshots remain readable; submission validates them. */
    }
    return [];
  })();
  if (tab.startsWith("profile"))
    return (
      <ProfileResolution
        row={row}
        review={tab === "profile-reviews"}
        onDone={onDone}
        onRefresh={onRefresh}
      />
    );
  return (
    <div className="sync-editor">
      <div className="sync-editor-heading">
        <div>
          <small>正在核对</small>
          <h3>{tabs.find(([id]) => id === tab)?.[1]}</h3>
        </div>
        <button type="button" disabled={busy} onClick={onRefresh}>
          重新读取
        </button>
      </div>
      <dl className="sync-facts">
        <div>
          <dt>记录编号</dt>
          <dd>{rowId(row, tab)}</dd>
        </div>
        {source?.revision != null && (
          <div>
            <dt>当前修订号</dt>
            <dd>{shown(source.revision)}</dd>
          </div>
        )}
        {row.reason != null && (
          <div>
            <dt>复核原因</dt>
            <dd>{shown(row.reason)}</dd>
          </div>
        )}
      </dl>
      <CandidateOverview source={source} />
      <details className="sync-snapshot">
        <summary>来源与候选版本明细</summary>
        <pre>{JSON.stringify(row, null, 2)}</pre>
      </details>
      {tab === "catalog-reviews" || tab.startsWith("profile") ? (
        <p className="sync-note">
          {tab.startsWith("profile")
            ? "资料复核功能正在准备中，敬请期待。你可以先查看上方的候选内容。"
            : "你可以在此核对授权原因。如需处理相关内容，请通过关联的冲突记录前往目录冲突或目录决策。"}
        </p>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              tab.startsWith("profile") ||
              lock.current ||
              !checked ||
              uncertain ||
              needsReload
            )
              return;
            lock.current = true;
            setBusy(true);
            onBusy(true);
            setError("");
            try {
              const id = uuid(row.conflictId);
              if (tab === "catalog")
                requireApplied(
                  await api.resolveCatalogConflict(
                    id,
                    catalogResolution(row, decision, winner, reason),
                  ),
                );
              else if (tab === "objects")
                requireApplied(
                  await api.resolveObjectConflict(
                    id,
                    objectResolution(row, decision, winner, reason),
                  ),
                );
              else if (tab === "decisions")
                requireApplied(
                  await api.resolveCatalogDecision(
                    id,
                    decisionResolution(row, decision, winner, reason),
                  ),
                );
              toast("本次处理已应用。");
              onDone();
            } catch (cause) {
              setError(errorMessage(disabledMessage(cause)));
              if (resultUncertain(cause)) setUncertain(true);
              if (
                cause instanceof ApiError &&
                (cause.code === "SYNC_CONFLICT" || cause.status === 409)
              )
                setNeedsReload(true);
            } finally {
              lock.current = false;
              setBusy(false);
              onBusy(false);
            }
          }}
        >
          <label>
            处理方式
            <Select
              aria-label="处理方式"
              value={decision}
              disabled={busy}
              required
              onChange={(event) => {
                setDecision(event.target.value);
                setWinner("");
                setChecked(false);
              }}
            >
              <option value="">请选择处理方式</option>
              <option value="KEEP">保留选定版本</option>
              <option value="REJECT">驳回变更</option>
            </Select>
          </label>
          {decision === "KEEP" && (
            <label>
              保留的候选版本
              <Select
                aria-label="保留的候选版本"
                value={winner}
                disabled={busy}
                required
                onChange={(event) => {
                  setWinner(event.target.value);
                  setChecked(false);
                }}
              >
                <option value="">从当前候选中选择</option>
                {options.map((id) => (
                  <option value={id} key={id}>
                    {id}
                  </option>
                ))}
              </Select>
            </label>
          )}
          <label>
            处理原因
            <textarea
              aria-label="处理原因"
              value={reason}
              disabled={busy}
              required
              maxLength={2000}
              rows={3}
              placeholder="说明核对结果，供后续追溯"
              onChange={(event) => {
                setReason(event.target.value);
                setChecked(false);
              }}
            />
          </label>
          <label className="sync-confirm">
            <input
              type="checkbox"
              checked={checked}
              disabled={busy}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>我已核对当前版本和处理范围。</span>
          </label>
          {error && (
            <p role="alert" className="sync-error">
              {error}
            </p>
          )}
          {uncertain && (
            <p className="sync-note">
              处理结果尚未确认，请先重新读取记录，避免重复提交。
            </p>
          )}
          <button
            className="sync-primary"
            disabled={busy || !checked || !decision || uncertain || needsReload}
          >
            {busy ? "正在处理…" : "提交本次处理"}
          </button>
        </form>
      )}
    </div>
  );
}

function CandidateOverview({ source }: { source: SyncRecord | null }) {
  const values =
    source?.candidates ?? source?.heads ?? source?.candidateOperations;
  if (!Array.isArray(values)) return null;
  return (
    <div className="sync-candidates" aria-label="候选版本对比">
      {values.map((value, index) => {
        const item =
          typeof value === "string"
            ? { operationId: value }
            : value && typeof value === "object"
              ? (value as SyncRecord)
              : {};
        const summary =
          item.value && typeof item.value === "object"
            ? (item.value as SyncRecord)
            : item.summary && typeof item.summary === "object"
              ? (item.summary as SyncRecord)
              : item;
        const fields = Object.entries(summary).filter(
          ([key, value]) =>
            ![
              "gid",
              "numericId",
              "operationId",
              "revision",
              "contentHash",
              "sourceSite",
            ].includes(key) &&
            ["string", "number", "boolean"].includes(typeof value),
        );
        return (
          <article key={shown(item.id ?? item.gid ?? item.operationId) + index}>
            <header>
              <strong>
                {shown(item.sourceSite ?? `候选版本 ${index + 1}`)}
              </strong>
              {item.revision != null && (
                <span>修订 {shown(item.revision)}</span>
              )}
            </header>
            <code>{shown(item.id ?? item.gid ?? item.operationId)}</code>
            {Object.hasOwn(item, "value") &&
              (!item.value || typeof item.value !== "object") && (
                <pre>{JSON.stringify(item.value, null, 2)}</pre>
              )}
            {item.vector != null && (
              <small>版本向量：{JSON.stringify(item.vector)}</small>
            )}
            {fields.map(([key, value]) => (
              <p key={key}>
                <span>
                  {(
                    {
                      name: "名称",
                      address: "地址",
                      signature: "签名",
                    } as Record<string, string>
                  )[key] ?? key}
                </span>
                {String(value)}
              </p>
            ))}
            {item.contentHash != null && (
              <small>内容摘要：{shown(item.contentHash)}</small>
            )}
          </article>
        );
      })}
    </div>
  );
}

function HubImport({ onBusy }: { onBusy: (busy: boolean) => void }) {
  const { api } = useApp(),
    cache = useQueryClient(),
    lock = useRef(false);
  const [json, setJson] = useState(""),
    [preview, setPreview] =
      useState<Schema["CatalogHubImportRequestRequest"]>(),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<Schema["CatalogImportResultResponse"]>();
  const change = (text: string) => {
    setJson(text);
    setPreview(undefined);
    setConfirmed(false);
    setResult(undefined);
    setError("");
  };
  return (
    <div className="sync-import">
      <section>
        <h3>导入区域目录</h3>
        <p>使用已核实的目录文件，先预览区域和批次信息，再提交导入。</p>
        <label>
          选择 JSON 文件
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                setError("请选择 2 MB 以内的目录文件。");
                return;
              }
              try {
                change(await file.text());
              } catch {
                setError("文件读取失败，请重新选择。");
              }
            }}
          />
        </label>
        <label>
          目录文件内容
          <textarea
            aria-label="目录文件内容"
            value={json}
            disabled={busy}
            rows={15}
            onChange={(event) => change(event.target.value)}
            placeholder={
              '{"sourceKey":"来源标识","requestId":"批次 UUID","contentHash":"来源内容摘要","hubs":[{"sourceId":"来源区域编号","name":"区域名称","centerGcj":{"lng":117.134,"lat":36.667},"rebindCoveredRestaurants":false}]}'
            }
          />
        </label>
        <button
          type="button"
          disabled={busy || !json.trim()}
          onClick={() => {
            try {
              setPreview(parseHubImport(json));
              setConfirmed(false);
              setError("");
            } catch (cause) {
              setError(errorMessage(cause));
            }
          }}
        >
          预览导入内容
        </button>
      </section>
      <aside>
        <h3>本次导入</h3>
        {preview ? (
          <>
            <dl className="sync-facts">
              <div>
                <dt>来源</dt>
                <dd>{preview.sourceKey}</dd>
              </div>
              <div>
                <dt>批次编号</dt>
                <dd>{preview.requestId}</dd>
              </div>
              <div>
                <dt>内容摘要</dt>
                <dd>{preview.contentHash}</dd>
              </div>
            </dl>
            <div className="sync-import-preview">
              {preview.hubs?.map((hub) => (
                <div key={hub.sourceId}>
                  <strong>{hub.name}</strong>
                  <span>{hub.sourceId}</span>
                  <small>
                    {hub.rebindCoveredRestaurants
                      ? "将重新绑定覆盖范围内的餐厅"
                      : "不重新绑定餐厅"}
                  </small>
                </div>
              ))}
            </div>
            <label className="sync-confirm">
              <input
                type="checkbox"
                disabled={busy}
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                已核对这 {preview.hubs?.length} 个区域及餐厅归属影响。
              </span>
            </label>
            <button
              className="sync-primary"
              type="button"
              disabled={busy || !confirmed || !!result}
              onClick={async () => {
                if (lock.current || !preview) return;
                lock.current = true;
                setBusy(true);
                onBusy(true);
                setError("");
                try {
                  const reply = await api.importCatalogHubs(preview);
                  if (reply.status !== "APPLIED" && reply.status !== "REPLAYED")
                    throw new Error(
                      reply.status === "CONFLICT"
                        ? "导入存在冲突，请核对目录冲突后重试。"
                        : reply.status === "BLOCKED"
                          ? "导入被阻止，请检查授权及服务端限制。"
                          : "未返回明确的导入结果，请保留批次编号并核实。",
                    );
                  setResult(reply);
                  void cache.invalidateQueries({ queryKey: ["hubs"] });
                } catch (cause) {
                  setError(errorMessage(disabledMessage(cause)));
                } finally {
                  lock.current = false;
                  setBusy(false);
                  onBusy(false);
                }
              }}
            >
              {busy ? "正在导入…" : "确认导入区域"}
            </button>
            <p className="sync-note">
              重试会继续使用当前文件的相同批次编号和摘要；不要为同一批次随意生成新编号。
            </p>
            {result && (
              <div className="sync-receipt" role="status">
                <strong>
                  {result.status === "REPLAYED"
                    ? "该批次已处理，返回既有结果"
                    : "目录导入已应用"}
                </strong>
                <p>
                  新增 {result.created ?? 0} 个 · 更新 {result.updated ?? 0} 个
                </p>
                <small>批次：{result.batchId || preview.requestId}</small>
              </div>
            )}
          </>
        ) : (
          <p className="sync-note">预览后会在这里显示区域记录和归属影响。</p>
        )}
        {error && (
          <p role="alert" className="sync-error">
            {error}
          </p>
        )}
      </aside>
    </div>
  );
}
