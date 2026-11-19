import { Check } from "lucide-react";
import { DesignNavigation, PublishButtonSurface } from "../mobile/ui";
import {
  setAppearance,
  setNavTransparency,
  useAppearance,
  useNavTransparency,
} from "./appearance";
import "./personalization.css";

const choices = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
] as const;

export default function Personalization() {
  const appearance = useAppearance();
  const transparency = useNavTransparency();
  return (
    <div className="personalization">
      <fieldset>
        <legend>外观</legend>
        <div className="personalization-options">
          {choices.map(({ value, label }) => (
            <label key={value}>
              <input
                type="radio"
                name="appearance"
                value={value}
                checked={appearance === value}
                onChange={() => setAppearance(value)}
              />
              <span>
                {label}
                <Check size={20} aria-hidden="true" />
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>底部导航</legend>
        <div
          className="personalization-preview"
          role="img"
          aria-label="底部导航外观预览"
        >
          <div inert>
            <DesignNavigation
              active="home"
              action={
                <span className="design-fab">
                  <PublishButtonSurface />
                </span>
              }
            />
          </div>
        </div>
        <div className="personalization-value">
          <label htmlFor="nav-transparency">透明度</label>
          <span aria-hidden="true">{transparency}%</span>
        </div>
        <input
          id="nav-transparency"
          type="range"
          min={0}
          max={100}
          step={1}
          value={transparency}
          aria-valuetext={transparency + "%"}
          onChange={(event) =>
            setNavTransparency(event.currentTarget.valueAsNumber)
          }
        />
        <small className="personalization-system-note">
          系统辅助显示已启用，底部导航使用实色背景。
        </small>
      </fieldset>
    </div>
  );
}
