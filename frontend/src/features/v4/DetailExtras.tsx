import { RestaurantActions } from "./Community";
import { Card } from "./shared";
import { EditHistory } from "./EditHistory";
import { MobileShopFeedback } from "./MobileShopFeedback";
export function FoodExtras({
  id,
  inline = false,
}: {
  id: number;
  inline?: boolean;
}) {
  if (inline) return null;
  return <EditHistory id={id} />;
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
        aria-label="食友评价"
        id="restaurant-evaluation"
        tabIndex={-1}
      >
        <MobileShopFeedback key={id} id={id} />
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
