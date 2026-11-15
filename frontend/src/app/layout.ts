export function desktopLayout(
  width: number,
  view: string | null,
  reference: boolean,
  design: boolean,
) {
  return (
    !reference &&
    !design &&
    view !== "mobile" &&
    (view === "desktop" || width >= 600)
  );
}

// Resizing an active editor must not replace its controller and discard inputs.
// Choose its presentation when entering the flow; CSS handles later resizing.
export function editingFlow(path: string) {
  if (path === "/comments/write") return "comment";
  if (path === "/publish" || path.startsWith("/publish/")) return "publish";
  if (/^\/foods\/\d+\/edit$/.test(path)) return path;
  if (/^\/restaurants\/\d+\/edit$/.test(path)) return path;
  if (path === "/restaurants/new" || path === "/restaurants/new/details")
    return "new-shop";
  if (path === "/auth" || path.startsWith("/auth/")) return "auth";
  return null;
}
