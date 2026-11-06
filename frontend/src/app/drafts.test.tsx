// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("./runtime", () => ({ isDemo: false }));
import { useMemoryDraft, usePageLifetime, useSessionDraft } from "./drafts";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
});

it("restores unsaved text after leaving and reopening, isolated by user", async () => {
  function Form({ owner }: { owner: string }) {
    const [draft, setDraft] = useSessionDraft(`feedback:${owner}`, {
      text: "",
    });
    return (
      <button onClick={() => setDraft({ text: "完整反馈草稿" })}>
        {draft.text || "空"}
      </button>
    );
  }
  await act(() => root.render(<Form owner="10" />));
  await act(() => host.querySelector("button")!.click());
  await act(() => root.render(null));
  await act(() => root.render(<Form owner="10" />));
  expect(host.textContent).toBe("完整反馈草稿");
  await act(() => root.render(<Form owner="21" />));
  expect(host.textContent).toBe("空");
  await act(() => root.render(<Form owner="10" />));
  expect(host.textContent).toBe("完整反馈草稿");
});

it("clears acknowledged drafts without reintroducing them on unmount", async () => {
  function Form() {
    const [draft, setDraft, clear] = useSessionDraft("profile:10", {
      name: "旧名字",
    });
    return (
      <>
        <button onClick={() => setDraft({ name: "新名字" })}>编辑</button>
        <button onClick={clear}>保存</button>
        <span>{draft.name}</span>
      </>
    );
  }
  await act(() => root.render(<Form />));
  await act(() => host.querySelectorAll("button")[0].click());
  await act(() => host.querySelectorAll("button")[1].click());
  await act(() => root.render(null));
  expect(sessionStorage.getItem("eatwhat:live:draft:profile:10")).toBeNull();
});

it("keeps selected files across SPA navigation without serializing them", async () => {
  const file = new File(["image"], "example.png", { type: "image/png" });
  let restored: File[] = [];
  function Form() {
    const [files, setFiles] = useMemoryDraft<File[]>("photos:10:1", []);
    restored = files;
    return <button onClick={() => setFiles([file])}>选择</button>;
  }
  await act(() => root.render(<Form />));
  await act(() => host.querySelector("button")!.click());
  await act(() => root.render(null));
  await act(() => root.render(<Form />));
  expect(restored[0]).toBe(file);
  expect(sessionStorage.length).toBe(0);
});

it("invalidates late completion after the originating page has left", async () => {
  let lifetime: { current: boolean };
  function Page() {
    lifetime = usePageLifetime();
    return null;
  }
  await act(() => root.render(<Page />));
  expect(lifetime!.current).toBe(true);
  await act(() => root.render(null));
  expect(lifetime!.current).toBe(false);
});
