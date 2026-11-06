import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  addMessage,
  readDiscussion,
  saveDiscussion,
  toggleHelpful,
  myCommentEntries,
} from "./comments";

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
const food = {
  id: 91,
  name: "新上传菜品",
  pictureUrl: ["foods/new.jpg"],
  restaurantName: "测试店",
};
const user = { id: 10, displayName: "测试食友" };

it("isolates comments by food and does not invent reviews for uploads with a demo name", () => {
  const first = addMessage(readDiscussion(food), user, "刚刚吃过", []);
  saveDiscussion(first);
  expect(readDiscussion(food).comments).toHaveLength(1);
  expect(
    readDiscussion({ ...food, id: 92, name: "鲜虾蟹籽云吞" }).comments,
  ).toHaveLength(0);
  expect(
    readDiscussion({
      id: 1,
      pictureUrl: ["/prototype/assets/dishes/yuntun.svg"],
    }).comments,
  ).toHaveLength(3);
});
it("keeps replies on the selected comment and indexes only the current user's messages", () => {
  const source = readDiscussion(food),
    first = addMessage(source, { id: 21, displayName: "小林" }, "不错", []);
  const replied = addMessage(first, user, "谢谢推荐", [], first.comments[0].id);
  saveDiscussion(replied);
  expect(source.comments).toHaveLength(0);
  expect(replied.comments).toHaveLength(1);
  expect(replied.comments[0].replies[0].text).toBe("谢谢推荐");
  expect(
    myCommentEntries(10).map((entry) => [entry.foodId, entry.reply]),
  ).toEqual([[91, true]]);
  expect(() => addMessage(first, user, "回复", [], "missing")).toThrow(
    "不存在",
  );
});
it("validates text and photo count before creating any comment", () => {
  const source = readDiscussion(food);
  expect(() => addMessage(source, user, "   ", [])).toThrow("1–500");
  expect(() => addMessage(source, user, "好吃", ["a", "b", "c", "d"])).toThrow(
    "3 张",
  );
  expect(source.comments).toHaveLength(0);
});
it("toggles helpful once in each direction without mutating the original", () => {
  const source = addMessage(readDiscussion(food), user, "好吃", []),
    id = source.comments[0].id;
  const liked = toggleHelpful(source, id),
    restored = toggleHelpful(liked, id);
  expect(source.comments[0].helpful).toBe(0);
  expect(liked.comments[0]).toMatchObject({ helpful: 1, liked: true });
  expect(restored.comments[0]).toMatchObject({ helpful: 0, liked: false });
});
it("reports storage failures without erasing the saved discussion", () => {
  const source = addMessage(readDiscussion(food), user, "已保存", []);
  saveDiscussion(source);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: () => {
      throw new Error("quota");
    },
  });
  expect(() =>
    saveDiscussion(addMessage(source, user, "尚未保存", [])),
  ).toThrow("无法保存");
  expect(readDiscussion(food).comments.map((c) => c.text)).toEqual(["已保存"]);
});
