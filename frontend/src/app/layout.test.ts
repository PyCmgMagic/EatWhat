import { describe, expect, it } from "vitest";
import { desktopLayout, editingFlow } from "./layout";

describe("responsive presentation", () => {
  it("uses phone below 600 and compact tablet layouts from 600", () => {
    expect(desktopLayout(599, null, false, false)).toBe(false);
    expect(desktopLayout(600, null, false, false)).toBe(true);
    expect(desktopLayout(767, null, false, false)).toBe(true);
    expect(desktopLayout(768, null, false, false)).toBe(true);
    expect(desktopLayout(1023, null, false, false)).toBe(true);
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
  it("retains the profile and restaurant editor through their steps", () => {
    expect(editingFlow("/me/edit")).toBe(editingFlow("/me/details"));
    expect(editingFlow("/restaurants/new")).toBe(
      editingFlow("/restaurants/new/details"),
    );
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
