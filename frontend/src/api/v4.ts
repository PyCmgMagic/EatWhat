import {
  requiredData,
  type Query,
  type RequestOptions,
  type Envelope,
  type createRequester,
} from "./client";
import type { Schema } from "./models";
import type { CaptchaRunner } from "./captcha";
import type {
  PushCommand,
  TelemetryConsentInput,
  TelemetryBatch,
} from "./v4-types";
type Reply<K extends keyof Schema> = NonNullable<
  Schema[K] extends { data?: infer D } ? D : never
>;
export function createV4Api(
  request: ReturnType<typeof createRequester>,
  captcha?: CaptchaRunner,
) {
  const data = async <T>(path: string, options?: RequestOptions) =>
    requiredData(await request<T | null>(path, options));
  const captchaData = async <T>(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ) => {
    let result: T | undefined;
    const run = captcha ?? (await import("./captcha")).runBrowserCaptcha;
    await run(
      (active) =>
        data<Schema["PublicConfigResponse"]>("/auth/captcha/config", {
          public: true,
          cache: "no-store",
          signal: active,
        }),
      async (headers, active) => {
        result = await data<T>(path, {
          method: "POST",
          body,
          headers,
          signal: active,
          cache: "no-store",
        });
      },
      signal,
    );
    return requiredData(result);
  };
  return {
    adminFeedbackCases: (
      query: {
        status?: "OPEN" | "CLOSED";
        kind?: "FEEDBACK" | "CATALOG_ERROR" | "REPORT";
        page?: number;
        pageSize?: number;
      } = {},
    ) =>
      data<Reply<"Result_PageResult_AdminCaseViewResponse">>(
        `/admin/feedback/cases`,
        { query: query as Query },
      ),
    adminFeedbackCase: (id: number) =>
      data<Reply<"Result_AdminCaseViewResponse">>(
        `/admin/feedback/cases/${encodeURIComponent(id)}`,
        {},
      ),
    resolveFeedback: (
      id: number,
      body: Schema["ResolveInputRequest"],
      idempotencyKey: string,
    ) =>
      data<Reply<"Result_ResolvedResponse">>(
        `/admin/feedback/cases/${encodeURIComponent(id)}/resolution`,
        {
          method: "POST",
          body,
          headers: { "Idempotency-Key": idempotencyKey },
        },
      ),
    moderationQueue: (query: { page?: number; pageSize?: number } = {}) =>
      data<Reply<"Result_PageResult_SubmissionResponse">>(
        `/admin/moderation/queue`,
        { query: query as Query },
      ),
    reviewSubmission: (body: Schema["NativeModerationReviewsRequestRequest"]) =>
      data<Reply<"Result_NativeModerationReviewsResultResponse">>(
        `/admin/moderation/reviews`,
        { method: "POST", body },
      ),
    adminSubmission: (revisionId: string) =>
      data<Reply<"Result_SubmissionResponse">>(
        `/admin/moderation/revisions/${encodeURIComponent(revisionId)}`,
        {},
      ),
    adminSubmissionImage: (revisionId: string, slot: number) =>
      data<Reply<"Result_EvidenceUrlResponse">>(
        `/admin/moderation/revisions/${encodeURIComponent(revisionId)}/images/${encodeURIComponent(slot)}`,
        {},
      ),
    adminRemoteConfig: () =>
      data<Reply<"Result_AdminConfigResponse">>(`/admin/remote-config`, {}),
    adminAnnouncements: (query: { page?: number; pageSize?: number } = {}) =>
      data<Reply<"Result_PageResult_AdminAnnouncementResponse">>(
        `/admin/remote-config/announcements`,
        { query: query as Query },
      ),
    createAnnouncement: (body: Schema["SaveAnnouncementRequest"]) =>
      data<Reply<"Result_AdminAnnouncementResponse">>(
        `/admin/remote-config/announcements`,
        { method: "POST", body },
      ),
    editAnnouncement: (id: number, body: Schema["SaveAnnouncementRequest"]) =>
      data<Reply<"Result_AdminAnnouncementResponse">>(
        `/admin/remote-config/announcements/${encodeURIComponent(id)}`,
        { method: "PUT", body },
      ),
    deleteAnnouncement: (id: number, query: { expectedRevision: number }) =>
      request<void>(
        `/admin/remote-config/announcements/${encodeURIComponent(id)}`,
        { method: "DELETE", query: query as Query },
      ),
    configAudit: (query: { page?: number; pageSize?: number } = {}) =>
      data<Reply<"Result_PageResult_AuditEntryResponse">>(
        `/admin/remote-config/audit`,
        { query: query as Query },
      ),
    saveRemoteSettings: (body: Schema["SaveSettingsRequest"]) =>
      data<Reply<"Result_SettingsResponse">>(`/admin/remote-config/settings`, {
        method: "PUT",
        body,
      }),
    saveVersionLine: (
      platform: string,
      body: Schema["SaveVersionLineRequest"],
    ) =>
      data<Reply<"Result_AdminVersionLineResponse">>(
        `/admin/remote-config/versions/${encodeURIComponent(platform)}`,
        { method: "PUT", body },
      ),
    topicCommand: (body: Schema["CommandRequest"]) =>
      data<Reply<"Result_TopicModelsAcceptedResponse">>(
        `/admin/topics/commands`,
        { method: "POST", body },
      ),
    consentOfferWithPassword: (body: Schema["WithdrawalRequestRequest"]) =>
      request<Envelope<Schema["ConsentChallengeResponse"]>>(
        `/auth/consent/offer-with-password`,
        { method: "POST", body, public: true, raw: true },
      ),
    deviceSessions: (query: { cursor?: string; size?: number } = {}) =>
      data<Reply<"Result_DeviceSessionPageResponse">>(`/auth/sessions`, {
        query: query as Query,
      }),
    revokeOtherSessions: (body: Schema["RevokeOthersRequest"]) =>
      data<Reply<"Result_SessionRevocationResponse">>(
        `/auth/sessions/revoke-others`,
        { method: "POST", body },
      ),
    resumeDeviceSessions: (commandId: string, capability: string) =>
      data<Reply<"Result_OutcomeResponse">>(
        `/auth/sessions/${encodeURIComponent(commandId)}/resume`,
        {
          method: "POST",
          headers: { "X-Recovery-Capability": capability },
          public: true,
        },
      ),
    deviceSessionStatus: (commandId: string, capability: string) =>
      data<Reply<"Result_DeviceSessionRecoveryStatusResponse">>(
        `/auth/sessions/${encodeURIComponent(commandId)}/status`,
        {
          method: "POST",
          headers: { "X-Recovery-Capability": capability },
          public: true,
        },
      ),
    revokeSession: (sessionId: string) =>
      data<Reply<"Result_SessionRevocationResponse">>(
        `/auth/sessions/${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
      ),
    createCatalogError: (
      body: Schema["CatalogErrorInputRequest"],
      idempotencyKey: string,
    ) =>
      data<Reply<"Result_FeedbackAcceptedResponse">>(
        `/feedback/catalog-errors`,
        {
          method: "POST",
          body,
          headers: { "Idempotency-Key": idempotencyKey },
        },
      ),
    createFeedback: (
      body: Schema["FeedbackInputRequest"],
      idempotencyKey: string,
    ) =>
      data<Reply<"Result_FeedbackAcceptedResponse">>(`/feedback/messages`, {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    myFeedback: (
      query: {
        kind?: "FEEDBACK" | "CATALOG_ERROR" | "REPORT";
        page?: number;
        pageSize?: number;
      } = {},
    ) =>
      data<Reply<"Result_PageResult_CaseViewResponse">>(`/feedback/mine`, {
        query: query as Query,
      }),
    feedbackCase: (id: number) =>
      data<Reply<"Result_CaseViewResponse">>(
        `/feedback/mine/${encodeURIComponent(id)}`,
        {},
      ),
    createReport: (
      body: Schema["ReportInputRequest"],
      idempotencyKey: string,
    ) =>
      data<Reply<"Result_FeedbackAcceptedResponse">>(`/feedback/reports`, {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    tagFoods: (
      tagId: number,
      query: {
        gcjLng?: number;
        gcjLat?: number;
        restaurantId?: number;
        uploaderId?: number;
        hubId?: number;
        keyword?: string;
        category?:
          | "staple"
          | "drink"
          | "snack"
          | "dessert"
          | "soup"
          | "hot_pot"
          | "grill"
          | "cold_dish"
          | "side_dish"
          | "other";
        minPrice?: number;
        maxPrice?: number;
        sort?:
          | "NEWEST"
          | "PRICE_ASC"
          | "PRICE_DESC"
          | "POPULAR"
          | "FAVORITED_AT"
          | "DISTANCE";
        page?: number;
        pageSize?: number;
        systemTagIds?: number[];
        myCustomTagIds?: number[];
        myCustomTagNames?: string[];
      } = {},
    ) =>
      data<Reply<"Result_PageResult_FoodVOResponse">>(
        `/foods/tags/my/${encodeURIComponent(tagId)}/foods`,
        { query: query as Query },
      ),
    mySubmissions: (query: { page?: number; pageSize?: number } = {}) =>
      data<Reply<"Result_PageResult_SubmissionResponse">>(
        `/moderation/submissions/my`,
        { query: query as Query },
      ),
    mySubmission: (revisionId: string) =>
      data<Reply<"Result_SubmissionResponse">>(
        `/moderation/submissions/${encodeURIComponent(revisionId)}`,
        {},
      ),
    submissionImage: (revisionId: string, slot: number) =>
      data<Reply<"Result_EvidenceUrlResponse">>(
        `/moderation/submissions/${encodeURIComponent(revisionId)}/images/${encodeURIComponent(slot)}`,
        {},
      ),
    notificationCards: (
      query: {
        column?:
          | "ALL"
          | "COMMENTS"
          | "LIKES_AND_FAVORITES"
          | "FOLLOWS"
          | "SYSTEM"
          | "INTERACTION";
        page?: number;
        pageSize?: number;
      } = {},
    ) =>
      data<Reply<"Result_PageResult_CardResponse">>(`/notification/cards`, {
        query: query as Query,
      }),
    unreadCards: (
      query: {
        column?:
          | "ALL"
          | "COMMENTS"
          | "LIKES_AND_FAVORITES"
          | "FOLLOWS"
          | "SYSTEM"
          | "INTERACTION";
      } = {},
    ) =>
      data<Reply<"Result_UnreadResponse">>(`/notification/cards/unread/count`, {
        query: query as Query,
      }),
    readCard: (id: string) =>
      request<void>(`/notification/cards/${encodeURIComponent(id)}/read`, {
        method: "POST",
      }),
    registerPush: (body: PushCommand) =>
      data<Reply<"Result_ReceiptResponse">>(`/push/bindings`, {
        method: "POST",
        body,
      }),
    refreshPush: (id: string, body: PushCommand) =>
      data<Reply<"Result_ReceiptResponse">>(
        `/push/bindings/${encodeURIComponent(id)}/token`,
        { method: "POST", body },
      ),
    transferPush: (id: string, body: PushCommand) =>
      data<Reply<"Result_ReceiptResponse">>(
        `/push/bindings/${encodeURIComponent(id)}/transfer`,
        { method: "POST", body },
      ),
    unbindPush: (id: string, body: PushCommand) =>
      data<Reply<"Result_ReceiptResponse">>(
        `/push/bindings/${encodeURIComponent(id)}/unbind`,
        { method: "POST", body },
      ),
    pushCommandStatus: (body: PushCommand) =>
      data<Reply<"Result_ReceiptResponse">>(`/push/commands/status`, {
        method: "POST",
        body,
      }),
    pushSettings: () =>
      data<Reply<"Result_List_SettingResponse">>(`/push/settings`, {}),
    disablePush: (body: PushCommand) =>
      data<Reply<"Result_ReceiptResponse">>(`/push/settings/disable`, {
        method: "POST",
        body,
      }),
    enablePush: (body: PushCommand) =>
      data<Reply<"Result_ReceiptResponse">>(`/push/settings/enable`, {
        method: "POST",
        body,
      }),
    remoteConfig: (
      query: { platform?: string; build?: number; campusId?: number } = {},
    ) =>
      data<Reply<"Result_ClientConfigResponse">>(`/remote-config`, {
        query: query as Query,
        public: true,
      }),
    favoriteRestaurants: (
      query: {
        keyword?: string;
        hubId?: number;
        campusId?: number;
        gcjLng?: number;
        gcjLat?: number;
        radius?: number;
        categories?: (
          | "staple"
          | "drink"
          | "snack"
          | "dessert"
          | "soup"
          | "hot_pot"
          | "grill"
          | "cold_dish"
          | "side_dish"
          | "other"
        )[];
        priceBand?: "UNDER_15" | "FROM_15_TO_30" | "OVER_30";
        sort?: "DISTANCE" | "FOOD_COUNT" | "NEWEST" | "RECOMMENDATION_RATE";
        favoritesOnly?: boolean;
        recommendedOnly?: boolean;
        page?: number;
        pageSize?: number;
      } = {},
    ) =>
      data<Reply<"Result_PageResult_RestaurantResponse">>(
        `/restaurant/favorites`,
        { query: query as Query },
      ),
    favoriteRestaurant: (id: number) =>
      request<void>(`/restaurant/${encodeURIComponent(id)}/favorite`, {
        method: "PUT",
      }),
    unfavoriteRestaurant: (id: number) =>
      request<void>(`/restaurant/${encodeURIComponent(id)}/favorite`, {
        method: "DELETE",
      }),
    rateRestaurant: (id: number, body: Schema["RestaurantRatingDTORequest"]) =>
      data<Reply<"Result_RestaurantRatingViewResponse">>(
        `/restaurant/${encodeURIComponent(id)}/rating`,
        { method: "PUT", body },
      ),
    unrateRestaurant: (id: number) =>
      data<Reply<"Result_RestaurantRatingViewResponse">>(
        `/restaurant/${encodeURIComponent(id)}/rating`,
        { method: "DELETE" },
      ),
    telemetryConsent: () =>
      data<Reply<"Result_ConsentResponse">>(`/telemetry/consent`, {}),
    saveTelemetryConsent: (body: TelemetryConsentInput) =>
      data<Reply<"Result_ConsentResponse">>(`/telemetry/consent`, {
        method: "PUT",
        body,
      }),
    disableTelemetry: (body: TelemetryConsentInput) =>
      data<Reply<"Result_ConsentResponse">>(`/telemetry/consent`, {
        method: "DELETE",
        body,
      }),
    telemetryEvents: (body: TelemetryBatch) =>
      data<Reply<"Result_AcceptedResponse">>(`/telemetry/events`, {
        method: "POST",
        body,
      }),
    topicsForFood: (foodId: number) =>
      data<Reply<"Result_List_SummaryResponse">>(
        `/topics/by-food/${encodeURIComponent(foodId)}`,
        {},
      ),
    currentTopic: (query: { campusId: number }) =>
      request<Reply<"Result_SummaryResponse"> | null>(`/topics/current`, {
        query: query as Query,
      }),
    topicHistory: (query: {
      campusId: number;
      page?: number;
      pageSize?: number;
    }) =>
      data<Reply<"Result_PageResult_SummaryResponse">>(`/topics/history`, {
        query: query as Query,
      }),
    topic: (id: number) =>
      data<Reply<"Result_DetailResponse">>(
        `/topics/${encodeURIComponent(id)}`,
        {},
      ),
    requestCancellation: (
      body: Schema["LifecycleCancellationControllerRequestRequest"],
    ) =>
      data<Reply<"Result_LifecycleRequestStatusResponse">>(
        `/user/cancellation`,
        { method: "POST", body },
      ),
    recoverCancellationPassword: (body: Schema["PasswordRecoveryRequest"]) =>
      data<Reply<"Result_RecoveryGrantResponse">>(
        `/user/cancellation/recover/password`,
        { method: "POST", body, public: true },
      ),
    cancellationPhoneChallenge: (body: Schema["PhoneRecoveryRequest"]) =>
      data<Reply<"Result_RecoveryChallengeResponse">>(
        `/user/cancellation/recover/phone/challenge`,
        { method: "POST", body, public: true },
      ),
    verifyCancellationPhone: (body: Schema["PhoneRecoveryRequest"]) =>
      data<Reply<"Result_RecoveryGrantResponse">>(
        `/user/cancellation/recover/phone/verify`,
        { method: "POST", body, public: true },
      ),
    cancelCancellation: (
      subjectId: string,
      requestId: string,
      body: Schema["CancellationRequest"],
      capability: string,
    ) =>
      data<Reply<"Result_LifecycleRequestStatusResponse">>(
        `/user/cancellation/${encodeURIComponent(subjectId)}/${encodeURIComponent(requestId)}/cancel`,
        {
          method: "POST",
          body,
          headers: { "X-Lifecycle-Recovery": capability },
          public: true,
        },
      ),
    cancellationStatus: (
      subjectId: string,
      requestId: string,
      capability: string,
    ) =>
      data<Reply<"Result_LifecycleRequestStatusResponse">>(
        `/user/cancellation/${encodeURIComponent(subjectId)}/${encodeURIComponent(requestId)}/status`,
        {
          method: "POST",
          headers: { "X-Lifecycle-Recovery": capability },
          public: true,
        },
      ),
    prepareMobile: (body: Schema["PrepareRequest"]) =>
      data<Reply<"Result_PreparedResponse">>(`/user/mobile/commands`, {
        method: "POST",
        body,
      }),
    mobileRecoveryStatus: (commandId: string, capability: string) =>
      data<Reply<"Result_CommittedResponse">>(
        `/user/mobile/commands/${encodeURIComponent(commandId)}/recovery-status`,
        {
          method: "POST",
          headers: { "X-Recovery-Capability": capability },
          public: true,
        },
      ),
    resumeMobile: (commandId: string, capability: string) =>
      data<Reply<"Result_OutcomeResponse">>(
        `/user/mobile/commands/${encodeURIComponent(commandId)}/resume`,
        {
          method: "POST",
          headers: { "X-Recovery-Capability": capability },
          public: true,
        },
      ),
    mobileStatus: (command: string) =>
      data<Reply<"Result_StatusResponse">>(
        `/user/mobile/commands/${encodeURIComponent(command)}`,
        {},
      ),
    mobileCode: (
      command: string,
      body: Schema["SendRequest"],
      signal?: AbortSignal,
    ) =>
      captchaData<Reply<"Result_ChallengeResponse">>(
        `/user/mobile/commands/${encodeURIComponent(command)}/codes`,
        body,
        signal,
      ),
    commitMobile: (command: string, body: Schema["CommitRequest"]) =>
      data<Reply<"Result_CommittedResponse">>(
        `/user/mobile/commands/${encodeURIComponent(command)}/commit`,
        { method: "POST", body },
      ),
  };
}
