// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { AppProvider } from "./context";
import { useApp, type AppState } from "./state";
import { writeSession, readSession } from "./runtime";
import { MobileChange } from "../features/v4/Account";
import DesktopProfile from "../desktop/DesktopProfile";
import { recoveryCommands } from "../api/recovery";
import { FeedbackForm } from "../features/v4/Community";

let root: Root, host: HTMLDivElement, app: AppState, cache: QueryClient;
const accountA = {
  id: 11,
  displayName: "食友甲",
  signature: "",
  verified: true,
  banned: false,
};
const accountB = {
  id: 22,
  displayName: "食友乙",
  signature: "",
  verified: true,
  banned: false,
};
const tokenA = { tokenName: "satoken", tokenValue: "review-account-a" };
const tokenB = { tokenName: "satoken", tokenValue: "review-account-b" };
const ok = (data: unknown) => new Response(JSON.stringify({ code: 0, data }));
let handler: (path: string, init?: RequestInit) => Promise<Response>;
let calls: string[];

function Probe({ page }: { page?: "mobile" | "profile" | "feedback" }) {
  app = useApp();
  cache = useQueryClient();
  return app.user && app.session ? (
    page === "mobile" ? (
      <MobileChange />
    ) : page === "profile" ? (
      <DesktopProfile />
    ) : page === "feedback" ? (
      <FeedbackForm />
    ) : null
  ) : null;
}
async function mount(page?: "mobile" | "profile" | "feedback") {
  await act(async () =>
    root.render(
      <AppProvider>
        <MemoryRouter initialEntries={["/settings/phone"]}>
          <Probe page={page} />
        </MemoryRouter>
      </AppProvider>,
    ),
  );
  await spin(() => !!app.user);
}
async function spin(condition: () => boolean) {
  for (let i = 0; i < 70 && !condition(); i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  expect(condition(), "test setup condition").toBe(true);
}
async function enter(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  sessionStorage.clear();
  recoveryCommands.clear();
  writeSession(null);
  writeSession(tokenA);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  calls = [];
  handler = async (path, init) => {
    if (path.endsWith("/user/info"))
      return ok(
        new Headers(init?.headers).get("satoken") === "Bearer review-account-b"
          ? accountB
          : accountA,
      );
    return ok([]);
  };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const path = String(url).split("?")[0];
      calls.push(path);
      return handler(path, init);
    }),
  );
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
    cache?.clear();
    writeSession(null);
  });
  host.remove();
  vi.unstubAllGlobals();
});

it.each([20001, "20002", 20003, "TOKEN_EXPIRED", 20010])(
  "clears a session rejected with HTTP 200 business code %s",
  async (code) => {
    await mount();
    handler = async () =>
      new Response(JSON.stringify({ code, msg: "用户未登录", data: null }));
    await act(async () => {
      await app.api.unread().catch(() => {});
    });
    expect(readSession()).toBeNull();
  },
);

it("keeps the current account when a public login request is rejected", async () => {
  await mount();
  handler = async () =>
    new Response(
      JSON.stringify({ code: 20001, msg: "用户未登录", data: null }),
    );
  await act(async () => {
    const result = await app.api.login({
      userName: "another",
      password: "invalid",
      device: "WEB",
    });
    expect(result.code).toBe(20001);
  });
  expect(readSession()).toEqual(tokenA);
  expect(app.user?.id).toBe(accountA.id);
});

it("does not let an expired reply from a previous session log out a new account", async () => {
  await mount();
  const original = handler;
  let finish!: (value: Response) => void;
  handler = (path, init) =>
    // The v2 bridge reads the unread count from the notification cards.
    path.endsWith("/notification/cards/unread/count")
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : original(path, init);
  const oldRequest = app.api.unread().catch(() => {});
  await act(async () => {
    await app.signIn(tokenB);
  });
  await act(async () => {
    finish(new Response(JSON.stringify({ code: 20001, data: null })));
    await oldRequest;
  });
  expect(readSession()).toEqual(tokenB);
  expect(app.user?.id).toBe(accountB.id);
});

it("does not let account A profile readback repopulate account B identity", async () => {
  let readbackStarted = false;
  await mount("profile");
  const original = handler;
  handler = async (path, init) => {
    if (path.endsWith("/user/updateInfo")) return ok(null);
    if (path.endsWith("/user/info")) {
      readbackStarted = true;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal!.reason),
          { once: true },
        );
      });
    }
    return original(path, init);
  };
  await enter(host.querySelector<HTMLInputElement>("#nick")!, "甲的新昵称");
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await spin(() => readbackStarted);
  await act(async () => {
    await app.clearLocalSession();
  });
  await spin(() => app.session === null);
  expect(cache.getQueryData(["me"])).toBeUndefined();
  handler = original;
  await act(async () => {
    await app.signIn(tokenB);
  });
  await spin(() => app.session?.tokenValue === tokenB.tokenValue);
  expect(app.user?.id).toBe(accountB.id);
});

