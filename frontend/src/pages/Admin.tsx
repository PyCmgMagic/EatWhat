import { Select } from "../components/Select";
import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAdminState } from "../app/admin-state";
import {
  foodEditBody,
  restaurantEditBody,
  submissionPath,
} from "../api/content-rules";
import { useApp } from "../app/state";
import type { Api } from "../api/service";
import {
  categories,
  money,
  type Food,
  type Hub,
  type Restaurant,
  type Schema,
} from "../api/models";
import { ErrorState, Icon, Loading, Modal, Pagination } from "../components/ui";
import {
  ShopTraitsFields,
  shopTraitsOf,
  type ShopTraits,
} from "../features/ShopTraits";
import { useTask } from "../components/useTask";
const AccountReviews = lazy(() =>
  import("./AdminApiV2").then((m) => ({ default: m.AccountReviews })),
);
const AdminPasswordReset = lazy(() =>
  import("./AdminApiV2").then((m) => ({ default: m.AdminPasswordReset })),
);
export type AdminTab =
  "summary" | "restaurants" | "foods" | "tags" | "users" | "hubs" | "security";
export default function AdminContent({ tab = "summary" }: { tab?: AdminTab }) {
  return tab === "summary" ? (
    <Summary />
  ) : tab === "restaurants" ? (
    <AdminRestaurants />
  ) : tab === "foods" ? (
    <AdminFoods />
  ) : tab === "tags" ? (
    <AdminTags />
  ) : tab === "users" ? (
    <AdminUsers />
  ) : tab === "security" ? (
    <Suspense fallback={<Loading />}>
      <AccountReviews />
    </Suspense>
  ) : (
    <AdminHubs />
  );
}

