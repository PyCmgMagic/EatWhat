import { lazy, Suspense, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  baiduMarkerUrl,
  mapPoint,
  type MapPoint,
} from "../features/map-geometry";
import { useDeviceLocation } from "../features/useDeviceLocation";
import { searchMapPlaces, type MapPlace } from "../api/baidu-places";
import type { Area } from "../app/area";
import type { V2Options, V2Schema } from "../api/backend-v2";
import { useV2 } from "./state";
import { RestaurantFoods } from "./foods";
import {
  distanceText,
  meals,
  priceLabels,
  ratingText,
  scenes,
  type Scene,
  useCampuses,
  useRestaurantTags,
} from "./discover";
import {
  dateTime,
  Form,
  Notice,
  PageControls,
  Picture,
  QueryState,
  Require,
  useAction,
  value,
} from "./ui";
import "../features/restaurant-map.css";

const BaiduMap = lazy(() => import("../features/BaiduMap"));
type Shop = V2Schema["Restaurant"];
type Search = NonNullable<V2Options<"search">["query"]>;

export function ShopList({ shops }: { shops?: Shop[] }) {
  return (
    <ul className="v2-shop-grid">
      {shops?.map((shop) => (
        <li key={shop.id}>
          <Link to={"/restaurants/" + shop.id} className="v2-shop-card">
            <Picture url={shop.pictureUrl} />
            <div>
              <h2>{shop.name}</h2>
              <p>{shop.address}</p>
              <p>
                {[
                  shop.priceBand && priceLabels[shop.priceBand],
                  distanceText(shop.distanceMeters),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Directory({
  mode,
  initialKeyword,
}: {
  mode: "nearby" | "search" | "favorites";
  initialKeyword?: string;
}) {
  const { call, user } = useV2();
  const nav = useNavigate();
  const campuses = useCampuses();
  const tags = useRestaurantTags();
  const [area, setArea] = useState<Area | null>(null);
  const location = useDeviceLocation({
    area,
    selectArea: setArea,
    autoLocate: false,
  });
  const [filters, setFilters] = useState<Search>(
    mode === "favorites"
      ? { sort: "FAVORITED_AT" }
      : { keyword: initialKeyword || undefined },
  );
  const [page, setPage] = useState(1);
  const hubs = useQuery({
    queryKey: ["v2", "hubs", "options"],
    queryFn: ({ signal }) => call("hubs", { query: { pageSize: 100 }, signal }),
  });
  const mapCenter =
    mapPoint(area) ??
    mapPoint(campuses.data?.find((campus) => campus.id === filters.campusId)) ??
    mapPoint(campuses.data?.find((campus) => campus.isDefault));
  const shops = useQuery({
    queryKey: ["v2", "directory", mode, filters, page, area],
    queryFn: ({ signal }) => {
      const query = {
        ...filters,
        page,
        pageSize: 16,
        gcjLng: area?.gcjLng,
        gcjLat: area?.gcjLat,
      };
      return call(
        mode === "favorites"
          ? "favorites"
          : mode === "nearby"
            ? "browse"
            : "search",
        { query, signal },
      );
    },
  });
  return (
    <section className="v2-panel">
      <div className="v2-heading">
        <h1>
          {mode === "favorites"
            ? "我的收藏"
            : mode === "search"
              ? "搜索店铺"
              : "附近店铺"}
        </h1>
        {(user?.verified || user?.role === "admin") && (
          <Link className="v2-primary" to="/restaurants/new">
            添加店铺
          </Link>
        )}
      </div>
      <form
        className="v2-filters v2-directory-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const radius = Number(value(data, "radius")) || undefined;
          if (radius && !area) {
            location.locate();
            return;
          }
          setFilters({
            keyword: value(data, "keyword") || undefined,
            campusId: Number(value(data, "campusId")) || undefined,
            hubId: Number(value(data, "hubId")) || undefined,
            radius,
            sort: value(data, "sort") || undefined,
            ...(mode === "favorites"
              ? {}
              : {
                  kind: value(data, "kind") || undefined,
                  priceBand: value(data, "priceBand") || undefined,
                  categories: data
                    .getAll("categories")
                    .map(String)
                    .filter(Boolean),
                  tags: data.getAll("tags").map(String).filter(Boolean),
                  delivery: data.has("delivery") || undefined,
                  recommendedOnly: data.has("recommendedOnly") || undefined,
                }),
          });
          setPage(1);
        }}
      >
        <label>
          店名或地址
          <input name="keyword" type="search" defaultValue={initialKeyword} />
        </label>
        <label>
          校区
          <select name="campusId">
            <option value="">全部</option>
            {campuses.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          商圈
          <select name="hubId">
            <option value="">全部</option>
            {hubs.data?.items?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          距离
          <select name="radius" disabled={!area}>
            <option value="">不限</option>
            {[500, 1000, 3000, 5000, 10000, 20000].map((radius) => (
              <option key={radius} value={radius}>
                {distanceText(radius)}
              </option>
            ))}
          </select>
        </label>
        <label>
          排序
          <select name="sort" defaultValue={filters.sort ?? ""}>
            {mode === "favorites" ? (
              <option value="FAVORITED_AT">最近收藏</option>
            ) : (
              <option value="">默认</option>
            )}
            <option value="NEWEST">最新发布</option>
            <option value="DISTANCE" disabled={!area}>
              距离最近
            </option>
          </select>
        </label>
        {mode !== "favorites" && (
          <>
            <label>
              类型
              <select name="kind">
                <option value="">全部</option>
                <option value="food">正餐</option>
                <option value="drink">甜点饮品</option>
              </select>
            </label>
            <label>
              品类
              <select name="categories">
                <option value="">全部</option>
                {tags.data?.categories?.map((tag) => (
                  <option key={tag}>{tag}</option>
                ))}
              </select>
            </label>
            <label>
              口味
              <select name="tags">
                <option value="">全部</option>
                {tags.data?.tags?.map((tag) => (
                  <option key={tag}>{tag}</option>
                ))}
              </select>
            </label>
            <label>
              价位
              <select name="priceBand">
                <option value="">全部</option>
                {Object.entries(priceLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="v2-check">
              <input type="checkbox" name="delivery" />
              可外卖
            </label>
            <label className="v2-check">
              <input type="checkbox" name="recommendedOnly" />
              高口碑
            </label>
          </>
        )}
        <button className="v2-primary" type="submit">
          搜索
        </button>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            location.locate();
          }}
          disabled={location.locating}
        >
          使用当前位置
        </button>
      </form>
      <Notice error={location.locationError} />
      {mode === "nearby" && (
        <div className="restaurant-map v2-map">
          <Suspense fallback={<p role="status">正在加载地图…</p>}>
            <BaiduMap
              center={mapCenter}
              devicePoint={mapPoint(area)}
              deviceRevision={location.deviceRevision}
              restaurants={shops.data?.items?.map(
                ({ id, name, address, gcjLng, gcjLat }) => ({
                  id,
                  name,
                  address,
                  gcjLng,
                  gcjLat,
                }),
              )}
              onSelect={(shop) => nav("/restaurants/" + shop.id)}
            />
          </Suspense>
        </div>
      )}
      <QueryState query={shops} empty={!shops.data?.items?.length}>
        <ShopList shops={shops.data?.items} />
      </QueryState>
      <PageControls
        page={page}
        hasNext={shops.data?.hasNext}
        change={setPage}
      />
    </section>
  );
}

export function RestaurantDetail({ id }: { id: number }) {
  const { call, session, user } = useV2();
  const cache = useQueryClient();
  const task = useAction();
  const [scene, setScene] = useState<Scene>("dine_in");
  const shop = useQuery({
    queryKey: ["v2", "restaurant", id],
    queryFn: ({ signal }) => call("restaurant", { path: { id }, signal }),
  });
  const data = shop.data;
  const editable = user?.verified || user?.role === "admin";
  const refresh = async () => {
    await Promise.all([
      shop.refetch(),
      cache.invalidateQueries({ queryKey: ["v2", "directory"] }),
    ]);
  };
  return (
    <QueryState query={shop} empty={!data}>
      {data && (
        <>
          <section className="v2-panel v2-shop-detail">
            <Picture url={data.pictureUrl} />
            <div>
              <h1>{data.name}</h1>
              <p>{data.address}</p>
              <p>
                {[
                  data.hubName,
                  data.priceBand && priceLabels[data.priceBand],
                  data.permanentlyClosed && "已歇业",
                  data.deliveryEnabled && "可外卖",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <ul className="v2-tags">
                {[...(data.categories ?? []), ...(data.tags ?? [])].map(
                  (tag) => (
                    <li key={tag}>{tag}</li>
                  ),
                )}
              </ul>
              <div className="v2-actions">
                {baiduMarkerUrl(data) && (
                  <a
                    href={baiduMarkerUrl(data)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    地图导航
                  </a>
                )}
                {editable && (
                  <Link to={"/restaurants/" + id + "/edit"}>编辑店铺</Link>
                )}
                {!session ? (
                  <Link to={"/auth?next=/restaurants/" + id}>登录后收藏</Link>
                ) : (
                  <button
                    disabled={task.busy}
                    aria-pressed={data.isFavorite === true}
                    onClick={() =>
                      void task.run(async (signal) => {
                        await call(
                          data.isFavorite ? "unfavorite" : "favorite",
                          { path: { id }, signal },
                        );
                        await refresh();
                      })
                    }
                  >
                    {data.isFavorite ? "取消收藏" : "收藏店铺"}
                  </button>
                )}
              </div>
            </div>
          </section>
          <section className="v2-panel">
            <h2>食友评价</h2>
            <div className="v2-tabs" aria-label="评价场景">
              {Object.entries(scenes).map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={scene === key}
                  onClick={() => setScene(key as Scene)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p>
              {ratingText(scene === "dine_in" ? data.dineIn : data.delivery)}
            </p>
            {session && (
              <div className="v2-actions">
                {(
                  [
                    ["RECOMMEND", "推荐"],
                    ["NOT_RECOMMEND", "不推荐"],
                  ] as const
                ).map(([rating, label]) => (
                  <button
                    key={rating}
                    disabled={task.busy}
                    aria-pressed={
                      (scene === "dine_in"
                        ? data.myRatings?.dineIn
                        : data.myRatings?.delivery) === rating
                    }
                    onClick={() =>
                      void task.run(async (signal) => {
                        await call("rate", {
                          path: { id },
                          body: { scene, rating },
                          signal,
                        });
                        await refresh();
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
                {(scene === "dine_in"
                  ? data.myRatings?.dineIn
                  : data.myRatings?.delivery) && (
                  <button
                    disabled={task.busy}
                    onClick={() =>
                      void task.run(async (signal) => {
                        await call("unrate", {
                          path: { id },
                          query: { scene },
                          signal,
                        });
                        await refresh();
                      })
                    }
                  >
                    撤销评价
                  </button>
                )}
              </div>
            )}
            {session && !editable && <Link to="/verify">学生认证</Link>}
            <Notice {...task} />
          </section>
          <RestaurantFoods restaurantId={id} editable={!!editable} />
          <History id={id} editable={!!editable} onRestore={refresh} />
        </>
      )}
    </QueryState>
  );
}

function historyValue(input: unknown) {
  if (input == null || input === "") return "空";
  if (typeof input === "object") return JSON.stringify(input);
  return String(input);
}

function History({
  id,
  editable,
  onRestore,
}: {
  id: number;
  editable: boolean;
  onRestore: () => Promise<void>;
}) {
  const { call } = useV2();
  const [page, setPage] = useState(1);
  const task = useAction();
  const history = useQuery({
    queryKey: ["v2", "restaurant", id, "history", page],
    queryFn: ({ signal }) =>
      call("history", { path: { id }, query: { page, pageSize: 10 }, signal }),
  });
  const labels: Record<string, string> = {
    create: "新增",
    edit: "编辑",
    restore: "恢复",
  };
  return (
    <section className="v2-panel">
      <h2>修改历史</h2>
      <QueryState query={history} empty={!history.data?.items?.length}>
        <ul className="v2-list v2-history">
          {history.data?.items?.map((row) => (
            <li key={row.id}>
              <details>
                <summary>
                  {labels[row.action ?? ""] || "修改"} ·{" "}
                  {row.editor?.displayName || "食友"} ·{" "}
                  {dateTime(row.createdAt)}
                </summary>
                <dl>
                  {row.changes?.map((change) => (
                    <div key={change.field}>
                      <dt>{fieldLabel(change.field)}</dt>
                      <dd>
                        {historyValue(change.from)} → {historyValue(change.to)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
              {editable && row.id && (
                <button
                  disabled={task.busy}
                  onClick={() => {
                    if (
                      confirm(
                        "店铺公开信息将恢复到该版本，并生成一条新记录。继续？",
                      )
                    )
                      void task.run(async (signal) => {
                        await call("restore", {
                          path: { id, revisionId: row.id! },
                          signal,
                        });
                        await Promise.all([onRestore(), history.refetch()]);
                      }, "店铺已恢复。");
                  }}
                >
                  恢复此版本
                </button>
              )}
            </li>
          ))}
        </ul>
      </QueryState>
      <PageControls
        page={page}
        hasNext={history.data?.hasNext}
        change={setPage}
      />
      <Notice {...task} />
    </section>
  );
}

function fieldLabel(key?: string) {
  const labels: Record<string, string> = {
    name: "店名",
    address: "地址",
    gcjLng: "经度",
    gcjLat: "纬度",
    poi: "地图地点",
    picture: "封面",
    permanentlyClosed: "已歇业",
    kind: "店铺类型",
    mealTimes: "饭点",
    priceBand: "价位",
    categories: "品类",
    tags: "口味",
    deliveryEnabled: "外卖",
  };
  return labels[key ?? ""] ?? key;
}

export function RestaurantEditorRoute({ id }: { id?: number }) {
  return (
    <Require edit>
      {id ? <ExistingEditor id={id} /> : <RestaurantEditor />}
    </Require>
  );
}

function ExistingEditor({ id }: { id: number }) {
  const { call } = useV2();
  const shop = useQuery({
    queryKey: ["v2", "restaurant", id],
    queryFn: ({ signal }) => call("restaurant", { path: { id }, signal }),
  });
  return (
    <QueryState query={shop} empty={!shop.data}>
      {shop.data && <RestaurantEditor shop={shop.data} />}
    </QueryState>
  );
}

function RestaurantEditor({ shop }: { shop?: Shop }) {
  const { call, upload, user } = useV2();
  const cache = useQueryClient();
  const nav = useNavigate();
  const tags = useRestaurantTags();
  const campuses = useCampuses();
  const [name, setName] = useState(shop?.name ?? "");
  const [address, setAddress] = useState(shop?.address ?? "");
  const [lng, setLng] = useState(String(shop?.gcjLng ?? ""));
  const [lat, setLat] = useState(String(shop?.gcjLat ?? ""));
  const [poi, setPoi] = useState(shop?.poi ?? undefined);
  const [matches, setMatches] = useState<MapPlace[]>([]);
  const [openMap, setOpenMap] = useState(false);
  const find = useAction();
  const uploadCache = useRef<{ file: File; key: string }>(null);
  const file = useRef<File>(null);
  const point =
    lng && lat
      ? mapPoint({ gcjLng: Number(lng), gcjLat: Number(lat) })
      : undefined;
  const center =
    point ?? mapPoint(campuses.data?.find((campus) => campus.isDefault));
  const choose = (point: MapPoint) => {
    setLng(String(point.gcjLng));
    setLat(String(point.gcjLat));
    setPoi("");
  };
  return (
    <section className="v2-panel v2-editor">
      <Link to={shop?.id ? "/restaurants/" + shop.id : "/nearby"}>返回</Link>
      <h1>{shop ? "编辑店铺" : "添加店铺"}</h1>
      <Form
        label={shop ? "保存店铺" : "发布店铺"}
        submit={async (data, signal) => {
          if (!point) throw new Error("请选择有效的 GCJ-02 店铺坐标。");
          if (!tags.data) throw new Error("请先加载店铺品类和口味。");
          const categories = data.getAll("categories").map(String);
          const tastes = data.getAll("tags").map(String);
          if (categories.length > 2 || tastes.length > 3)
            throw new Error("最多选择 2 个品类、3 个口味。");
          const mealTimes = data.getAll("mealTimes").map(String);
          if (!name.trim() || !address.trim() || !mealTimes.length)
            throw new Error("请填写店名、地址并选择至少一个饭点。");
          let picture = data.has("clearPicture") ? "" : undefined;
          if (file.current) {
            const selected = file.current;
            if (uploadCache.current?.file !== selected)
              uploadCache.current = {
                file: selected,
                key: await upload(selected, "restaurants", signal),
              };
            picture = uploadCache.current.key;
          }
          const body = {
            name: name.trim(),
            address: address.trim(),
            ...point,
            poi,
            kind: value(data, "kind"),
            mealTimes,
            priceBand: value(data, "priceBand"),
            categories,
            tags: tastes,
            deliveryEnabled: data.has("deliveryEnabled"),
            picture,
          };
          const result = shop?.id
            ? await call("editRestaurant", {
                path: { id: shop.id },
                body: {
                  ...body,
                  permanentlyClosed: data.has("permanentlyClosed"),
                },
                signal,
              })
            : await call("addRestaurant", { body, signal });
          const id = result?.id ?? shop?.id;
          if (!id)
            throw new Error("没有收到店铺编号，请先在附近列表确认结果。");
          await Promise.all([
            cache.invalidateQueries({ queryKey: ["v2", "restaurant", id] }),
            cache.invalidateQueries({ queryKey: ["v2", "directory"] }),
            cache.invalidateQueries({ queryKey: ["v2", "admin-restaurants"] }),
          ]);
          nav("/restaurants/" + id, { replace: true });
        }}
      >
        <label>
          店名
          <input
            name="name"
            required
            maxLength={20}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          地址
          <input
            name="address"
            required
            maxLength={30}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </label>
        <div className="v2-actions">
          <button type="button" onClick={() => setOpenMap((old) => !old)}>
            {openMap ? "收起地图" : "地图选点"}
          </button>
          <button
            type="button"
            disabled={find.busy || !name.trim()}
            onClick={() =>
              void find.run(async (signal) => {
                const result = await searchMapPlaces(name, center, signal);
                setMatches(result);
              }, "已完成地点搜索。")
            }
          >
            按店名找地点
          </button>
        </div>
        <Notice {...find} />
        {matches.length > 0 && (
          <ul className="v2-list">
            {matches.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => {
                    choose(place.point);
                    setName(place.name);
                    setAddress(place.address);
                    setPoi(place.id);
                    setMatches([]);
                  }}
                >
                  {place.name} {place.address}
                </button>
              </li>
            ))}
          </ul>
        )}
        {openMap && (
          <div className="restaurant-map v2-map">
            <Suspense fallback={<p role="status">正在加载地图…</p>}>
              <BaiduMap
                center={center}
                pickedPoint={point}
                onPick={choose}
                deviceRevision={0}
              />
            </Suspense>
          </div>
        )}
        <div className="v2-filters">
          <label>
            GCJ-02 经度
            <input
              required
              type="number"
              step="any"
              value={lng}
              onChange={(event) => {
                setLng(event.target.value);
                setPoi("");
              }}
            />
          </label>
          <label>
            GCJ-02 纬度
            <input
              required
              type="number"
              step="any"
              value={lat}
              onChange={(event) => {
                setLat(event.target.value);
                setPoi("");
              }}
            />
          </label>
          <label>
            店铺类型
            <select name="kind" defaultValue={shop?.kind ?? "food"}>
              <option value="food">正餐</option>
              <option value="drink">甜点饮品</option>
            </select>
          </label>
          <label>
            价位
            <select name="priceBand" defaultValue={shop?.priceBand ?? ""}>
              <option value="">未填写</option>
              {Object.entries(priceLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <CheckOptions
          name="mealTimes"
          label="饭点"
          options={Object.keys(meals)}
          labels={meals}
          checked={shop?.mealTimes ?? ["lunch", "dinner"]}
        />
        <QueryState query={tags}>
          <CheckOptions
            name="categories"
            label="品类（最多 2 项）"
            options={tags.data?.categories}
            checked={shop?.categories}
          />
          <CheckOptions
            name="tags"
            label="口味（最多 3 项）"
            options={tags.data?.tags}
            checked={shop?.tags}
          />
        </QueryState>
        <label className="v2-check">
          <input
            type="checkbox"
            name="deliveryEnabled"
            defaultChecked={shop?.deliveryEnabled}
          />
          可外卖
        </label>
        {shop && (
          <label className="v2-check">
            <input
              type="checkbox"
              name="permanentlyClosed"
              defaultChecked={shop.permanentlyClosed}
            />
            已歇业
          </label>
        )}
        {shop?.pictureUrl && (
          <Picture url={shop.pictureUrl} className="v2-editor-image" />
        )}
        {user?.verified && (
          <label>
            店铺封面
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => {
                file.current = event.currentTarget.files?.[0] ?? null;
              }}
            />
          </label>
        )}
        {shop?.pictureUrl && (
          <label className="v2-check">
            <input type="checkbox" name="clearPicture" />
            移除封面
          </label>
        )}
      </Form>
    </section>
  );
}

export function CheckOptions({
  name,
  label,
  options,
  checked,
  labels,
}: {
  name: string;
  label: string;
  options?: string[];
  checked?: string[];
  labels?: Record<string, string>;
}) {
  return (
    <fieldset className="v2-check-options">
      <legend>{label}</legend>
      {options?.map((option) => (
        <label className="v2-check" key={option}>
          <input
            name={name}
            value={option}
            type="checkbox"
            defaultChecked={checked?.includes(option)}
          />
          {labels?.[option] ?? option}
        </label>
      ))}
    </fieldset>
  );
}