it("keeps acknowledged profile changes when only readback fails on the same session", async () => {
  await mount("profile");
  const original = handler;
  handler = async (path, init) => {
    if (path.endsWith("/user/updateInfo")) return ok(null);
    if (path.endsWith("/user/info")) throw new TypeError("readback offline");
    return original(path, init);
  };
  await enter(host.querySelector<HTMLInputElement>("#nick")!, "甲的新昵称");
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await spin(() => app.user?.displayName === "甲的新昵称");
  expect(readSession()).toEqual(tokenA);
});

// Backend v2 has no mobile-change commands; the bridge reports them retired.
it.skip("keeps the phone form editable after a definitive prepare rejection", async () => {
  await mount("mobile");
  const original = handler;
  handler = async (path, init) =>
    path.endsWith("/user/mobile/commands")
      ? new Response(
          JSON.stringify({ code: 10001, msg: "手机号已绑定", data: null }),
        )
      : original(path, init);
  await enter(
    host.querySelector<HTMLInputElement>('input[inputmode="tel"]')!,
    "13800138000",
  );
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await spin(() => calls.some((p) => p.endsWith("/user/mobile/commands")));
  expect(host.querySelector('input[inputmode="tel"]')).not.toBeNull();
  expect(recoveryCommands.has("mobile")).toBe(false);
  handler = async (path, init) =>
    path.endsWith("/user/mobile/commands")
      ? ok({
          commandId: JSON.parse(String(init?.body)).commandId,
          oldProofRequired: true,
        })
      : original(path, init);
  await enter(
    host.querySelector<HTMLInputElement>('input[inputmode="tel"]')!,
    "13900139000",
  );
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await spin(() => !!recoveryCommands.get("mobile")?.prepared);
  expect(recoveryCommands.get("mobile")?.mobile).toBe("13900139000");
});

// Backend v2 has no mobile-change commands; the bridge reports them retired.
it.skip("retains the mobile recovery command if preparation has an unknown outcome", async () => {
  await mount("mobile");
  const original = handler;
  handler = async (path, init) => {
    if (path.endsWith("/user/mobile/commands"))
      throw new TypeError("response lost");
    return original(path, init);
  };
  await enter(
    host.querySelector<HTMLInputElement>('input[inputmode="tel"]')!,
    "13800138000",
  );
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(recoveryCommands.has("mobile")).toBe(true);
  expect(host.querySelector('input[inputmode="tel"]')).toBeNull();
});

// Backend v2 has no mobile-change commands; the bridge reports them retired.
it.skip("preserves an in-progress recovery capability when the old session expires", async () => {
  await mount();
  const commandId = "00000000-0000-4000-8000-000000000001";
  recoveryCommands.set("mobile", {
    commandId,
    capability: "synthetic-test-capability",
  });
  handler = async () =>
    new Response(
      JSON.stringify({ code: 20001, msg: "用户未登录", data: null }),
      { status: 401 },
    );
  await act(async () => {
    await app.api.mobileStatus(commandId).catch(() => {});
  });
  await spin(() => app.session === null);
  expect(recoveryCommands.has("mobile")).toBe(true);
  handler = async () => ok(accountB);
  await act(async () => {
    await app.signIn(tokenB);
  });
  expect(recoveryCommands.size).toBe(0);
  expect(app.user?.id).toBe(accountB.id);
});

it("allows explicit logout to clear recovery state when the token was already expired", async () => {
  await mount();
  recoveryCommands.set("mobile", {
    commandId: "pending-command",
    capability: "synthetic-capability",
  });
  handler = async () =>
    new Response(JSON.stringify({ code: 20001, data: null }));
  await act(async () => {
    await app.signOut();
  });
  expect(readSession()).toBeNull();
  expect(recoveryCommands.size).toBe(0);
});

it("blocks feedback longer than the API contract limit of 500 characters", async () => {
  await mount("feedback");
  const textarea = host.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(textarea, "测".repeat(501));
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(textarea.maxLength).toBe(500);
  const original = handler;
  handler = async (path, init) =>
    path.endsWith("/feedback/messages")
      ? new Response(
          JSON.stringify({ code: 10001, msg: "反馈内容最多500字", data: null }),
        )
      : original(path, init);
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(calls.filter((p) => p.endsWith("/feedback/messages"))).toHaveLength(0);
});

it("accepts feedback exactly at the 500-character limit", async () => {
  await mount("feedback");
  const textarea = host.querySelector("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(textarea, "测".repeat(500));
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const original = handler;
  let submitted = "";
  handler = async (path, init) => {
    if (path.endsWith("/feedback/messages")) {
      submitted = JSON.parse(String(init?.body)).text;
      return ok({ id: 1 });
    }
    return original(path, init);
  };
  await act(async () => {
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(submitted).toHaveLength(500);
});
