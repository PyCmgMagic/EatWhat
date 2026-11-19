import { useSearchParams } from "react-router-dom";
export const discoveryKinds = [
  { id: "food", name: "美食" },
  { id: "drink", name: "甜点饮品" },
  { id: "buffet", name: "自助" },
] as const;
export type DiscoveryKind = (typeof discoveryKinds)[number]["id"];

/** Keep the selected feed in the return address when discovery unmounts. */
export function useDiscoveryCategory() {
  const [params, setParams] = useSearchParams();
  const value = params.get("category");
  const category = discoveryKinds.find(({ id }) => id === value)?.id ?? "food";
  const setCategory = (next: DiscoveryKind) => {
    if (next === category && (!value || value === next)) return;
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next !== "food") updated.set("category", next);
        else updated.delete("category");
        return updated;
      },
      { replace: true, state: { preserveScroll: true } },
    );
  };
  return [category, setCategory] as const;
}
