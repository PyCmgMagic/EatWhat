// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFoodPhoto } from "./media";

let root: Root, container: HTMLDivElement, client: QueryClient;
let photo: ReturnType<typeof useFoodPhoto>;
function Photo({ src }: { src?: string }) {
  photo = useFoodPhoto(src);
  return photo.unavailable ? (
    <span>{photo.failed ? "加载失败" : "暂无实拍"}</span>
  ) : (
    <img src={src} onError={photo.onError} />
  );
}
async function render(src?: string) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <Photo src={src} />
      </QueryClientProvider>,
    ),
  );
}
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient();
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});
describe("food photo fallback and signed URL recovery", () => {
  it("distinguishes missing photos from failures and does not refetch missing media", async () => {
    const renew = vi.spyOn(client, "invalidateQueries");
    await render();
    expect(container.textContent).toBe("暂无实拍");
    await act(async () => photo.onError());
    expect(renew).not.toHaveBeenCalled();
  });
  it("shows a fallback after failure, refreshes only once and restores a new URL", async () => {
    const renew = vi.spyOn(client, "invalidateQueries");
    await render("https://media.example/expired.jpg");
    await act(async () =>
      container.querySelector("img")!.dispatchEvent(new Event("error")),
    );
    expect(container.textContent).toBe("加载失败");
    expect(renew).toHaveBeenCalledExactlyOnceWith({ queryKey: ["foods"] });
    await act(async () => photo.onError());
    expect(renew).toHaveBeenCalledTimes(1);
    await render("https://media.example/refreshed.jpg");
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://media.example/refreshed.jpg",
    );
    expect(photo.unavailable).toBe(false);
    await render(undefined);
    expect(container.textContent).toBe("暂无实拍");
  });
  it("falls back for broken local images without refreshing business data", async () => {
    const renew = vi.spyOn(client, "invalidateQueries");
    await render("/assets/missing.jpg");
    await act(async () => photo.onError());
    expect(container.textContent).toBe("加载失败");
    expect(renew).not.toHaveBeenCalled();
  });
});
