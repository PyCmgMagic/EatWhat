import { ActionMenu } from "../components/AnchoredPopover";
import { useState, type ReactNode } from "react";
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
  const [panel, setPanel] = useState<"history" | "report" | null>(null);

  function open(next: "history" | "report") {
    setPanel(next);
  }

  return (
    <>
      <ActionMenu
        className="dish-more"
        triggerClassName="dish-icon-button"
        panelClassName="dish-more-panel"
        label="更多菜品操作"
        icon={<DesignIcon name="more" size={22} />}
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
      </ActionMenu>
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
