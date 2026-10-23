import { describe, expect, it } from "vitest";
import { profileChanges, profileForm } from "./profile";

describe("desktop profile updates", () => {
  it("does not overwrite a timestamp birthday or unavailable location when editing a nickname", () => {
    const saved = profileForm({
      userName: "原有昵称",
      birthday: 946684800000,
      hometownProvinceId: 81,
      hometownCityId: 91,
      gender: "custom",
    });
    expect(profileChanges({ ...saved, name: " 新的昵称 " }, saved)).toEqual({
      userName: "新的昵称",
    });
  });
  it("keeps ISO dates in their recorded calendar day without timezone conversion", () => {
    const saved = profileForm({ birthday: "2001-01-01T00:00:00+08:00" });
    expect(saved.birthday).toBe("2001-01-01");
    expect(profileChanges(saved, saved)).toEqual({});
  });
  it("clears optional fields only when explicitly changed", () => {
    const saved = profileForm({
      birthday: 946684800000,
      gender: "female",
      signature: "好好吃饭",
      hometownProvinceId: 1,
      hometownCityId: 2,
    });
    expect(
      profileChanges(
        {
          ...saved,
          birthday: "",
          gender: "",
          signature: "",
          province: null,
          city: null,
        },
        saved,
      ),
    ).toEqual({
      birthday: null,
      gender: null,
      signature: "",
      hometownProvinceId: null,
      hometownCityId: null,
    });
  });
  it("clears the old city when selecting another province", () => {
    const saved = profileForm({ hometownProvinceId: 1, hometownCityId: 2 });
    expect(
      profileChanges({ ...saved, province: 3, city: null }, saved),
    ).toEqual({ hometownProvinceId: 3, hometownCityId: null });
  });
});
