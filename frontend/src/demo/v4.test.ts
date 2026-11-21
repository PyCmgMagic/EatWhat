// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { handleV4, seedV4, type DemoV4 } from "./v4";
import type { RequestOptions } from "../api/client";
import type { Food, Restaurant, User, CustomTag } from "../api/models";
let s: {
  user: User;
  foods: Food[];
  restaurants: Restaurant[];
  tags: CustomTag[];
  v4: DemoV4;
};
const id = () => crypto.randomUUID(),
  cap = () => "a".repeat(43);
const persona = (admin = false) =>
  history.replaceState(
    null,
    "",
    `/?demo=1&persona=${admin ? "admin" : "verified"}`,
  );
const call = (path: string, options: RequestOptions = {}) =>
  handleV4(s, path, options)!.data as any;
const post = (
  path: string,
  body: unknown,
  headers?: RequestOptions["headers"],
) => call(path, { method: "POST", body, headers });
beforeEach(() => {
  localStorage.clear();
  persona();
  s = {
    user: { id: 10, verified: true, displayName: "同学", phone: "13800000000" },
    foods: [
      {
        id: 1,
        name: "云吞",
        accountId: 10,
        restaurantId: 1,
        price: 12.5,
        pictureUrl: ["foods/old"],
        myCustomTags: [{ id: 1, name: "喜欢" }],
      },
    ],
    restaurants: [
      {
        id: 1,
        name: "小店",
        address: "西门",
        accountId: 10,
        gcjLng: 117,
        gcjLat: 36,
        hubId: 1,
      },
    ],
    tags: [{ id: 1, name: "喜欢" }],
    v4: seedV4(),
  };
});
it("keeps feedback categories on user records and filters the admin queue using private device metadata", () => {
  const issue = post(
    "/feedback/messages",
    { text: "图片加载失败", category: "PROBLEM" },
    { "Idempotency-Key": id() },
  );
  const other = post(
    "/feedback/messages",
    { text: "未分类的反馈" },
    { "Idempotency-Key": id() },
  );
  expect(call(`/feedback/mine/${issue.id}`)).toMatchObject({
    category: "PROBLEM",
  });
  expect(call(`/feedback/mine/${other.id}`).category).toBe("OTHER");
  expect(call(`/feedback/mine/${issue.id}`)).not.toHaveProperty(
    "submissionDevice",
  );
  persona(true);
  const detail = call(`/admin/feedback/cases/${issue.id}`);
  expect(detail.submissionDevice.platform).toBe("web");
  const query = {
    category: "PROBLEM",
    submitterId: detail.submitterId,
    appVersion: detail.submissionDevice.appVersion,
  };
  expect(
    call("/admin/feedback/cases", { query }).items.map(
      (item: typeof detail) => item.view.id,
    ),
  ).toEqual([issue.id]);
  expect(
    call("/admin/feedback/cases", {
      query: { ...query, appVersion: "unmatched" },
    }).items,
  ).toEqual([]);
});

