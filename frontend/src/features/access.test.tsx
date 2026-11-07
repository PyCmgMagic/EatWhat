// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HashRouter, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VerificationDialogProvider } from "../app/verification-dialog";
import { ActionAccessPrompts, showAccessPrompt } from "../app/access-prompt";
import { createApi } from "../api/service";
import { withActionAccess } from "../api/access";
import type { Session } from "../api/client";
import { useFoodActions } from "../components/FoodCard";
import { useActionAccess } from "./access";

const state = vi.hoisted(() => ({
  app: {
    session: { tokenName: "test", tokenValue: "test" } as object | null,
    user: { verified: false, banned: false } as
      { verified: boolean; banned: boolean } | undefined,
    toast: vi.fn(),
    api: {
      favorite: (async () => null) as (
        id: number,
        saved: boolean,
      ) => Promise<unknown>,
    },
  },
  remote: { data: {} as { maintenance?: { mode: string } } },
  login: vi.fn(),
  action: vi.fn(),
  favorite: false as boolean | null,
  favoriteRequest: vi.fn(),
  serverDenial: false,
}));
vi.mock("../app/state", () => ({ useApp: () => state.app }));
vi.mock("./v4/Remote", () => ({ useRemoteConfig: () => state.remote }));
vi.mock("../app/auth-dialog", () => ({
  useLoginDialog: () => ({ openLogin: state.login }),
  LoginLink: () => null,
}));

function Page() {
  const access = useActionAccess(),
    location = useLocation(),
    navigate = useNavigate();
  const foodActions = useFoodActions({ id: 7, isFavorite: state.favorite });
  return (
    <>
      <output>{location.pathname + location.search}</output>
      <input aria-label="草稿" defaultValue="保留的内容" />
      <button
        data-testid="like"
        onClick={() => {
          if (access(true)) state.action();
        }}
      >
        喜欢
      </button>
      <button
        data-testid="favorite"
        disabled={foodActions.favoriteDisabled}
        onClick={foodActions.favorite}
      >
        收藏
      </button>
      <button
        data-testid="unfavorite"
        onClick={() => {
          if (access()) state.action();
        }}
      >
        取消收藏
      </button>
      <button
        data-testid="leave"
        onClick={() => void navigate("/restaurants/1")}
      >
        离开
      </button>
    </>
  );
}
let root: Root, container: HTMLDivElement, cache: QueryClient;
const showModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const closeModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);
const dialog = () =>
  document.querySelector<HTMLDialogElement>(".ew-verification-dialog");
