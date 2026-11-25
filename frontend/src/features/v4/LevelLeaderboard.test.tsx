// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProfileWorkspaceContext } from "../../app/profile-workspace";
import LevelLeaderboard from "./LevelLeaderboard";

const { api, identity } = vi.hoisted(() => ({
  api: { levelLeaderboard: vi.fn(), userFoods: vi.fn() },
  identity: { id: 10 },
}));
vi.mock("../../app/state", () => ({ useApp: () => ({ api, user: identity }) }));

let host: HTMLDivElement;
let root: Root;
const board = [
  {
    rank: 1,
    id: 11,
    displayName: "椒盐小卷",
    level: 10,
    title: "老吃家",
    coverUrl: "https://images.example.test/pork.jpg",
  },
  {
    rank: 2,
    id: 12,
    displayName: "柚子冰茶",
    level: 9,
    coverUrl: "https://images.example.test/noodles.jpg",
  },
  { rank: 3, id: 13, displayName: "今天想吃饭", level: 8 },
  { rank: 4, id: 10, displayName: "阿禾", level: 5 },
  { rank: 5, id: 15, displayName: "栗子", level: 3 },
];

async function render(desktop = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/me/growth/leaderboard"]}>
          <ProfileWorkspaceContext.Provider value={desktop}>
            <LevelLeaderboard />
          </ProfileWorkspaceContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

async function until(check: () => unknown) {
  for (let i = 0; i < 50 && !check(); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
  expect(check()).toBeTruthy();
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  identity.id = 10;
  api.levelLeaderboard.mockReset().mockResolvedValue(board);
  api.userFoods.mockReset().mockResolvedValue({ items: [] });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("uses the desktop cover URLs returned by the leaderboard and focuses the viewer's row", async () => {
  api.levelLeaderboard.mockResolvedValue([...board].reverse());
  await render(true);
  await until(() => host.querySelector('.level-board-place[data-rank="2"] .level-board-cover img'));
  expect(
    Array.from(
      host.querySelectorAll<HTMLImageElement>(".level-board-cover img"),
      (image) => image.src,
    ),
  ).toEqual([board[0].coverUrl, board[1].coverUrl]);
  expect(
    host.querySelector('.level-board-place[data-rank="3"] .level-board-cover'),
  ).toBeNull();
  const second = host.querySelector('.level-board-place[data-rank="2"]')!;
  await act(async () =>
    second.querySelector(".level-board-cover img")!.dispatchEvent(new Event("error")),
  );
  expect(second.querySelector(".level-board-cover")).toBeNull();
  expect(second.querySelector('a[href="/users/12"]')).toBeTruthy();
  expect(api.userFoods).not.toHaveBeenCalled();
  expect(host.querySelectorAll(".level-board-table tbody tr")).toHaveLength(2);
  const row = host.querySelector<HTMLTableRowElement>("tr[data-own]")!;
  row.scrollIntoView = vi.fn();
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".level-board-my-rank")!.click(),
  );
  expect(document.activeElement).toBe(row);
  expect(row.scrollIntoView).toHaveBeenCalledWith({
    block: "center",
    behavior: "instant",
  });
});

it("keeps the mobile podium compact and shows when the viewer is outside the board", async () => {
  identity.id = 99;
  await render();
  await until(() => host.querySelector(".level-board-unranked"));
  expect(host.querySelector(".level-board-unranked")?.textContent).toBe(
    "未进入前 50 名",
  );
  expect(host.querySelector(".level-board-my-rank")).toBeNull();
  expect(
    Array.from(
      host.querySelectorAll<HTMLImageElement>(".level-board-cover img"),
      (image) => image.src,
    ),
  ).toEqual([board[0].coverUrl]);
  expect(api.userFoods).not.toHaveBeenCalled();
  expect(host.querySelector(".v4-breadcrumb a")?.getAttribute("href")).toBe(
    "/me/growth",
  );
});
