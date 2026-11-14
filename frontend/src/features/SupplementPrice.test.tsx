// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SupplementPrice } from "./SupplementPrice";

const { edit, toast, allow } = vi.hoisted(() => ({
  edit: vi.fn(),
  toast: vi.fn(),
  allow: vi.fn(() => true),
}));
vi.mock("../app/state", () => ({
  useApp: () => ({ api: { editMyFood: edit }, toast }),
}));
vi.mock("./access", () => ({ useActionAccess: () => allow }));

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  for (const [name, open] of [
    ["showModal", true],
    ["close", false],
  ] as const)
    Object.defineProperty(HTMLDialogElement.prototype, name, {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = open;
      },
    });
  edit.mockReset().mockResolvedValue(null);
  toast.mockReset();
  allow.mockReset().mockReturnValue(true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function render(price: number | null) {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SupplementPrice food={{ id: 7, name: "牛肉面", price }} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
}
function type(value: string) {
  const input = document.querySelector<HTMLInputElement>("dialog input")!;
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
const save = () =>
  act(async () =>
    document
      .querySelector<HTMLButtonElement>("dialog button[type=submit]")!
      .click(),
  );

it("is offered only while the price is missing", async () => {
  await render(18);
  expect(host.querySelector(".supplement-price-button")).toBeNull();
  await render(null);
  expect(host.querySelector(".supplement-price-button")?.textContent).toBe(
    "补充价格",
  );
});

it("checks the price, then saves only the price", async () => {
  await render(null);
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".supplement-price-button")!.click(),
  );
  await act(async () => type("18.55"));
  await save();
  expect(document.querySelector("[role=alert]")?.textContent).toContain(
    "最多保留一位",
  );
  expect(edit).not.toHaveBeenCalled();

  await act(async () => type("18.5"));
  await save();
  expect(edit).toHaveBeenCalledWith(7, { price: 18.5 });
  expect(toast).toHaveBeenCalledWith("价格已补充，谢谢你");
  expect(document.querySelector("dialog")).toBeNull();
});

it("asks to sign in or verify before opening", async () => {
  allow.mockReturnValue(false);
  await render(null);
  await act(async () =>
    host.querySelector<HTMLButtonElement>(".supplement-price-button")!.click(),
  );
  expect(allow).toHaveBeenCalledWith(true);
  expect(document.querySelector("dialog")).toBeNull();
});
