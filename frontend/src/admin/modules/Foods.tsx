import { Select } from "../../components/Select";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAdminState } from "../../app/admin-state";
import { useApp } from "../../app/state";
import { categories, money, type Food } from "../../api/models";
import { FoodEditor } from "./FoodEditor";
import { FoodOwnerTransfer } from "./FoodOwnerTransfer";
import { useTask } from "../../components/useTask";
import {
  Async,
  Confirm,
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
