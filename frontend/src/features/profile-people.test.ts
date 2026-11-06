import { describe, expect, it } from "vitest";
import {
  canReadPeople,
  legacyPeopleHref,
  peopleHref,
  peoplePage,
} from "./profile-people";

describe("profile people routes", () => {
  it("opens inside a profile, retaining its content tab and clearing old list state", () => {
    expect(
      peopleHref("/me", "?tab=favorites&peoplePage=3&peopleQ=林", "fans"),
    ).toBe("/me?tab=favorites&people=fans");
    expect(peopleHref("/users/21", "", "follow")).toBe(
      "/users/21?people=follow",
    );
  });
  it("redirects old self and other-user links into the right profile", () => {
    expect(legacyPeopleHref("?tab=fans", 10)).toBe("/me?people=fans");
    expect(legacyPeopleHref("?tab=follow&userId=10", 10)).toBe(
      "/me?people=follow",
    );
    expect(legacyPeopleHref("?tab=fans&userId=21", 10)).toBe(
      "/users/21?people=fans",
    );
    expect(legacyPeopleHref("?tab=fans&userId=21")).toBe(
      "/users/21?people=fans",
    );
  });
  it("does not silently turn an invalid person into the current account's list", () => {
    for (const id of ["", "0", "-1", "1.5", "nope", "9007199254740992"])
      expect(legacyPeopleHref(`?userId=${id}`, 10)).toBeUndefined();
  });
  it("normalizes malformed or unsafe page parameters", () => {
    expect(peoplePage("3")).toBe(3);
    for (const page of [
      null,
      "",
      "0",
      "-1",
      "1.2",
      "NaN",
      "Infinity",
      "9007199254740992",
    ])
      expect(peoplePage(page)).toBe(1);
  });
});

describe("people list privacy gate", () => {
  const other = {
    authenticated: true,
    ownerId: 21,
    accountId: 10,
    profileReady: true,
  };
  it("allows the owner regardless of public visibility", () => {
    expect(
      canReadPeople({
        ...other,
        ownerId: 10,
        profileReady: false,
        visible: false,
      }),
    ).toBe(true);
  });
  it("requires explicit confirmed visibility for somebody else's list", () => {
    for (const visible of [undefined, null, false])
      expect(canReadPeople({ ...other, visible })).toBe(false);
    expect(
      canReadPeople({ ...other, profileReady: false, visible: true }),
    ).toBe(false);
    expect(canReadPeople({ ...other, visible: true })).toBe(true);
  });
  it("blocks guests, banned accounts and invalid or unresolved identities", () => {
    expect(
      canReadPeople({ ...other, authenticated: false, visible: true }),
    ).toBe(false);
    expect(canReadPeople({ ...other, banned: true, visible: true })).toBe(
      false,
    );
    expect(canReadPeople({ ...other, ownerId: undefined, visible: true })).toBe(
      false,
    );
    expect(
      canReadPeople({ ...other, accountId: undefined, visible: true }),
    ).toBe(false);
  });
});
