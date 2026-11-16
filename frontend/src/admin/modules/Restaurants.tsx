import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAdminState } from "../../app/admin-state";
import { useApp } from "../../app/state";
import { restaurantEditBody, submissionPath } from "../../api/content-rules";
import { type Hub, type Restaurant } from "../../api/models";
import { useTask } from "../../components/useTask";
import {
  ShopTraitsFields,
  shopTraitsOf,
  type ShopTraits,
} from "../../features/ShopTraits";
import {
  Async,
  Confirm,
  Drawer,
  Field,
  Icon,
  Pager,
  Panel,
  Pill,
  Thumb,
  dateTime,
  num,
} from "../kit";
import { percent } from "./Overview";

export function Coordinates({
  lng,
  lat,
}: {
  lng?: number | null;
  lat?: number | null;
}) {
  return (
    <>
      <Field label="GCJ02 经度">
        <input
          name="lng"
          type="number"
          min="72.004"
          max="137.8347"
          step="any"
          defaultValue={lng ?? ""}
          required
        />
      </Field>
      <Field label="GCJ02 纬度">
        <input
          name="lat"
          type="number"
          min="0.8293"
          max="55.8271"
          step="any"
          defaultValue={lat ?? ""}
          required
        />
      </Field>
    </>
  );
}

