// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AppProvider } from "../../app/context";
import { writeSession } from "../../app/runtime";
import Growth from "./Growth";

it("keeps a downgraded owner's title available and refreshes the displayed title on selection", async () => {
  let equipped = true;
  const writes: string[] = [];
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input).split("?")[0];
      let data: unknown = {};
      if (path.endsWith("/user/info")) data = { id: 11, verified: true };
      if (path.endsWith("/user/level")) {
        data = {
          level: 9,
          experience: 9999,
          title: equipped ? "老吃家" : null,
        };
      }
      if (path.endsWith("/user/titles")) {
        data = [
          {
            code: "veteran_foodie",
            name: "老吃家",
            requiredExperience: 10000,
            acquiredAt: 1000,
            equipped,
          },
        ];
      }
      if (path.includes("/user/titles/equipped")) {
        writes.push(init?.method ?? "");
        equipped = init?.method === "PUT";
        data = null;
      }
      return new Response(JSON.stringify({ code: 0, data }));
    },
  );
  writeSession({ tokenName: "satoken", tokenValue: "title-test" });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  async function button(label: string) {
    const find = () =>
      host.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]:not(:disabled)`,
      );
    for (let i = 0; i < 100 && !find(); i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    expect(find()).toBeTruthy();
    return find()!;
  }
  try {
    await act(async () =>
      root.render(
        <AppProvider>
          <MemoryRouter initialEntries={["/me/growth"]}>
            <Growth />
          </MemoryRouter>
        </AppProvider>,
      ),
    );
    const remove = await button("取消佩戴老吃家");
    expect(host.querySelector(".user-title-badge")?.textContent).toBe("老吃家");
    await act(async () => remove.click());
    const wear = await button("佩戴老吃家");
    expect(host.querySelector(".user-title-badge")).toBeNull();
    await act(async () => wear.click());
    await button("取消佩戴老吃家");
    expect(host.querySelector(".user-title-badge")?.textContent).toBe("老吃家");
    expect(writes).toEqual(["DELETE", "PUT"]);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    writeSession(null);
    vi.unstubAllGlobals();
  }
});
