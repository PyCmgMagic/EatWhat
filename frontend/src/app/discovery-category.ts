import { useSearchParams } from "react-router-dom";
import { foodCategories } from "../api/v2-vocab";

const categoryIds = new Set<string>(foodCategories.map(({ id }) => id));

/** Keep the selected feed in the return address when discovery unmounts. */
export function useDiscoveryCategory() {
  const [params, setParams] = useSearchParams();
  const value = params.get("category") ?? "";
  const category = categoryIds.has(value) ? value : "";
  const setCategory = (next: string) => {
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (categoryIds.has(next)) updated.set("category", next);
        else updated.delete("category");
        return updated;
      },
      { replace: true },
    );
  };
  return [category, setCategory] as const;
}