export default function Restaurants() {
  const [params] = useSearchParams(),
    linked = params.get("keyword") ?? "";
  const { api } = useApp(),
    [page, setPage] = useAdminState("restaurants.page", 1),
    [keyword, setKeyword] = useAdminState(
      "restaurants.keyword:" + linked,
      linked,
    ),
    [edit, setEdit] = useState<Restaurant | null>(null),
    [remove, setRemove] = useState<Restaurant | null>(null);
  const q = useQuery({
      queryKey: ["admin", "restaurants", page, keyword],
      queryFn: () => api.adminRestaurants(page, keyword),
    }),
    removal = useTask("餐厅已删除", () => setRemove(null), [
      "admin",
      "restaurants",
    ]);
  return (
    <>
      <form
        className="ew-admin-toolbar"
        key={keyword}
        onSubmit={(e) => {
          e.preventDefault();
          setKeyword(
            String(new FormData(e.currentTarget).get("keyword") || "").trim(),
          );
          setPage(1);
        }}
      >
        <label className="ew-admin-search">
          <Icon name="search" size={17} />
          <input
            name="keyword"
            placeholder="搜索餐厅名称"
            aria-label="搜索餐厅"
            defaultValue={keyword}
          />
        </label>
        <button className="ew-admin-btn is-primary">查询</button>
        {keyword && (
          <button
            type="button"
            className="ew-admin-btn is-ghost"
            onClick={() => {
              setKeyword("");
              setPage(1);
            }}
          >
            清除
          </button>
        )}
      </form>
      <Panel flush>
        <Async
          query={q}
          rows={8}
          empty={!q.data?.items?.length}
          emptyTitle={keyword ? `没有名称包含「${keyword}」的餐厅` : "暂无餐厅"}
        >
          <div className="ew-admin-table-wrap">
            <table className="ew-admin-table">
              <thead>
                <tr>
                  <th>餐厅</th>
                  <th>地址</th>
                  <th>区域</th>
                  <th className="is-num">菜品</th>
                  <th className="is-num">推荐率</th>
                  <th>状态</th>
                  <th aria-label="操作" />
                </tr>
              </thead>
              <tbody>
                {q.data?.items?.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="ew-admin-cell-main">
                        <Thumb src={r.coverUrl} icon="store" />
                        <span>
                          <Link to={`/restaurants/${r.id}`}>{r.name}</Link>
                          <small>#{r.id}</small>
                        </span>
                      </div>
                    </td>
                    <td className="is-wrap">{r.address || "—"}</td>
                    <td>
                      {r.hubName ??
                        ((r as { hubId?: number | null }).hubId
                          ? `#${(r as { hubId?: number }).hubId}`
                          : "未关联")}
                    </td>
                    <td className="is-num">{num(r.visibleFoodCount)}</td>
                    <td className="is-num">
                      {r.ratingCount
                        ? `${percent(r.recommendationRate)} · ${r.ratingCount} 人`
                        : "—"}
                    </td>
                    <td>
                      <Pill tone={r.permanentlyClosed ? "bad" : "good"}>
                        {r.permanentlyClosed ? "已歇业" : "营业中"}
                      </Pill>
                    </td>
                    <td>
                      <div className="ew-admin-row-actions">
                        <button
                          className="ew-admin-icon-btn"
                          aria-label={`编辑 ${r.name}`}
                          title="编辑"
                          disabled={!r.id}
                          onClick={() => setEdit(r)}
                        >
                          <Icon name="edit" size={17} />
                        </button>
                        <button
                          className="ew-admin-icon-btn is-danger"
                          aria-label={`删除 ${r.name}`}
                          title="删除"
                          disabled={!r.id}
                          onClick={() => setRemove(r)}
                        >
                          <Icon name="delete" size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Async>
        <Pager
          page={page}
          total={q.data?.totalItems}
          totalPages={q.data?.totalPages}
          hasNext={q.data?.hasNext}
          onChange={setPage}
        />
      </Panel>
      {edit && (
        <RestaurantEditor restaurant={edit} onClose={() => setEdit(null)} />
      )}
      {remove && (
        <Confirm
          danger
          title={`删除「${remove.name}」？`}
          confirmLabel="删除餐厅"
          busy={removal.isPending}
          onClose={() => setRemove(null)}
          onConfirm={() => removal.run(() => api.deleteRestaurant(remove.id!))}
        >
          删除会影响公共餐厅目录。当前可见菜品 {num(remove.visibleFoodCount)}{" "}
          道，请先核实关联菜品；本操作不会级联删除菜品。
        </Confirm>
      )}
    </>
  );
}

function RestaurantEditor({
  restaurant: r,
  onClose,
}: {
  restaurant: Restaurant;
  onClose: () => void;
}) {
  const { api, toast } = useApp(),
    nav = useNavigate(),
    task = useTask(undefined, onClose, ["admin", "restaurants"]),
    [traits, setTraits] = useState(() =>
      shopTraitsOf(r as Restaurant & Partial<ShopTraits>),
    );
  return (
    <Drawer
      wide
      title="编辑餐厅"
      subtitle={`#${r.id} · ${r.hubName ?? "未关联区域"}`}
      onClose={onClose}
      onSubmit={(e) => {
        const d = new FormData(e.currentTarget);
        task.run(async () => {
          if (!traits.mealTimes.length)
            throw new Error("请至少选择一个营业饭点。");
          const result = await api.editRestaurant(r.id!, {
            ...restaurantEditBody(r, {
              name: String(d.get("name")).trim(),
              address: String(d.get("address")).trim(),
              gcjLng: Number(d.get("lng")),
              gcjLat: Number(d.get("lat")),
            }),
            ...traits,
          });
          toast(result?.revisionId ? "修改已提交审核。" : "餐厅资料已更新。", {
            tone: "success",
          });
          if (result?.revisionId) nav(submissionPath(result, "/admin"));
        });
      }}
      footer={
        <>
          <button type="button" className="ew-admin-btn" onClick={onClose}>
            取消
          </button>
          <button className="ew-admin-btn is-primary" disabled={task.isPending}>
            {task.isPending ? "保存中…" : "保存"}
          </button>
        </>
      }
    >
      <div className="ew-admin-form">
        <Field label="名称" wide>
          <input name="name" defaultValue={r.name || ""} required />
        </Field>
        <Field label="地址" wide>
          <input name="address" defaultValue={r.address || ""} required />
        </Field>
        <Coordinates
          lng={(r as { gcjLng?: number | null }).gcjLng}
          lat={(r as { gcjLat?: number | null }).gcjLat}
        />
      </div>
      <h3 className="ew-admin-subhead">营业信息</h3>
      <div className="ew-admin-traits">
        <ShopTraitsFields
          value={traits}
          onChange={setTraits}
          disabled={task.isPending}
        />
      </div>
    </Drawer>
  );
}

export function Hubs() {
  const { api, toast } = useApp(),
    [page, setPage] = useAdminState("hubs.page", 1),
    [edit, setEdit] = useState<Hub | true | null>(null),
    [action, setAction] = useState<{
      hub: Hub;
      kind: "delete" | "rebind";
    } | null>(null),
    q = useQuery({ queryKey: ["hubs", page], queryFn: () => api.hubs(page) }),
    task = useTask(undefined, () => setAction(null), ["hubs", "admin"]);
  return (
    <>
      <div className="ew-admin-toolbar">
        <span className="ew-admin-toolbar-note">
          区域决定餐厅归属与「附近」范围；修改边界后需单独重算餐厅归属。
        </span>
        <button className="ew-admin-btn is-primary" onClick={() => setEdit(true)}>
          <Icon name="add" size={16} />
          添加区域
        </button>
      </div>
      <Panel flush>
        <Async
          query={q}
          rows={5}
          empty={!q.data?.items?.length}
          emptyTitle="还没有区域"
          emptyHint="添加第一个区域后，餐厅可以按边界自动归属。"
        >
          <div className="ew-admin-table-wrap">
            <table className="ew-admin-table">
              <thead>
                <tr>
                  <th>区域</th>
                  <th>中心位置（GCJ02）</th>
                  <th>边界</th>
                  <th>最近更新</th>
                  <th aria-label="操作" />
                </tr>
              </thead>
              <tbody>
                {q.data?.items?.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <div className="ew-admin-cell-main">
                        <Thumb icon="district" />
                        <span>
                          <strong>{h.name}</strong>
                          <small>#{h.id}</small>
                        </span>
                      </div>
                    </td>
                    <td className="is-mono">
                      {h.gcjLng ?? "—"}, {h.gcjLat ?? "—"}
                    </td>
                    <td>
                      <Pill tone={h.boundary ? "good" : "neutral"}>
                        {h.boundary ? "已设置" : "未设置"}
                      </Pill>
                    </td>
                    <td className="is-muted">{dateTime(h.updatedAt)}</td>
                    <td>
                      <div className="ew-admin-row-actions">
                        <button
                          className="ew-admin-btn is-small"
                          onClick={() => setAction({ hub: h, kind: "rebind" })}
                        >
                          重算归属
                        </button>
                        <button
                          className="ew-admin-icon-btn"
                          aria-label={`编辑 ${h.name}`}
                          title="编辑"
                          onClick={() => setEdit(h)}
                        >
                          <Icon name="edit" size={17} />
                        </button>
                        <button
                          className="ew-admin-icon-btn is-danger"
                          aria-label={`删除 ${h.name}`}
                          title="删除"
                          onClick={() => setAction({ hub: h, kind: "delete" })}
                        >
                          <Icon name="delete" size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Async>
        <Pager
          page={page}
          total={q.data?.totalItems}
          totalPages={q.data?.totalPages}
          hasNext={q.data?.hasNext}
          onChange={setPage}
        />
      </Panel>
      {edit && (
        <HubEditor
          hub={edit === true ? undefined : edit}
          onClose={() => setEdit(null)}
        />
      )}
      {action && (
        <Confirm
          danger={action.kind === "delete"}
          busy={task.isPending}
          title={
            action.kind === "delete"
              ? `删除「${action.hub.name}」？`
              : `重算「${action.hub.name}」的餐厅归属？`
          }
          confirmLabel={action.kind === "delete" ? "删除区域" : "开始重算"}
          onClose={() => setAction(null)}
          onConfirm={() =>
            task.run(async () => {
              if (action.kind === "delete") {
                await api.deleteHub(action.hub.id!);
                toast("区域已删除", { tone: "success" });
              } else {
                const count = await api.rebindHub(action.hub.id!);
                toast(`已重算，影响 ${count} 家餐厅`, { tone: "success" });
              }
            })
          }
        >
          {action.kind === "delete"
            ? "请核实删除对餐厅查询与已有归属的影响。"
            : "会按区域边界重新绑定餐厅归属，请先确认边界准确。"}
        </Confirm>
      )}
    </>
  );
}

function HubEditor({ hub: h, onClose }: { hub?: Hub; onClose: () => void }) {
  const { api } = useApp(),
    task = useTask("区域已保存", onClose, ["hubs", "admin"]);
  return (
    <Drawer
      title={h ? "编辑区域" : "添加区域"}
      subtitle={h ? `#${h.id}` : "填写区域中心，边界可稍后补充"}
      onClose={onClose}
      onSubmit={(e) => {
        const d = new FormData(e.currentTarget);
        task.run(async () => {
          const boundary = String(d.get("boundary") || "").trim();
          if (boundary) {
            let parsed: { type?: string };
            try {
              parsed = JSON.parse(boundary);
            } catch {
              throw new Error("区域边界不是有效的 JSON。");
            }
            if (!["MultiPolygon", "Polygon", "Feature"].includes(parsed.type!))
              throw new Error("请填写有效的区域 GeoJSON。");
          }
          const body = {
            name: String(d.get("name")).trim(),
            gcjLng: Number(d.get("lng")),
            gcjLat: Number(d.get("lat")),
            boundaryGeoJson: boundary || undefined,
          };
          if (h?.id) await api.editHub(h.id, body);
          else await api.createHub(body);
        });
      }}
      footer={
        <>
          <button type="button" className="ew-admin-btn" onClick={onClose}>
            取消
          </button>
          <button className="ew-admin-btn is-primary" disabled={task.isPending}>
            {task.isPending ? "保存中…" : "保存区域"}
          </button>
        </>
      }
    >
      <div className="ew-admin-form">
        <Field label="区域名称" wide>
          <input name="name" defaultValue={h?.name || ""} required />
        </Field>
        <Coordinates lng={h?.gcjLng} lat={h?.gcjLat} />
        <Field
          label="区域边界 GeoJSON"
          hint="选填。留空不修改已有边界；保存后餐厅归属仍需单独重算。"
          wide
        >
          <textarea
            name="boundary"
            rows={8}
            className="is-mono"
            placeholder='{"type":"Polygon","coordinates":[…]}'
          />
        </Field>
      </div>
    </Drawer>
  );
}
