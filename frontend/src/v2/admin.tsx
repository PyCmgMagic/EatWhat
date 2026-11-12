import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, useParams } from "react-router-dom";
import type { V2Schema } from "../api/backend-v2";
import { mapPoint } from "../features/map-geometry";
import { useV2 } from "./state";
import { useCampuses } from "./discover";
import {
  dateTime,
  Form,
  Notice,
  PageControls,
  QueryState,
  Require,
  useAction,
  value,
} from "./ui";

const pages = {
  "": "概览",
  users: "用户",
  restaurants: "店铺",
  hubs: "商圈",
  policies: "政策",
};

export function Admin() {
  const { module = "", id } = useParams();
  const [menu, setMenu] = useState(false);
  const policyId = id && /^[1-9]\d*$/.test(id) ? Number(id) : undefined;
  return (
    <Require admin>
      <div className="v2-admin">
        <button
          className="v2-admin-menu"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          管理菜单
        </button>
        <nav
          className={menu ? "v2-admin-nav is-open" : "v2-admin-nav"}
          aria-label="管理后台"
        >
          <Link to="/" className="v2-admin-back">
            返回前台
          </Link>
          {Object.entries(pages).map(([key, title]) => (
            <NavLink
              key={key}
              end={!key}
              to={key ? "/admin/" + key : "/admin"}
              onClick={() => setMenu(false)}
            >
              {title}
            </NavLink>
          ))}
        </nav>
        <div className="v2-admin-content">
          {module === "" ? (
            <Summary />
          ) : module === "users" ? (
            <Users />
          ) : module === "restaurants" ? (
            <Restaurants />
          ) : module === "hubs" ? (
            <Hubs />
          ) : module === "policies" && policyId ? (
            <PolicyDetail id={policyId} />
          ) : module === "policies" ? (
            <Policies />
          ) : (
            <section className="v2-panel">
              <h1>该管理功能暂未开放</h1>
              <Link to="/admin">返回概览</Link>
            </section>
          )}
        </div>
      </div>
    </Require>
  );
}

function Summary() {
  const { call } = useV2();
  const query = useQuery({
    queryKey: ["v2", "admin-summary"],
    queryFn: ({ signal }) => call("summary", { signal }),
  });
  const data = query.data;
  return (
    <section className="v2-panel">
      <h1>数据概览</h1>
      <QueryState query={query}>
        <dl className="v2-summary">
          <div>
            <dt>用户总数</dt>
            <dd>{data?.totalUsers ?? 0}</dd>
          </div>
          <div>
            <dt>今日新增</dt>
            <dd>{data?.todayUsers ?? 0}</dd>
          </div>
          <div>
            <dt>已认证</dt>
            <dd>{data?.verifiedUsers ?? 0}</dd>
          </div>
          <div>
            <dt>认证率</dt>
            <dd>{Math.round((data?.verifiedRate ?? 0) * 1000) / 10}%</dd>
          </div>
        </dl>
      </QueryState>
    </section>
  );
}

function AdminSearch({ onSearch }: { onSearch: (keyword: string) => void }) {
  return (
    <form
      className="v2-actions"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(value(new FormData(event.currentTarget), "keyword"));
      }}
    >
      <label>
        关键词
        <input name="keyword" type="search" />
      </label>
      <button>搜索</button>
    </form>
  );
}

