import type { operations } from "./schema";
import { boundedText, normalizedTag } from "./content-rules";
import { putImage } from "./storage-upload";
import { compressImage } from "./image-compression";
export type RestaurantFilters = NonNullable<
  operations["RestaurantController_browseRestaurants_get"]["parameters"]["query"]
>;
import type { CaptchaRunner } from "./captcha";
import { createV4Api } from "./v4";
import { createCommentsApi } from "./comments";
import {
  createRequester,
  ApiError,
  errorMessage,
  requiredData,
  type Envelope,
  type RequestOptions,
  type Transport,
} from "./client";
import type {
  Schema,
  Food,
  Restaurant,
  Hub,
  User,
  Page,
  CustomTag,
  Notification,
} from "./models";

export type FoodFilters = {
  hubId?: number;
  keyword?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  systemTagIds?: number[];
  myCustomTagIds?: number[];
  myCustomTagNames?: string[];
};
export type RecommendFilters = {
  campusId?: number;
  mealTime?: string;
  category?: string;
  size?: number;
  deviceId?: string;
};

export function createApi(transport: Transport, captcha?: CaptchaRunner) {
  const request = createRequester(transport);
  const sendVerified = async (path: string, options: RequestOptions = {}) => {
    options.signal?.throwIfAborted();
    const body = (options.body ?? {}) as Record<string, unknown>;
    if (
      ["/auth/phone/code", "/user/getCode", "/auth/getCode"].includes(path) &&
      !/^1[3-9][0-9]{9}$/.test(
        String(body.mobile ?? options.query?.mobile ?? ""),
      )
    )
      throw new Error("请输入有效的 11 位手机号。");
    if (
      path === "/auth/sendEmail" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(options.query?.email ?? ""))
    )
      throw new Error("请输入有效的邮箱地址。");
    if (
      path === "/auth/password-conflict/challenge" &&
      (!String(body.identifier ?? "").trim() ||
        String(body.identifier).length > 64)
    )
      throw new Error("请输入 1–64 个字符的账号标识。");
    const runner = captcha ?? (await import("./captcha")).runBrowserCaptcha;
    return runner(
      (signal) =>
        data<Schema["PublicConfigResponse"]>("/auth/captcha/config", {
          public: true,
          cache: "no-store",
          signal,
        }),
      (headers, signal) =>
        request<void>(path, { ...options, headers, signal, cache: "no-store" }),
      options.signal,
    );
  };
  const data = async <T>(path: string, options?: RequestOptions) =>
    requiredData(await request<T | null>(path, options));
  const post = (
    path: string,
    body?: unknown,
    query?: RequestOptions["query"],
  ) => request<void>(path, { method: "POST", body, query });
  const created = async (path: string, body: unknown) => {
    const value = await data<Schema["CreatedResourceVOResponse"]>(path, {
      method: "POST",
      body,
    });
    if (!Number.isSafeInteger(value.id) || (value.id ?? 0) < 1)
      throw new ApiError(
        "创建结果缺少有效编号，请先到列表核实，避免重复提交。",
        "INVALID_RESPONSE",
      );
    return {
      id: value.id as number,
      moderationStatus: value.moderationStatus ?? null,
      revisionId: value.revisionId ?? null,
    };
  };
  return {
    ...createV4Api(request, captcha),
    ...createCommentsApi(request),
    recordActivity: (signal?: AbortSignal) =>
      data<Schema["DailyUseResponse"]>("/user/activity", {
        method: "POST",
        signal,
        background: true,
      }),
    growth: () => data<Schema["GrowthProgressResponse"]>("/user/growth"),
    growthLedger: (page = 1, pageSize = 20) => {
      if (
        !Number.isInteger(page) ||
        page < 1 ||
        page > 10000 ||
        !Number.isInteger(pageSize) ||
        pageSize < 1 ||
        pageSize > 100
      )
        throw new Error("经验记录页码或每页数量无效。");
      return data<Page<Schema["ExperienceEntryResponse"]>>(
        "/user/growth/ledger",
        { query: { page, pageSize } },
      );
    },
    engagementStats: (date?: string) =>
      data<Schema["EngagementStatsResponse"]>("/admin/engagement/stats", {
        query: { date },
      }),
    login: (body: Schema["LoginDTORequest"]) =>
      request<Envelope<Schema["AuthReply"]["data"]>>("/auth/login", {
        method: "POST",
        body,
        raw: true,
        public: true,
      }),
    /** @deprecated New accounts register through phoneCode and phoneLogin. */
    register: (body: Schema["RegisterDTORequest"]) =>
      request<Envelope<Schema["AuthReply"]["data"]>>("/auth/register", {
        method: "POST",
        body,
        raw: true,
        public: true,
      }),
    phoneCode: (mobile: string, signal?: AbortSignal) =>
      sendVerified("/auth/phone/code", {
        signal,
        method: "POST",
        body: { mobile },
        public: true,
      }),
    phoneLogin: (body: Schema["PhoneLoginDTORequest"]) =>
      request<Envelope<Schema["PhoneLoginReply"]["data"]>>(
        "/auth/phone/login",
        { method: "POST", body, public: true, raw: true },
      ),
    passwordCode: (signal?: AbortSignal) =>
      sendVerified("/auth/password/code", { method: "POST", signal }),
    legacyPhoneCode: (mobile: string, signal?: AbortSignal) =>
      sendVerified("/auth/getCode", {
        method: "POST",
        query: { mobile },
        signal,
      }),
    resetPassword: (body: Schema["ResetPasswordByCodeDTORequest"]) =>
      post("/auth/password/reset", body),
    ssoStart: () =>
      data<Schema["SsoStartVOResponse"]>("/auth/sdu", { method: "POST" }),
    ssoStartAlias: () => data<Schema["SsoStartVOResponse"]>("/auth/sdu"),
    setUsername: (body: Schema["SetLoginUsernameDTORequest"]) =>
      data<Schema["LoginUsernameVOResponse"]>("/auth/username/set", {
        method: "POST",
        body,
      }),
    userFoods: (userId: number, page = 1, filters?: FoodFilters) =>
      data<Page<Food>>(`/foods/by-user/${userId}`, {
        query: { page, pageSize: 12, ...filters },
      }),
    clearHistory: (targetType?: "food" | "restaurant") =>
      request<void>("/history/browse", {
        method: "DELETE",
        query: { targetType },
      }),
    recommendationSettings: () =>
      data<Schema["RecommendationSettingsResponse"]>(
        "/user/recommendation-settings",
      ),
    saveRecommendationSettings: (personalized: boolean) =>
      data<Schema["RecommendationSettingsResponse"]>(
        "/user/recommendation-settings",
        { method: "PUT", body: { personalized } },
      ),
    blocks: (page = 1) =>
      data<Page<Schema["BlockedUserResponse"]>>("/user/blocks", {
        query: { page, pageSize: 20 },
      }),
    blockStatus: (userId: number) =>
      data<Schema["BlockStatusResponse"]>(`/user/blocks/${userId}`),
    setBlock: (userId: number, blocked: boolean) =>
      data<Schema["BlockStatusResponse"]>(`/user/blocks/${userId}`, {
        method: blocked ? "PUT" : "DELETE",
      }),
    passwordConflictChallenge: (identifier: string, signal?: AbortSignal) =>
      sendVerified("/auth/password-conflict/challenge", {
        method: "POST",
        body: { identifier },
        public: true,
        signal,
      }),
    passwordConflictReset: (
      body: Schema["AccountPasswordRecoveryResetRequest"],
    ) =>
      request<void>("/auth/password-conflict/reset", {
        method: "POST",
        body,
        public: true,
      }),
    accountReviews: () =>
      data<Schema["ReviewSummaryResponse"][]>("/auth/security/account-reviews"),
    decideAccountReview: (eventId: string, approved: boolean) =>
      post(
        `/auth/security/account-reviews/${encodeURIComponent(eventId)}/decision`,
        { approved },
      ),
    resetAccountConflict: (userId: number, newPassword: string) =>
      post(
        `/auth/security/account-reviews/password-conflicts/${userId}/reset`,
        { newPassword },
      ),
    adminPolicy: () =>
      data<Schema["ConsentPolicySettingsVOResponse"]>("/admin/consent/policy"),
    saveAdminPolicy: (body: Schema["SaveConsentPolicyDTORequest"]) =>
      data<Schema["ConsentPolicySettingsVOResponse"]>("/admin/consent/policy", {
        method: "PUT",
        body,
      }),
    preferences: () =>
      data<Schema["ManualPreferencesResponse"]>(
        "/user/recommendation-profile/preferences",
      ),
    savePreferences: (body: Schema["FoodPreferencesDTORequest"]) =>
      data<Schema["ManualPreferencesResponse"]>(
        "/user/recommendation-profile/preferences",
        { method: "PUT", body },
      ),
    clearPreferences: () =>
      data<Schema["ManualPreferencesResponse"]>(
        "/user/recommendation-profile/preferences",
        { method: "DELETE" },
      ),
    campuses: () => data<Schema["CampusResponse"][]>("/campus/list"),
    checkUsername: (userName: string) =>
      request<void>("/auth/checkUsername", {
        method: "POST",
        query: { userName },
        public: true,
      }),
    logout: () => post("/auth/logout"),
    me: () => data<User>("/user/info"),
    updateProfile: (body: Schema["UpdateUserInfoDTORequest"]) =>
      request<void>("/user/updateInfo", { method: "PUT", body }),
    changePassword: (body: Schema["ChangePwdDTORequest"]) =>
      post("/auth/changePassword", body),
    privacy: (body: Schema["PrivacyDTORequest"]) =>
      post("/user/changePrivacy", body),
    verified: () => data<string[]>("/auth/verify"),
    sendEmail: (email: string, signal?: AbortSignal) =>
      sendVerified("/auth/sendEmail", { query: { email }, signal }),
    consentPolicy: () =>
      data<Schema["ConsentPolicyVOResponse"]>("/auth/consent/policy", {
        public: true,
      }),
    consent: () => data<Schema["ConsentStatusViewResponse"]>("/auth/consent"),
    grantConsent: (body: Schema["AccountConsentGrantRequestRequest"]) =>
      request<void>("/auth/consent/grant", {
        method: "POST",
        body,
        public: !!body.proof,
      }),
    withdrawConsent: () => post("/auth/consent/withdraw"),
    withdrawConsentWithPassword: (
      body: Schema["AccountConsentWithdrawalRequestRequest"],
    ) =>
      request<Schema["ConsentViewResponse"] | null>(
        "/auth/consent/withdraw-with-password",
        {
          method: "POST",
          body,
          public: true,
        },
      ),
    recommend: async (limit = 8, filters: RecommendFilters = {}) => {
      // Deployed servers return data as an array; the checked-in API contract
      // still describes a page. Normalize both here for desktop and mobile.
      const result = await data<Food[] | Page<Food>>("/foods/recommend", {
        query: { size: limit, ...filters },
      });
      const items = Array.isArray(result) ? result : result.items;
      if (!Array.isArray(items))
        throw new ApiError(
          "推荐数据格式不正确，请稍后重试。",
          "INVALID_RESPONSE",
        );
      return items;
    },
    food: (id: number) => data<Food>(`/foods/detail/${id}`),
    foods: (
      restaurantId: number | undefined,
      page = 1,
      filters?: FoodFilters,
    ) =>
      data<Page<Food>>("/foods/list", {
        query: { restaurantId, page, pageSize: 12, ...filters },
      }),
    myFoods: (page = 1) =>
      data<Page<Food>>("/foods/my", { query: { page, pageSize: 12 } }),
    favorites: (page = 1, filters?: FoodFilters) =>
      data<Page<Food>>("/foods/favorites", {
        query: { page, pageSize: 12, ...filters },
      }),
    like: (id: number, liked: boolean) =>
      post(`/foods/${id}/${liked ? "unlike" : "like"}`),
    favorite: (id: number, saved: boolean) =>
      post(`/foods/${id}/${saved ? "unfavorite" : "favorite"}`),
    foodTags: (id: number) =>
      data<Schema["FoodTagViewVOResponse"]>(`/foods/${id}/tags`),
    myTags: (page = 1) =>
      data<Page<CustomTag>>("/foods/tags/my", {
        query: { page, pageSize: 20 },
      }),
    systemTags: () =>
      data<Schema["FoodTagSummaryVOResponse"][]>("/foods/tags/system"),
    addCustomTags: (id: number, names: string[]) =>
      post(`/foods/${id}/tags/custom`, {
        names: names.map((name) =>
          boundedText(normalizedTag(name), 10, "个人标签"),
        ),
      }),
    addSystemTags: (id: number, tagIds: number[]) =>
      post(`/foods/${id}/tags/system`, { tagIds }),
    removeTag: (id: number, tagId: number) =>
      request<void>(`/foods/${id}/tags/${tagId}`, { method: "DELETE" }),
    renameTag: (tagId: number, name: string) =>
      request<void>(`/foods/tags/my/${tagId}`, {
        method: "PUT",
        body: { name: boundedText(normalizedTag(name), 10, "个人标签") },
      }),
    deleteTag: (tagId: number) =>
      request<void>(`/foods/tags/my/${tagId}`, { method: "DELETE" }),
    createFood: (body: Schema["CreateFoodDTORequest"]) =>
      created("/foods/upload", body),
    editMyFood: (id: number, body: Schema["EditFoodDTORequest"]) =>
      request<Schema["CreatedResourceVOResponse"] | null>(`/foods/my/${id}`, {
        method: "PUT",
        body,
      }),
    deleteMyFood: (id: number) =>
      request<void>(`/foods/my/${id}`, { method: "DELETE" }),
    hubs: (page = 1) =>
      data<Page<Hub>>("/hub/list", { query: { page, pageSize: 20 } }),
    hubDetail: (id: number) => data<Hub>(`/hub/detail/${id}`),
    locateHub: (gcjLng: number, gcjLat: number) =>
      request<Hub | null>("/hub/locate", { query: { gcjLng, gcjLat } }),
    restaurantSearch: (
      query: RestaurantFilters & { gcjLng: number; gcjLat: number },
    ) =>
      data<Page<Restaurant>>("/restaurant/search", {
        query: {
          ...query,
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 12,
        },
      }),
    restaurant: (id: number) => data<Restaurant>(`/restaurant/detail/${id}`),
    browseRestaurants: (query: RestaurantFilters = {}) =>
      data<Page<Restaurant>>("/restaurant/browse", {
        query: { page: 1, pageSize: 12, ...query },
      }),
    createRestaurant: (body: Schema["RestaurantDTORequest"]) =>
      created("/restaurant/add", {
        ...body,
        name: boundedText(body.name, 20, "店名"),
        address: boundedText(body.address, 30, "地址"),
      }),
    presign: (body: Schema["PresignUploadReqDTORequest"]) =>
      data<Schema["PresignUploadRespDTOResponse"]>("/upload/presign", {
        method: "POST",
        body,
      }),
    presignBatch: (body: Schema["PresignBatchUploadReqDTORequest"]) =>
      data<Schema["PresignBatchUploadRespDTOResponse"]>(
        "/upload/presign/batch",
        {
          method: "POST",
          body,
        },
      ),
    complete: (key: string) =>
      data<Schema["CompletedFileResponse"]>("/upload/complete", {
        method: "POST",
        body: { key },
      }),
    notifications: (page = 1) =>
      data<Page<Notification>>("/notification/list", {
        query: { page, pageSize: 20 },
      }),
    unread: () => data<number>("/notification/unread/count"),
    read: (id: number) => post(`/notification/read/${id}`),
    readAll: () => post("/notification/read/all"),
    history: (targetType: "food" | "restaurant", page = 1) =>
      data<Page<Schema["BrowseHistoryItemDTOResponse"]>>("/history/browse", {
        query: { targetType, page, pageSize: 12 },
      }),
    otherUser: (userId: number) =>
      data<Schema["OtherUserInfoDTOResponse"]>("/user/userInfo", {
        query: { userId },
      }),
    follow: (userId: number, following: boolean) =>
      post(`/user/${following ? "unfollow" : "follow"}`, undefined, { userId }),
    followers: (kind: "followers" | "followings", userId?: number, page = 1) =>
      data<Page<Schema["FansDTOResponse"]>>(`/user/${kind}`, {
        query: { userId, page, pageSize: 20 },
      }),
    provinces: () =>
      data<Schema["ProvinceDTOResponse"][]>("/api/location/provinces"),
    cities: (provinceId: number) =>
      data<Schema["CityDTOResponse"][]>(
        `/api/location/provinces/${provinceId}/cities`,
      ),
    sendMobileCode: (mobile: string, signal?: AbortSignal) =>
      sendVerified("/user/getCode", {
        method: "POST",
        body: { mobile, scene: "bind" },
        signal,
      }),
    bindMobile: (mobile: string, code: string) =>
      post("/user/bindMobile", { mobile, code }),
    summary: () => data<Schema["SummaryVOResponse"]>("/admin/summary"),
    adminRestaurants: (page = 1, keyword?: string) =>
      data<Page<Restaurant>>("/restaurant/list", {
        query: { page, pageSize: 12, keyword },
      }),
    editRestaurant: (id: number, body: Schema["EditRestaurantDTORequest"]) =>
      request<Schema["CreatedResourceVOResponse"] | null>(
        `/restaurant/edit/${id}`,
        { method: "PUT", body },
      ),
    deleteRestaurant: (id: number) =>
      request<void>(`/restaurant/delete/${id}`, { method: "DELETE" }),
    editFood: (id: number, body: Schema["EditFoodDTORequest"]) =>
      request<Schema["CreatedResourceVOResponse"] | null>(`/foods/edit/${id}`, {
        method: "PUT",
        body,
      }),
    deleteFood: (id: number) =>
      request<void>(`/foods/delete/${id}`, { method: "DELETE" }),
    adminTags: (page = 1) =>
      data<Page<Schema["AdminFoodTagVOResponse"]>>("/admin/food-tags", {
        query: { page, pageSize: 20 },
      }),
    createSystemTag: (name: string) => post("/admin/food-tags", { name }),
    editSystemTag: (id: number, name: string) =>
      request<void>(`/admin/food-tags/${id}`, {
        method: "PUT",
        body: { name },
      }),
    deleteSystemTag: (id: number) =>
      request<void>(`/admin/food-tags/${id}`, { method: "DELETE" }),
    adminUsers: (page = 1) =>
      data<Page<Schema["UserListItemVOResponse"]>>("/user/list", {
        query: { page, pageSize: 20 },
      }),
    ban: (userId: number, reason: string, banUntil?: string) =>
      post(`/user/ban/${userId}`, { reason, banUntil }),
    unban: (userId: number) => post(`/user/unban/${userId}`),
    createHub: (body: Schema["HubDTORequest"]) => post("/hub/add", body),
    editHub: (id: number, body: Schema["HubDTORequest"]) =>
      request<void>(`/hub/edit/${id}`, { method: "PUT", body }),
    deleteHub: (id: number) =>
      request<void>(`/hub/delete/${id}`, { method: "DELETE" }),
    rebindHub: (id: number) =>
      data<number>(`/hub/rebind-restaurants/${id}`, { method: "POST" }),
    catalogConflicts: () =>
      data<Schema["ConflictViewResponse"][]>("/admin/sync/catalog/conflicts"),
    objectConflicts: () =>
      data<Schema["ObjectHeadConflictViewResponse"][]>(
        "/admin/sync/catalog/conflicts/objects",
      ),
    resolveObjectConflict: (
      id: string,
      body: Schema["CatalogConflictResolveHeadRequestRequest"],
    ) =>
      data<Schema["ResolutionResultResponse"]>(
        `/admin/sync/catalog/conflicts/objects/${encodeURIComponent(id)}/resolve`,
        { method: "POST", body },
      ),
    catalogDecisions: () =>
      data<Schema["DecisionViewResponse"][]>(
        "/admin/sync/catalog/conflicts/decisions",
      ),
    catalogDecision: (id: string) =>
      data<Schema["DecisionViewResponse"]>(
        `/admin/sync/catalog/conflicts/decisions/${encodeURIComponent(id)}`,
      ),
    resolveCatalogConflict: (
      id: string,
      body: Schema["CatalogConflictResolveRequestRequest"],
    ) =>
      data<Schema["ResolutionResultResponse"]>(
        `/admin/sync/catalog/conflicts/${encodeURIComponent(id)}/resolve`,
        { method: "POST", body },
      ),
    resolveCatalogDecision: (
      id: string,
      body: Schema["CatalogConflictResolveDecisionRequestRequest"],
    ) =>
      data<Schema["ResolutionResultResponse"]>(
        `/admin/sync/catalog/conflicts/decisions/${encodeURIComponent(id)}/resolve`,
        { method: "POST", body },
      ),
    catalogReviews: () =>
      data<Schema["AuthorizationReviewViewResponse"][]>(
        "/admin/sync/catalog/conflicts/reviews",
      ),
    importCatalogHubs: (body: Schema["CatalogHubImportRequestRequest"]) =>
      data<Schema["CatalogImportResultResponse"]>(
        "/admin/sync/catalog/import/hubs",
        { method: "POST", body },
      ),
    profileConflicts: () =>
      data<Schema["ConflictResponse"][]>("/admin/sync/profile-conflicts"),
    resolveProfileConflict: (
      id: string,
      body: Schema["ResolveRequestRequest"],
    ) =>
      post(
        `/admin/sync/profile-conflicts/${encodeURIComponent(id)}/resolve`,
        body,
      ),
    profileReviews: () =>
      data<Schema["AuthorizationReviewResponse"][]>(
        "/admin/sync/profile-conflicts/authorization-reviews",
      ),
    resolveProfileReview: (id: string, body: Schema["ResolveRequestRequest"]) =>
      post(
        `/admin/sync/profile-conflicts/authorization-reviews/${encodeURIComponent(id)}/resolve`,
        body,
      ),
  };
}
export type Api = ReturnType<typeof createApi>;

