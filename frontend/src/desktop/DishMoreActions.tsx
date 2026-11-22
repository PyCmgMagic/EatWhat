import { ActionMenu } from "../components/AnchoredPopover";
import type { Food } from "../api/models";
import { FoodManage } from "../features/Catalog";
import { DesignIcon } from "../mobile/ui";

export function DishMoreActions({
  food,
  onReport,
}: {
  food: Food;
  onReport: () => void;
}) {
  return (
    <ActionMenu
      className="pc-dish-more"
      triggerClassName="pc-icon-button"
      panelClassName="pc-dish-more-panel"
      label="更多菜品操作"
      icon={<DesignIcon name="more" size={20} />}
    >
      <FoodManage food={food} inMenu anyone />
      <button type="button" aria-haspopup="dialog" onClick={onReport}>
        <DesignIcon name="report" size={16} />
        举报菜品
      </button>
    </ActionMenu>
  );
}
