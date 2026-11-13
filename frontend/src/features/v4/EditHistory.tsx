import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { errorMessage } from "../../api/client";
import { mealTimes, priceBands, shopKinds } from "../../api/v2-vocab";
import { timeText } from "./shared";
import "./edit-history.css";

/** One saved version of a dish or shop (backend v2 keeps every edit). */
export type Revision = {
  id?: number;
  action?: string | null;
  restoredFrom?: number | null;
  editor?: { id?: number; displayName?: string | null } | null;
  changes?: { field?: string; from?: unknown; to?: unknown }[] | null;
  createdAt?: number | null;
};

const fieldNames: Record<string, string> = {
  name: "名称",
  price: "价格",
  category: "分类",
  tags: "口味",
  signature: "招牌菜",
  description: "推荐理由",
  pictures: "图片",
  picture: "图片",
  pictureUrls: "图片",
  pictureUrl: "图片",
  stageColor: "舞台色",
  coverCrop: "封面裁剪",
  address: "地址",
  gcjLng: "位置",
  gcjLat: "位置",
  poi: "地图地点",
  permanentlyClosed: "营业状态",
  kind: "店铺类型",
  mealTimes: "营业饭点",
  priceBand: "人均价位",
  categories: "店铺分类",
  deliveryEnabled: "外卖",
  hubId: "所属商圈",
};
const actionNames: Record<string, string> = {
  create: "创建",
  edit: "修改",
  restore: "恢复",
};
const named = (list: { id: string; name: string }[], v: unknown) =>
  list.find((x) => x.id === v)?.name ?? String(v);

function show(field: string, value: unknown): string {
  if (value == null || value === "" || (Array.isArray(value) && !value.length))
    return "空";
  if (/^picture/.test(field)) return "图片";
  if (field === "permanentlyClosed") return value ? "已停业" : "营业中";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (field === "price") return `¥${value}`;
  if (field === "priceBand") return named(priceBands, value);
  if (field === "kind") return named(shopKinds, value);
  if (field === "mealTimes" && Array.isArray(value))
    return value.map((v) => named(mealTimes, v)).join("、");
  if (Array.isArray(value)) return value.map(String).join("、");
  if (typeof value === "object") return "已调整";
  return String(value);
}

function changeLines(revision: Revision) {
  const seen = new Set<string>();
  return (revision.changes ?? []).flatMap((c) => {
    const field = c.field ?? "";
    const label = fieldNames[field] ?? field;
    // Longitude and latitude are one "位置" change.
    if (seen.has(label)) return [];
    // Skip changes that look the same (e.g. empty → empty).
    if (
      revision.action !== "create" &&
      !/^picture|^coverCrop$|^gcjL/.test(field) &&
      show(field, c.from) === show(field, c.to)
    )
      return [];
    seen.add(label);
    if (/^picture|^coverCrop$|^gcjL/.test(field)) return [`${label}已更新`];
    if (revision.action === "create") return [`${label}：${show(field, c.to)}`];
    return [`${label}：${show(field, c.from)} → ${show(field, c.to)}`];
  });
}

/**
 * Edit history shown under a dish or shop. Signed-in verified users (and
 * admins) can put an earlier version back, as backend v2 allows.
 */
export function EditHistory({
  kind,
  id,
}: {
  kind: "food" | "restaurant";
  id: number;
}) {
  const { api, user } = useApp(),
    cache = useQueryClient(),
    [open, setOpen] = useState(false),
    [page, setPage] = useState(1),
    [confirm, setConfirm] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  const q = useQuery({
    queryKey: ["edit-history", kind, id, page],
    queryFn: () => api.editHistory(kind, id, page),
    enabled: open && !!id,
  });
  const canRestore =
    !!user && (user.verified === true || user.role === "admin");
  const items = q.data?.items ?? [];
  return (
    <details
      className="edit-history"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        修改记录
        <small>
          {kind === "food" ? "大家一起维护菜品信息" : "大家一起维护店铺信息"}
        </small>
      </summary>
      {q.isPending && open && <p className="edit-history-state">正在读取…</p>}
      {q.isError && (
        <p className="edit-history-state">
          {errorMessage(q.error)}
          <button type="button" onClick={() => void q.refetch()}>
            重试
          </button>
        </p>
      )}
      {q.data && !items.length && (
        <p className="edit-history-state">还没有修改记录。</p>
      )}
      {!!items.length && (
        <ol className="edit-history-list">
          {items.map((revision, index) => {
            const latest = page === 1 && index === 0;
            return (
              <li key={revision.id}>
                <div className="edit-history-head">
                  <strong>{revision.editor?.displayName || "校园食友"}</strong>
                  <span>
                    {revision.restoredFrom
                      ? "恢复旧版本"
                      : (actionNames[revision.action ?? ""] ?? "修改")}
                  </span>
                  <time>{timeText(revision.createdAt)}</time>
                  {latest && <em>当前版本</em>}
                </div>
                <ul>
                  {changeLines(revision).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {canRestore && !latest && revision.id != null && (
                  <div className="edit-history-actions">
                    {confirm === revision.id ? (
                      <>
                        <span>恢复后会生成一个新版本，确认恢复？</span>
                        <button
                          type="button"
                          className="is-primary"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setNote("");
                            try {
                              await api.restoreRevision(kind, id, revision.id!);
                              setConfirm(null);
                              setPage(1);
                              setNote("已恢复到这个版本。");
                              await cache.invalidateQueries({
                                predicate: (query) =>
                                  [
                                    "edit-history",
                                    "food",
                                    "foods",
                                    "restaurant",
                                    "restaurants",
                                  ].includes(String(query.queryKey[0])),
                              });
                            } catch (error) {
                              setNote(errorMessage(error));
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {busy ? "正在恢复…" : "确认恢复"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirm(null)}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setNote("");
                          setConfirm(revision.id!);
                        }}
                      >
                        恢复到这个版本
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {note && (
        <p className="edit-history-state" role="status">
          {note}
        </p>
      )}
      {(page > 1 || q.data?.hasNext) && (
        <nav className="edit-history-pager" aria-label="修改记录分页">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            较新
          </button>
          <span>第 {page} 页</span>
          <button
            type="button"
            disabled={!q.data?.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            更早
          </button>
        </nav>
      )}
    </details>
  );
}
