// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createApi, type Api } from "../api/service";
import type { Transport } from "../api/client";
import { withReactionHaptics } from "./reaction-haptics";

const vibrate = vi.fn();
const send = vi.fn<Transport>();
const api = withReactionHaptics(createApi(send));
const key = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  send.mockReset().mockResolvedValue({ code: 0, data: [] });
  vibrate.mockReset();
  vi.stubGlobal("navigator", { vibrate });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete document.documentElement.dataset.motionInput;
});

const toggles: [string, (api: Api, active: boolean) => Promise<unknown>][] = [
  ["food like", (api, active) => api.like(1, !active)],
  ["food favorite", (api, active) => api.favorite(1, !active)],
  [
    "shop favorite",
    (api, active) =>
      active ? api.favoriteRestaurant(1) : api.unfavoriteRestaurant(1),
  ],
  ["follow", (api, active) => api.follow(1, !active)],
  [
    "comment like",
    (api, active) =>
      active ? api.likeComment(1, key) : api.unlikeComment(1, key),
  ],
  [
    "comment emoji",
    (api, active) => api.setCommentReaction(1, "HEART", active),
  ],
];

it.each(toggles)(
  "pulses once for each confirmed %s toggle",
  async (_, toggle) => {
    const activation = toggle(api, true);
    expect(vibrate).not.toHaveBeenCalled();
    await activation;
    await toggle(api, false);
    expect(vibrate.mock.calls).toEqual([[20], [10]]);
  },
);

it("skips reads, rejected actions and results arriving after navigation", async () => {
  await api.commentLike(1);
  send.mockResolvedValueOnce({ code: 1, msg: "denied", data: null });
  await expect(api.like(1, false)).rejects.toThrow("denied");
  const pending = api.favorite(1, false);
  const page = location.href;
  try {
    history.replaceState(null, "", "#/elsewhere");
    await pending;
    expect(vibrate).not.toHaveBeenCalled();
  } finally {
    history.replaceState(null, "", page);
  }
});

it("respects reduced motion, keyboard input and background tabs", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  await api.like(1, false);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  document.documentElement.dataset.motionInput = "keyboard";
  await api.like(1, false);
  delete document.documentElement.dataset.motionInput;
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  await api.like(1, false);
  expect(vibrate).not.toHaveBeenCalled();
});

it("preserves the action result when vibration is unavailable or blocked", async () => {
  const result = [{ reaction: "HEART", count: 1, selected: true }];
  send.mockResolvedValue({ code: 0, data: result });
  vibrate.mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(await api.setCommentReaction(1, "HEART", true)).toBe(result);
  vi.stubGlobal("navigator", {});
  expect(await api.setCommentReaction(1, "HEART", true)).toBe(result);
});
