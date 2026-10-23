import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { useArea } from "../app/area";
import { parseId } from "../api/models";
import {
  Empty,
  ErrorState,
  Gate,
  Icon,
  Intro,
  Loading,
  Pagination,
  Picture,
} from "../components/ui";
import { FoodGrid } from "../components/FoodCard";
export default function Restaurants() {
  return (
    <>
      <Intro
        title="先找一家店，再发现好味道。"
        subtitle="食堂窗口，还是校门口的小馆？循着香味慢慢找。"
      />
      <Gate verified={false}>
        <RestaurantSearch />
      </Gate>
    </>
  );
}
function RestaurantSearch() {
  const { api } = useApp(),
    { area, openArea } = useArea(),
    [params, setParams] = useSearchParams();
  const keyword = params.get("keyword") || "",
    page = parseId(params.get("page") || "1") || 1;
  const q = useQuery({
    queryKey: ["restaurants", "search", area, keyword, page],
    queryFn: () =>
      api.restaurantSearch({
        keyword: keyword || undefined,
        gcjLng: area!.gcjLng,
        gcjLat: area!.gcjLat,
        hubId: area?.hubId,
        page,
        pageSize: 12,
      }),
    enabled: !!area,
  });
  return (
    <>
      <div className="search-toolbar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setParams({ keyword: String(data.get("keyword") || "") });
          }}
        >
          <label className="sr-only" htmlFor="restaurant-keyword">
            餐厅名称
          </label>
          <input
            key={keyword}
            className="field"
            id="restaurant-keyword"
            name="keyword"
            type="search"
            defaultValue={keyword}
            placeholder="输入餐厅或窗口名称"
            maxLength={100}
          />
          <button className="btn btn-primary" type="submit">
            <Icon name="search" />
            查找餐厅
          </button>
        </form>
        <button className="btn btn-secondary" onClick={openArea}>
          <Icon name="pin" />
          {area?.name || "选择区域"}
        </button>
      </div>
      {area && (
        <p className="section-caption">
          {area.source === "hub"
            ? `按「${area.name}」中心查询，不代表你的实时位置。`
            : "按你主动授权的设备位置查询。"}
        </p>
      )}
      {!area ? (
        <Empty
          title="从哪里开始找好吃的？"
          action={
            <button className="btn btn-primary" onClick={openArea}>
              选择区域
              <Icon name="pin" />
            </button>
          }
        >
          选定一个区域，或主动使用设备定位，就可以查询餐厅。
        </Empty>
      ) : q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : q.data?.items?.length ? (
        <>
          <div className="restaurant-grid">
            {q.data.items.map((r, i) => (
              <Link
                key={r.id ?? i}
                className="restaurant-card"
                to={`/restaurants/${r.id}`}
              >
                <div className="restaurant-photo">
                  <Picture src={r.pictureUrl?.[0]} alt={r.name || "餐厅"} />
                </div>
                <div>
                  <h2>{r.name || "未命名餐厅"}</h2>
                  <p>
                    <Icon name="pin" />
                    {r.address || "地址待补充"}
                  </p>
                  <span className="text-link">
                    看看店里的菜
                    <Icon name="arrow" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <Pagination
            page={page}
            hasNext={q.data.hasNext}
            totalPages={q.data.totalPages}
            onPage={(p) => setParams({ keyword, page: String(p) })}
          />
        </>
      ) : (
        <Empty
          title="还没找到这家店"
          action={
            <Link to="/restaurants/new" className="btn btn-secondary">
              添加一家餐厅
              <Icon name="plus" />
            </Link>
          }
        >
          试试换个名字或区域，已认证同学也可以补充餐厅。
        </Empty>
      )}
    </>
  );
}
export function RestaurantDetail() {
  const id = parseId(useParams().id);
  return (
    <Gate>
      {id ? (
        <RestaurantContent id={id} />
      ) : (
        <Empty
          title="餐厅地址无效"
          action={
            <Link to="/restaurants" className="btn btn-primary">
              重新查找餐厅
            </Link>
          }
        >
          请从餐厅列表重新进入。
        </Empty>
      )}
    </Gate>
  );
}
function RestaurantContent({ id }: { id: number }) {
  const { api } = useApp(),
    [page, setPage] = useState(1),
    [tag, setTag] = useState<number>();
  const tags = useQuery({
    queryKey: ["system-tags"],
    queryFn: () => api.systemTags(),
  });
  const restaurant = useQuery({
      queryKey: ["restaurants", "detail", id],
      queryFn: () => api.restaurant(id),
    }),
    foods = useQuery({
      queryKey: ["foods", "restaurant", id, page, tag],
      queryFn: () =>
        api.foods(id, page, tag ? { systemTagIds: [tag] } : undefined),
      enabled: !!restaurant.data,
    });
  if (restaurant.isPending) return <Loading />;
  if (restaurant.isError)
    return (
      <ErrorState
        error={restaurant.error}
        retry={() => void restaurant.refetch()}
      />
    );
  const r = restaurant.data;
  return (
    <>
      <Link className="text-link back-link" to="/restaurants">
        <Icon name="left" />
        继续找餐厅
      </Link>
      <div className="restaurant-heading">
        <div className="restaurant-heading-photo">
          <Picture src={r.pictureUrl?.[0]} alt={r.name || "餐厅"} />
        </div>
        <div>
          <span className="eyebrow">校园里的好味道</span>
          <h1>{r.name}</h1>
          <p>
            <Icon name="pin" />
            {r.address || "详细地址待补充"}
          </p>
        </div>
        <Link className="btn btn-primary" to={`/publish?restaurantId=${id}`}>
          分享这里的一道菜
          <Icon name="plus" />
        </Link>
      </div>
      <div className="section-title">
        <h2>同学们在这里吃过什么？</h2>
        <span className="muted">
          {foods.data?.totalItems != null
            ? `${foods.data.totalItems} 道分享`
            : ""}
        </span>
      </div>
      {tags.data && (
        <div className="store-tag-filter">
          <label htmlFor="store-tag" className="muted">
            按口味找店内菜品
          </label>
          <select
            className="field"
            id="store-tag"
            value={tag ?? ""}
            onChange={(e) => {
              setTag(Number(e.target.value) || undefined);
              setPage(1);
            }}
          >
            <option value="">全部公共标签</option>
            {tags.data.map((t) => (
              <option key={t.id} value={t.id!}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {foods.isPending ? (
        <Loading />
      ) : foods.isError ? (
        <ErrorState error={foods.error} retry={() => void foods.refetch()} />
      ) : foods.data.items?.length ? (
        <>
          <FoodGrid foods={foods.data.items} />
          <Pagination
            page={page}
            hasNext={foods.data.hasNext}
            totalPages={foods.data.totalPages}
            onPage={setPage}
          />
        </>
      ) : (
        <Empty
          title="这家店的第一份分享，等你来写"
          action={
            <Link
              className="btn btn-primary"
              to={`/publish?restaurantId=${id}`}
            >
              分享一道菜
            </Link>
          }
        >
          拍下眼前的美味，把你的私藏推荐给同学。
        </Empty>
      )}
    </>
  );
}