function Summary() {
  const { api } = useApp(),
    q = useQuery({
      queryKey: ["admin", "summary"],
      queryFn: () => api.summary(),
    });
  if (q.isPending) return <Loading />;
  if (q.isError)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const s = q.data;
  return (
    <>
      <div className="admin-stats">
        {[
          {
            label: "校园食友",
            total: s.totalUsers,
            today: s.todayUsers,
            icon: "users",
          },
          {
            label: "菜品分享",
            total: s.totalFoods,
            today: s.todayFoods,
            icon: "bowl",
          },
          {
            label: "餐厅与窗口",
            total: s.totalRestaurants,
            today: s.todayRestaurants,
            icon: "store",
          },
        ].map((i) => (
          <article key={i.label}>
            <Icon name={i.icon} />
            <p>{i.label}</p>
            <strong>{i.total ?? "—"}</strong>
            <small>今日新增 {i.today ?? "—"}</small>
          </article>
        ))}
      </div>
      <div className="admin-summary-ratio">
        <span>认证比例</span>
        <strong>{s.verifiedRate ?? "—"}</strong>
        <span
          role="note"
          tabIndex={0}
          title="接口尚未明确比例单位，当前按原值展示。"
          aria-label="接口尚未明确比例单位，当前按原值展示。"
        >
          i
        </span>
      </div>
    </>
  );
}
function DeleteDialog({
  title,
  description,
  run,
  onClose,
}: {
  title: string;
  description: string;
  run: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { toast } = useApp();
  const task = useTask(undefined, onClose, [
    "admin",
    "restaurants",
    "foods",
    "hubs",
    "system-tags",
  ]);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="modal-description">{description}</p>
      {task.error && <ErrorState error={task.error} />}
      <div className="modal-actions">
        <button
          className="btn btn-secondary"
          disabled={task.isPending}
          onClick={onClose}
        >
          取消
        </button>
        <button
          className="btn btn-primary"
          disabled={task.isPending}
          onClick={() =>
            task.run(async () => {
              const result = await run();
              toast(
                typeof result === "number"
                  ? `已重算，影响 ${result} 家餐厅`
                  : "操作已完成",
              );
            })
          }
        >
          确认操作
        </button>
      </div>
    </Modal>
  );
}
function AdminRestaurants() {
  const [params] = useSearchParams();
  const { api } = useApp(),
    [page, setPage] = useAdminState("restaurants.page", 1),
    [keyword, setKeyword] = useAdminState(
      "restaurants.keyword:" + (params.get("keyword") ?? ""),
      params.get("keyword") ?? "",
    ),
    [edit, setEdit] = useState<Restaurant | null>(null),
    [del, setDel] = useState<Restaurant | null>(null);
  const q = useQuery({
    queryKey: ["admin", "restaurants", page, keyword],
    queryFn: () => api.adminRestaurants(page, keyword),
  });
  return (
    <>
      <form
        className="inline-form admin-search"
        onSubmit={(e) => {
          e.preventDefault();
          setKeyword(
            String(new FormData(e.currentTarget).get("keyword") || ""),
          );
          setPage(1);
        }}
      >
        <input
          className="field"
          name="keyword"
          placeholder="查找餐厅名称"
          aria-label="管理员查找餐厅"
          defaultValue={keyword}
        />
        <button className="btn btn-primary">查找</button>
      </form>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>餐厅</th>
                <th>地址</th>
                <th>区域</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items?.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.name}
                    <small className="cell-secondary">#{r.id}</small>
                  </td>
                  <td>{r.address || "—"}</td>
                  <td>{r.hubId ?? "未关联"}</td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => setEdit(r)} disabled={!r.id}>
                        编辑
                      </button>
                      <button onClick={() => setDel(r)} disabled={!r.id}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!q.data.items?.length && <p className="table-empty">暂无餐厅</p>}
        </div>
      )}
      <Pagination
        page={page}
        hasNext={q.data?.hasNext}
        totalPages={q.data?.totalPages}
        onPage={setPage}
      />
      {edit && (
        <Modal title="维护餐厅资料" onClose={() => setEdit(null)}>
          <RestaurantEditor restaurant={edit} onClose={() => setEdit(null)} />
        </Modal>
      )}
      {del && (
        <DeleteDialog
          title={`删除「${del.name}」？`}
          description="删除会影响公共餐厅目录。请先核实关联菜品与实际维护规则；本操作不会在前端擅自级联删除菜品。"
          run={() => api.deleteRestaurant(del.id!)}
          onClose={() => setDel(null)}
        />
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
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
          toast(result?.revisionId ? "修改已提交审核。" : "餐厅资料已更新。");
          if (result?.revisionId) nav(submissionPath(result, "/admin"));
        });
      }}
    >
      <label className="form-label" htmlFor="admin-store-name">
        名称
      </label>
      <input
        id="admin-store-name"
        className="field"
        name="name"
        defaultValue={r.name || ""}
        required
      />
      <label className="form-label" htmlFor="admin-store-address">
        地址
      </label>
      <input
        id="admin-store-address"
        className="field"
        name="address"
        defaultValue={r.address || ""}
        required
      />
      <Coordinates lng={r.gcjLng} lat={r.gcjLat} />
      <ShopTraitsFields
        value={traits}
        onChange={setTraits}
        disabled={task.isPending}
      />
      {task.error && <ErrorState error={task.error} />}
      <button className="btn btn-primary" disabled={task.isPending}>
        保存餐厅资料
      </button>
    </form>
  );
}
function AdminFoods() {
  const { api } = useApp(),
    [filters, setFilters] = useAdminState<{
      restaurantId?: number;
      keyword?: string;
      category?: string;
      sort?: string;
    }>("foods.filters", {}),
    [page, setPage] = useAdminState("foods.page", 1),
    [edit, setEdit] = useState<Food | null>(null),
    [del, setDel] = useState<Food | null>(null),
    q = useQuery({
      queryKey: ["foods", "admin", filters, page],
      queryFn: () =>
        api.foods(filters.restaurantId, page, {
          keyword: filters.keyword,
          category: filters.category,
          sort: filters.sort,
        }),
    });
  return (
    <>
      <form
        className="inline-form admin-search"
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
        <input
          name="keyword"
          className="field"
          aria-label="菜品关键词"
          defaultValue={filters.keyword}
          placeholder="搜索菜名"
        />
        <input
          name="id"
          className="field"
          type="number"
          min="1"
          step="1"
          placeholder="餐厅编号（选填）"
          aria-label="餐厅编号"
          defaultValue={filters.restaurantId}
        />
        <Select
          name="category"
          className="field"
          aria-label="管理菜品分类"
          defaultValue={filters.category}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </Select>
        <Select
          name="sort"
          className="field"
          aria-label="管理菜品排序"
          defaultValue={filters.sort}
        >
          <option value="NEWEST">最新分享</option>
          <option value="POPULAR">最多点赞</option>
          <option value="PRICE_ASC">价格从低到高</option>
          <option value="PRICE_DESC">价格从高到低</option>
        </Select>
        <button className="btn btn-primary">查询菜品</button>
      </form>
      <p className="section-caption">
        默认查看全站菜品；可按名称、分类或餐厅筛选。内容编辑和删除仅限管理员。
      </p>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>菜品</th>
                <th>餐厅</th>
                <th>编号</th>
                <th>价格</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items?.map((food) => (
                <tr key={food.id}>
                  <td>{food.name}</td>
                  <td>{food.restaurantName || "—"}</td>
                  <td>{food.id}</td>
                  <td>{money(food.price)}</td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => setEdit(food)}>编辑</button>
                      <button onClick={() => setDel(food)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!q.data.items?.length && (
            <p className="table-empty">当前条件下没有菜品</p>
          )}
        </div>
      )}
      <Pagination
        page={page}
        hasNext={q.data?.hasNext}
        totalPages={q.data?.totalPages}
        onPage={setPage}
      />
      {edit && (
        <Modal title="维护菜品资料" onClose={() => setEdit(null)}>
          <FoodEditor food={edit} onClose={() => setEdit(null)} />
        </Modal>
      )}
      {del && (
        <DeleteDialog
          title={`删除「${del.name}」？`}
          description="删除会影响公共内容、收藏和浏览记录，请确认该条目确实需要删除。"
          run={() => api.deleteFood(del.id!)}
          onClose={() => setDel(null)}
        />
      )}
    </>
  );
}
function FoodEditor({ food: f, onClose }: { food: Food; onClose: () => void }) {
  const { api, toast } = useApp(),
    nav = useNavigate(),
    task = useTask(undefined, onClose, ["foods", "admin"]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        task.run(async () => {
          const result = await api.editFood(
            f.id!,
            foodEditBody(f, {
              name: String(d.get("name")).trim(),
              description: String(d.get("description") || ""),
              price: d.get("price") === "" ? undefined : Number(d.get("price")),
              category: String(
                d.get("category"),
              ) as Schema["EditFoodDTORequest"]["category"],
            }),
          );
          toast(result?.revisionId ? "修改已提交审核。" : "菜品资料已更新。");
          if (result?.revisionId) nav(submissionPath(result, "/admin"));
        });
      }}
    >
      <label className="form-label" htmlFor="admin-food-name">
        菜品名称
      </label>
      <input
        className="field"
        id="admin-food-name"
        name="name"
        defaultValue={f.name || ""}
        required
      />
      <div className="form-two-cols">
        <div>
          <label className="form-label" htmlFor="admin-food-price">
            价格（元）
          </label>
          <input
            className="field"
            id="admin-food-price"
            name="price"
            type="number"
            min="0"
            step="any"
            defaultValue={f.price ?? ""}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="admin-food-category">
            基础分类
          </label>
          <Select
            id="admin-food-category"
            className="field"
            name="category"
            defaultValue={f.category || "other"}
          >
            {categories
              .filter((c) => c.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </Select>
        </div>
      </div>
      <label className="form-label" htmlFor="admin-food-description">
        描述
      </label>
      <textarea
        className="field"
        id="admin-food-description"
        name="description"
        defaultValue={f.description || ""}
      />
      {task.error && <ErrorState error={task.error} />}
      <button className="btn btn-primary" disabled={task.isPending}>
        保存菜品资料
      </button>
    </form>
  );
}
function AdminTags() {
  const { api } = useApp(),
    [page, setPage] = useAdminState("tags.page", 1),
    [edit, setEdit] = useState<Schema["AdminFoodTagVOResponse"] | null>(null),
    [del, setDel] = useState<Schema["AdminFoodTagVOResponse"] | null>(null),
    q = useQuery({
      queryKey: ["admin", "tags", page],
      queryFn: () => api.adminTags(page),
    });
  const task = useTask("公共标签已添加", undefined, ["admin", "system-tags"]);
  return (
    <>
      <form
        className="inline-form admin-search"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            name = String(new FormData(form).get("name") || "").trim();
          if (name)
            task.run(async () => {
              await api.createSystemTag(name);
              form.reset();
            });
        }}
      >
        <input
          name="name"
          className="field"
          placeholder="新增公共口味标签"
          aria-label="新增公共标签名称"
          maxLength={64}
          required
        />
        <button className="btn btn-primary" disabled={task.isPending}>
          添加标签
        </button>
      </form>
      {task.error && <ErrorState error={task.error} />}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>标签名称</th>
                <th>使用数量</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items?.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.usageCount ?? "—"}</td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => setEdit(t)}>改名</button>
                      <button onClick={() => setDel(t)}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page}
        hasNext={q.data?.hasNext}
        totalPages={q.data?.totalPages}
        onPage={setPage}
      />
      {edit && (
        <Modal title="修改公共标签名称" onClose={() => setEdit(null)}>
          <NameEditor
            name={edit.name || ""}
            run={(name) => api.editSystemTag(edit.id!, name)}
            onClose={() => setEdit(null)}
          />
        </Modal>
      )}
      {del && (
        <DeleteDialog
          title={`删除公共标签「${del.name}」？`}
          description={`此标签的使用数量为 ${del.usageCount ?? "未知"}。删除会影响公共分类及关联标记，请核实后操作。`}
          run={() => api.deleteSystemTag(del.id!)}
          onClose={() => setDel(null)}
        />
      )}
    </>
  );
}
function NameEditor({
  name,
  run,
  onClose,
}: {
  name: string;
  run: (name: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const task = useTask("名称已更新", onClose, [
    "admin",
    "foods",
    "system-tags",
  ]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const name = String(
          new FormData(e.currentTarget).get("name") || "",
        ).trim();
        if (name) task.run(() => run(name));
      }}
    >
      <label className="form-label" htmlFor="edit-name">
        名称
      </label>
      <input
        id="edit-name"
        name="name"
        className="field"
        defaultValue={name}
        maxLength={64}
        required
      />
      {task.error && <ErrorState error={task.error} />}
      <button className="btn btn-primary" disabled={task.isPending}>
        保存名称
      </button>
    </form>
  );
}
function AdminUsers() {
  const { api } = useApp(),
    [page, setPage] = useAdminState("users.page", 1),
    [reset, setReset] = useState<Schema["UserListItemVOResponse"] | null>(null),
    [edit, setEdit] = useState<Schema["UserListItemVOResponse"] | null>(null),
    q = useQuery({
      queryKey: ["admin", "users", page],
      queryFn: () => api.adminUsers(page),
    });
  return (
    <>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>用户</th>
                <th>角色</th>
                <th>认证</th>
                <th>账号状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items?.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.displayName || "校园食友"}
                    <small className="cell-secondary">
                      登录名：{u.userName || "未设置"}
                    </small>
                    <small className="cell-secondary">#{u.id}</small>
                  </td>
                  <td>{u.role || "—"}</td>
                  <td>{u.verified ? "已认证" : "未认证"}</td>
                  <td>{u.accountStatus?.accountStatus || "待确认"}</td>
                  <td>
                    <button className="text-link" onClick={() => setEdit(u)}>
                      管理状态
                    </button>
                    <button
                      className="text-link"
                      onClick={() => setReset(u)}
                      disabled={!u.id}
                    >
                      重置密码冲突
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page}
        hasNext={q.data?.hasNext}
        totalPages={q.data?.totalPages}
        onPage={setPage}
      />
      {reset?.id && (
        <Modal title="重置账号密码冲突" onClose={() => setReset(null)}>
          <Suspense fallback={<Loading />}>
            <AdminPasswordReset
              userId={reset.id}
              displayName={reset.displayName || reset.userName || "校园食友"}
              onDone={() => setReset(null)}
            />
          </Suspense>
        </Modal>
      )}
      {edit && (
        <Modal
          title={`管理「${edit.displayName || edit.userName}」的账号状态`}
          onClose={() => setEdit(null)}
        >
          <BanEditor user={edit} onClose={() => setEdit(null)} />
        </Modal>
      )}
    </>
  );
}
function BanEditor({
  user: u,
  onClose,
}: {
  user: Schema["UserListItemVOResponse"];
  onClose: () => void;
}) {
  const { api } = useApp(),
    task = useTask("账号状态已更新", onClose, ["admin"]);
  return (
    <>
      <p className="modal-description">
        当前状态：{u.accountStatus?.accountStatus || "待确认"}
        。可设置截止时间，留空代表永久封禁。
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const reason = String(
            new FormData(e.currentTarget).get("reason") || "",
          ).trim();
          const until = String(
            new FormData(e.currentTarget).get("until") || "",
          );
          if (reason)
            task.run(() =>
              api.ban(
                u.id!,
                reason,
                until ? new Date(until).toISOString() : undefined,
              ),
            );
        }}
      >
        <label className="form-label" htmlFor="ban-reason">
          封禁原因
        </label>
        <textarea
          className="field"
          name="reason"
          id="ban-reason"
          minLength={1}
          maxLength={255}
          required
        />
        <label className="form-label">
          封禁截止时间（可选）
          <input
            className="field"
            name="until"
            type="datetime-local"
            min={new Date().toISOString().slice(0, 16)}
          />
        </label>
        <button className="btn btn-primary" disabled={task.isPending || !u.id}>
          确认封禁
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={task.isPending || !u.id}
          onClick={() => task.run(() => api.unban(u.id!))}
        >
          解除封禁
        </button>
      </form>
      {task.error && <ErrorState error={task.error} />}
    </>
  );
}
function AdminHubs() {
  const { api } = useApp(),
    [page, setPage] = useAdminState("hubs.page", 1),
    [edit, setEdit] = useState<Hub | true | null>(null),
    [action, setAction] = useState<{
      hub: Hub;
      kind: "delete" | "rebind";
    } | null>(null),
    q = useQuery({ queryKey: ["hubs", page], queryFn: () => api.hubs(page) });
  return (
    <>
      <div className="section-title">
        <h2>区域目录</h2>
        <button className="btn btn-primary" onClick={() => setEdit(true)}>
          <Icon name="plus" />
          添加区域
        </button>
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>区域名称</th>
                <th>中心位置（GCJ02）</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items?.map((h) => (
                <tr key={h.id}>
                  <td>{h.name}</td>
                  <td>
                    {h.gcjLng ?? "—"}, {h.gcjLat ?? "—"}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => setEdit(h)}>编辑</button>
                      <button
                        onClick={() => setAction({ hub: h, kind: "rebind" })}
                      >
                        重算餐厅归属
                      </button>
                      <button
                        onClick={() => setAction({ hub: h, kind: "delete" })}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={page}
        hasNext={q.data?.hasNext}
        totalPages={q.data?.totalPages}
        onPage={setPage}
      />
      {edit && (
        <Modal
          title={edit === true ? "添加一个区域" : "维护区域中心与边界"}
          onClose={() => setEdit(null)}
        >
          <HubEditor
            hub={edit === true ? undefined : edit}
            onClose={() => setEdit(null)}
          />
        </Modal>
      )}
      {action && (
        <DeleteDialog
          title={
            action.kind === "delete"
              ? `删除「${action.hub.name}」？`
              : `重算「${action.hub.name}」内的餐厅归属？`
          }
          description={
            action.kind === "delete"
              ? "请核实区域删除对餐厅查询与已有归属的影响。"
              : "此操作会按区域边界重新绑定餐厅归属，请先确认边界准确。"
          }
          run={async () => {
            if (action.kind === "delete") await api.deleteHub(action.hub.id!);
            else {
              const count = await api.rebindHub(action.hub.id!);
              setAction(null);
              return count;
            }
          }}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
function Coordinates({
  lng,
  lat,
}: {
  lng?: number | null;
  lat?: number | null;
}) {
  return (
    <div className="form-two-cols">
      <div>
        <label className="form-label" htmlFor="coord-lng">
          GCJ02 经度
        </label>
        <input
          id="coord-lng"
          name="lng"
          className="field"
          type="number"
          min="72.004"
          max="137.8347"
          step="any"
          defaultValue={lng ?? ""}
          required
        />
      </div>
      <div>
        <label className="form-label" htmlFor="coord-lat">
          GCJ02 纬度
        </label>
        <input
          id="coord-lat"
          name="lat"
          className="field"
          type="number"
          min="0.8293"
          max="55.8271"
          step="any"
          defaultValue={lat ?? ""}
          required
        />
      </div>
    </div>
  );
}
function HubEditor({ hub: h, onClose }: { hub?: Hub; onClose: () => void }) {
  const { api } = useApp(),
    task = useTask("区域已保存", onClose, ["hubs", "admin"]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = new FormData(e.currentTarget);
        task.run(async () => {
          const boundary = String(d.get("boundary") || "").trim();
          if (boundary) {
            const parsed = JSON.parse(boundary);
            if (!["MultiPolygon", "Polygon", "Feature"].includes(parsed.type))
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
    >
      <label className="form-label" htmlFor="hub-name">
        区域名称
      </label>
      <input
        className="field"
        id="hub-name"
        name="name"
        defaultValue={h?.name || ""}
        required
      />
      <Coordinates lng={h?.gcjLng} lat={h?.gcjLat} />
      <label className="form-label" htmlFor="hub-boundary">
        区域边界 GeoJSON <span className="optional">选填，留空不修改边界</span>
      </label>
      <textarea
        className="field"
        name="boundary"
        id="hub-boundary"
        placeholder="填写已核实的区域边界数据"
      />
      <p className="section-caption">
        已有边界保留；编辑成功后，餐厅归属重算仍需单独确认。
      </p>
      {task.error && <ErrorState error={task.error} />}
      <button className="btn btn-primary" disabled={task.isPending}>
        保存区域
      </button>
    </form>
  );
}
