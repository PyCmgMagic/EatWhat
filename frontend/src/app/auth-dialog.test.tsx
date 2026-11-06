// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { HashRouter, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LoginDialogProvider,
  LoginLink,
  useAuthBusy,
  useAuthFlow,
  useLoginDialog,
} from "./auth-dialog";
import { getConsentProof, setConsentProof } from "./consent";

type Flow = ReturnType<typeof useAuthFlow>;
let currentFlow: Flow;
const mounted = vi.fn(),
  unmounted = vi.fn();

// Exercise the real provider, router and flow hooks without issuing credentials
// or importing unrelated application services from the production forms.
vi.mock("../components/AuthDialogContent", () => ({
  default: function AuthContent({ path }: { path: string }) {
    currentFlow = useAuthFlow();
    const [busy, setBusy] = useState(false);
    const [policyOpen, setPolicyOpen] = useState(false);
    useAuthBusy(busy);
    return (
      <section data-testid="auth-content" data-path={path}>
        <input aria-label="登录账号" defaultValue="" />
        <output data-testid="auth-search">{currentFlow.location.search}</output>
        <Link data-testid="register" to="/auth/username-register">
          注册
        </Link>
        <Link data-testid="forgot" to="/auth/forgot">
          找回密码
        </Link>
        <Link
          data-testid="phone"
          to="/auth/register?next=%2Fsettings%2Fpassword"
        >
          手机重置密码
        </Link>
        <Link data-testid="password" to="/auth">
          密码登录
        </Link>
        <button
          data-testid="consent"
          onClick={() => currentFlow.navigate("/auth/consent")}
        >
          授权确认
        </button>
        <button data-testid="finish" onClick={() => currentFlow.finish("/me")}>
          完成登录
        </button>
        <button data-testid="busy" onClick={() => setBusy((value) => !value)}>
          切换提交状态
        </button>
        <button data-testid="open-policy" onClick={() => setPolicyOpen(true)}>
          查看授权政策
        </button>
        {policyOpen &&
          createPortal(
            <dialog
              open
              data-testid="policy-dialog"
              onCancel={(event) => {
                event.preventDefault();
                setPolicyOpen(false);
              }}
            >
              授权政策正文
            </dialog>,
            document.body,
          )}
      </section>
    );
  },
}));

function Background({ loginTo = "/auth" }: { loginTo?: string }) {
  const location = useLocation(),
    navigate = useNavigate();
  const { openLogin } = useLoginDialog();
  const [draft, setDraft] = useState("");
  useEffect(() => {
    mounted();
    return () => {
      unmounted();
    };
  }, []);
  return (
    <main>
      <output data-testid="page-path">
        {location.pathname + location.search + location.hash}
      </output>
      <output data-testid="page-key">{location.key}</output>
      <input
        aria-label="未发送评论"
        value={draft}
        onInput={(event) => setDraft(event.currentTarget.value)}
      />
      <LoginLink data-testid="open-login" to={loginTo}>
        登录
      </LoginLink>
      <button
        data-testid="open-again"
        onClick={() => openLogin("/auth/register")}
      >
        再次请求登录
      </button>
      <button
        data-testid="leave"
        onClick={() => void navigate("/restaurants/4")}
      >
        离开原页
      </button>
      <LoginLink data-testid="normal-link" to="/verify">
        学生认证
      </LoginLink>
    </main>
  );
}

function Standalone() {
  currentFlow = useAuthFlow();
  return (
    <output data-testid="page-path">
      {currentFlow.location.pathname + currentFlow.location.search}
    </output>
  );
}

let container: HTMLDivElement, root: Root;
const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);
const element = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.querySelector<T>(`[data-testid="${id}"]`)!;
const dialog = () =>
  document.querySelector<HTMLDialogElement>(".ew-login-dialog");
const closeButton = () =>
  document.querySelector<HTMLButtonElement>('[aria-label="关闭登录"]')!;
const route = () => element("page-path").textContent;
const authPath = () => element("auth-content").dataset.path;