export async function uploadFiles(
  api: Pick<Api, "presign" | "presignBatch" | "complete">,
  files: File[],
  biz: Schema["PresignUploadReqDTORequest"]["biz"],
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  onComplete?: (index: number, key: string) => void,
) {
  if (!files.length || files.length > 9) throw new Error("请选择 1–9 张图片。");
  if (files.length === 1) {
    const key = await uploadFile(api, files[0], biz, signal, fetcher);
    onComplete?.(0, key);
    return [key];
  }
  // Decode one original at a time to limit memory use on mobile devices.
  const prepared: File[] = [];
  for (const file of files)
    prepared.push(await compressImage(file, biz, signal));
  signal?.throwIfAborted();
  const signed = await api.presignBatch({
    biz,
    files: prepared.map((file) => ({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    })),
  });
  const credentials = signed.files;
  if (
    !credentials ||
    credentials.length !== files.length ||
    new Set(credentials.map((item) => item?.key)).size !== files.length
  )
    throw new Error("批量上传凭证数量或文件标识不一致，请重试。");
  for (const item of credentials) {
    if (
      !item?.key ||
      !item.putUrl ||
      !["https:", "http:"].includes(new URL(item.putUrl).protocol)
    )
      throw new Error("批量上传凭证不完整，请重试。");
  }
  const keys: string[] = [];
  for (let index = 0; index < files.length; index++) {
    const item = credentials[index]!;
    await putImage(
      item.putUrl!,
      prepared[index],
      signal,
      fetcher,
      `第 ${index + 1} 张图片`,
    );
    signal?.throwIfAborted();
    const completed = await api.complete(item.key!);
    signal?.throwIfAborted();
    if (completed.key !== item.key)
      throw new Error("图片确认结果不一致，请重试。");
    keys.push(item.key!);
    onComplete?.(index, item.key!);
  }
  return keys;
}