const pagePath = () => container.querySelector("output")?.textContent;
const control = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;
async function click(element: HTMLElement) {
  await act(async () => {
    element.click();
  });
}
async function render() {
  await act(async () =>
    root.render(
      <QueryClientProvider client={cache}>
        <HashRouter>
          <VerificationDialogProvider>
            <ActionAccessPrompts />
            <Page />
          </VerificationDialogProvider>
        </HashRouter>
      </QueryClientProvider>,
    ),
  );
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function () {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function () {
      this.open = false;
    },
  });
  window.history.replaceState(null, "", "/#/foods/7?from=home");
  state.app.session = { tokenName: "test", tokenValue: "test" };
  state.app.user = { verified: false, banned: false };
  state.remote.data = {};
  state.favorite = false;
  state.serverDenial = false;
  vi.clearAllMocks();
  state.app.api.favorite = createApi(
    withActionAccess(
      async (path) => {
        state.favoriteRequest(7, path.endsWith("/unfavorite"));
        return state.serverDenial
          ? { code: 20004, msg: "权限不足：用户未验证" }
          : { code: 0, data: null };
      },
      {
        session: () => state.app.session as Session | null,
        user: () => state.app.user,
        loadUser: async () => state.app.user!,
        context: () => window.location.hash,
        prompt: showAccessPrompt,
      },
    ),
  ).favorite;
  cache = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  cache.clear();
  container.remove();
  vi.unstubAllGlobals();
  if (showModal)
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (closeModal)
    Object.defineProperty(HTMLDialogElement.prototype, "close", closeModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

it("prompts before verification, blocks the action and preserves the page and draft on cancellation", async () => {
  await render();
  control("like").focus();
  await click(control("like"));
  expect(dialog()?.open).toBe(true);
  expect(pagePath()).toBe("/foods/7?from=home");
  expect(state.action).not.toHaveBeenCalled();
  await click(control("like"));
  expect(document.querySelectorAll(".ew-verification-dialog")).toHaveLength(1);
  await click(
    document.querySelector<HTMLButtonElement>(".ew-verification-later")!,
  );
  expect(dialog()).toBeNull();
  expect(pagePath()).toBe("/foods/7?from=home");
  expect(container.querySelector("input")?.value).toBe("保留的内容");
  expect(document.activeElement).toBe(control("like"));
});
it("navigates only after confirmation and preserves a return destination", async () => {
  await render();
  await click(control("like"));
  await click(
    document.querySelector<HTMLButtonElement>(".ew-verification-go")!,
  );
  expect(pagePath()).toBe("/verify?next=%2Ffoods%2F7%3Ffrom%3Dhome");
  expect(window.history.state.usr.returnTo).toBe("/foods/7?from=home");
  expect(dialog()).toBeNull();
  expect(state.action).not.toHaveBeenCalled();
});
it("Escape closes the prompt without navigating", async () => {
  await render();
  await click(control("like"));
  await act(async () => {
    dialog()!.dispatchEvent(new Event("cancel", { cancelable: true }));
  });
  expect(dialog()).toBeNull();
  expect(pagePath()).toBe("/foods/7?from=home");
});
it("keeps guest login and verified actions working", async () => {
  state.app.session = null;
  state.app.user = undefined;
  await render();
  await click(control("like"));
  expect(state.login).toHaveBeenCalledWith(
    "/auth/password?next=%2Ffoods%2F7%3Ffrom%3Dhome",
  );
  expect(dialog()).toBeNull();
  state.app.session = {};
  state.app.user = { verified: true, banned: false };
  await render();
  await click(control("like"));
  expect(state.action).toHaveBeenCalledTimes(1);
  expect(dialog()).toBeNull();
});
it("does not add a verification requirement to login-only actions", async () => {
  await render();
  await click(control("unfavorite"));
  expect(state.action).toHaveBeenCalledTimes(1);
  expect(dialog()).toBeNull();
});
it.each([false, null])(
  "prompts before adding a favorite when the saved state is %s",
  async (saved) => {
    state.favorite = saved;
    await render();
    await click(control("favorite"));
    expect(dialog()?.open).toBe(true);
    expect(dialog()?.textContent).toContain("收藏");
    expect(state.favoriteRequest).not.toHaveBeenCalled();
    expect(pagePath()).toBe("/foods/7?from=home");
  },
);
it.each([
  { verified: true, saved: false },
  { verified: false, saved: true },
])("allows a valid favorite action with %o", async ({ verified, saved }) => {
  state.app.user!.verified = verified;
  state.favorite = saved;
  await render();
  await click(control("favorite"));
  expect(state.favoriteRequest).toHaveBeenCalledExactlyOnceWith(7, saved);
  expect(dialog()).toBeNull();
});
it("asks guests to log in before adding a favorite", async () => {
  state.app.session = null;
  state.app.user = undefined;
  await render();
  await click(control("favorite"));
  expect(state.login).toHaveBeenCalledWith(
    "/auth/password?next=%2Ffoods%2F7%3Ffrom%3Dhome",
    { returnFocus: undefined },
  );
  expect(state.favoriteRequest).not.toHaveBeenCalled();
  expect(dialog()).toBeNull();
});
it("keeps the server-required prompt open when cached verification is stale, without success feedback", async () => {
  state.app.user!.verified = true;
  state.serverDenial = true;
  await render();
  await click(control("favorite"));
  expect(dialog()?.open).toBe(true);
  expect(state.favoriteRequest).toHaveBeenCalledTimes(1);
  expect(
    state.app.toast.mock.calls.filter(([message]) => message),
  ).toHaveLength(0);
  await click(
    document.querySelector<HTMLButtonElement>(".ew-verification-later")!,
  );
  expect(dialog()).toBeNull();
  expect(pagePath()).toBe("/foods/7?from=home");
  expect(state.favoriteRequest).toHaveBeenCalledTimes(1);
});
it("preserves banned and maintenance restrictions", async () => {
  state.app.user!.banned = true;
  await render();
  await click(control("like"));
  expect(state.app.toast).toHaveBeenCalled();
  expect(dialog()).toBeNull();
  state.app.user!.banned = false;
  state.remote.data = { maintenance: { mode: "READ_ONLY" } };
  await render();
  await click(control("like"));
  expect(state.action).not.toHaveBeenCalled();
  expect(dialog()).toBeNull();
});
it("clears stale prompts when leaving the page or when verification status updates", async () => {
  await render();
  await click(control("like"));
  await click(control("leave"));
  expect(dialog()).toBeNull();
  await click(control("like"));
  state.app.user = { verified: true, banned: false };
  await render();
  expect(dialog()).toBeNull();
  expect(state.action).not.toHaveBeenCalled();
});
