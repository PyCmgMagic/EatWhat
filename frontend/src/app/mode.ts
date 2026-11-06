export function demoEnabled(
  search: string,
  development: boolean,
  demoBuild = false,
) {
  return (
    (development || demoBuild) &&
    new URLSearchParams(search).get("demo") === "1"
  );
}