export function classifyAuth(reply: Envelope<unknown>) {
  const d = reply.data;
  if (
    String(reply.code) === "0" &&
    d &&
    typeof d === "object" &&
    "tokenValue" in d &&
    "tokenName" in d &&
    "isLogin" in d &&
    d.isLogin === true &&
    typeof d.tokenValue === "string" &&
    d.tokenValue &&
    typeof d.tokenName === "string" &&
    d.tokenName
  ) {
    return {
      kind: "session" as const,
      session: { tokenName: d.tokenName, tokenValue: d.tokenValue },
    };
  }
  if (
    ["20005", "20006"].includes(String(reply.code)) ||
    (d &&
      typeof d === "object" &&
      ("consentProof" in d ||
        "identityReady" in d ||
        "registrationAccepted" in d))
  ) {
    return {
      kind: "error" as const,
      message: "账号暂时无法登录，请稍后重试或联系管理员检查账号状态。",
    };
  }
  return {
    kind: "error" as const,
    message: errorMessage(
      new ApiError(
        reply.msg || "服务未返回有效登录会话，请稍后重新登录。",
        reply.code,
      ),
    ),
  };
}

export async function uploadFile(
  api: Pick<Api, "presign" | "complete">,
  file: File,
  biz: Schema["PresignUploadReqDTORequest"]["biz"],
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  onPhase?: (phase: "uploading" | "confirming") => void,
) {
  onPhase?.("uploading");
  const prepared = await compressImage(file, biz, signal);
  signal?.throwIfAborted();
  const signed = await api.presign({
    fileName: prepared.name,
    contentType: prepared.type,
    fileSize: prepared.size,
    biz,
  });
  if (!signed.putUrl || !signed.key)
    throw new Error("上传凭证不完整，请重新选择图片。");
  await putImage(signed.putUrl, prepared, signal, fetcher);
  signal?.throwIfAborted();
  onPhase?.("confirming");
  const completed = await api.complete(signed.key);
  signal?.throwIfAborted();
  if (!completed.key || completed.key !== signed.key)
    throw new Error("图片确认结果不一致，请重新上传。");
  return completed.key;
}
