import { describe, expect, it } from "vitest";
import { profileChanges, profileForm, profileClearError } from "./profile";

describe("desktop profile updates", () => {
  it("does not overwrite a timestamp birthday or gender when editing a nickname", () => {
    const saved = profileForm({
      displayName: "原有昵称",
      birthday: 946684800000,
      gender: "custom",
    });
    expect(profileChanges({ ...saved, name: " 新的昵称 " }, saved)).toEqual({
      displayName: "新的昵称",
    });
  });
  it("keeps ISO dates in their recorded calendar day without timezone conversion", () => {
    const saved = profileForm({ birthday: "2001-01-01T00:00:00+08:00" });
    expect(saved.birthday).toBe("2001-01-01");
    expect(profileChanges(saved, saved)).toEqual({});
  });
  it("does not send undocumented nullable fields and explains why clearing needs a contract", () => {
    const saved = profileForm({
      birthday: 946684800000,
      gender: "female",
      signature: "好好吃饭",
    });
    expect(
      profileChanges(
        {
          ...saved,
          birthday: "",
          gender: "",
          signature: "",
        },
        saved,
      ),
    ).toEqual({
      birthday: undefined,
      signature: "",
    });
    expect(profileClearError({ ...saved, birthday: "" }, saved)).toContain(
      "清空",
    );
  });
});
