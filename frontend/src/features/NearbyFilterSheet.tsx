import { useState } from "react";
import { createPortal } from "react-dom";
import { priceBands } from "../api/v2-vocab";
import { discoveryKinds } from "../app/discovery-category";
import { useApp } from "../app/state";
import { Modal } from "../components/ui";
import { useShopOptions } from "./shop-options";
import SheetHandle from "../mobile/SheetHandle";
import { SlidersHorizontal } from "lucide-react";
import { useArea } from "../app/area";
import {
  allShops,
  hasNearbyFilters,
  useNearbyShops,
  type NearbyFilters,
} from "./nearby-filters";
import "./nearby-filters.css";

function ChoiceGroup({
  title,
  choices,
  value,
  choose,
  defaultLabel = "不限",
}: {
  title: string;
  choices: readonly { id: string; name: string }[];
  value: string;
  choose: (value: string) => void;
  defaultLabel?: string;
}) {
  return (
    <fieldset>
      <legend>{title}</legend>
      <div className="nearby-filter-chips">
        {[{ id: "", name: defaultLabel }, ...choices].map(({ id, name }) => (
          <label key={id}>
            <input
              type="radio"
              name={title}
              checked={value === id}
              onChange={() => choose(id)}
            />
            <span>{name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function NearbyFilterTrigger({
  active,
  open,
  onClick,
  showLabel,
}: {
  active: boolean;
  open: boolean;
  onClick: () => void;
  showLabel?: boolean;
}) {
  return (
    <button
      type="button"
      className="nearby-filter-trigger"
      aria-label={active ? "筛选店铺，已应用筛选" : "筛选店铺"}
      aria-haspopup="dialog"
      aria-expanded={open}
      data-active={active || undefined}
      onClick={onClick}
    >
      <SlidersHorizontal size={showLabel ? 16 : 20} aria-hidden="true" />
      {showLabel && "筛选"}
    </button>
  );
}

export default function NearbyFilterSheet({
  filters,
  keyword,
  pageSize,
  onApply,
  onClose,
}: {
  filters: NearbyFilters;
  keyword: string;
  pageSize?: number;
  onApply: (filters: NearbyFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  const { session } = useApp();
  const { categories } = useShopOptions();
  const { area } = useArea();
  const preview = useNearbyShops(keyword, draft, 1, pageSize);
  const count = preview.data?.totalItems;
  function change(patch: Partial<NearbyFilters>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  return createPortal(
    <Modal title="筛选" className="nearby-filter-sheet" onClose={onClose}>
      <SheetHandle
        mode="dismiss"
        target=".nearby-filter-sheet"
        label="筛选"
        onDismiss={onClose}
      />
      <div className="nearby-filter-fields">
        <ChoiceGroup
          title="类型"
          choices={discoveryKinds}
          value={draft.kind}
          choose={(kind) => change({ kind })}
        />
        <fieldset>
          <legend>品类，可以多选</legend>
          <div className="nearby-filter-chips nearby-filter-categories">
            {categories.map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  checked={draft.categories.includes(category)}
                  onChange={(event) =>
                    change({
                      categories: event.target.checked
                        ? [...draft.categories, category].sort()
                        : draft.categories.filter((item) => item !== category),
                    })
                  }
                />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <ChoiceGroup
          title="价位"
          choices={priceBands}
          value={draft.priceBand}
          choose={(priceBand) => change({ priceBand })}
        />
        {area && (
          <ChoiceGroup
            title="排序"
            defaultLabel="距离优先"
            choices={[{ id: "NEWEST", name: "最新店铺" }]}
            value={draft.newestFirst ? "NEWEST" : ""}
            choose={(sort) => change({ newestFirst: sort === "NEWEST" })}
          />
        )}
        <label className="nearby-filter-switch">
          <span>
            只看口碑好的
            <small id="nearby-reputation-rule">
              堂食或外卖至少 3 条评价，推荐率不低于 70%
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="只看口碑好的"
            aria-describedby="nearby-reputation-rule"
            checked={draft.recommendedOnly}
            onChange={(event) =>
              change({ recommendedOnly: event.target.checked })
            }
          />
        </label>
        <label className="nearby-filter-switch">
          <span>只看我收藏的店{!session && <small>登录后可用</small>}</span>
          <input
            type="checkbox"
            role="switch"
            disabled={!session}
            checked={!!session && draft.favoritesOnly}
            onChange={(event) =>
              change({ favoritesOnly: event.target.checked })
            }
          />
        </label>
      </div>
      <footer className="nearby-filter-actions">
        <button
          type="button"
          disabled={!hasNearbyFilters(draft)}
          onClick={() => setDraft(allShops)}
        >
          重置
        </button>
        {preview.isError ? (
          <button type="button" onClick={() => void preview.refetch()}>
            查询失败，重试
          </button>
        ) : (
          <button
            type="button"
            aria-live="polite"
            disabled={preview.isPending}
            onClick={() => onApply(draft)}
          >
            {preview.isPending
              ? "正在查询…"
              : count == null
                ? "查看店铺"
                : `看 ${count} 家`}
          </button>
        )}
      </footer>
    </Modal>,
    document.body,
  );
}
