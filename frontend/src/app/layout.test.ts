import { describe, expect, it } from "vitest";
import { desktopLayout, editingFlow } from "./layout";

describe("responsive presentation", () => {
  it("uses the mobile shell below 640 and the desktop shell for tablet and larger widths", () => {
    for (const width of [390, 600, 639])
      expect(desktopLayout(width, null, false, false)).toBe(false);
    for (const width of [640, 767, 900, 1023, 1024, 1440])
      expect(desktopLayout(width, null, false, false)).toBe(true);
  });
  it("honors explicit previews at any width", () => {
    expect(desktopLayout(320, "desktop", false, false)).toBe(true);
    expect(desktopLayout(1920, "mobile", false, false)).toBe(false);
  });
  it("keeps original reference and gallery screens", () => {
    expect(desktopLayout(1440, "desktop", true, false)).toBe(false);
    expect(desktopLayout(1440, "desktop", false, true)).toBe(false);
  });
  it("shares presentation through each publishing step", () => {
    expect(editingFlow("/publish")).toBe("publish");
    expect(editingFlow("/publish/crop")).toBe("publish");
    expect(editingFlow("/publish/dish")).toBe("publish");
  });
  it("retains the restaurant editor through its steps", () => {
    expect(editingFlow("/restaurants/new")).toBe(
      editingFlow("/restaurants/new/details"),
    );
  });
  it("lets both profile editor entries follow the current viewport", () => {
    expect(editingFlow("/me/edit")).toBeNull();
    expect(editingFlow("/me/details")).toBeNull();
  });
  it.each([
    "/auth",
    "/auth/password",
    "/auth/register",
    "/auth/register/confirm",
    "/auth/forgot",
    "/auth/password-conflict/reset",
  ])("lets %s follow the current viewport", (path) => {
    expect(editingFlow(path)).toBeNull();
  });
  it("isolates different food editors and excludes ordinary pages", () => {
    expect(editingFlow("/foods/1/edit")).not.toBe(editingFlow("/foods/2/edit"));
    for (const path of [
      "/",
      "/me",
      "/settings",
      "/foods/1",
      "/publishing",
      "/reference/G-EditProfile",
    ])
      expect(editingFlow(path)).toBeNull();
  });
});
