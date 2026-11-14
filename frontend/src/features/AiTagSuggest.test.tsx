// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AiTagSuggest, draftPictureKeys } from "./AiTagSuggest";

const { suggest } = vi.hoisted(() => ({ suggest: vi.fn() }));
vi.mock("../app/state", () => ({
  useApp: () => ({ api: { suggestDishTags: suggest } }),
}));

const tastes = ["辣", "麻", "甜", "酸", "清淡"].map((name, i) => ({
  id: i + 1,
  name,
}));
let root: Root, host: HTMLDivElement;
const apply = vi.fn();

async function click(
  current: { category?: string; tagIds: number[] },
  extra: Partial<Parameters<typeof AiTagSuggest>[0]> = {},
) {
  await act(async () => {
    root.render(
      <AiTagSuggest
        name="水煮牛肉"
        tagOptions={tastes}
        current={current}
        onApply={apply}
        {...extra}
      />,
    );
  });
  await act(async () => host.querySelector("button")!.click());
  return host.querySelector("[role=status]")?.textContent;
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  suggest.mockReset();
  apply.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

it("fills in a suggestion that differs from the current choice", async () => {
  suggest.mockResolvedValue({ category: "菜", tags: ["辣", "麻"] });
  expect(await click({ category: "staple", tagIds: [] })).toContain(
    "已按建议填写",
  );
  expect(apply).toHaveBeenCalledWith("side_dish", [1, 2]);
});

it("confirms the current category and tastes without changing them", async () => {
  suggest.mockResolvedValue({ category: "菜", tags: ["麻", "辣"] });
  expect(await click({ category: "side_dish", tagIds: [1, 2] })).toContain(
    "不用改",
  );
  expect(apply).not.toHaveBeenCalled();
});

it("sends photo keys and the dish being edited", async () => {
  suggest.mockResolvedValue({ category: "菜", tags: [] });
  await click(
    { category: "side_dish", tagIds: [3] },
    { foodId: 12, pictures: async () => ["foods/a.png"] },
  );
  expect(suggest).toHaveBeenCalledWith(
    expect.objectContaining({ foodId: 12, pictures: ["foods/a.png"] }),
  );
  // No tastes in the reply leaves the chosen ones alone.
  expect(apply).not.toHaveBeenCalled();
});

it("uploads only the first three local photos and reuses existing keys", async () => {
  const files = [1, 2, 3, 4].map((n) => new File([String(n)], `${n}.png`));
  const upload = vi.fn(
    async (
      list: File[],
      _biz: "foods",
      done?: (index: number, key: string) => void,
    ) => list.map((file, i) => (done?.(i, `foods/${file.name}`), "")),
  );
  const save = vi.fn();
  const keys = await draftPictureKeys(
    [{ key: "foods/old.png" }, {}, ...files.map((file) => ({ file }))],
    upload,
    save,
  );
  expect(keys).toEqual(["foods/old.png", "foods/1.png", "foods/2.png"]);
  expect(upload.mock.calls[0][0]).toEqual(files.slice(0, 2));
  expect([...save.mock.calls[0][0].keys()]).toEqual(files.slice(0, 2));
});
