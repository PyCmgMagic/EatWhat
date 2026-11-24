import { Select } from "../../components/Select";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAdminState } from "../../app/admin-state";
import { useApp } from "../../app/state";
import { foodEditBody } from "../../api/content-rules";
import {
  categories,
  money,
  type Food,
  type Schema,
} from "../../api/models";
import { FoodOwnerTransfer } from "./FoodOwnerTransfer";
import { useTask } from "../../components/useTask";
import {
  Async,
  Confirm,
  Drawer,
  Field,
  Icon,
  Pager,
  Panel,
  Thumb,
  ago,
  num,
} from "../kit";

type Filters = {
  restaurantId?: number;
  keyword?: string;
  category?: string;
  sort?: string;
};
const sorts = [
  ["NEWEST", "最新分享"],
  ["POPULAR", "最多点赞"],
  ["PRICE_ASC", "价格从低到高"],
  ["PRICE_DESC", "价格从高到低"],
];

export default function Foods() {
  const { api } = useApp(),
    [filters, setFilters] = useAdminState<Filters>("foods.filters", {}),
    [page, setPage] = useAdminState("foods.page", 1),
    [edit, setEdit] = useState<Food | null>(null),
    [transfer, setTransfer] = useState<Food | null>(null),
    [remove, setRemove] = useState<Food | null>(null),
    q = useQuery({
      queryKey: ["foods", "admin", filters, page],
      queryFn: () =>
        api.adminFoods(filters.restaurantId, page, {
          keyword: filters.keyword,
          category: filters.category,
          sort: filters.sort,
        }),
    }),
    removal = useTask("菜品已删除", () => setRemove(null), ["foods", "admin"]);
  const filtered = !!(
    filters.keyword ||
    filters.category ||
    filters.restaurantId
  );
  return (
    <>
      <form
        className="ew-admin-toolbar"
        key={JSON.stringify(filters)}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setFilters({
            restaurantId: data.get("id") ? Number(data.get("id")) : undefined,
            keyword: String(data.get("keyword") || "").trim() || undefined,
            category: String(data.get("category") || "") || undefined,
            sort: String(data.get("sort") || "NEWEST"),
          });
          setPage(1);
        }}
      >
        <label className="ew-admin-search">
          <Icon name="search" size={17} />
          <input
            name="keyword"
            aria-label="菜品关键词"
            defaultValue={filters.keyword}
            placeholder="搜索菜名"
          />
        </label>
        <Select inline motionDuration={200} closeDuration={100}
          name="category"
          aria-label="菜品分类"
          defaultValue={filters.category ?? ""}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.id ? category.label : "全部分类"}
            </option>
          ))}
        </Select>
        <Select inline motionDuration={200} closeDuration={100}
          name="sort"
          aria-label="排序"
          defaultValue={filters.sort ?? "NEWEST"}
        >
          {sorts.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
        <input
          name="id"
          className="is-narrow"
          type="number"
          min="1"
          step="1"
          placeholder="餐厅编号"
          aria-label="餐厅编号"
          defaultValue={filters.restaurantId}
        />
        <button className="ew-admin-btn is-primary">查询</button>
        {filtered && (
          <button
            type="button"
            className="ew-admin-btn is-ghost"
            onClick={() => {
              setFilters({});
              setPage(1);
            }}
          >
            清除筛选
          </button>
        )}
      </form>
      <Panel flush>
        <Async
          query={q}
          rows={8}
          empty={!q.data?.items?.length}
          emptyTitle="当前条件下没有菜品"
          emptyHint={filtered ? "换个关键词或清除筛选试试。" : undefined}
        >
          <div className="ew-admin-table-wrap">
            <table className="ew-admin-table">
              <thead>
                <tr>
                  <th>菜品</th>
                  <th>餐厅</th>
                  <th>分类</th>
                  <th className="is-num">价格</th>
                  <th className="is-num">点赞</th>
                  <th>首次分享者</th>
                  <th>发布</th>
                  <th aria-label="操作" />
                </tr>
              </thead>
              <tbody>
                {q.data?.items?.map((food) => (
                  <tr key={food.id}>
                    <td>
                      <div className="ew-admin-cell-main">
                        <Thumb src={food.pictureUrl?.[0]} />
                        <span>
                          <Link to={`/foods/${food.id}`}>{food.name}</Link>
                          <small>#{food.id}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      {food.restaurantName ? (
                        <Link to={`/restaurants/${food.restaurantId}`}>
                          {food.restaurantName}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{food.categoryLabel || "—"}</td>
                    <td className="is-num">{money(food.price)}</td>
                    <td className="is-num">{num(food.likesCount)}</td>
                    <td>{food.uploaderName?.trim() || "—"}</td>
                    <td className="is-muted">{ago(food.createdAt)}</td>
                    <td>
                      <div className="ew-admin-row-actions">
                        <button
                          className="ew-admin-icon-btn"
                          aria-label={`编辑 ${food.name}`}
                          title="编辑"
                          onClick={() => setEdit(food)}
                        >
                          <Icon name="edit" size={17} />
                        </button>
                        <button
                          className="ew-admin-icon-btn"
                          aria-label={`转移 ${food.name} 的归属`}
                          title="转移归属"
                          onClick={() => setTransfer(food)}
                        >
                          <Icon name="follow" size={17} />
                        </button>
                        <button
                          className="ew-admin-icon-btn is-danger"
                          aria-label={`删除 ${food.name}`}
                          title="删除"
                          onClick={() => setRemove(food)}
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
      {edit && <FoodEditor food={edit} onClose={() => setEdit(null)} />}
      {transfer && (
        <FoodOwnerTransfer food={transfer} onClose={() => setTransfer(null)} />
      )}
      {remove && (
        <Confirm
          danger
          title={`删除「${remove.name}」？`}
          confirmLabel="删除菜品"
          askReason="删除原因（选填，会通知分享者）"
          busy={removal.isPending}
          onClose={() => setRemove(null)}
          onConfirm={(reason) =>
            removal.run(() => api.deleteFood(remove.id!, reason))
          }
        >
          删除后公共内容、收藏和浏览记录中都不再显示这道菜，无法在后台恢复。
        </Confirm>
      )}
    </>
  );
}

function FoodEditor({ food, onClose }: { food: Food; onClose: () => void }) {
  const { api, toast } = useApp(),
    task = useTask(undefined, onClose, ["foods", "admin"]);
  return (
    <Drawer
      title="编辑菜品"
      subtitle={`#${food.id} · ${food.restaurantName || "未关联餐厅"}`}
      onClose={onClose}
      onSubmit={(e) => {
        const d = new FormData(e.currentTarget);
        task.run(async () => {
          const result = await api.editFood(
            food.id!,
            foodEditBody(food, {
              name: String(d.get("name")).trim(),
              description: String(d.get("description") || ""),
              price: d.get("price") === "" ? undefined : Number(d.get("price")),
              category: String(
                d.get("category"),
              ) as Schema["EditFoodDTORequest"]["category"],
            }),
          );
          toast(result?.moderationStatus === "PENDING" ? "修改已提交审核。" : "菜品资料已更新。", {
            tone: "success",
          });
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
      {!!food.pictureUrl?.length && (
        <div className="ew-admin-gallery">
          {food.pictureUrl.slice(0, 4).map((src) => (
            <Thumb key={src} src={src} />
          ))}
        </div>
      )}
      <div className="ew-admin-form">
        <Field label="菜品名称" wide>
          <input name="name" defaultValue={food.name || ""} required />
        </Field>
        <Field label="价格（元）">
          <input
            name="price"
            type="number"
            min="0"
            step="any"
            defaultValue={food.price ?? ""}
          />
        </Field>
        <Field label="基础分类">
          <Select inline motionDuration={200} closeDuration={100} name="category" defaultValue={food.category || "other"}>
            {categories
              .filter((c) => c.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="描述" wide>
          <textarea
            name="description"
            rows={5}
            defaultValue={food.description || ""}
          />
        </Field>
      </div>
    </Drawer>
  );
}
