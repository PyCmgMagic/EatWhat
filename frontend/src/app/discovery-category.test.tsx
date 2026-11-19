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
      <button onClick={() => setCategory("drink")}>甜点饮品</button>
      <button onClick={() => setCategory("buffet")}>自助</button>
      <button onClick={() => setCategory("food")}>美食</button>
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
    await click("甜点饮品");
    await click("查看菜品");
    expect(host.querySelector("a")?.getAttribute("href")).toBe(
      "/?category=drink",
    );
    if (back === "返回") await click("返回");
    else await act(() => navigate(-1));
    expect(selected()).toBe("drink");
  },
);
it("restores a direct category URL and preserves other filters when switching or clearing it", async () => {
  await mount("/?category=drink&meal=lunch");
  expect(selected()).toBe("drink");
  await click("自助");
  expect(address()).toBe("/?category=buffet&meal=lunch");
  await click("美食");
  expect(selected()).toBe("food");
  expect(address()).toBe("/?meal=lunch");
});
it("does not add a browser history entry for each category switch", async () => {
  await mount();
  await click("甜点饮品");
  await click("自助");
  await act(() => navigate(-1));
  expect(address()).toBe("/nearby");
});
it.each(["snack", "unknown"])(
  "opens the food tab for the old or unknown category %s",
  async (category) => {
    await mount(`/?category=${category}`);
    expect(selected()).toBe("food");
  },
);
