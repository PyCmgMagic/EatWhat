// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AiTagSuggest, draftPictureKeys } from "./AiTagSuggest";

const { suggest, toast } = vi.hoisted(() => ({
  suggest: vi.fn(),
  toast: vi.fn(),
}));
vi.mock("../app/state", () => ({
  useApp: () => ({ api: { suggestDishTags: suggest }, toast }),
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
  toast.mockReset();
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

it("says tastes need not be picked when the model gives none, keeping the chosen ones", async () => {
  suggest.mockResolvedValue({ category: "小吃", tags: [] });
  // Same category, no tastes chosen.
  expect(await click({ category: "snack", tagIds: [] })).toContain(
    "💡 分类是「小吃」没错啦，口味不用刻意选哦～",
  );
  // Same category, tastes chosen: keep them and defer to the user.
  const kept = await click({ category: "snack", tagIds: [1, 2] });
  expect(kept).toContain(
    "💡 分类是「小吃」没错啦，AI 没识别出明显口味，不过如果你吃着觉得「辣、麻」，按你的感觉来就好！",
  );
  expect(kept).not.toContain("分类和口味不用改");
  expect(apply).not.toHaveBeenCalled();

  // Different category: apply only the category, tastes untouched.
  expect(await click({ category: "staple", tagIds: [] })).toContain(
    "💡 已按建议把分类改为「小吃」，口味不用刻意选哦～",
  );
  expect(apply).toHaveBeenCalledWith("snack", []);
  expect(await click({ category: "staple", tagIds: [1] })).toContain(
    "💡 已按建议把分类改为「小吃」，AI 没识别出明显口味，不过如果你吃着觉得「辣」，按你的感觉来就好！",
  );
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

it("keeps compact autofill functional and reports its result outside the field label", async () => {
  suggest.mockResolvedValue({ category: "菜", tags: ["辣", "麻"] });
  await click({ category: "staple", tagIds: [] }, { compact: true });
  expect(apply).toHaveBeenCalledWith("side_dish", [1, 2]);
  expect(toast).toHaveBeenCalledWith("已填写分类和口味，可继续调整。", {
    tone: "info",
  });
  expect(host.querySelector("b, small")).toBeNull();
});

it("reports errors from compact autofill without filling any fields", async () => {
  suggest.mockRejectedValue(new Error("暂时无法分析"));
  await click({ category: "staple", tagIds: [] }, { compact: true });
  expect(apply).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith("暂时无法分析", { tone: "error" });
});
