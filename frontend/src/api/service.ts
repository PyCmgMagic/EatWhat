import {
  createRequester,
  ApiError,
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

export type FoodFilters = { hubId?: number; keyword?: string; category?: string; minPrice?: number; maxPrice?: number; sort?: string; systemTagIds?: number[]; myCustomTagIds?: number[]; myCustomTagNames?: string[] };
export type RecommendFilters = {campusId?: number;mealTime?: string;category?: string;size?: number;deviceId?: string};

export function createApi(transport: Transport) {
  const request = createRequester(transport);
  const data = async <T>(path: string, options?: RequestOptions) =>
    requiredData(await request<T | null>(path, options));
  const post = (
    path: string,
    body?: unknown,
    query?: RequestOptions["query"],
  ) => request<void>(path, { method: "POST", body, query });
  const created = async (path:string,body:unknown) => {
    const value=await data<Schema["CreatedResourceVOResponse"]>(path,{method:"POST",body});
    if(!Number.isSafeInteger(value.id)||(value.id??0)<1) throw new ApiError("创建结果缺少有效编号，请先到列表核实，避免重复提交。","INVALID_RESPONSE");
    return {id:value.id as number};
  };
  return {
    login: (body: Schema["LoginDTORequest"]) =>
      request<Envelope<Schema["AuthReply"]["data"]>>("/auth/login", {
        method: "POST",
        body,
        raw: true,
        public: true,
      }),
    register: (body: Schema["RegisterDTORequest"]) =>
      request<Envelope<Schema["AuthReply"]["data"]>>("/auth/register", {
        method: "POST",
        body,
        raw: true,
        public: true,
      }),
    phoneCode: (mobile: string) => request<void>("/auth/phone/code", {method:"POST",body:{mobile},public:true}),
    phoneLogin: (body: Schema["PhoneLoginDTORequest"]) => request<Envelope<Schema["PhoneLoginReply"]["data"]>>("/auth/phone/login", {method:"POST",body,public:true,raw:true}),
    passwordCode: () => post("/auth/password/code"),
    resetPassword: (body: Schema["ResetPasswordByCodeDTORequest"]) => post("/auth/password/reset",body),
    ssoStart: () => data<Schema["SsoStartVOResponse"]>("/auth/sdu", {method:"POST"}),
    preferences: () => data<Schema["ManualPreferencesResponse"]>("/user/recommendation-profile/preferences"),
    savePreferences: (body: Schema["FoodPreferencesDTORequest"]) => data<Schema["ManualPreferencesResponse"]>("/user/recommendation-profile/preferences",{method:"PUT",body}),
    clearPreferences: () => data<Schema["ManualPreferencesResponse"]>("/user/recommendation-profile/preferences",{method:"DELETE"}),
    campuses: () => data<Schema["CampusResponse"][]>("/campus/list"),
    checkUsername: (username: string) =>
      request<void>("/auth/checkUsername", {
        method: "POST",
        query: { username },
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
    sendEmail: (email: string) =>
      request<void>("/auth/sendEmail", { query: { email } }),
    consentPolicy: () =>
      data<NonNullable<Schema["ConsentPolicyReply"]["data"]>>(
        "/auth/consent/policy",
        { public: true },
      ),
    consent: () => data<Schema["ConsentViewResponse"]>("/auth/consent"),
    grantConsent: (body: Schema["GrantRequestRequest"]) =>
      post("/auth/consent/grant", body),
    withdrawConsent: () => post("/auth/consent/withdraw"),
    recommend: (limit = 8, filters: RecommendFilters = {}) =>
      data<Food[]>("/foods/recommend", { query: { size:limit, ...filters } }),
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
      data<Page<Food>>("/foods/favorites", { query: { page, pageSize: 12, ...filters } }),
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
      post(`/foods/${id}/tags/custom`, { names }),
    addSystemTags: (id: number, tagIds: number[]) =>
      post(`/foods/${id}/tags/system`, { tagIds }),
    removeTag: (id: number, tagId: number) =>
      request<void>(`/foods/${id}/tags/${tagId}`, { method: "DELETE" }),
    renameTag: (tagId: number, name: string) =>
      request<void>(`/foods/tags/my/${tagId}`, {
        method: "PUT",
        body: { name },
      }),
    deleteTag: (tagId: number) =>
      request<void>(`/foods/tags/my/${tagId}`, { method: "DELETE" }),
    createFood: (body: Schema["CreateFoodDTORequest"]) =>
      created("/foods/upload",body),
    editMyFood: (id: number, body: Schema["EditFoodDTORequest"]) => request<void>(`/foods/my/${id}`,{method:"PUT",body}),
    deleteMyFood: (id: number) => request<void>(`/foods/my/${id}`,{method:"DELETE"}),
    hubs: (page = 1) =>
      data<Page<Hub>>("/hub/list", { query: { page, pageSize: 20 } }),
    restaurantSearch: (query: {gcjLng:number;gcjLat:number;keyword?:string;hubId?:number;radius?:number;page?:number;pageSize?:number}) =>
      data<Page<Restaurant>>("/restaurant/search", {
        query: {
          ...query,
          page: query.page ?? 1,
          pageSize: query.pageSize ?? 12,
        },
      }),
    restaurant: (id: number) => data<Restaurant>(`/restaurant/detail/${id}`),
    browseRestaurants: (query: {keyword?:string;hubId?:number;page?:number;pageSize?:number} = {}) => data<Page<Restaurant>>("/restaurant/browse",{query:{page:1,pageSize:12,...query}}),
    createRestaurant: (body: Schema["RestaurantDTORequest"]) =>
      created("/restaurant/add",body),
    presign: (body: Schema["PresignUploadReqDTORequest"]) =>
      data<Schema["PresignUploadRespDTOResponse"]>("/upload/presign", {
        method: "POST",
        body,
      }),
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
    sendMobileCode: (mobile: string) =>
      post("/user/getCode", { mobile, scene: "bind" }),
    bindMobile: (mobile: string, code: string) =>
      post("/user/bindMobile", { mobile, code }),
    summary: () => data<Schema["SummaryVOResponse"]>("/admin/summary"),
    adminRestaurants: (page = 1, keyword?: string) =>
      data<Page<Restaurant>>("/restaurant/list", {
        query: { page, pageSize: 12, keyword },
      }),
    editRestaurant: (id: number, body: Schema["EditRestaurantDTORequest"]) =>
      request<void>(`/restaurant/edit/${id}`, { method: "PUT", body }),
    deleteRestaurant: (id: number) =>
      request<void>(`/restaurant/delete/${id}`, { method: "DELETE" }),
    editFood: (id: number, body: Schema["EditFoodDTORequest"]) =>
      request<void>(`/foods/edit/${id}`, { method: "PUT", body }),
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
    ban: (userId: number, reason: string) =>
      post(`/user/ban/${userId}`, { reason }),
    unban: (userId: number) => post(`/user/unban/${userId}`),
    createHub: (body: Schema["HubDTORequest"]) => post("/hub/add", body),
    editHub: (id: number, body: Schema["HubDTORequest"]) =>
      request<void>(`/hub/edit/${id}`, { method: "PUT", body }),
    deleteHub: (id: number) =>
      request<void>(`/hub/delete/${id}`, { method: "DELETE" }),
    rebindHub: (id: number) =>
      data<number>(`/hub/rebind-restaurants/${id}`, { method: "POST" }),
  };
}
export type Api = ReturnType<typeof createApi>;

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
    d &&
    typeof d === "object" &&
    ("consentProof" in d || "identityReady" in d || "registrationAccepted" in d)
  ) {
    const proof =
      "consentProof" in d && typeof d.consentProof === "string"
        ? d.consentProof
        : undefined;
    return {
      kind: "consent" as const,
      proof,
      message: reply.msg || "账号授权或身份同步尚未完成，请查看授权状态。",
    };
  }
  return {
    kind: "error" as const,
    message: reply.msg || "服务未返回有效登录会话，请稍后重新登录。",
  };
}

export async function uploadFile(
  api: Pick<Api, "presign" | "complete">,
  file: File,
  biz: "avatar" | "foods" | "restaurants" | "activity",
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  onPhase?: (phase: "uploading" | "confirming") => void,
) {
  onPhase?.("uploading");
  const signed = await api.presign({
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
    biz,
  });
  if (!signed.putUrl || !signed.key)
    throw new Error("上传凭证不完整，请重新选择图片。");
  const url = new URL(signed.putUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("上传地址无效。");
  // Intentionally separate from API transport: never forward the app session to object storage.
  const response = await fetcher(signed.putUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
    credentials: "omit",
    redirect: "error",
    signal: signal ?? AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(`图片上传失败（HTTP ${response.status}），请重试。`);
  onPhase?.("confirming");
  const completed = await api.complete(signed.key);
  if (!completed.key || completed.key !== signed.key)
    throw new Error("图片确认结果不一致，请重新上传。");
  return completed.key;
}