function Users() {
  const { call, user } = useV2();
  const cache = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [resetUser, setResetUser] = useState<V2Schema["UserListItem"]>();
  const task = useAction();
  const query = useQuery({
    queryKey: ["v2", "admin-users", keyword, page],
    queryFn: ({ signal }) =>
      call("users", { query: { keyword, page, pageSize: 20 }, signal }),
  });
  return (
    <section className="v2-panel">
      <h1>用户管理</h1>
      <AdminSearch
        onSearch={(keyword) => {
          setKeyword(keyword);
          setPage(1);
        }}
      />
      {resetUser && (
        <div className="v2-admin-editor">
          <h2>给 {resetUser.displayName} 设置临时密码</h2>
          <p>重置后，该用户的所有设备都会退出登录。</p>
          <Form
            label="设置临时密码"
            submit={async (data, signal) => {
              const password = String(data.get("password") ?? "");
              if (new TextEncoder().encode(password).length > 72)
                throw new Error("密码不能超过 72 字节。");
              await call("adminResetPassword", {
                path: { userId: resetUser.id! },
                body: { password },
                signal,
              });
              setResetUser(undefined);
            }}
          >
            <label>
              临时密码
              <input
                required
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={64}
              />
            </label>
            <button type="button" onClick={() => setResetUser(undefined)}>
              取消
            </button>
          </Form>
        </div>
      )}
      <QueryState query={query} empty={!query.data?.items?.length}>
        <ul className="v2-list">
          {query.data?.items?.map((target) => (
            <li key={target.id}>
              <div>
                <strong>{target.displayName || target.userName}</strong>
                <p>{target.phone ?? target.email}</p>
                <span>
                  {target.role === "admin"
                    ? "管理员"
                    : target.verified
                      ? "已认证"
                      : "未认证"}
                  {target.banned ? " · 已封禁" : ""}
                </span>
              </div>
              {target.id &&
                target.role !== "admin" &&
                target.id !== user?.id && (
                  <div className="v2-actions">
                    <button
                      disabled={task.busy}
                      onClick={() => {
                        if (
                          !target.banned &&
                          !confirm(
                            "封禁后该用户将退出登录，直到管理员解封。继续？",
                          )
                        )
                          return;
                        void task.run(
                          async (signal) => {
                            await call(target.banned ? "unban" : "ban", {
                              path: { userId: target.id! },
                              signal,
                            });
                            await Promise.all([
                              query.refetch(),
                              cache.invalidateQueries({
                                queryKey: ["v2", "admin-summary"],
                              }),
                            ]);
                          },
                          target.banned ? "已解封。" : "已封禁。",
                        );
                      }}
                    >
                      {target.banned ? "解封" : "封禁"}
                    </button>
                    {!target.banned && (
                      <button onClick={() => setResetUser(target)}>
                        重置密码
                      </button>
                    )}
                  </div>
                )}
            </li>
          ))}
        </ul>
      </QueryState>
      <PageControls
        page={page}
        hasNext={query.data?.hasNext}
        change={setPage}
      />
      <Notice {...task} />
    </section>
  );
}

