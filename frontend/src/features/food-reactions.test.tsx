// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Food } from "../api/models";
import { useFoodReaction } from "./food-reactions";

const { api } = vi.hoisted(() => ({
  api: {
    like: vi.fn(),
    favorite: vi.fn(),
  },
}));

vi.mock("../app/state", async (original) => ({
  ...(await original<object>()),
  useApp: () => ({ api }),
}));

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  api.like.mockReset();
  api.favorite.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

let serverFood: Food = { id: 71 };

function Probe({
  foodId,
  onError,
}: {
  foodId: number;
  onError?: (e: unknown) => void;
}) {
  const query = useQuery<Food>({
    queryKey: ["foods", "detail", foodId],
    queryFn: () => ({ ...serverFood }),
    staleTime: Infinity,
  });
  const reactions = useFoodReaction({
    foodId,
    food: query.data,
    onError,
  });
  return (
    <div>
      <button
        type="button"
        data-testid="fav"
        aria-pressed={query.data?.isFavorite === true}
        onClick={() => void reactions.toggle("favorite")}
      />
      <button
        type="button"
        data-testid="like"
        aria-pressed={query.data?.isLiked === true}
        onClick={() => void reactions.toggle("like")}
      >
        {query.data?.likesCount ?? 0}
      </button>
    </div>
  );
}

async function mountProbe(
  initial: Food,
  onError?: (e: unknown) => void,
): Promise<QueryClient> {
  serverFood = { ...initial };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["foods", "detail", initial.id], initial);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Probe foodId={initial.id!} onError={onError} />
      </QueryClientProvider>,
    ),
  );
  return client;
}

async function flushCache() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.click();
    await flushCache();
  });
}

it("updates detail cache synchronously and serializes rapid taps without dropping toggles", async () => {
  let resolveFirst!: () => void;
  let resolveSecond!: () => void;
  api.favorite
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSecond = resolve;
        }),
    );

  const client = await mountProbe({
    id: 71,
    isFavorite: false,
    isLiked: false,
    likesCount: 2,
  });
  const fav = host.querySelector<HTMLButtonElement>('[data-testid="fav"]')!;

  await click(fav);
  expect(fav.getAttribute("aria-pressed")).toBe("true");
  expect(api.favorite).toHaveBeenCalledTimes(1);
  expect(api.favorite).toHaveBeenNthCalledWith(1, 71, false);

  await click(fav);
  expect(
    client.getQueryData<Food>(["foods", "detail", 71])?.isFavorite,
  ).toBe(false);
  expect(fav.getAttribute("aria-pressed")).toBe("false");
  // Second tap is queued until the first request settles.
  expect(api.favorite).toHaveBeenCalledTimes(1);

  await act(async () => {
    serverFood = { ...serverFood, isFavorite: true };
    resolveFirst();
    await flushCache();
  });
  expect(api.favorite).toHaveBeenCalledTimes(2);
  expect(api.favorite).toHaveBeenNthCalledWith(2, 71, true);

  await act(async () => {
    serverFood = { ...serverFood, isFavorite: false };
    resolveSecond();
    await flushCache();
  });
  expect(
    client.getQueryData<Food>(["foods", "detail", 71])?.isFavorite,
  ).toBe(false);
});

it("rolls back the detail cache and reports errors when the API rejects", async () => {
  const onError = vi.fn();
  let rejectLike!: (err: Error) => void;
  api.like.mockImplementationOnce(
    () =>
      new Promise<void>((_, reject) => {
        rejectLike = reject;
      }),
  );

  const client = await mountProbe(
    { id: 71, isFavorite: false, isLiked: false, likesCount: 4 },
    onError,
  );
  const like = host.querySelector<HTMLButtonElement>('[data-testid="like"]')!;

  await click(like);
  expect(client.getQueryData<Food>(["foods", "detail", 71])).toMatchObject({
    isLiked: true,
    likesCount: 5,
  });
  expect(like.getAttribute("aria-pressed")).toBe("true");
  expect(like.textContent).toBe("5");

  const err = new Error("offline");
  await act(async () => {
    rejectLike(err);
    await flushCache();
  });

  expect(onError).toHaveBeenCalledWith(err);
  expect(like.getAttribute("aria-pressed")).toBe("false");
  expect(like.textContent).toBe("4");
  expect(client.getQueryData<Food>(["foods", "detail", 71])).toMatchObject({
    isLiked: false,
    likesCount: 4,
  });
});
