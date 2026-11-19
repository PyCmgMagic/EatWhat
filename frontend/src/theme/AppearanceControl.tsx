import { Moon, Sun } from "lucide-react";
import { setAppearance, useTheme } from "./appearance";

export function ThemeToggle() {
  const dark = useTheme() === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      role="switch"
      aria-label="深色模式"
      aria-checked={dark}
      title={dark ? "切换到浅色模式" : "切换到深色模式"}
      onClick={() => setAppearance(dark ? "light" : "dark")}
    >
      <Sun aria-hidden="true" />
      <Moon aria-hidden="true" />
    </button>
  );
}
