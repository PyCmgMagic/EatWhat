// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDiscoveryCategory } from "./discovery-category";
import { RouteContinuityProvider, useReturnTo } from "./navigation";

let host: HTMLDivElement, root: Root, navigate: NavigateFunction;
function Home() {
  const [category, setCategory] = useDiscoveryCategory();
  return (
    <>
      <output data-testid="category">{category}</output>
      <button onClick={() => setCategory("staple")}>主食</button>
      <button onClick={() => setCategory("snack")}>小吃</button>
      <button onClick={() => setCategory("")}>今日推荐</button>
      <Link to="/foods/1">查看菜品</Link>
    </>
  );
}
function Detail() {
  const back = useReturnTo("/");
  return <Link to={back}>返回</Link>;
}
function Probe() {
  navigate = useNavigate();
  const location = useLocation();
  return (
    <>
      <output data-testid="address">
        {location.pathname + location.search}
      </output>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/foods/:id" element={<Detail />} />
        <Route path="/nearby" element={<p>附近</p>} />
      </Routes>
    </>
  );
}
async function mount(path = "/") {
  await act(() =>
    root.render(
      <MemoryRouter initialEntries={["/nearby", path]} initialIndex={1}>
        <RouteContinuityProvider>
          <Probe />
        </RouteContinuityProvider>
      </MemoryRouter>,
    ),
  );
}
async function click(text: string) {
  const element = [...host.querySelectorAll<HTMLElement>("button,a")].find(
    (element) => element.textContent === text,
  )!;
  await act(() => element.click());
}
const selected = () =>
  host.querySelector('[data-testid="category"]')?.textContent;
const address = () =>
  host.querySelector('[data-testid="address"]')?.textContent;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each(["返回", "浏览器后退"])(
  "restores the category through %s after discovery remounts",
  async (back) => {
    await mount();
    await click("主食");
    await click("查看菜品");
    expect(host.querySelector("a")?.getAttribute("href")).toBe(
      "/?category=staple",
    );
    if (back === "返回") await click("返回");
    else await act(() => navigate(-1));
    expect(selected()).toBe("staple");
  },
);
it("restores a direct category URL and preserves other filters when switching or clearing it", async () => {
  await mount("/?category=drink&meal=lunch");
  expect(selected()).toBe("drink");
  await click("小吃");
  expect(address()).toBe("/?category=snack&meal=lunch");
  await click("今日推荐");
  expect(selected()).toBe("");
  expect(address()).toBe("/?meal=lunch");
});
it("does not add a browser history entry for each category switch", async () => {
  await mount();
  await click("主食");
  await click("小吃");
  await act(() => navigate(-1));
  expect(address()).toBe("/nearby");
});
it("falls back to today's recommendations for unknown categories", async () => {
  await mount("/?category=unknown");
  expect(selected()).toBe("");
});
