import { expect, it } from "vitest";
import { withDraftTag } from "./draft-tags";

it("adds the normalized tag to the unpublished draft without mutating it", () => {
  const original = ["考试周"];
  expect(withDraftTag(original, "  想再吃  ")).toEqual(["考试周", "想再吃"]);
  expect(original).toEqual(["考试周"]);
});
it("does not duplicate tags with surrounding or repeated whitespace", () => {
  expect(withDraftTag(["再  来一份"], " 再 来一份 ")).toEqual(["再 来一份"]);
});
it("allows selecting an existing tag at the limit but rejects the 21st tag", () => {
  const names = Array.from({ length: 20 }, (_, i) => `标签${i}`);
  expect(withDraftTag(names, "标签19")).toEqual(names);
  expect(() => withDraftTag(names, "新增标签")).toThrow("最多添加 20 个");
});
it.each(["", "  ", "一二三四五六七八九十百"])(
  "rejects invalid names without silently losing input: %s",
  (value) => {
    expect(() => withDraftTag([], value)).toThrow("1–10 个字");
  },
);
it("counts Unicode characters consistently with the API validation", () => {
  expect(withDraftTag([], "🍜".repeat(10))).toEqual(["🍜".repeat(10)]);
  expect(() => withDraftTag([], "🍜".repeat(11))).toThrow("1–10 个字");
});
