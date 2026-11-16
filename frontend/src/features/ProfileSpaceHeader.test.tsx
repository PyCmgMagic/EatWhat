// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppProvider } from "../app/context";
import { writeSession } from "../app/runtime";
import ProfileSpaceHeader from "./ProfileSpaceHeader";

let host: HTMLDivElement;
let root: Root;
let resolveFoods: (response: Response) => void;
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
  writeSession({ tokenName: "satoken", tokenValue: "profile-cover" });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const path = String(input).split("?")[0];
      if (path.endsWith("/user/info"))
        return Promise.resolve(
          ok({ id: 11, displayName: "食友甲", verified: true, banned: false }),
        );
      if (path.endsWith("/foods/my"))
        return new Promise<Response>((resolve) => {
          resolveFoods = resolve;
        });
      return Promise.resolve(ok({ items: [], hasNext: false }));
    }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={["/me"]}>
          <ProfileSpaceHeader />
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

it("uses a neutral loading stage before applying the real cover color", async () => {
  await spin(() => !!host.querySelector(".profile-overview-hero"));
  const hero = host.querySelector<HTMLElement>(".profile-overview-hero")!;
  expect(hero.getAttribute("aria-busy")).toBe("true");
  expect(hero.style.getPropertyValue("--profile-stage")).toBe("#E8E1D8");
  expect(host.querySelector(".profile-overview-cover img")).toBeNull();
  await spin(() => typeof resolveFoods === "function");
  await act(async () => {
    resolveFoods(
      ok({
        items: [
          {
            id: 71,
            name: "真实菜品",
            pictureUrl: ["/real-cover.jpg"],
            stageColor: "porcelain",
          },
        ],
        hasNext: false,
      }),
    );
  });
  await spin(() => hero.getAttribute("aria-busy") === "false");
  expect(hero.style.getPropertyValue("--profile-stage")).toBe("#9DB8D9");
  expect(
    host.querySelector(".profile-overview-cover img")?.getAttribute("src"),
  ).toBe("/real-cover.jpg");
});
