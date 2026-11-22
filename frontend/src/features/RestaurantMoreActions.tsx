import { ActionMenu } from "../components/AnchoredPopover";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { DesignIcon } from "../mobile/ui";
import { shopEditPath } from "./EditRestaurant";
import { RestaurantCorrectionDialog } from "./RestaurantCorrectionDialog";
import { RestaurantReportDialog } from "./RestaurantReportDialog";
import { RestaurantHistoryDialog } from "./v4/EditHistory";
import "./restaurant-more-actions.css";

export function RestaurantMoreActions({
  id,
  name,
  desktop = false,
}: {
  id: number;
  name?: string | null;
  desktop?: boolean;
}) {
  const { pathname, search } = useLocation();
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <>
      <ActionMenu
        className={`restaurant-more${desktop ? " is-desktop" : ""}`}
        triggerClassName="restaurant-more-trigger"
        panelClassName="restaurant-more-panel"
        label="更多店铺操作"
        icon={<DesignIcon name="more" size={22} />}
      >
        <Link to={shopEditPath(id)} state={{ returnTo: pathname + search }}>
          <DesignIcon name="edit" size={18} />
          编辑店铺
        </Link>
        {desktop ? (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setHistoryOpen(true);
            }}
          >
            <DesignIcon name="history" size={18} />
            修改记录
          </button>
        ) : (
          <Link
            to={`/restaurants/${id}/history`}
            state={{ returnTo: pathname + search }}
          >
            <DesignIcon name="history" size={18} />
            修改记录
          </Link>
        )}
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => {
            setCorrectionOpen(true);
          }}
        >
          <DesignIcon name="feedback" size={18} />
          信息纠错
        </button>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => {
            setReportOpen(true);
          }}
        >
          <DesignIcon name="report" size={18} />
          举报店铺
        </button>
      </ActionMenu>
      {correctionOpen && (
        <RestaurantCorrectionDialog
          restaurantId={id}
          restaurantName={name}
          onClose={() => setCorrectionOpen(false)}
        />
      )}
      {reportOpen && (
        <RestaurantReportDialog
          restaurantId={id}
          restaurantName={name}
          onClose={() => setReportOpen(false)}
        />
      )}
      {historyOpen && (
        <RestaurantHistoryDialog
          id={id}
          name={name}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </>
  );
}
