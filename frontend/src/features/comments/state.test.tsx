// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
const identity = vi.hoisted(() => ({
  user: { id: 10 },
  session: { tokenName: "test", tokenValue: "test" },
  aborted: false,
}));
vi.mock("../../app/state", () => ({ useApp: () => identity }));
vi.mock("../../app/runtime", () => ({
  isDemo: false,
  sessionSignal: () => ({ aborted: identity.aborted }),
}));
import { useCommentCommand } from "./state";
import {
  clearCommentDrafts,
  useMemoryDraft,
  useSessionDraft,
} from "../../app/drafts";

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  identity.user.id = 10;
  identity.aborted = false;
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
});

it("restores the frozen payload and command UUID after a timeout and remount", async () => {
  const send = vi
    .fn()
    .mockRejectedValueOnce(new ApiError("timeout", "NETWORK"))
    .mockResolvedValueOnce({ id: 1 });
  const after = vi.fn();
  function Form() {
    const task = useCommentCommand<{ text: string }, { id: number }>(
      "submit:1:root",
      send,
      after,
    );
    return (
      <button
        onClick={() =>
          void task.run({
            text: host.dataset.changed ? "编辑后的内容" : "原始内容",
          })
        }
      >
        {task.pending ? "重试" : "发送"}
      </button>
    );
  }
  await act(() => root.render(<Form />));
  await act(() => host.querySelector("button")!.click());
  expect(host.textContent).toBe("重试");
  await act(() => root.render(null));
  host.dataset.changed = "yes";
  await act(() => root.render(<Form />));
  await act(() => host.querySelector("button")!.click());
  expect(send.mock.calls[1]).toEqual(send.mock.calls[0]);
  expect(send.mock.calls[0][0]).toEqual({ text: "原始内容" });
  expect(after).toHaveBeenCalledOnce();
  expect(sessionStorage.length).toBe(0);
});

it("blocks duplicate clicks and ignores completion after an account change", async () => {
  let finish!: (value: { id: number }) => void;
  const send = vi.fn(
      () =>
        new Promise<{ id: number }>((resolve) => {
          finish = resolve;
        }),
    ),
    after = vi.fn();
  function Form() {
    const task = useCommentCommand<null, { id: number }>("like:1", send, after);
    return <button onClick={() => void task.run(null)}>操作</button>;
  }
  await act(() => root.render(<Form />));
  await act(() => {
    host.querySelector("button")!.click();
    host.querySelector("button")!.click();
  });
  expect(send).toHaveBeenCalledOnce();
  identity.aborted = true;
  await act(() => finish({ id: 1 }));
  expect(after).not.toHaveBeenCalled();
});

it("clears only comment drafts, including selected image memory, on logout", async () => {
  let selected: string[] = [];
  function Form() {
    const [value, set] = useSessionDraft("comments:draft:10:1:root", "");
    const [files, setFiles] = useMemoryDraft<string[]>(
      "comments:draft:10:1:root",
      [],
    );
    selected = files;
    return (
      <button
        onClick={() => {
          set("未提交评论");
          setFiles(["file"]);
        }}
      >
        {value || "空"}
      </button>
    );
  }
  sessionStorage.setItem("eatwhat:live:draft:profile:10", "保留资料草稿");
  await act(() => root.render(<Form />));
  await act(() => host.querySelector("button")!.click());
  expect(selected).toHaveLength(1);
  clearCommentDrafts();
  await act(() => root.render(null));
  await act(() => root.render(<Form />));
  expect(host.textContent).toBe("空");
  expect(selected).toEqual([]);
  expect(sessionStorage.getItem("eatwhat:live:draft:profile:10")).toBe(
    "保留资料草稿",
  );
});
