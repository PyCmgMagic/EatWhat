import { describe, expect, it, vi } from "vitest";
import { withActionAccess } from "./access";
import { bannedPageAllowed, bannedRequestAllowed } from "./banned-access";
import type { RequestOptions, Transport } from "./client";

const allowed: [string, RequestOptions][] = [
  ["/user/info", {}],
  ["/foods/my", {}],
  ["/foods/favorites", {}],
  ["/history/browse", {}],
  ["/notification/cards", {}],
  ["/auth/logout", { method: "POST" }],
  ["/auth/changePassword", { method: "POST" }],
  ["/auth/password/reset", { method: "POST" }],
  ["/auth/sessions/revoke-others", { method: "POST" }],
  ["/auth/sessions/7", { method: "DELETE" }],
  ["/user/changePrivacy", { method: "POST" }],
  ["/user/blocks/7", { method: "PUT" }],
  ["/user/unfollow", { method: "POST" }],
  ["/foods/7/unlike", { method: "POST" }],
  ["/foods/7/unfavorite", { method: "POST" }],
  ["/comments/7/reactions/LIKE", { method: "DELETE" }],
  ["/history/browse", { method: "DELETE" }],
  ["/notification/cards/7/read", { method: "POST" }],
  ["/notification/cards/read-all", { method: "POST" }],
  ["/feedback/messages", { method: "POST" }],
  ["/upload/presign", { method: "POST", body: { biz: "feedback" } }],
  ["/upload/presign/batch", { method: "POST", body: { biz: "feedback" } }],
  [
    "/upload/complete",
    { method: "POST", body: { key: "feedback/2026/shot.png" } },
  ],
];
const denied: [string, RequestOptions][] = [
  ["/user/updateInfo", { method: "PUT" }],
  ["/foods/upload", { method: "POST" }],
  ["/foods/edit/7", { method: "PUT" }],
  ["/foods/7/like", { method: "POST" }],
  ["/foods/7/favorite", { method: "POST" }],
  ["/user/follow", { method: "POST" }],
  ["/foods/7/comments", { method: "POST" }],
  ["/comments/7", { method: "DELETE" }],
  ["/comments/7/reactions/LIKE", { method: "PUT" }],
  ["/foods/7/rating", { method: "PUT" }],
  ["/user/activity", { method: "POST" }],
  ["/admin/summary", {}],
  ["/user/list", {}],
  ["/new-unclassified-command", { method: "POST" }],
  ...["avatar", "foods", "comments"].map((biz): [string, RequestOptions] => [
    "/upload/presign",
    { method: "POST", body: { biz } },
  ]),
  [
    "/upload/complete",
    { method: "POST", body: { key: "avatar/2026/shot.png" } },
  ],
];

function client(verified: boolean, loaded = true) {
  const user = { verified, banned: true };
  const send = vi.fn<Transport>(async () => ({ code: 0 }));
  const session = { tokenName: "test", tokenValue: "test" };
  const prompt = vi.fn(() => true);
  const call = withActionAccess(send, {
    session: () => session,
    user: () => (loaded ? user : undefined),
    loadUser: async () => user,
    context: () => "#/me",
    prompt,
  });
  return { send, call, prompt };
}

describe.each([true, false])("restricted account, verified=%s", (verified) => {
  it.each(allowed)(
    "permits %s %j without prompting for verification",
    async (path, options) => {
      const c = client(verified);
      await expect(c.call(path, options)).resolves.toMatchObject({ code: 0 });
      expect(c.send).toHaveBeenCalledOnce();
      expect(c.prompt).not.toHaveBeenCalled();
    },
  );
  it.each(denied)(
    "blocks %s %j before any network request",
    async (path, options) => {
      const c = client(verified);
      await expect(c.call(path, options)).rejects.toMatchObject({
        code: "USER_DISABLED",
      });
      expect(c.send).not.toHaveBeenCalled();
    },
  );
});
it("loads identity before login-only or unclassified writes", async () => {
  for (const path of ["/user/updateInfo", "/unclassified-write"]) {
    const c = client(true, false);
    await expect(c.call(path, { method: "PUT" })).rejects.toMatchObject({
      code: "USER_DISABLED",
    });
    expect(c.send).not.toHaveBeenCalled();
  }
});
it("opens self-service pages but not editors or administration", () => {
  for (const path of [
    "/me",
    "/me/shares",
    "/favorites",
    "/history",
    "/settings/password",
    "/settings/devices",
    "/feedback",
    "/feedback/mine/7",
  ])
    expect(bannedPageAllowed(path), path).toBe(true);
  for (const path of [
    "/me/edit",
    "/publish",
    "/foods/7/edit",
    "/admin",
    "/settings/unknown",
  ])
    expect(bannedPageAllowed(path), path).toBe(false);
});
it("only recognizes read-only methods as reads", () => {
  expect(bannedRequestAllowed("/user/info", { method: "PATCH" })).toBe(false);
});
