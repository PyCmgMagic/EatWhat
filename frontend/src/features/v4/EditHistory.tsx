import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../../app/state";
import { errorMessage } from "../../api/client";
import { mealTimes, priceBands, shopKinds } from "../../api/v2-vocab";
import { DesignIcon as Icon } from "../../mobile/ui";
import { Modal } from "../../components/ui";
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
const isBlank = (value: unknown) =>
  value == null || value === "" || (Array.isArray(value) && !value.length);

function show(field: string, value: unknown): string {
  if (isBlank(value)) return "空";
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

type ShopChange = {
  field: string;
  label: string;
  before?: string;
  after: string;
};

const operatingFields = new Set([
  "permanentlyClosed",
  "kind",
  "mealTimes",
  "priceBand",
  "categories",
  "tags",
  "deliveryEnabled",
]);

function shopChanges(revision: Revision) {
  const changes = new Map<string, ShopChange>();
  const created = revision.action === "create";
  for (const { field, from, to } of revision.changes ?? []) {
    if (!field) continue;
    if (isBlank(to) && (created || isBlank(from))) continue;

    // Coordinates and the provider's place ID describe the same map location.
    if (["gcjLng", "gcjLat", "poi"].includes(field)) {
      if (created || from !== to)
        changes.set("location", {
          field,
          label: "地图位置",
          after: created ? "已设置" : "已更新",
        });
      continue;
    }
    if (/^picture/.test(field)) {
      changes.set("pictures", {
        field,
        label: "图片",
        after: isBlank(to) ? "已移除" : isBlank(from) ? "已添加" : "已更新",
      });
      continue;
    }

    const label = fieldNames[field] ?? field;
    const after = isBlank(to) ? "未填写" : show(field, to);
    const before = isBlank(from) ? "未填写" : show(field, from);
    if (created) changes.set(field, { field, label, after });
    else if (before !== after)
      changes.set(field, { field, label, before, after });
    else if (after === "已调整" && JSON.stringify(from) !== JSON.stringify(to))
      changes.set(field, { field, label, after });
  }
  return [...changes.values()];
}

function ShopRevision({
  revision,
  latest,
  children,
}: {
  revision: Revision;
  latest: boolean;
  children?: ReactNode;
}) {
  const created = revision.action === "create";
  const restored =
    revision.restoredFrom != null || revision.action === "restore";
  const editor = revision.editor?.displayName || "校园食友";
  const changes = shopChanges(revision);
  const groups = [
    {
      key: "details",
      title: "店铺资料",
      changes: changes.filter(({ field }) => !operatingFields.has(field)),
    },
    {
      key: "operations",
      title: "经营信息",
      changes: changes.filter(({ field }) => operatingFields.has(field)),
    },
  ].filter((group) => group.changes.length);

  return (
    <>
      <span
        className="shop-revision-marker"
        data-current={latest}
        aria-hidden="true"
      >
        <Icon
          name={created ? "store" : restored ? "history" : "edit"}
          size={16}
        />
      </span>
      <article className="shop-revision-card" data-current={latest}>
        <header className="shop-revision-header">
          <div className="shop-revision-title">
            <h2>
              {created ? "创建店铺" : restored ? "恢复旧版本" : "修改店铺"}
            </h2>
            {latest && <span>当前版本</span>}
          </div>
          <div className="shop-revision-byline">
            <strong>{editor}</strong>
            <time>{timeText(revision.createdAt)}</time>
          </div>
        </header>
        <div className="shop-revision-body">
          {groups.map((group) => (
            <section
              className="shop-revision-group"
              data-group={group.key}
              key={group.key}
            >
              {groups.length > 1 && <h3>{group.title}</h3>}
              <dl className="shop-revision-fields">
                {group.changes.map(({ field, label, before, after }) => (
                  <div className="shop-revision-field" key={field}>
                    <dt>{label}</dt>
                    {before === undefined ? (
                      <dd>{after}</dd>
                    ) : (
                      <dd className="shop-revision-compare">
                        <div className="shop-revision-before">
                          <small>修改前</small>
                          {before}
                        </div>
                        <span
                          className="shop-revision-arrow"
                          aria-hidden="true"
                        >
                          <Icon name="chevronRight" size={15} />
                        </span>
                        <div className="shop-revision-after">
                          <small>修改后</small>
                          {after}
                        </div>
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {!changes.length && (
            <p className="shop-revision-empty">暂无可展示的字段变化。</p>
          )}
          {children}
        </div>
      </article>
    </>
  );
}

export function EditHistory({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="edit-history"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        修改记录
        <small>大家一起维护菜品信息</small>
      </summary>
      <RevisionList kind="food" id={id} enabled={open} />
    </details>
  );
}

export function FoodEditHistoryDialog({
  id,
  onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  return (
    <Modal title="修改记录" className="food-history-modal" onClose={onClose}>
      <div className="edit-history food-history-content">
        <RevisionList kind="food" id={id} />
      </div>
    </Modal>
  );
}

/** Shop history as a dialog, so the PC menu does not leave the shop page. */
export function RestaurantHistoryDialog({
  id,
  name,
  onClose,
}: {
  id: number;
  name?: string | null;
  onClose: () => void;
}) {
  return (
    <Modal title="修改记录" className="shop-history-modal" onClose={onClose}>
      {name && (
        <p className="shop-history-name">
          <Icon name="store" size={17} />
          <span>{name}</span>
        </p>
      )}
      <div className="edit-history shop-history-content">
        <RevisionList kind="restaurant" id={id} />
      </div>
    </Modal>
  );
}

export function RestaurantEditHistory({ id }: { id: number }) {
  const { api } = useApp();
  const location = useLocation();
  const detailPath = `/restaurants/${id}`;
  const source = location.state?.returnTo;
  const back =
    typeof source === "string" && source.split("?")[0] === detailPath
      ? source
      : detailPath;
  const shop = useQuery({
    queryKey: ["restaurants", "detail", id],
    queryFn: () => api.restaurant(id),
  });
  return (
    <section
      className="restaurant-history-page"
      aria-labelledby="restaurant-history-title"
    >
      <header>
        <Link className="restaurant-history-back" to={back}>
          <Icon name="back" size={16} />
          返回店铺
        </Link>
        <h1 id="restaurant-history-title">修改记录</h1>
        {shop.data?.name && (
          <p className="shop-history-name">
            <Icon name="store" size={17} />
            <span>{shop.data.name}</span>
          </p>
        )}
      </header>
      <div className="edit-history shop-history-content">
        <RevisionList key={id} kind="restaurant" id={id} />
      </div>
    </section>
  );
}

function RevisionList({
  kind,
  id,
  enabled = true,
}: {
  kind: "food" | "restaurant";
  id: number;
  enabled?: boolean;
}) {
  const { api, user } = useApp(),
    cache = useQueryClient(),
    [page, setPage] = useState(1),
    [confirm, setConfirm] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState("");
  const q = useQuery({
    queryKey: ["edit-history", kind, id, page],
    queryFn: () => api.editHistory(kind, id, page),
    enabled: enabled && !!id,
  });
  const canRestore =
    !!user && (user.verified === true || user.role === "admin");
  const items = q.data?.items ?? [];
  const isShop = kind === "restaurant";

  async function restore(revisionId: number) {
    setBusy(true);
    setNote("");
    try {
      await api.restoreRevision(kind, id, revisionId);
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
  }

  function restoreActions(revisionId: number) {
    return (
      <div className="edit-history-actions">
        {confirm === revisionId ? (
          <>
            <span>恢复后会生成一个新版本，确认恢复？</span>
            <button
              type="button"
              className="is-primary"
              disabled={busy}
              onClick={() => void restore(revisionId)}
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
            disabled={busy}
            onClick={() => {
              setNote("");
              setConfirm(revisionId);
            }}
          >
            恢复到这个版本
          </button>
        )}
      </div>
    );
  }
  return (
    <>
      {q.isPending && enabled && (
        <p className="edit-history-state" role="status">
          正在读取…
        </p>
      )}
      {q.isError && (
        <p className="edit-history-state">
          {errorMessage(q.error)}
          <button
            type="button"
            disabled={q.isFetching}
            onClick={() => void q.refetch()}
          >
            {q.isFetching ? "正在重试…" : "重试"}
          </button>
        </p>
      )}
      {q.data && !items.length && (
        <p className="edit-history-state">还没有修改记录。</p>
      )}
      {!!items.length && (
        <ol className={isShop ? "shop-revision-list" : "edit-history-list"}>
          {items.map((revision, index) => {
            const latest = page === 1 && index === 0;
            const key = revision.id ?? `unidentified-${index}`;
            const actions =
              canRestore &&
              !latest &&
              revision.id != null &&
              restoreActions(revision.id);
            if (isShop)
              return (
                <li key={key}>
                  <ShopRevision revision={revision} latest={latest}>
                    {actions}
                  </ShopRevision>
                </li>
              );
            return (
              <li key={key}>
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
                {actions}
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
            disabled={busy || page <= 1}
            onClick={() => {
              setConfirm(null);
              setPage((p) => p - 1);
            }}
          >
            较新
          </button>
          <span>第 {page} 页</span>
          <button
            type="button"
            disabled={busy || !q.data?.hasNext}
            onClick={() => {
              setConfirm(null);
              setPage((p) => p + 1);
            }}
          >
            更早
          </button>
        </nav>
      )}
    </>
  );
}