function Restaurants() {
  const { call } = useV2();
  const cache = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const task = useAction();
  const query = useQuery({
    queryKey: ["v2", "admin-restaurants", keyword, page],
    queryFn: ({ signal }) =>
      call("restaurants", { query: { keyword, page, pageSize: 20 }, signal }),
  });
  return (
    <section className="v2-panel">
      <div className="v2-heading">
        <h1>店铺管理</h1>
        <Link className="v2-primary" to="/restaurants/new">
          添加店铺
        </Link>
      </div>
      <AdminSearch
        onSearch={(keyword) => {
          setKeyword(keyword);
          setPage(1);
        }}
      />
      <QueryState query={query} empty={!query.data?.items?.length}>
        <ul className="v2-list">
          {query.data?.items?.map((shop) => (
            <li key={shop.id}>
              <div>
                <Link to={"/restaurants/" + shop.id}>{shop.name}</Link>
                <p>{shop.address}</p>
              </div>
              <div className="v2-actions">
                <Link to={"/restaurants/" + shop.id + "/edit"}>编辑</Link>
                <button
                  disabled={task.busy}
                  onClick={() => {
                    if (
                      shop.id &&
                      confirm(
                        "删除后店铺、相关收藏和修改历史将一并删除，无法恢复。继续？",
                      )
                    )
                      void task.run(async (signal) => {
                        await call("deleteRestaurant", {
                          path: { id: shop.id! },
                          signal,
                        });
                        await Promise.all([
                          query.refetch(),
                          cache.invalidateQueries({
                            queryKey: ["v2", "directory"],
                          }),
                        ]);
                        cache.removeQueries({
                          queryKey: ["v2", "restaurant", shop.id],
                        });
                      }, "店铺已删除。");
                  }}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </QueryState>
      <PageControls
        page={page}
        hasNext={query.data?.hasNext}
        change={setPage}
      />
      <Notice {...task} />
    </section>
  );
}

function validRing(ring: unknown) {
  if (!Array.isArray(ring) || ring.length < 4) return false;
  return (
    ring.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        typeof point[0] === "number" &&
        typeof point[1] === "number" &&
        Math.abs(point[0]) <= 180 &&
        Math.abs(point[1]) <= 90 &&
        !!mapPoint({ gcjLng: point[0], gcjLat: point[1] }),
    ) &&
    ring[0][0] === ring.at(-1)[0] &&
    ring[0][1] === ring.at(-1)[1]
  );
}
const validPolygon = (polygon: unknown) =>
  Array.isArray(polygon) && !!polygon.length && polygon.every(validRing);

export function boundaryGeoJson(text: string) {
  if (!text) return undefined;
  const invalid = () =>
    new Error(
      "请输入有效的 GCJ-02 Polygon 或 MultiPolygon，边界的首尾坐标需要相同。",
    );
  let geo;
  try {
    geo = JSON.parse(text);
  } catch {
    throw invalid();
  }
  if (geo?.type === "FeatureCollection" && geo.features?.length === 1)
    geo = geo.features[0];
  if (geo?.type === "Feature") geo = geo.geometry;
  if (geo?.type === "Polygon" && validPolygon(geo.coordinates)) return text;
  if (
    geo?.type === "MultiPolygon" &&
    Array.isArray(geo.coordinates) &&
    geo.coordinates.length &&
    geo.coordinates.every(validPolygon)
  )
    return text;
  throw invalid();
}

function Hubs() {
  const { call } = useV2();
  const cache = useQueryClient();
  const campuses = useCampuses();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<V2Schema["Hub"]>();
  const task = useAction();
  const query = useQuery({
    queryKey: ["v2", "admin-hubs", keyword, page],
    queryFn: ({ signal }) =>
      call("hubs", { query: { keyword, page, pageSize: 20 }, signal }),
  });
  const refresh = async () => {
    await Promise.all([
      query.refetch(),
      cache.invalidateQueries({ queryKey: ["v2", "hubs"] }),
      cache.invalidateQueries({ queryKey: ["v2", "directory"] }),
    ]);
  };
  return (
    <section className="v2-panel">
      <div className="v2-heading">
        <h1>商圈管理</h1>
        <button className="v2-primary" onClick={() => setEditor({})}>
          添加商圈
        </button>
      </div>
      <AdminSearch
        onSearch={(keyword) => {
          setKeyword(keyword);
          setPage(1);
        }}
      />
      {editor && (
        <div className="v2-admin-editor" key={editor.id ?? "new"}>
          <h2>{editor.id ? "编辑商圈" : "添加商圈"}</h2>
          <Form
            label="保存商圈"
            submit={async (data, signal) => {
              const gcjLng = Number(value(data, "lng")),
                gcjLat = Number(value(data, "lat"));
              if (!mapPoint({ gcjLng, gcjLat }))
                throw new Error("请输入有效的 GCJ-02 坐标。");
              const body = {
                name: value(data, "name"),
                gcjLng,
                gcjLat,
                campusId: Number(value(data, "campusId")) || null,
                boundaryGeoJson: boundaryGeoJson(value(data, "boundary")),
              };
              if (editor.id)
                await call("editHub", {
                  path: { id: editor.id },
                  body,
                  signal,
                });
              else await call("addHub", { body, signal });
              setEditor(undefined);
              await refresh();
            }}
          >
            <label>
              商圈名称
              <input required name="name" defaultValue={editor.name} />
            </label>
            <label>
              校区
              <select name="campusId" defaultValue={editor.campusId ?? ""}>
                <option value="">未归属校区</option>
                {campuses.data?.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="v2-filters">
              <label>
                GCJ-02 经度
                <input
                  required
                  name="lng"
                  type="number"
                  step="any"
                  defaultValue={editor.gcjLng}
                />
              </label>
              <label>
                GCJ-02 纬度
                <input
                  required
                  name="lat"
                  type="number"
                  step="any"
                  defaultValue={editor.gcjLat}
                />
              </label>
            </div>
            <label>
              GCJ-02 边界 GeoJSON
              <textarea
                name="boundary"
                rows={5}
                defaultValue={
                  editor.boundary
                    ? JSON.stringify(editor.boundary, null, 2)
                    : ""
                }
              />
            </label>
            <button type="button" onClick={() => setEditor(undefined)}>
              取消
            </button>
          </Form>
        </div>
      )}
      <QueryState query={query} empty={!query.data?.items?.length}>
        <ul className="v2-list">
          {query.data?.items?.map((hub) => (
            <li key={hub.id}>
              <strong>{hub.name}</strong>
              <div className="v2-actions">
                <button
                  disabled={task.busy}
                  onClick={() =>
                    void task.run(async (signal) => {
                      if (hub.id)
                        setEditor(
                          (await call("hub", {
                            path: { id: hub.id },
                            signal,
                          })) ?? undefined,
                        );
                    })
                  }
                >
                  编辑
                </button>
                <button
                  disabled={task.busy}
                  onClick={() => {
                    if (hub.id && confirm("删除商圈会重新计算店铺归属，继续？"))
                      void task.run(async (signal) => {
                        await call("deleteHub", {
                          path: { id: hub.id! },
                          signal,
                        });
                        await refresh();
                      }, "商圈已删除。");
                  }}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </QueryState>
      <PageControls
        page={page}
        hasNext={query.data?.hasNext}
        change={setPage}
      />
      <Notice {...task} />
    </section>
  );
}

function Policies() {
  const { call, refreshIdentity } = useV2();
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const query = useQuery({
    queryKey: ["v2", "admin-policies", page],
    queryFn: ({ signal }) =>
      call("policies", { query: { page, pageSize: 20 }, signal }),
  });
  return (
    <section className="v2-panel">
      <div className="v2-heading">
        <h1>政策管理</h1>
        <button
          className="v2-primary"
          onClick={() => setPublishing(!publishing)}
        >
          {publishing ? "收起表单" : "发布新版本"}
        </button>
      </div>
      {publishing && (
        <div className="v2-admin-editor">
          <Form
            label="发布政策"
            submit={async (data, signal) => {
              if (
                !confirm(
                  "发布后所有用户都需要重新同意，已发布正文不可修改。继续？",
                )
              )
                return;
              await call("publishPolicy", {
                body: {
                  version: value(data, "version"),
                  privacyText: value(data, "privacyText"),
                  crossBorderText: value(data, "crossBorderText"),
                },
                signal,
              });
              setPublishing(false);
              setPage(1);
              cache.removeQueries({ queryKey: ["v2", "policy"] });
              await cache.invalidateQueries({
                queryKey: ["v2", "admin-policies"],
                refetchType: "none",
              });
              await refreshIdentity();
            }}
          >
            <label>
              版本号
              <input
                name="version"
                required
                maxLength={32}
                pattern={"[A-Za-z0-9._\\-]{1,32}"}
              />
            </label>
            <label>
              隐私政策
              <textarea
                name="privacyText"
                required
                rows={6}
                maxLength={50_000}
              />
            </label>
            <label>
              数据跨境说明
              <textarea
                name="crossBorderText"
                required
                rows={6}
                maxLength={50_000}
              />
            </label>
          </Form>
        </div>
      )}
      <QueryState query={query} empty={!query.data?.items?.length}>
        <ul className="v2-list">
          {query.data?.items?.map((policy) => (
            <li key={policy.id}>
              <Link to={"/admin/policies/" + policy.id}>
                版本 {policy.version}
              </Link>
              <time>{dateTime(policy.publishedAt)}</time>
            </li>
          ))}
        </ul>
      </QueryState>
      <PageControls
        page={page}
        hasNext={query.data?.hasNext}
        change={setPage}
      />
    </section>
  );
}

function PolicyDetail({ id }: { id: number }) {
  const { call } = useV2();
  const query = useQuery({
    queryKey: ["v2", "admin-policy", id],
    queryFn: ({ signal }) => call("policyDetail", { path: { id }, signal }),
  });
  return (
    <section className="v2-panel">
      <Link to="/admin/policies">返回政策管理</Link>
      <QueryState query={query}>
        <h1>版本 {query.data?.version}</h1>
        <time>{dateTime(query.data?.publishedAt)}</time>
        <h2>隐私政策</h2>
        <p className="v2-policy-copy">{query.data?.privacyText}</p>
        <h2>数据跨境说明</h2>
        <p className="v2-policy-copy">{query.data?.crossBorderText}</p>
      </QueryState>
    </section>
  );
}
