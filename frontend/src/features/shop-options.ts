import { useQuery } from "@tanstack/react-query";
import { useApp } from "../app/state";
import { dislikableTags, shopCategories, tasteTags } from "../api/v2-vocab";

/**
 * Shop categories and tastes come from the backend (GET /recommend/tags), so
 * a category added there shows up without a frontend change. The built-in
 * lists only cover the moment before the answer arrives or a failed request.
 */
export function useShopOptions() {
  const { api } = useApp();
  const q = useQuery({
    queryKey: ["shop-options"],
    queryFn: () => api.shopOptions(),
    staleTime: 3_600_000,
  });
  const pick = (value: string[] | null | undefined, fallback: string[]) =>
    value?.length ? value : fallback;
  return {
    categories: pick(q.data?.categories, shopCategories),
    tags: pick(q.data?.tags, tasteTags),
    dislikableTags: pick(q.data?.dislikableTags, dislikableTags),
  };
}
