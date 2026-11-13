// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Link, MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../app/runtime", () => ({ isDemo: false }));
vi.mock("../app/area", () => ({ useArea: () => ({ campusId: 1 }) }));
vi.mock("../app/auth-dialog", () => ({
  LoginLink: ({ children, ...props }: any) => (
    <Link {...props}>{children}</Link>
  ),
}));
import { AppContext, type AppState } from "../app/state";
import {
  readAdminState,
  useRememberWorkspaces,
  workspaceDestination,
  writeAdminState,
} from "../app/admin-state";
import WorkspaceSwitch from "./WorkspaceSwitch";
import AdminApp from "./AdminApp";

let root: Root, host: HTMLDivElement;
const app = (role = "admin", id = 10) =>
  ({
    user: { id, role, displayName: "管理员" },
    session: { tokenName: "test", tokenValue: "test" },
    me: { isPending: false, isError: false },
    api: { summary: vi.fn(), commentModerationQueue: vi.fn() },
  }) as unknown as AppState;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  sessionStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
function Tracker() {
  useRememberWorkspaces();
  return (
    <>
      <WorkspaceSwitch mode="admin" />
      <WorkspaceSwitch mode="front" />
      <Link to="/admin/feedback?page=2">进入评论</Link>
    </>
  );
}

it("remembers each workspace without changing the login session", async () => {
  const identity = app();
  await act(() =>
    root.render(
      <AppContext.Provider value={identity}>
        <MemoryRouter initialEntries={["/foods/7?section=comments"]}>
          <Tracker />
        </MemoryRouter>
      </AppContext.Provider>,
    ),
  );
  expect(workspaceDestination(10, "front")).toBe("/foods/7?section=comments");
  await act(() =>
    [...host.querySelectorAll("a")]
      .find((a) => a.textContent === "进入评论")!
      .click(),
  );
  expect(workspaceDestination(10, "admin")).toBe("/admin/feedback?page=2");
  expect(
    host.querySelector('a[aria-label="切换到前台"]')?.getAttribute("href"),
  ).toBe("/foods/7?section=comments");
  expect(identity.session?.tokenValue).toBe("test");
});
it("isolates destinations by account and rejects manipulated stored links", () => {
  writeAdminState(10, "workspace:admin", "/admin/foods");
  expect(workspaceDestination(10, "admin")).toBe("/admin/foods");
  expect(workspaceDestination(21, "admin")).toBe("/admin");
  writeAdminState(10, "workspace:front", "//outside.example");
  expect(workspaceDestination(10, "front")).toBe("/me");
});
it("does not show a workspace switch or record admin state for regular users", async () => {
  await act(() =>
    root.render(
      <AppContext.Provider value={app("user")}>
        <MemoryRouter initialEntries={["/settings"]}>
          <Tracker />
        </MemoryRouter>
      </AppContext.Provider>,
    ),
  );
  expect(host.querySelectorAll(".workspace-switch")).toHaveLength(0);
  expect(readAdminState(10, "workspace:front", null)).toBeNull();
});
it("denies direct backend access before mounting any management queries", async () => {
  const identity = app("user");
  await act(() =>
    root.render(
      <AppContext.Provider value={identity}>
        <MemoryRouter initialEntries={["/admin/comments"]}>
          <AdminApp />
        </MemoryRouter>
      </AppContext.Provider>,
    ),
  );
  expect(host.textContent).toContain("需要管理员身份");
  expect(host.querySelector(".admin-sidebar")).toBeNull();
  expect(identity.api.commentModerationQueue).not.toHaveBeenCalled();
  expect(identity.api.summary).not.toHaveBeenCalled();
});
