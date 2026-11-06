import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "../../app/state";
import { RestaurantActions } from "./Community";
import { Card, QueryView } from "./shared";
export function FoodExtras({ id }: { id: number }) {
  const { api } = useApp(),
    q = useQuery({
      queryKey: ["topics", "food", id],
      queryFn: () => api.topicsForFood(id),
      retry: false,
    });
  return (
    <Card title="发现与反馈">
      <Link to={`/reports/new?type=FOOD&id=${id}`}>举报这道菜 →</Link>
      <QueryView query={q}>
        {q.data?.map((t) => (
          <Link className="v4-row" key={t.id} to={`/topics/${t.id}`}>
            已入选：{t.name} →
          </Link>
        ))}
      </QueryView>
    </Card>
  );
}
export default function DetailExtras({ path }: { path: string }) {
  const id = Number(path.split("/").pop());
  return (
    <div className="v4-mobile-extras" id="restaurant-evaluation" tabIndex={-1}>
      {/^\/foods\/\d+$/.test(path) ? (
        <FoodExtras id={id} />
      ) : (
        <Card title="店铺评价与反馈">
          <RestaurantActions id={id} hideFavorite />
        </Card>
      )}
    </div>
  );
}
