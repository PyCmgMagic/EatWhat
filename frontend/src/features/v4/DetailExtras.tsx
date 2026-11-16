import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { RestaurantActions } from "./Community";
import { Card, QueryView } from "./shared";
import { EditHistory } from "./EditHistory";
import { MobileShopFeedback } from "./MobileShopFeedback";
export function FoodExtras({
  id,
  inline = false,
}: {
  id: number;
  inline?: boolean;
}) {
  const { api } = useApp(),
    q = useQuery({
      queryKey: ["topics", "food", id],
      queryFn: () => api.topicsForFood(id),
      retry: false,
    });
  if (inline)
    return (
      <>
        <footer className="mobile-food-footer" aria-label="菜品相关操作">
          {!!q.data?.length && (
            <nav className="mobile-food-topics" aria-label="相关专题">
              {q.data.map((t) => (
                <Link key={t.id} to={`/topics/${t.id}`}>
                  已入选：{t.name} →
                </Link>
              ))}
            </nav>
          )}
          {q.isError && (
            <p className="mobile-food-topics-error" role="status">
              相关专题暂时未能加载
              <button disabled={q.isFetching} onClick={() => void q.refetch()}>
                {q.isFetching ? "加载中…" : "重试"}
              </button>
            </p>
          )}
        </footer>
      </>
    );
  if (!q.isError && !q.data?.length) return <EditHistory id={id} />;
  return (
    <>
      <EditHistory id={id} />
      <Card title="相关专题">
        <QueryView query={q}>
          {q.data?.map((t) => (
            <Link className="v4-row" key={t.id} to={`/topics/${t.id}`}>
              已入选：{t.name} →
            </Link>
          ))}
        </QueryView>
      </Card>
    </>
  );
}
export default function DetailExtras({
  path,
  inline = false,
}: {
  path: string;
  inline?: boolean;
}) {
  const id = Number(path.split("/").pop());
  if (inline)
    return (
      <section
        className="mobile-restaurant-feedback"
        id="restaurant-evaluation"
        tabIndex={-1}
      >
        <h2>店铺评价与反馈</h2>
        <MobileShopFeedback id={id} />
      </section>
    );
  return (
    <div className="v4-mobile-extras" id="restaurant-evaluation" tabIndex={-1}>
      {/^\/foods\/\d+$/.test(path) ? (
        <FoodExtras id={id} />
      ) : (
        <Card title="店铺评价与反馈">
          <RestaurantActions id={id} hideFavorite hideMaintenance />
        </Card>
      )}
    </div>
  );
}
