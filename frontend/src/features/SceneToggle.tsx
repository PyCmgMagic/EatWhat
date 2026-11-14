import type { CSSProperties } from "react";
import { recommendScenes, type RecommendScene } from "../api/v2-vocab";
import "./scene-toggle.css";

/** Dine-in / delivery switch for the recommendation feed. */
export function SceneToggle({
  value,
  onChange,
  tone = "light",
  stage,
}: {
  value: RecommendScene;
  onChange: (scene: RecommendScene) => void;
  /** "stage" follows the text colour of the coloured home header. */
  tone?: "light" | "stage";
  /** Header background, used as the text colour of the selected option. */
  stage?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="堂食还是外卖"
      className="ew-scene-toggle"
      data-tone={tone}
      style={
        stage ? ({ "--scene-toggle-on": stage } as CSSProperties) : undefined
      }
    >
      {recommendScenes.map((scene) => (
        <button
          key={scene.id}
          type="button"
          role="radio"
          aria-checked={value === scene.id}
          onClick={() => value !== scene.id && onChange(scene.id)}
        >
          <span>{scene.name}</span>
        </button>
      ))}
    </div>
  );
}
