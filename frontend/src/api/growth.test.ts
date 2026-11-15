import { describe, expect, it } from "vitest";
import { ledgerSourceName } from "./growth";

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
