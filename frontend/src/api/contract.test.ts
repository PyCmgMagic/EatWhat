import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createApi } from "./service";
import type { RequestOptions } from "./client";
import { parse } from "yaml";
// Read the only authoritative specification, including its unusual /api controller prefix.
const spec = parse(
  readFileSync(
    new URL("../../../docs/EatWhat 业务服务 APIv5.yaml", import.meta.url),
    "utf8",
  ),
);
it("every implemented service operation exists in the latest YAML contract and supplies its required parameters", async () => {
  const calls: { path: string; options: RequestOptions }[] = [];
  const api = createApi(
    async (path, options) => {
      calls.push({ path, options });
      return { code: 0, data: { id: 123, items: [] } };
    },
    async (getConfig, send, signal) => {
      const active = signal ?? new AbortController().signal;
      await getConfig(active);
      return send(
        {
          "X-Captcha-Ticket": "contract-ticket",
          "X-Captcha-Randstr": "contract-rand",
        },
        active,
      );
    },
  );
  await Promise.all([
    api.adminFeedbackCases({}),
    api.adminFeedbackCase(1),
    api.resolveFeedback(1, {}, "11111111-1111-4111-8111-111111111111"),
    api.moderationQueue({}),
    api.reviewSubmission({
      revisionId: "11111111-1111-4111-8111-111111111111",
      verdict: "APPROVE",
      reasonCode: "contract-fixture",
    }),
    api.adminSubmission("11111111-1111-4111-8111-111111111111"),
    api.adminSubmissionImage("11111111-1111-4111-8111-111111111111", 1),
    api.adminRemoteConfig(),
    api.adminAnnouncements({}),
    api.createAnnouncement({ level: "NORMAL", content: "contract-fixture" }),
    api.editAnnouncement(1, { level: "NORMAL", content: "contract-fixture" }),
    api.deleteAnnouncement(1, { expectedRevision: 1 }),
    api.configAudit({}),
    api.saveRemoteSettings({
      flags: {},
      params: {},
      maintenance: { mode: "NONE" },
      expectedRevision: 1,
    }),
    api.saveVersionLine("contract-fixture", {
      minBuild: 1,
      latestBuild: 1,
      expectedRevision: 1,
    }),
    api.topicCommand({
      commandId: "11111111-1111-4111-8111-111111111111",
      operation: "SAVE",
      edit: {
        topicId: "11111111-1111-4111-8111-111111111111",
        expectedRevision: 0,
        campusId: 1,
        name: "本期专题",
        introduction: "介绍",
        startsAt: "2026-11-02T00:00:00Z",
        endsAt: "2026-12-02T00:00:00Z",
        foodIds: [],
      },
    }),
    api.consentOfferWithPassword({
      userName: "contract-fixture",
      password: "contract-fixture",
    }),
    api.deviceSessions({}),
    api.revokeOtherSessions({
      commandId: "11111111-1111-4111-8111-111111111111",
      recoveryCapability: "contract-fixture",
    }),
    api.resumeDeviceSessions(
      "11111111-1111-4111-8111-111111111111",
      "fixture-capability",
    ),
    api.deviceSessionStatus(
      "11111111-1111-4111-8111-111111111111",
      "fixture-capability",
    ),
    api.revokeSession("11111111-1111-4111-8111-111111111111"),
    api.createCatalogError({}, "11111111-1111-4111-8111-111111111111"),
    api.createFeedback({}, "11111111-1111-4111-8111-111111111111"),
    api.myFeedback({}),
    api.feedbackCase(1),
    api.createReport({}, "11111111-1111-4111-8111-111111111111"),
    api.tagFoods(1, {}),
    api.mySubmissions({}),
    api.mySubmission("11111111-1111-4111-8111-111111111111"),
    api.submissionImage("11111111-1111-4111-8111-111111111111", 1),
    api.notificationCards({}),
    api.unreadCards({}),
    api.readCard("11111111-1111-4111-8111-111111111111"),
    api.registerPush({
      commandId: "11111111-1111-4111-8111-111111111111",
      operation: "CREATE",
      capability: "fixture-capability",
      category: "SYSTEM",
    }),
    api.refreshPush("11111111-1111-4111-8111-111111111111", {
      commandId: "11111111-1111-4111-8111-111111111111",
      operation: "REFRESH",
      capability: "fixture-capability",
      category: "SYSTEM",
    }),
    api.transferPush("11111111-1111-4111-8111-111111111111", {
      commandId: "11111111-1111-4111-8111-111111111111",
      operation: "TRANSFER",
      capability: "fixture-capability",
      category: "SYSTEM",
    }),
    api.unbindPush("11111111-1111-4111-8111-111111111111", {
      commandId: "11111111-1111-4111-8111-111111111111",
      operation: "UNBIND",
      capability: "fixture-capability",
      category: "SYSTEM",
    }),
    api.pushCommandStatus({
      commandId: "11111111-1111-4111-8111-111111111111",
      operation: "SETTINGS",
      capability: "fixture-capability",
      category: "SYSTEM",
    }),
    api.pushSettings(),
    api.disablePush({
      commandId: "11111111-1111-4111-8111-111111111111",
      operation: "DISABLE",
      capability: "fixture-capability",
      category: "SYSTEM",
    }),
    api.enablePush({
      commandId: "11111111-1111-4111-8111-111111111111",
      operation: "ENABLE",
      capability: "fixture-capability",
      category: "SYSTEM",
    }),
    api.remoteConfig({}),
    api.favoriteRestaurants({}),
    api.favoriteRestaurant(1),
    api.unfavoriteRestaurant(1),
    api.rateRestaurant(1, { rating: "RECOMMEND" }),
    api.unrateRestaurant(1),
    api.telemetryConsent(),
    api.saveTelemetryConsent({
      enabled: false,
      policyVersion: "policy",
      expectedRevision: 0,
    }),
    api.disableTelemetry({
      enabled: false,
      policyVersion: "policy",
      expectedRevision: 0,
    }),
    api.telemetryEvents({ consentRevision: 0, events: [] }),
    api.topicsForFood(1),
    api.currentTopic({ campusId: 1 }),
    api.topicHistory({ campusId: 1 }),
    api.topic(1),
    api.requestCancellation({}),
    api.recoverCancellationPassword({}),
    api.cancellationPhoneChallenge({}),
    api.verifyCancellationPhone({}),
    api.cancelCancellation(
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111",
      {},
      "fixture-capability",
    ),
    api.cancellationStatus(
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111",
      "fixture-capability",
    ),
    api.prepareMobile({
      commandId: "11111111-1111-4111-8111-111111111111",
      mobile: "contract-fixture",
    }),
    api.mobileRecoveryStatus(
      "11111111-1111-4111-8111-111111111111",
      "fixture-capability",
    ),
    api.resumeMobile(
      "11111111-1111-4111-8111-111111111111",
      "fixture-capability",
    ),
    api.mobileStatus("11111111-1111-4111-8111-111111111111"),
    api.mobileCode("11111111-1111-4111-8111-111111111111", {
      type: "OLD_PHONE",
    }),
    api.commitMobile("11111111-1111-4111-8111-111111111111", {
      newCode: "contract-fixture",
      recoveryCapability: "contract-fixture",
    }),
    api.setUsername({ userName: "student", code: "123456" }),
    api.ssoStartAlias(),
    api.legacyPhoneCode("13800000000"),
    api.userFoods(21),
    api.clearHistory(),
    api.recommendationSettings(),
    api.saveRecommendationSettings(false),
    api.blocks(),
    api.blockStatus(21),
    api.setBlock(21, true),
    api.setBlock(21, false),
    api.passwordConflictChallenge("student"),
    api.passwordConflictReset({ token: "proof", newPassword: "password1" }),
    api.accountReviews(),
    api.decideAccountReview("00000000-0000-4000-8000-000000000001", true),
    api.resetAccountConflict(21, "password1"),
    api.adminPolicy(),
    api.saveAdminPolicy({
      version: "v1",
      url: "/api/policies/v1.html",
      expectedRevision: 1,
    }),
    api.login({ userName: "abc", password: "123456", device: "WEB" }),
    api.register({ userName: "abc", password: "123456", device: "WEB" }),
    api.checkUsername("abc"),
    api.logout(),
    api.me(),
    api.updateProfile({ displayName: "abc" }),
    api.changePassword({ oldPassword: "a", newPassword: "123456" }),
    api.privacy({ following: true }),
    api.verified(),
    api.sendEmail("x@x.edu"),
    api.consentPolicy(),
    api.consent(),
    api.grantConsent({ policyVersion: "v1", proof: "proof" }),
    api.withdrawConsent(),
    api.recommend(),
    api.food(1),
    api.foods(1),
    api.myFoods(),
    api.favorites(),
    api.like(1, false),
    api.like(1, true),
    api.favorite(1, false),
    api.favorite(1, true),
    api.foodTags(1),
    api.myTags(),
    api.systemTags(),
    api.addCustomTags(1, ["want"]),
    api.addSystemTags(1, [2]),
    api.removeTag(1, 2),
    api.renameTag(2, "want"),
    api.deleteTag(2),
    api.createFood({ restaurantId: 1, name: "面", pictureUrl: ["k"] }),
    api.hubs(),
    api.restaurantSearch({ gcjLng: 117, gcjLat: 36 }),
    api.restaurant(1),
    api.createRestaurant({
      name: "店",
      address: "地址",
      gcjLng: 117,
      gcjLat: 36,
    }),
    api.presign({
      fileName: "x.jpg",
      contentType: "image/jpeg",
      fileSize: 1,
      biz: "foods",
    }),
    api.complete("k"),
    api.notifications(),
    api.unread(),
    api.read(1),
    api.readAll(),
    api.history("food"),
    api.otherUser(2),
    api.follow(2, true),
    api.follow(2, false),
    api.followers("followers"),
    api.followers("followings"),
    api.provinces(),
    api.cities(1),
    api.sendMobileCode("13800000000"),
    api.bindMobile("13800000000", "123456"),
    api.summary(),
    api.adminRestaurants(),
    api.editRestaurant(1, { name: "店" }),
    api.deleteRestaurant(1),
    api.editFood(1, { name: "面" }),
    api.deleteFood(1),
    api.adminTags(),
    api.createSystemTag("tag"),
    api.editSystemTag(1, "tag"),
    api.deleteSystemTag(1),
    api.adminUsers(),
    api.ban(1, "reason"),
    api.unban(1),
    api.createHub({ name: "校区", gcjLng: 117, gcjLat: 36 }),
    api.editHub(1, { name: "校区", gcjLng: 117, gcjLat: 36 }),
    api.deleteHub(1),
    api.rebindHub(1),
    api.phoneCode("13800000000"),
    api.phoneLogin({ mobile: "13800000000", code: "123456", device: "WEB" }),
    api.passwordCode(),
    api.resetPassword({ code: "123456", newPassword: "password" }),
    api.ssoStart(),
    api.preferences(),
    api.savePreferences({ likedTags: [], dislikedTags: [] }),
    api.clearPreferences(),
    api.campuses(),
    api.editMyFood(1, { description: "更新" }),
    api.deleteMyFood(1),
    api.browseRestaurants(),
    api.withdrawConsentWithPassword({ userName: "abc", password: "123456" }),
    api.hubDetail(1),
    api.locateHub(117, 36),
    api.presignBatch({
      biz: "foods",
      files: [{ fileName: "x.png", contentType: "image/png", fileSize: 1 }],
    }),
    api.catalogConflicts(),
    api.objectConflicts(),
    api.resolveObjectConflict("00000000-0000-4000-8000-000000000001", {
      expectedRevision: 1,
      heads: [],
      decision: "REJECT",
    }),
    api.catalogDecisions(),
    api.catalogDecision("00000000-0000-4000-8000-000000000001"),
    api.resolveCatalogConflict("00000000-0000-4000-8000-000000000001", {
      expectedRevision: 1,
      candidates: [],
      decision: "REJECT",
    }),
    api.resolveCatalogDecision("00000000-0000-4000-8000-000000000001", {
      candidateOperations: [],
      decisionHeads: [],
      decision: "REJECT",
    }),
    api.catalogReviews(),
    api.importCatalogHubs({
      sourceKey: "qa",
      requestId: "00000000-0000-4000-8000-000000000001",
      contentHash: "hash",
      hubs: [],
    }),
    api.profileConflicts(),
    api.resolveProfileConflict("00000000-0000-4000-8000-000000000001", {
      expectedRevision: 1,
    }),
    api.profileReviews(),
    api.resolveProfileReview("00000000-0000-4000-8000-000000000001", {
      expectedRevision: 1,
    }),
  ]);
  for (const { path, options } of calls) {
    const matched = Object.keys(spec.paths).find((template) =>
      new RegExp("^" + template.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(
        path,
      ),
    );
    expect(matched, `undefined endpoint ${path}`).toBeTruthy();
    const method = (options.method ?? "GET").toLowerCase();
    const op = spec.paths[matched!][method];
    expect(op, `${method} ${path} missing from v5`).toBeTruthy();
    for (const param of op.parameters ?? [])
      if (param.required && param.in === "query")
        expect(
          options.query?.[param.name],
          `${path} requires ${param.name}`,
        ).not.toBeUndefined();
    for (const param of op.parameters ?? [])
      if (param.required && param.in === "header")
        expect(
          options.headers?.[
            param.name as keyof NonNullable<RequestOptions["headers"]>
          ],
          `${path} requires ${param.name}`,
        ).toBeTruthy();
    if (
      op.requestBody?.required &&
      op.requestBody.content["application/json"]
    ) {
      expect(options.body, `${path} requires a body`).toBeDefined();
      const schema = op.requestBody.content["application/json"]?.schema;
      if (schema?.$ref) {
        const bodySchema =
          spec.components.schemas[schema.$ref.split("/").pop()];
        for (const key of bodySchema.required ?? [])
          expect(
            (options.body as Record<string, unknown>)[key],
            `${path} requires body.${key}`,
          ).not.toBeUndefined();
      }
    }
  }
  const implemented = new Set(
    calls.map(({ path, options }) => {
      const matched = Object.keys(spec.paths).find((template) =>
        new RegExp("^" + template.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(
          path,
        ),
      );
      return `${options.method ?? "GET"} ${matched}`;
    }),
  );
  const backendOnly = new Set([
    "GET /auth/verifyEmail",
    "GET /auth/callback/{state}",
    "POST /auth/callback/{state}",
    "GET /callback/{state}",
    "POST /callback/{state}",
  ]);
  const excluded: string[] = [],
    missing: string[] = [];
  for (const [path, methods] of Object.entries(spec.paths))
    for (const method of Object.keys(methods as object)) {
      if (!["get", "post", "put", "delete", "patch"].includes(method)) continue;
      const key = `${method.toUpperCase()} ${path}`;
      if (path.startsWith("/activity/") || path.startsWith("/admin/activities"))
        excluded.push(key);
      else if (!implemented.has(key) && !backendOnly.has(key))
        missing.push(key);
    }
  expect(missing).toEqual([]);
  expect(excluded).toHaveLength(14);
  expect(implemented.size).toBe(185);
});