it("keeps pending food private until an administrator approves its exact revision", () => {
  const r = post("/foods/upload", {
    name: "热云吞",
    price: 15.5,
    restaurantId: 1,
    category: "staple",
    pictureUrl: ["foods/new"],
  });
  expect(r.moderationStatus).toBe("PENDING");
  expect(s.foods).toHaveLength(1);
  const view = call(`/moderation/submissions/${r.revisionId}`);
  expect(view.candidate.pictureUrl).toBeUndefined();
  expect(view.imageCount).toBe(1);
  expect(() =>
    post("/admin/moderation/reviews", {
      revisionId: r.revisionId,
      verdict: "APPROVE",
      reasonCode: "OK",
    }),
  ).toThrow(/管理员/);
  persona(true);
  post("/admin/moderation/reviews", {
    revisionId: r.revisionId,
    verdict: "APPROVE",
    reasonCode: "OK",
  });
  expect(s.foods.find((f) => f.id === r.id)?.name).toBe("热云吞");
  expect(
    post("/admin/moderation/reviews", {
      revisionId: r.revisionId,
      verdict: "APPROVE",
      reasonCode: "OK",
    }).state,
  ).toBe("ALREADY_PUBLISHED");
  expect(() =>
    post("/admin/moderation/reviews", {
      revisionId: r.revisionId,
      verdict: "REJECT",
    }),
  ).toThrow(/已被处理/);
  const cards = call("/notification/cards");
  expect(cards.items[0].data.detail.type).toBe("moderation_result");
  expect(call("/notification/cards/unread/count").members).toBe(1);
  post(`/notification/cards/${cards.items[0].id}/read`, {});
  expect(call("/notification/cards/unread/count").members).toBe(0);
});
it("supersedes a pending edit without changing the public snapshot", () => {
  const a = call("/foods/my/edit/1", {
      method: "PUT",
      body: { name: "第一版" },
    }),
    b = call("/foods/my/edit/1", { method: "PUT", body: { name: "第二版" } });
  expect(s.foods[0].name).toBe("云吞");
  expect(call(`/moderation/submissions/${a.revisionId}`).moderationStatus).toBe(
    "SUPERSEDED",
  );
  expect(call(`/moderation/submissions/${b.revisionId}`).moderationStatus).toBe(
    "PENDING",
  );
});
it("deduplicates feedback and decisions and never silently applies catalog corrections", () => {
  const key = id(),
    body = { restaurantId: 1, errorType: "WRONG_NAME", note: "招牌更名了" },
    headers = { "Idempotency-Key": key };
  const r = post("/feedback/catalog-errors", body, headers);
  expect(post("/feedback/catalog-errors", body, headers)).toEqual(r);
  expect(s.v4.feedback).toHaveLength(1);
  expect(() =>
    post("/feedback/catalog-errors", { ...body, note: "另一条" }, headers),
  ).toThrow(/同一命令/);
  persona(true);
  const decision = { "Idempotency-Key": id() },
    result = post(
      `/admin/feedback/cases/${r.id}/resolution`,
      { outcome: "ACCEPTED", reply: "已核实" },
      decision,
    );
  expect(result.catalogChangeRequired).toBe(true);
  expect(s.restaurants[0].name).toBe("小店");
  expect(call(`/feedback/mine/${r.id}`).reply).toBe("已核实");
  expect(call("/notification/cards").items[0].data.detail.type).toBe(
    "case_result",
  );
});
it("applies topic revisions once and rejects stale edits", () => {
  persona(true);
  const commandId = id(),
    edit = {
      topicId: id(),
      expectedRevision: 0,
      campusId: 1,
      name: "新专题",
      introduction: "好吃",
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: new Date(Date.now() + 600000).toISOString(),
      foodIds: [1],
      coverFoodId: 1,
    },
    b = { commandId, operation: "PUBLISH", edit };
  const r = post("/admin/topics/commands", b);
  expect(post("/admin/topics/commands", b)).toEqual(r);
  expect(() =>
    post("/admin/topics/commands", { ...b, commandId: id() }),
  ).toThrow(/已被更新/);
  expect(call(`/topics/${r.numericId}`).foods).toHaveLength(1);
  expect(call("/topics/by-food/1")).toHaveLength(2);
  post("/admin/topics/commands", {
    ...b,
    commandId: id(),
    operation: "WITHDRAW",
    edit: { ...edit, expectedRevision: 1 },
  });
  persona();
  expect(() => call(`/topics/${r.numericId}`)).toThrow(/不可见/);
});
it("handles restaurant favorites, ratings and personal tag ownership", () => {
  call("/restaurant/1/favorite", { method: "PUT" });
  call("/restaurant/1/favorite", { method: "PUT" });
  expect(call("/restaurant/favorites").items).toHaveLength(1);
  call("/restaurant/1/rating", { method: "PUT", body: { rating: "GOOD" } });
  expect(call("/restaurant/detail/1").myRating).toBe("GOOD");
  expect(call("/restaurant/1/rating", { method: "DELETE" }).rating).toBeNull();
  call("/restaurant/1/favorite", { method: "DELETE" });
  expect(call("/restaurant/favorites").items).toHaveLength(0);
  expect(call("/foods/tags/my/1/foods").items).toHaveLength(1);
  expect(() => call("/foods/tags/my/2/foods")).toThrow(/不属于你/);
});
it("checks remote revisions, announcement audiences and build decisions", () => {
  persona(true);
  s.v4.settings.flags.autoCutout = { on: false, reason: "旧配置" };
  s.v4.settings.flags.publish = { on: false, reason: "暂停发布" };
  const initial = call("/admin/remote-config");
  expect(initial.settings.flags).not.toHaveProperty("autoCutout");
  expect(initial.settings.flags.publish).toEqual({
    on: false,
    reason: "暂停发布",
  });
  call("/admin/remote-config/settings", {
    method: "PUT",
    body: {
      ...initial.settings,
      expectedRevision: 1,
      maintenance: { mode: "READ_ONLY", message: "维护中" },
    },
  });
  expect(() =>
    call("/admin/remote-config/settings", {
      method: "PUT",
      body: { ...initial.settings, expectedRevision: 1 },
    }),
  ).toThrow(/更新/);
  post("/admin/remote-config/announcements", {
    level: "IMPORTANT",
    content: "仅测试构建",
    platforms: ["web"],
    campusIds: [1],
    minBuild: 5,
    maxBuild: 9,
    enabled: true,
  });
  const line = call("/admin/remote-config").versions.find(
    (x: any) => x.platform === "web",
  );
  call("/admin/remote-config/versions/web", {
    method: "PUT",
    body: { expectedRevision: line.revision, minBuild: 5, latestBuild: 10 },
  });
  const remote = call("/remote-config", {
    query: { platform: "web", campusId: 1, build: 6 },
  });
  expect(remote.flags).not.toHaveProperty("autoCutout");
  expect(remote.flags.publish).toEqual(initial.settings.flags.publish);
  expect(remote.update.decision).toBe("SUGGEST");
  expect(remote.announcements[0].content).toBe("仅测试构建");
  expect(
    call("/remote-config", {
      query: { platform: "web", campusId: 2, build: 4 },
    }).announcements,
  ).toHaveLength(1);
  expect(
    call("/remote-config", { query: { platform: "web", build: 4 } }).update
      .decision,
  ).toBe("FORCE");
  expect(call("/admin/remote-config/audit").items.length).toBeGreaterThan(0);
});
it("requires explicit telemetry consent, rejects payload text, deduplicates and stops after withdrawal", () => {
  const batch = {
    consentRevision: 2,
    events: [{ eventId: id(), properties: { event: "app_open" } }],
  };
  expect(() => post("/telemetry/events", batch)).toThrow(/尚未授权/);
  const consent = call("/telemetry/consent");
  call("/telemetry/consent", {
    method: "PUT",
    body: {
      expectedRevision: consent.revision,
      policyVersion: consent.policyVersion,
      enabled: true,
    },
  });
  expect(post("/telemetry/events", batch)).toEqual({
    accepted: 1,
    duplicates: 0,
  });
  expect(post("/telemetry/events", batch)).toEqual({
    accepted: 0,
    duplicates: 1,
  });
  expect(() =>
    post("/telemetry/events", {
      ...batch,
      events: [
        { eventId: id(), properties: { event: "app_open", url: "secret" } },
      ],
    }),
  ).toThrow(/未允许/);
  call("/telemetry/consent", {
    method: "DELETE",
    body: { expectedRevision: 2, policyVersion: consent.policyVersion },
  });
  expect(s.v4.events).toHaveLength(0);
  expect(() => post("/telemetry/events", batch)).toThrow(/尚未授权/);
});
it("uses current push generation and the observed close frontier", () => {
  const commandId = id(),
    proof = cap(),
    r = post("/push/bindings", {
      commandId,
      operation: "CREATE",
      capability: proof,
    });
  const refresh = {
    commandId: id(),
    operation: "REFRESH",
    bindingId: r.bindingId,
    capability: proof,
    deviceToken: "demo-only",
    expectedGeneration: 1,
    expectedTokenGeneration: 0,
  };
  post(`/push/bindings/${r.bindingId}/token`, refresh);
  expect(() =>
    post(`/push/bindings/${r.bindingId}/token`, {
      ...refresh,
      commandId: id(),
    }),
  ).toThrow(/更新/);
  const off = post("/push/settings/disable", {
    commandId: id(),
    operation: "DISABLE",
    category: "SYSTEM",
    expectedPreferenceRevision: 1,
  });
  expect(() =>
    post("/push/settings/enable", {
      commandId: id(),
      operation: "ENABLE",
      category: "SYSTEM",
      expectedPreferenceRevision: 2,
    }),
  ).toThrow(/关闭状态/);
  const on = post("/push/settings/enable", {
    commandId: id(),
    operation: "ENABLE",
    category: "SYSTEM",
    expectedPreferenceRevision: 2,
    observedCloseFrontier: off.closeFrontier,
  });
  expect(on.state).toBe("ENABLED");
  expect(() =>
    post("/push/commands/status", { commandId, capability: "wrong" }),
  ).toThrow(/凭据/);
  expect(
    post("/push/commands/status", {
      commandId,
      operation: "CREATE",
      capability: proof,
    }).bindingId,
  ).toBe(r.bindingId);
  expect(JSON.stringify(s)).not.toContain(proof);
  expect(JSON.stringify(s)).not.toContain("demo-only");
});
it("does not issue a session token for pending device revocation", () => {
  const commandId = id(),
    proof = cap(),
    b = { commandId, recoveryCapability: proof };
  expect(post("/auth/sessions/revoke-others", b).status).toBe("PENDING");
  expect(() =>
    post(
      `/auth/sessions/${commandId}/resume`,
      {},
      { "X-Recovery-Capability": "wrong" },
    ),
  ).toThrow(/凭据/);
  expect(
    post(
      `/auth/sessions/${commandId}/resume`,
      {},
      { "X-Recovery-Capability": proof },
    ).tokenValue,
  ).toBeNull();
  post(
    `/auth/sessions/${commandId}/status`,
    {},
    { "X-Recovery-Capability": proof },
  );
  expect(
    post(
      `/auth/sessions/${commandId}/resume`,
      {},
      { "X-Recovery-Capability": proof },
    ).status,
  ).toBe("READY");
});
it("scopes mobile recovery to its command and keeps pending credentials separate from login", () => {
  const commandId = id(),
    proof = cap();
  post("/user/mobile/commands", { commandId, mobile: "13900000000" });
  post(`/user/mobile/commands/${commandId}/codes`, { type: "NEW_PHONE" });
  const pending = post(`/user/mobile/commands/${commandId}/commit`, {
    newCode: "123456",
    password: "demo-only",
    recoveryCapability: proof,
  });
  expect(pending.credentialPropagation).toBe("PENDING");
  expect(pending.replacement.tokenValue).toBeNull();
  expect(() =>
    post(
      `/user/mobile/commands/${commandId}/resume`,
      {},
      { "X-Recovery-Capability": "wrong" },
    ),
  ).toThrow(/凭据/);
  const resumed = post(
    `/user/mobile/commands/${commandId}/resume`,
    {},
    { "X-Recovery-Capability": proof },
  );
  expect(resumed.status).toBe("READY");
  expect(s.user.phone).toBe("13900000000");
  expect(JSON.stringify(s)).not.toContain(proof);
});
it("requires an exact cancellation capability and credential operation to undo a pending request", () => {
  const requestId = id(),
    operationId = id(),
    proof = cap();
  post("/user/cancellation", { requestId, recoveryCapability: proof });
  const grant = post("/user/cancellation/recover/password", {
    requestId,
    operationId,
    identifier: "student",
    password: "demo-only",
    recoveryCapability: proof,
  });
  expect(() =>
    post(
      `/user/cancellation/${grant.subjectId}/${requestId}/cancel`,
      { credentialOperation: id() },
      { "X-Lifecycle-Recovery": proof },
    ),
  ).toThrow(/身份/);
  const result = post(
    `/user/cancellation/${grant.subjectId}/${requestId}/cancel`,
    { credentialOperation: operationId },
    { "X-Lifecycle-Recovery": proof },
  );
  expect(result.phase).toBe("ACTIVE");
  expect(result.complete).toBe(false);
});
it("requires a fresh captcha proof for every mobile code request", async () => {
  vi.resetModules();
  const { demoTransport } = await import("./transport"),
    commandId = id();
  await demoTransport("/user/mobile/commands", {
    method: "POST",
    body: { commandId, mobile: "13900000000" },
  });
  await expect(
    demoTransport(`/user/mobile/commands/${commandId}/codes`, {
      method: "POST",
      body: { type: "NEW_PHONE" },
    }),
  ).rejects.toMatchObject({ code: 30015 });
  const config = (await demoTransport("/auth/captcha/config", {})).data as any,
    headers = {
      "X-Captcha-Ticket": `demo-ticket:${config.aidEncrypted}`,
      "X-Captcha-Randstr": config.aidEncrypted,
    };
  const options = { method: "POST", body: { type: "NEW_PHONE" }, headers };
  expect(
    (await demoTransport(`/user/mobile/commands/${commandId}/codes`, options))
      .code,
  ).toBe(0);
  await expect(
    demoTransport(`/user/mobile/commands/${commandId}/codes`, options),
  ).rejects.toMatchObject({ code: 30016 });
});
it("restores a mock cancellation across a reload using only a persisted capability digest", async () => {
  vi.stubGlobal("crypto", webcrypto);
  try {
    vi.resetModules();
    const { demoTransport } = await import("./transport"),
      requestId = id(),
      proof = cap();
    await demoTransport("/user/cancellation", {
      method: "POST",
      body: { requestId, recoveryCapability: proof },
    });
    const raw = localStorage.getItem("eatwhat-demo-prototype-v3")!;
    expect(raw).not.toContain(proof);
    expect(JSON.parse(raw).v4.recoveries[requestId].capabilityHash).toMatch(
      /^[0-9a-f]{64}$/,
    );
    vi.resetModules();
    const reloaded = await import("./transport");
    const grant = (
      await reloaded.demoTransport("/user/cancellation/recover/password", {
        method: "POST",
        body: {
          requestId,
          operationId: id(),
          identifier: "student",
          password: "demo",
          recoveryCapability: proof,
        },
      })
    ).data as any;
    const status = await reloaded.demoTransport(
      `/user/cancellation/${grant.subjectId}/${requestId}/status`,
      { method: "POST", headers: { "X-Lifecycle-Recovery": proof } },
    );
    expect(status.data).toMatchObject({ phase: "PENDING", complete: false });
  } finally {
    vi.unstubAllGlobals();
  }
});
