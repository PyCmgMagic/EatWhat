import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { DesignIcon } from "../mobile/ui";
import { shopEditPath } from "./EditRestaurant";
import { RestaurantCorrectionDialog } from "./RestaurantCorrectionDialog";
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
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);

  function dismiss() {
    if (!disclosure.current?.open) return;
    disclosure.current.open = false;
    trigger.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    const details = disclosure.current!;
    function outside(event: PointerEvent) {
      if (details.open && !details.contains(event.target as Node))
        details.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && details.open) {
        event.preventDefault();
        dismiss();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <>
      <details
        className={`restaurant-more${desktop ? " is-desktop" : ""}`}
        ref={disclosure}
        onBlur={(event) => {
          if (
            event.relatedTarget &&
            !event.currentTarget.contains(event.relatedTarget)
          )
            event.currentTarget.open = false;
        }}
      >
        <summary
          className="restaurant-more-trigger"
          aria-label="更多店铺操作"
          ref={trigger}
        >
          <DesignIcon name="more" size={22} />
        </summary>
        <div
          className="restaurant-more-panel"
          role="group"
          aria-label="店铺相关操作"
          onClick={(event) => {
            if ((event.target as Element).closest("a, button")) dismiss();
          }}
        >
          <Link to={shopEditPath(id)} state={{ returnTo: pathname + search }}>
            <DesignIcon name="edit" size={18} />
            编辑店铺
          </Link>
          <Link
            to={`/restaurants/${id}/history`}
            state={{ returnTo: pathname + search }}
          >
            <DesignIcon name="history" size={18} />
            修改记录
          </Link>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              dismiss();
              setCorrectionOpen(true);
            }}
          >
            <DesignIcon name="feedback" size={18} />
            信息纠错
          </button>
          <Link to={`/reports/new?type=RESTAURANT&id=${id}`}>
            <DesignIcon name="report" size={18} />
            举报店铺
          </Link>
        </div>
      </details>
      {correctionOpen && (
        <RestaurantCorrectionDialog
          restaurantId={id}
          restaurantName={name}
          onClose={() => setCorrectionOpen(false)}
        />
      )}
    </>
  );
}
