// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("../../app/runtime", () => ({
  isDemo: false,
  sessionSignal: () => new AbortController().signal,
}));
vi.mock("../access", () => ({ useActionAccess: () => () => true }));
vi.mock("../../app/area", () => ({ useArea: () => ({ campusId: 1 }) }));
import { AppContext, type AppState } from "../../app/state";
import { CommentComposer } from "./Comments";

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL() {
        return `blob:${Math.random()}`;
      }
      static revokeObjectURL() {}
    },
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
async function mount() {
  const upload = vi
    .fn()
    .mockResolvedValueOnce("comments/one")
    .mockRejectedValueOnce(new Error("第二张上传失败"))
    .mockResolvedValueOnce("comments/two");
  const submit = vi.fn().mockResolvedValue({
    id: 7,
    revisionId: "revision",
    moderationStatus: "PENDING",
  });
  const toast = vi.fn();
  const app = {
    user: { id: 10, verified: true },
    session: { tokenName: "test", tokenValue: "token" },
    api: { createFoodComment: submit },
    upload,
    toast,
  } as unknown as AppState;
  await act(() =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <AppContext.Provider value={app}>
            <CommentComposer food={{ id: 1, name: "云吞" }} target={null} />
          </AppContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  return { upload, submit, toast };
}
async function text(value: string) {
  await act(() => {
    const input = host.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("preserves completed upload keys after a partial failure and retries only the remaining image", async () => {
  const { upload, submit, toast } = await mount();
  await text("好吃");
  await act(() => {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [
        new File(["a"], "one.png", { type: "image/png" }),
        new File(["b"], "two.png", { type: "image/png" }),
      ],
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(() =>
    host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click(),
  );
  expect(upload).toHaveBeenCalledTimes(2);
  expect(submit).not.toHaveBeenCalled();
  expect(host.querySelector("textarea")!.value).toBe("好吃");
  expect(host.textContent).toContain("第二张上传失败");
  await act(() =>
    host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click(),
  );
  expect(upload).toHaveBeenCalledTimes(3);
  expect(upload.mock.calls[2][0].name).toBe("two.png");
  expect(submit).toHaveBeenCalledWith(
    1,
    {
      text: "好吃",
      pictureKeys: ["comments/one", "comments/two"],
      campusId: 1,
    },
    expect.any(String),
  );
  expect(toast).toHaveBeenCalledWith("已提交，等待审核。", { tone: "info" });
  expect(host.querySelector("textarea")!.value).toBe("");
});
it("counts emoji by Unicode character and prevents oversized submissions", async () => {
  const { submit } = await mount();
  await text("🍜".repeat(200));
  expect(host.textContent).toContain("200/200");
  expect(
    host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled,
  ).toBe(false);
  await text("🍜".repeat(201));
  expect(
    host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled,
  ).toBe(true);
  expect(submit).not.toHaveBeenCalled();
});
