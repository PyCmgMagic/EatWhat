import { Select } from "../../components/Select";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAdminState } from "../../app/admin-state";
import { useApp } from "../../app/state";
import { parseId } from "../../api/models";
import {
  feedbackCategories,
  feedbackCategoryLabel,
  feedbackReasons,
  type FeedbackCategory,
  type FeedbackCase,
} from "../../api/feedback";
import { Async, Field, Icon, Pager, Pill, dateTime, type Tone } from "../kit";
import { statusText } from "../../features/v4/shared";
import FeedbackCaseDetail from "./FeedbackCaseDetail";

type Status = "OPEN" | "CLOSED";
type Kind = "ALL" | NonNullable<FeedbackCase["kind"]>;
type Filters = {
  category?: FeedbackCategory;
  submitterId?: number;
  appVersion?: string;
};

export default function Feedback() {
  const { api } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const selected =
    parseId(params.get("case") ?? undefined) ?? location.state?.caseId;
  const [page, setPage] = useAdminState("feedback.page", 1);
  const [status, setStatus] = useAdminState<Status>("feedback.status", "OPEN");
  const [kind, setKind] = useAdminState<Kind>("feedback.kind", "ALL");
  const [filters, setFilters] = useAdminState<Filters>("feedback.filters", {});
  const [expanded, setExpanded] = useState(false);
  const filterButton = useRef<HTMLButtonElement>(null);
  const activeStatus = useRef<HTMLButtonElement>(null);
  const pending = status === "OPEN";
  const showCategory = kind === "ALL" || kind === "FEEDBACK";
  const applied = [
    showCategory && filters.category && feedbackCategories[filters.category],
    filters.submitterId && `提交人 #${filters.submitterId}`,
    filters.appVersion && `版本 ${filters.appVersion}`,
  ].filter(Boolean);
  const filtered = kind !== "ALL" || applied.length > 0;
  const counts = useQuery({
    queryKey: ["admin", "feedback", "counts"],
    queryFn: () => api.feedbackCounts(),
    staleTime: 60000,
    retry: false,
  }).data;
  const typeCount = (count?: number) =>
    pending && count && !applied.length ? `（${count}）` : "";
  const query = useQuery({
    queryKey: ["admin", "feedback", page, status, kind, filters],
    queryFn: () =>
      api.adminFeedbackCases({
        page,
        pageSize: 12,
        status,
        kind: kind === "ALL" ? undefined : kind,
        ...filters,
        category: showCategory ? filters.category : undefined,
      }),
  });
  const { items, totalPages, totalItems, hasNext } = query.data ?? {};
  // Resolving the last case on a page can shrink the queue.
  const lastPage = totalPages == null ? undefined : Math.max(1, totalPages);
  useEffect(() => {
    if (lastPage !== undefined && page > lastPage) setPage(lastPage);
  }, [page, lastPage, setPage]);

  function switchStatus(next: Status) {
    setStatus(next);
    setPage(1);
  }
  function clearFilters() {
    setKind("ALL");
    setFilters({});
    setExpanded(false);
    setPage(1);
    filterButton.current?.focus();
  }
  function caseParams(id?: number) {
    const next = new URLSearchParams(params);
    if (id) next.set("case", String(id));
    else next.delete("case");
    return next;
  }
  function closeDetail() {
    if (location.state?.fromFeedbackList) void navigate(-1);
    else setParams(caseParams(), { replace: true, state: null });
  }
  return (
    <>
      <section
        className="ew-admin-panel ew-feedback-inbox"
        aria-label="反馈列表"
      >
        <header className="ew-feedback-toolbar">
          <div className="ew-feedback-views" role="group" aria-label="处理状态">
            {(["OPEN", "CLOSED"] as const).map((value) => (
              <button
                key={value}
                type="button"
                ref={status === value ? activeStatus : undefined}
                aria-pressed={status === value}
                onClick={() => switchStatus(value)}
              >
                {value === "OPEN" ? "待处理" : "已处理"}
                {value === "OPEN" && counts?.total != null && (
                  <span>{counts.total}</span>
                )}
              </button>
            ))}
          </div>
          <div className="ew-feedback-tools">
            <Select inline motionDuration={200} closeDuration={100}
              aria-label="反馈类型"
              value={kind}
              onChange={(event) => {
                const next = event.target.value as Kind;
                setKind(next);
                if (next !== "ALL" && next !== "FEEDBACK" && filters.category)
                  setFilters({ ...filters, category: undefined });
                setPage(1);
              }}
            >
              <option value="ALL">全部类型</option>
              <option value="FEEDBACK">
                意见反馈{typeCount(counts?.feedback)}
              </option>
              <option value="CATALOG_ERROR">
                店铺纠错{typeCount(counts?.catalogError)}
              </option>
              <option value="REPORT">举报{typeCount(counts?.report)}</option>
            </Select>
            <button
              ref={filterButton}
              className="ew-admin-btn"
              type="button"
              aria-expanded={expanded}
              aria-controls="feedback-filters"
              onClick={() => setExpanded(!expanded)}
            >
              <Icon name="filter" size={15} /> 更多筛选
              {applied.length > 0 && ` (${applied.length})`}
            </button>
          </div>
        </header>
        <div id="feedback-filters" hidden={!expanded}>
          {expanded && (
            <form
              className="ew-feedback-filters"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setFilters({
                  category: (data.get("category") || undefined) as
                    FeedbackCategory | undefined,
                  submitterId: Number(data.get("submitterId")) || undefined,
                  appVersion:
                    String(data.get("appVersion") || "").trim() || undefined,
                });
                setPage(1);
                setExpanded(false);
                filterButton.current?.focus();
              }}
            >
              {showCategory && (
                <Field label="反馈分类">
                  <Select inline motionDuration={200} closeDuration={100} name="category" defaultValue={filters.category ?? ""}>
                    <option value="">全部分类</option>
                    {Object.entries(feedbackCategories).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </Select>
                </Field>
              )}
              <Field label="提交人 ID">
                <input
                  name="submitterId"
                  type="number"
                  min="1"
                  step="1"
                  max={Number.MAX_SAFE_INTEGER}
                  defaultValue={filters.submitterId}
                />
              </Field>
              <Field label="应用版本">
                <input
                  name="appVersion"
                  maxLength={32}
                  defaultValue={filters.appVersion}
                />
              </Field>
              <button className="ew-admin-btn is-primary" type="submit">
                应用筛选
              </button>
            </form>
          )}
        </div>
        {applied.length > 0 && (
          <div className="ew-feedback-applied">
            <span>{applied.join(" · ")}</span>
            {!!items?.length && (
              <button className="ew-admin-link" onClick={clearFilters}>
                清除全部筛选
              </button>
            )}
          </div>
        )}
        <Async query={query} rows={5}>
          {items?.length ? (
            <>
              <div className="ew-feedback-columns" aria-hidden="true">
                <span>反馈内容</span>
                <span>提交人</span>
                <span>{pending ? "提交时间" : "处理时间"}</span>
                <span />
              </div>
              <ul className="ew-feedback-list">
                {items.map(
                  ({ view, targetName, submitterName, submitterId }) => {
                    if (!view?.id) return null;
                    const reason =
                      view.reason &&
                      (feedbackReasons[view.reason] ?? view.reason);
                    const title =
                      view.text || reason || targetName || `反馈 #${view.id}`;
                    const tone: Tone =
                      view.kind === "REPORT"
                        ? "bad"
                        : view.kind === "CATALOG_ERROR"
                          ? "warn"
                          : "info";
                    return (
                      <li key={view.id}>
                        <Link
                          to={{ search: caseParams(view.id).toString() }}
                          state={{
                            fromFeedbackList: true,
                            preserveScroll: true,
                          }}
                          aria-haspopup="dialog"
                        >
                          <span className="ew-feedback-subject">
                            <strong>{title}</strong>
                            <span className="ew-feedback-context">
                              <Pill tone={tone} dot={false}>
                                {feedbackCategoryLabel(view) ??
                                  statusText(view.kind)}
                              </Pill>
                              {targetName && targetName !== title && (
                                <span>{targetName}</span>
                              )}
                              {!pending && view.outcome && (
                                <span>{statusText(view.outcome)}</span>
                              )}
                            </span>
                          </span>
                          <span className="ew-feedback-person">
                            <span className="sr-only">提交人 </span>
                            {submitterName ||
                              (submitterId ? `用户 #${submitterId}` : "—")}
                          </span>
                          <time>
                            <span className="sr-only">
                              {pending ? "提交时间" : "处理时间"}{" "}
                            </span>
                            {dateTime(pending ? view.createdAt : view.closedAt)}
                          </time>
                          <span className="ew-feedback-row-action">
                            {pending ? "处理" : "查看"}
                            <Icon name="chevronRight" size={14} />
                          </span>
                        </Link>
                      </li>
                    );
                  },
                )}
              </ul>
            </>
          ) : (
            <div className="ew-feedback-empty">
              <div
                className="ew-feedback-empty-icon"
                aria-hidden="true"
                data-clear={(pending && !filtered) || undefined}
              >
                {filtered ? (
                  <Icon name="filter" size={28} />
                ) : pending ? (
                  <>
                    <Inbox size={32} strokeWidth={1.65} />
                    <i>
                      <Icon name="check" size={12} />
                    </i>
                  </>
                ) : (
                  <Icon name="history" size={30} />
                )}
              </div>
              <h2 aria-live="polite">
                {filtered
                  ? "没有符合条件的反馈"
                  : pending
                    ? "暂无待处理反馈"
                    : "暂无已处理记录"}
              </h2>
              <button
                className="ew-admin-btn"
                onClick={() => {
                  if (filtered) clearFilters();
                  else {
                    switchStatus(pending ? "CLOSED" : "OPEN");
                    requestAnimationFrame(() => activeStatus.current?.focus());
                  }
                }}
              >
                {filtered
                  ? "清除筛选"
                  : pending
                    ? "查看已处理记录"
                    : "返回待处理"}
                <Icon name="chevronRight" size={14} />
              </button>
            </div>
          )}
          {(page > 1 || hasNext || (totalPages ?? 0) > 1) && (
            <Pager
              page={page}
              total={totalItems}
              totalPages={totalPages}
              hasNext={hasNext}
              onChange={setPage}
            />
          )}
        </Async>
      </section>
      {selected && (
        <FeedbackCaseDetail
          key={selected}
          id={selected}
          onClose={closeDetail}
          onReturnToQueue={() => {
            closeDetail();
            requestAnimationFrame(() =>
              activeStatus.current?.focus({ preventScroll: true }),
            );
          }}
        />
      )}
    </>
  );
}
