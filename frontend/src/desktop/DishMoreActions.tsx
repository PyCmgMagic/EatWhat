import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { Food } from "../api/models";
import { FoodManage } from "../features/Catalog";
import { DesignIcon } from "../mobile/ui";

export function DishMoreActions({ food, id }: { food: Food; id: number }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);

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
    <details
      className="pc-dish-more"
      ref={disclosure}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          event.currentTarget.open = false;
        }
      }}
    >
      <summary
        className="pc-icon-button"
        aria-label="更多菜品操作"
        title="更多菜品操作"
        ref={trigger}
      >
        <DesignIcon name="more" size={20} />
      </summary>
      <div
        className="pc-dish-more-panel"
        onClick={(event) => {
          if ((event.target as Element).closest("a, button")) dismiss();
        }}
      >
        <FoodManage food={food} inMenu anyone />
        <Link to={`/reports/new?type=FOOD&id=${id}`}>
          <DesignIcon name="report" size={16} />
          举报菜品
        </Link>
      </div>
    </details>
  );
}
