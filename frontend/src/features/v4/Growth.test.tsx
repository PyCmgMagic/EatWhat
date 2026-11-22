// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppProvider } from "../../app/context";
import { writeSession } from "../../app/runtime";
import Growth from "./Growth";

let host: HTMLDivElement;
let root: Root;
const ok = (data: unknown) => new Response(JSON.stringify({ code: 0, data }));

async function spin(condition: () => boolean) {
  for (let i = 0; i < 70 && !condition(); i++)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  expect(condition(), "test setup condition").toBe(true);
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  sessionStorage.clear();
  writeSession({ tokenName: "satoken", tokenValue: "growth" });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path = String(input).split("?")[0];
      if (path.endsWith("/user/info"))
        return Promise.resolve(
          ok({ id: 11, displayName: "食友甲", verified: true, banned: false }),
        );
      if (path.endsWith("/user/titles")) return Promise.resolve(ok([]));
      if (path.endsWith("/user/level/logs"))
        return Promise.resolve(
          ok({
            items: [
              {
                id: 1,
                day: "2026-11-16",
                source: "daily_use",
                amount: 5,
                createdAt: new Date(Date.UTC(2026, 10, 16, 4, 30)).toISOString(),
              },
            ],
            currentPage: 1,
            totalItems: 1,
            totalPages: 1,
            hasNext: false,
          }),
        );
      if (path.endsWith("/user/level"))
        return Promise.resolve(
          ok({
            experience: 80,
            level: 2,
            levelExperience: 30,
            nextLevelExperience: 100,
            toNextLevel: 20,
            maxLevel: false,
            dailyUseExperience: 5,
            title: null,
            rules: [
              { source: "daily_use", name: "每日使用", amount: 5, dailyCap: 1 },
              {
                source: "food_published",
                name: "发布菜品",
                amount: 15,
                dailyCap: 3,
              },
            ],
          }),
        );
      return Promise.resolve(ok({ items: [], hasNext: false }));
    }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={["/me/growth"]}>
          <Growth />
        </MemoryRouter>
      </AppProvider>,
    ),
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  writeSession(null);
  vi.unstubAllGlobals();
});

it("tucks the experience rules and ledger into collapsed entries", async () => {
  await spin(() => !!host.querySelector(".growth-rules"));
  await spin(() => !!host.querySelector(".growth-ledger li"));

  const rules = host.querySelector<HTMLDetailsElement>(".growth-rules")!;
  const records = host.querySelector<HTMLDetailsElement>(
    ".growth-records > details",
  )!;
  expect(rules.open).toBe(false);
  expect(records.open).toBe(false);
  expect(host.textContent).toContain("怎么获得经验");
  expect(host.textContent).toContain("2 种途径");
  expect(host.textContent).toContain("经验记录");
  expect(host.textContent).toContain("共 1 条");
  expect(host.querySelectorAll(".growth-rules li")).toHaveLength(2);
  expect(host.querySelector(".growth-ledger li")!.textContent).toContain(
    "所属日期 2026-11-16",
  );

  await act(async () =>
    host
      .querySelector<HTMLElement>(".growth-records > details > summary")!
      .click(),
  );
  expect(records.open).toBe(true);

  await act(async () =>
    host.querySelector<HTMLElement>(".growth-rules > summary")!.click(),
  );
  expect(rules.open).toBe(true);
});
