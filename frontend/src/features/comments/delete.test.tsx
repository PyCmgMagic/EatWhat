// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../../app/runtime", () => ({
  isDemo: false,
  sessionSignal: () => new AbortController().signal,
}));
vi.mock("../access", () => ({ useActionAccess: () => () => true }));
vi.mock("../../app/area", () => ({ useArea: () => ({ campusId: 1 }) }));
import { AppContext, type AppState } from "../../app/state";
import { FoodDiscussion } from "./Comments";

const mine = { id: 8, restaurantId: 5, authorId: 10, authorName: "我", text: "我写的", replyCount: 0 };
const other = { id: 9, restaurantId: 5, authorId: 22, authorName: "食友", text: "别人写的", replyCount: 1 };
const myReply = { id: 11, restaurantId: 5, rootId: 9, authorId: 10, authorName: "我", text: "我的回复" };
let host: HTMLDivElement, root: Root;
let rows: object[];
const remove = vi.fn();
const Where = () => <output>{useLocation().search}</output>;
const settle = () => act(() => new Promise((r) => setTimeout(r, 30)));
const button = (text: string) =>
  [...document.querySelectorAll("button")].filter((b) => b.textContent === text);
const click = async (b: HTMLElement) => {
  await act(async () => b.click());
  await settle();
};

async function render({ session = true, search = "" } = {}) {
  const app = {
    user: session ? { id: 10 } : undefined,
    session: session ? { tokenName: "t", tokenValue: "v" } : null,
    toast: vi.fn(),
    api: {
      restaurantComments: async () => ({ items: rows, totalItems: rows.length }),
      commentReplies: async () => ({ items: [myReply], totalItems: 1 }),
      commentDetail: async () => mine,
      commentLike: async () => ({ liked: false, likesCount: 0 }),
      deleteComment: remove,
    },
  } as unknown as AppState;
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[`/restaurants/5${search}`]}>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          <AppContext.Provider value={app}>
            <FoodDiscussion food={{ id: 5, name: "小店" }} restaurant />
            <Where />
          </AppContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  await settle();
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  HTMLDialogElement.prototype.showModal ??= function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function () {
    this.removeAttribute("open");
  };
  sessionStorage.clear();
  rows = [mine, other];
  remove.mockReset().mockImplementation(async (id: number) => {
    rows = rows.filter((r) => (r as { id: number }).id !== id);
    return {};
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("offers deletion only on the viewer's own comments and replies", async () => {
  await render();
  expect(
    button("删除").map((b) => b.closest("article")!.getAttribute("aria-label")),
  ).toEqual(["我的评论", "我的回复"]);
});

it("offers nothing to guests", async () => {
  await render({ session: false });
  expect(button("删除")).toHaveLength(0);
});

it("deletes after confirmation and refreshes the list", async () => {
  await render();
  await click(button("删除")[0]);
  expect(document.body.textContent).toContain("所有回复将不再展示");
  expect(remove).not.toHaveBeenCalled();
  await click(button("确认删除")[0]);
  expect(remove).toHaveBeenCalledWith(8, expect.any(String));
  expect(host.textContent).not.toContain("我写的");
  expect(host.textContent).toContain("别人写的");
});

it("returns to the full list when the linked comment is deleted", async () => {
  await render({ search: "?commentId=8" });
  await click(button("删除")[0]);
  await click(button("确认删除")[0]);
  expect(host.querySelector("output")!.textContent).not.toContain("commentId");
  expect(host.textContent).toContain("别人写的");
});

it("keeps the comment and shows the error when deletion fails", async () => {
  remove.mockRejectedValue(new Error("删除失败"));
  await render();
  await click(button("删除")[0]);
  await click(button("确认删除")[0]);
  expect(document.querySelector('dialog [role="alert"]')).not.toBeNull();
  expect(host.textContent).toContain("我写的");
});