async function click(node: HTMLElement) {
  await act(async () => {
    node.click();
  });
}
async function cancel() {
  await act(async () => {
    dialog()!.dispatchEvent(new Event("cancel", { cancelable: true }));
  });
}
async function render(
  path = "/foods/7?sort=popular#comments",
  loginTo = "/auth",
) {
  window.history.replaceState(null, "", "/#" + path);
  await act(async () => {
    root.render(
      <HashRouter>
        <LoginDialogProvider>
          <Background loginTo={loginTo} />
        </LoginDialogProvider>
      </HashRouter>,
    );
  });
}
async function renderStandalone(path: string) {
  window.history.replaceState(null, "", "/#" + path);
  await act(async () => {
    root.render(
      <HashRouter>
        <Standalone />
      </HashRouter>,
    );
  });
}
async function writeDraft(value: string) {
  const input = document.querySelector<HTMLInputElement>(
    '[aria-label="未发送评论"]',
  )!;
  await act(async () => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom has no browser top layer. Keep native visibility state while testing
  // React cancellation, focus restoration and routing rather than simulating it.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  document.body.style.overflow = "";
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  mounted.mockClear();
  unmounted.mockClear();
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  document.body.style.overflow = "";
  vi.restoreAllMocks();
  if (originalShowModal)
    Object.defineProperty(
      HTMLDialogElement.prototype,
      "showModal",
      originalShowModal,
    );
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose)
    Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

describe("login dialog preserves the active page", () => {
  it("opens without navigating or remounting the page, and keeps the unfinished draft", async () => {
    await render();
    const input = await writeDraft("这家店的面很好吃，稍后补充照片");
    const hash = window.location.hash,
      key = element("page-key").textContent;
    await click(element("open-login"));
    expect(dialog()?.open).toBe(true);
    expect(authPath()).toBe("/auth");
    expect(window.location.hash).toBe(hash);
    expect(element("page-key").textContent).toBe(key);
    expect(document.querySelector('[aria-label="未发送评论"]')).toBe(input);
    expect(input.value).toBe("这家店的面很好吃，稍后补充照片");
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  });

  it("switches registration, password recovery and consent inside the modal only", async () => {
    await render();
    const hash = window.location.hash;
    await click(element("open-login"));
    await click(element("register"));
    expect(authPath()).toBe("/auth/username-register");
    await click(element("forgot"));
    expect(authPath()).toBe("/auth/forgot");
    await click(element("consent"));
    expect(authPath()).toBe("/auth/consent");
    await click(element("password"));
    expect(authPath()).toBe("/auth");
    expect(window.location.hash).toBe(hash);
    expect(mounted).toHaveBeenCalledTimes(1);
  });

  it("restores focus and scroll on cancel and starts a fresh form on reopen", async () => {
    await render();
    document.body.style.overflow = "auto";
    const trigger = element("open-login");
    trigger.focus();
    await click(trigger);
    const input = document.querySelector<HTMLInputElement>(
      '[aria-label="登录账号"]',
    )!;
    input.value = "previous-account";
    input.focus();
    setConsentProof("temporary-consent-proof");
    expect(document.body.style.overflow).toBe("hidden");
    await cancel();
    expect(dialog()).toBeNull();
    expect(document.body.style.overflow).toBe("auto");
    expect(document.activeElement).toBe(trigger);
    expect(getConsentProof()).toBeUndefined();
    await click(trigger);
    expect(
      document.querySelector<HTMLInputElement>('[aria-label="登录账号"]')!
        .value,
    ).toBe("");
    expect(authPath()).toBe("/auth");
  });

  it("closes after login without changing current route or creating history entries", async () => {
    await render();
    const input = await writeDraft("未提交的评论");
    const hash = window.location.hash,
      key = element("page-key").textContent;
    await click(element("open-login"));
    await click(element("finish"));
    expect(dialog()).toBeNull();
    expect(window.location.hash).toBe(hash);
    expect(element("page-key").textContent).toBe(key);
    expect(input.value).toBe("未提交的评论");
    expect(unmounted).not.toHaveBeenCalled();
  });

  it("honors an explicit next destination through internal form switches", async () => {
    await render("/foods/7", "/auth?next=%2Ffavorites%3Fcategory%3Dstaple");
    await click(element("open-login"));
    await click(element("register"));
    await click(element("finish"));
    expect(dialog()).toBeNull();
    expect(route()).toBe("/favorites?category=staple");
  });

  it("allows password recovery to replace the return destination while keeping the page until login", async () => {
    await render("/foods/7");
    await click(element("open-login"));
    await click(element("forgot"));
    await click(element("phone"));
    expect(authPath()).toBe("/auth/register");
    expect(element("auth-search").textContent).toBe(
      "?next=%2Fsettings%2Fpassword",
    );
    expect(route()).toBe("/foods/7");
    await click(element("finish"));
    expect(route()).toBe("/settings/password");
  });

  it.each([
    "https://example.com/",
    "//example.com/",
    "/\\example.com/",
    "/auth/register",
  ])("ignores unsafe or recursive next destination %s", async (next) => {
    await render("/foods/7", "/auth?next=" + encodeURIComponent(next));
    await click(element("open-login"));
    await click(element("finish"));
    expect(dialog()).toBeNull();
    expect(route()).toBe("/foods/7");
  });
});

describe("login dialog request lifecycle", () => {
  it("closes only the nested policy portal when its native dialog is cancelled", async () => {
    await render();
    await click(element("open-login"));
    const loginDialog = dialog();
    const account = document.querySelector<HTMLInputElement>(
      '[aria-label="登录账号"]',
    )!;
    account.value = "keep-this-account";
    await click(element("open-policy"));
    expect(element("policy-dialog").parentElement).toBe(document.body);
    await act(async () => {
      element("policy-dialog").dispatchEvent(
        new Event("cancel", { cancelable: true }),
      );
    });
    expect(document.querySelector('[data-testid="policy-dialog"]')).toBeNull();
    expect(dialog()).toBe(loginDialog);
    expect(dialog()?.open).toBe(true);
    expect(account.value).toBe("keep-this-account");
    expect(document.body.style.overflow).toBe("hidden");
    expect(route()).toBe("/foods/7?sort=popular#comments");
  });

  it("blocks dismissal and mode changes during a request, then restores them", async () => {
    await render();
    await click(element("open-login"));
    await click(element("busy"));
    expect(closeButton().disabled).toBe(true);
    await click(closeButton());
    await cancel();
    await click(dialog()!);
    await click(element("register"));
    expect(dialog()?.open).toBe(true);
    expect(authPath()).toBe("/auth");
    await click(element("busy"));
    expect(closeButton().disabled).toBe(false);
    await click(element("register"));
    expect(authPath()).toBe("/auth/username-register");
    await click(closeButton());
    expect(dialog()).toBeNull();
  });

  it("keeps one request when multiple features ask for login", async () => {
    await render();
    await click(element("open-login"));
    const original = dialog();
    await click(element("open-again"));
    expect(document.querySelectorAll(".ew-login-dialog")).toHaveLength(1);
    expect(dialog()).toBe(original);
    expect(authPath()).toBe("/auth");
  });

  it("ignores a dismissed request completing after a new login was opened", async () => {
    await render("/foods/7", "/auth?next=%2Ffavorites");
    await click(element("open-login"));
    const staleFinish = currentFlow.finish;
    await cancel();
    await click(element("open-again"));
    const latest = dialog();
    await act(async () => {
      staleFinish("/me");
    });
    expect(dialog()).toBe(latest);
    expect(authPath()).toBe("/auth/register");
    expect(route()).toBe("/foods/7");
    await click(element("finish"));
    expect(dialog()).toBeNull();
    expect(route()).toBe("/foods/7");
  });

  it("closes on external navigation and rejects the old completion", async () => {
    await render("/foods/7", "/auth?next=%2Ffavorites");
    await click(element("open-login"));
    const staleFinish = currentFlow.finish;
    await click(element("leave"));
    expect(dialog()).toBeNull();
    expect(route()).toBe("/restaurants/4");
    await act(async () => {
      staleFinish("/me");
    });
    expect(route()).toBe("/restaurants/4");
  });

  it("preserves ordinary navigation for non-login links", async () => {
    await render();
    await click(element("normal-link"));
    expect(route()).toBe("/verify");
    expect(dialog()).toBeNull();
  });
});

describe("standalone login compatibility", () => {
  it("uses the normal router for authentication links on an existing login page", async () => {
    await render("/auth", "/auth/register");
    await click(element("open-login"));
    expect(route()).toBe("/auth/register");
    expect(dialog()).toBeNull();
  });

  it("uses a safe explicit next destination without a dialog provider", async () => {
    await renderStandalone("/auth?next=%2Ffavorites%3Fsort%3Dnewest");
    await act(async () => {
      currentFlow.finish("/me");
    });
    expect(route()).toBe("/favorites?sort=newest");
  });

  it.each(["", "?next=https%3A%2F%2Fexample.com", "?next=%2Fauth%2Fregister"])(
    "uses the standalone form fallback for absent or unsafe next: %s",
    async (search) => {
      await renderStandalone("/auth" + search);
      await act(async () => {
        currentFlow.finish("/settings/username?first=1");
      });
      expect(route()).toBe("/settings/username?first=1");
    },
  );

  it("still supports regular authentication-flow navigation outside the modal", async () => {
    await renderStandalone("/auth");
    await act(async () => {
      currentFlow.navigate("/auth/consent");
    });
    expect(route()).toBe("/auth/consent");
  });
});
