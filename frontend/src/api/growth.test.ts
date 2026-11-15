import { describe, expect, it } from "vitest";
import { experienceRules, ledgerSourceName, userTitle } from "./growth";

describe("ledgerSourceName", () => {
  it("显示接口返回的来源名", () => {
    expect(ledgerSourceName("每日使用")).toBe("每日使用");
    expect(ledgerSourceName("发布菜品")).toBe("发布菜品");
  });
  it("旧的枚举值转成中文", () => {
    expect(ledgerSourceName("DAILY_USE")).toBe("每日使用");
    expect(ledgerSourceName("daily_use")).toBe("每日使用");
  });
  it("没有来源时用通用名", () => {
    expect(ledgerSourceName(undefined)).toBe("经验奖励");
    expect(ledgerSourceName(" ")).toBe("经验奖励");
  });
});

describe("userTitle", () => {
  it("只认非空字符串", () => {
    expect(userTitle({ title: "老吃家" })).toBe("老吃家");
    expect(userTitle({ title: null })).toBeNull();
    expect(userTitle({ title: " " })).toBeNull();
    expect(userTitle(undefined)).toBeNull();
  });
});

describe("experienceRules", () => {
  it("过滤不完整的来源，旧接口没有 rules 时为空", () => {
    expect(
      experienceRules({
        rules: [
          {
            source: "food_published",
            name: "发布菜品",
            amount: 15,
            dailyCap: 3,
          },
          { source: "x", name: "缺数值" },
        ],
      }),
    ).toEqual([
      { source: "food_published", name: "发布菜品", amount: 15, dailyCap: 3 },
    ]);
    expect(experienceRules({})).toEqual([]);
  });
});
