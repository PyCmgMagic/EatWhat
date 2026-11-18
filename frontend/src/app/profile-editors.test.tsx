// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DesktopProfile from "../desktop/DesktopProfile";
import ProfileEditor from "../mobile/ProfileEditor";
import { AppProvider } from "./context";
import { writeDraft } from "./drafts";
import { ProfileDraftProvider, useProfileDraft } from "./profile-draft";
import { writeSession } from "./runtime";
import { useApp } from "./state";

const user = { id: 91, displayName: "测试食友", verified: true };
const noop = () => {};
let host: HTMLDivElement;
let root: Root;

function MobileEditor() {
  const profile = useProfileDraft()!;
  return (
    <ProfileEditor
      form={profile.form}
      busy={!!profile.phase}
      avatarOpen={false}
      onChange={profile.change}
      onAvatar={noop}
      onSave={() => void profile.save()}
      onCancel={noop}
    />
  );
}

function Editor({ mobile }: { mobile: boolean }) {
  if (!useApp().user) return null;
  return (
    <ProfileDraftProvider editing>
      {mobile ? <MobileEditor /> : <DesktopProfile />}
    </ProfileDraftProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  writeSession({ tokenName: "satoken", tokenValue: "profile-editor-test" });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  writeSession(null);
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it.each(["mobile", "desktop"])(
  "hides unsupported hometown fields from the %s v2 profile editor",
  async (layout) => {
    if (layout === "desktop") {
      writeDraft(`profile:${user.id}`, {
        name: user.displayName,
        province: 81,
        city: 91,
      });
    }
    const fetch = vi.fn(
      async (url: string, _options?: RequestInit) =>
        new Response(
          JSON.stringify({
            code: 0,
            data: url.endsWith("/user/info") ? user : null,
          }),
        ),
    );
    vi.stubGlobal("fetch", fetch);

    await act(async () =>
      root.render(
        <AppProvider>
          <MemoryRouter initialEntries={["/me/edit"]}>
            <Editor mobile={layout === "mobile"} />
          </MemoryRouter>
        </AppProvider>,
      ),
    );
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(host.querySelector<HTMLInputElement>("#nick")?.value).toBe(
        user.displayName,
      );
    });

    expect(host.querySelector("#home-province")).toBeNull();
    expect(host.textContent).not.toContain("家乡");
    expect(fetch.mock.calls.some(([url]) => url.includes("/location/"))).toBe(
      false,
    );
    const save = host.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    )!;
    if (layout === "desktop") {
      expect(save.disabled).toBe(true);
    }

    const name = host.querySelector<HTMLInputElement>("#nick")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(name, "新的昵称");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => save.click());
    const write = fetch.mock.calls.find(([url]) =>
      url.endsWith("/user/updateInfo"),
    );
    expect(JSON.parse(String(write?.[1]?.body))).toEqual({
      displayName: "新的昵称",
    });
  },
);
