import { useEffect, useRef, useState, type ReactNode } from "react";
import { FoodReportDialog } from "../features/FoodReportDialog";
import { FoodEditHistoryDialog } from "../features/v4/EditHistory";
import { DesignIcon } from "./ui";

export function DishMoreActions({
  foodId,
  foodName,
  management,
}: {
  foodId: number;
  foodName?: string | null;
  management: ReactNode;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const [panel, setPanel] = useState<"history" | "report" | null>(null);

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

  function open(next: "history" | "report") {
    dismiss();
    setPanel(next);
  }

  return (
    <>
      <details
        className="dish-more"
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
          className="dish-icon-button"
          aria-label="更多菜品操作"
          ref={trigger}
        >
          <DesignIcon name="more" size={22} />
        </summary>
        <div
          className="dish-more-panel"
          role="group"
          aria-label="菜品相关操作"
          onClick={(event) => {
            if ((event.target as Element).closest("a, button")) dismiss();
          }}
        >
          {management}
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => open("history")}
          >
            <DesignIcon name="history" size={18} />
            修改记录
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => open("report")}
          >
            <DesignIcon name="report" size={18} />
            举报这道菜
          </button>
        </div>
      </details>
      {panel === "history" && (
        <FoodEditHistoryDialog id={foodId} onClose={() => setPanel(null)} />
      )}
      {panel === "report" && (
        <FoodReportDialog
          foodId={foodId}
          foodName={foodName}
          onClose={() => setPanel(null)}
        />
      )}
    </>
  );
}
