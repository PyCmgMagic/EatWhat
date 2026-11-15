import fs from "node:fs/promises";
import openapiTS, { astToString, COMMENT_HEADER } from "openapi-typescript";

const source = new URL(
  "../../docs/EatWhat 业务服务 后端v2.openapi.json",
  import.meta.url,
);
const out = new URL("../src/api/", import.meta.url);

// Spring's generated operationId suffixes move whenever another controller
// gains a method. Keep the names already used by the v2 UI keyed by the real
// contract instead. New operations receive a deterministic method/path name.
const stableNames = {
  "GET /auth/sdu": "sdu",
  "GET /foods/duplicates": "getFoodDuplicates",
  "POST /auth/sdu": "startSso",
  "PUT /user/updateInfo": "updateInfo",
  "GET /user/recommendation-profile/preferences": "preferences",
  "PUT /user/recommendation-profile/preferences": "savePreferences",
  "DELETE /user/recommendation-profile/preferences": "clearPreferences",
  "GET /user/blocks/{userId}": "blockStatus",
  "PUT /user/blocks/{userId}": "block",
  "DELETE /user/blocks/{userId}": "unblock",
  "PUT /restaurant/{id}/rating": "rate",
  "DELETE /restaurant/{id}/rating": "unrate",
  "PUT /restaurant/{id}/favorite": "favorite",
  "DELETE /restaurant/{id}/favorite": "unfavorite",
  "PUT /restaurant/edit/{id}": "editRestaurant",
  "PUT /hub/edit/{id}": "editHub",
  "POST /user/unfollow": "unfollow",
  "POST /user/unban/{userId}": "unban",
  "POST /user/mobile/change/old-code": "changeOldCode",
  "POST /user/mobile/change/new-code": "changeNewCode",
  "POST /user/mobile/change/commit": "changeCommit",
  "POST /user/getCode": "userCode",
  "POST /user/follow": "follow",
  "POST /user/changePrivacy": "changePrivacy",
  "POST /user/bindMobile": "bindMobile",
  "POST /user/ban/{userId}": "ban",
  "POST /upload/presign": "presign",
  "POST /upload/presign/batch": "presignBatch",
  "POST /upload/complete": "complete",
  "POST /restaurant/{id}/history/{revisionId}/restore": "restore",
  "POST /restaurant/add": "addRestaurant",
  "POST /recommend/dismiss/{id}": "dismiss",
  "POST /hub/add": "addHub",
  "POST /auth/verifyEmail": "verifyEmail",
  "POST /auth/username/set": "usernameSet",
  "POST /auth/sessions/revoke-others": "revokeOthers",
  "POST /auth/sendEmail": "sendEmail",
  "POST /auth/sdu/confirm": "sduConfirm",
  "POST /auth/register": "register",
  "POST /auth/phone/login": "phoneLogin",
  "POST /auth/phone/code": "phoneCode",
  "POST /auth/password/reset": "passwordReset",
  "POST /auth/password/code": "passwordCode",
  "POST /auth/logout": "logout",
  "POST /auth/login": "login",
  "POST /auth/consent/grant": "grant",
  "POST /auth/checkUsername": "checkUsername",
  "POST /auth/changePassword": "changePassword",
  "POST /admin/users/{userId}/password": "adminResetPassword",
  "GET /admin/consent/policies": "policies",
  "POST /admin/consent/policies": "publishPolicy",
  "GET /user/userInfo": "userInfo",
  "GET /user/list": "users",
  "GET /user/info": "me",
  "GET /user/followings": "followings",
  "GET /user/followers": "followers",
  "GET /user/blocks": "blocks",
  "GET /restaurant/{id}/history": "history",
  "GET /restaurant/list": "restaurants",
  "GET /restaurant/favorites": "favorites",
  "GET /restaurant/detail/{id}": "restaurant",
  "GET /restaurant/search": "search",
  "GET /restaurant/browse": "browse",
  "GET /recommend": "recommend",
  "GET /recommend/tags": "tags",
  "GET /recommend/pick": "pick",
  "GET /hub/locate": "locate",
  "GET /hub/list": "hubs",
  "GET /hub/detail/{id}": "hub",
  "GET /campus/list": "campuses",
  "GET /auth/verify": "verify",
  "GET /auth/sessions": "sessions",
  "GET /auth/consent": "consentStatus",
  "GET /auth/consent/policy": "currentPolicy",
  "GET /auth/captcha/config": "captchaConfig",
  "GET /admin/summary": "summary",
  "GET /admin/consent/policies/{id}": "policyDetail",
  "DELETE /restaurant/delete/{id}": "deleteRestaurant",
  "DELETE /hub/delete/{id}": "deleteHub",
  "DELETE /auth/sessions/{sessionId}": "revoke",
};

function semanticName(method, path) {
  const words = path
    .split("/")
    .filter(Boolean)
    .map((part) => {
      const parameter = part.match(/^\{(.+)\}$/)?.[1];
      const value = parameter ? `by-${parameter}` : part;
      return value
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join("");
    })
    .join("");
  return method.toLowerCase() + words;
}

export async function readBackendV2() {
  const spec = JSON.parse(await fs.readFile(source, "utf8"));
  const schemas = spec.components.schemas;
  const ref = (name) => ({ $ref: "#/components/schemas/" + name });
  schemas.AdminResetPassword = {
    type: "object",
    required: ["password"],
    properties: { password: { type: "string", minLength: 6, maxLength: 64 } },
  };
  spec.paths["/admin/users/{userId}/password"].post.requestBody.content[
    "application/json"
  ].schema = ref("AdminResetPassword");
  schemas.PublicConsentPolicy = structuredClone(schemas.ConsentPolicy);
  delete schemas.PublicConsentPolicy.properties.id;
  delete schemas.PublicConsentPolicy.properties.publishedBy;
  schemas.ResultPublicConsentPolicy = structuredClone(
    schemas.ResultConsentPolicy,
  );
  schemas.ResultPublicConsentPolicy.properties.data = ref(
    "PublicConsentPolicy",
  );
  const current = spec.paths["/auth/consent/policy"].get.responses["200"];
  Object.values(current.content)[0].schema = ref("ResultPublicConsentPolicy");

  // springdoc merges nested records that share a simple Java name. Repair the
  // affected operations with source-accurate, operation-specific schemas.
  const string = { type: "string" };
  const int32 = { type: "integer", format: "int32" };
  const int64 = { type: "integer", format: "int64" };
  const bool = { type: "boolean" };
  const decimal = { type: "number" };
  const array = (items) => ({ type: "array", items });
  const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
  const object = (properties) => ({ type: "object", properties });
  const result = (data) =>
    object({ code: int32, data, msg: string, timestamp: int64 });
  const page = (item) =>
    object({
      currentPage: int64,
      items: array(item),
      totalPages: int64,
      totalItems: int64,
      hasNext: bool,
    });
  const response = (path, method, schema) => {
    const content = spec.paths[path][method].responses["200"].content;
    Object.values(content)[0].schema = ref(schema);
  };
  const request = (path, method, schema) => {
    const content = spec.paths[path][method].requestBody.content;
    Object.values(content)[0].schema = ref(schema);
  };

  schemas.FoodV2 = object({
    id: int64,
    restaurantId: int64,
    restaurantName: string,
    accountId: nullable(int64),
    name: string,
    category: string,
    price: nullable(decimal),
    description: nullable(string),
    pictureUrls: array(string),
    tags: array(string),
    signature: bool,
    stageColor: nullable(string),
    stageAlternates: array(string),
    coverCrop: nullable(ref("CoverCrop")),
    likeCount: int64,
    favoriteCount: int64,
    isLiked: nullable(bool),
    isFavorite: nullable(bool),
    createdAt: int64,
    updatedAt: int64,
  });
  schemas.FoodEditRequest = object({
    name: string,
    category: string,
    price: nullable(decimal),
    description: string,
    pictures: array(string),
    tags: array(string),
    signature: bool,
    stageColor: string,
    stageAlternates: array(string),
    coverCrop: ref("CoverCrop"),
  });
  schemas.FoodOptions = object({
    categories: array(string),
    tags: array(string),
    stageColors: array(string),
    maxPictures: int32,
    maxTags: int32,
    maxSignatures: int32,
  });
  schemas.ResultFoodV2 = result(ref("FoodV2"));
  schemas.PageResultFoodV2 = page(ref("FoodV2"));
  schemas.ResultPageResultFoodV2 = result(ref("PageResultFoodV2"));
  schemas.ResultFoodOptions = result(ref("FoodOptions"));
  request("/foods/edit/{id}", "put", "FoodEditRequest");
  response("/foods/detail/{id}", "get", "ResultFoodV2");
  response("/foods/options", "get", "ResultFoodOptions");
  for (const path of [
    "/foods/list",
    "/foods/my",
    "/foods/by-user/{userId}",
    "/foods/favorites",
  ])
    response(path, "get", "ResultPageResultFoodV2");

  schemas.NotificationTarget = object({ domain: string, id: int64 });
  schemas.NotificationActor = object({
    id: int64,
    displayName: string,
    avatar: nullable(string),
  });
  schemas.NotificationCard = object({
    id: int64,
    column: string,
    kind: string,
    target: ref("NotificationTarget"),
    day: string,
    memberCount: int32,
    unreadMemberCount: int32,
    latestAt: int64,
    actors: array(ref("NotificationActor")),
    data: {},
  });
  schemas.PageResultNotificationCard = page(ref("NotificationCard"));
  schemas.ResultPageResultNotificationCard = result(
    ref("PageResultNotificationCard"),
  );
  response("/notification/cards", "get", "ResultPageResultNotificationCard");

  schemas.AiSettingsRequest = object({
    enabled: bool,
    baseUrl: string,
    apiKey: string,
    model: string,
    responseFormat: string,
  });
  schemas.AiSettings = object({
    configured: bool,
    enabled: bool,
    baseUrl: nullable(string),
    apiKeyHint: nullable(string),
    model: nullable(string),
    responseFormat: nullable(string),
    updatedBy: nullable(int64),
    updatedAt: nullable(int64),
  });
  schemas.ResultAiSettings = result(ref("AiSettings"));
  request("/admin/ai/settings", "put", "AiSettingsRequest");
  response("/admin/ai/settings", "get", "ResultAiSettings");
  response("/admin/ai/settings", "put", "ResultAiSettings");

  // Records named Settings / Consent / Accepted in different modules are merged
  // by springdoc; give each operation its own source-accurate schema.
  schemas.RemoteSettings = {
    type: "object",
    properties: {
      revision: { type: "integer", format: "int32" },
      flags: {
        type: "object",
        additionalProperties: { $ref: "#/components/schemas/Flag" },
      },
      params: { type: "object", additionalProperties: {} },
      maintenance: { $ref: "#/components/schemas/Maintenance" },
      updatedAt: { type: "integer", format: "int64" },
      updatedBy: { type: "integer", format: "int64" },
    },
  };
  schemas.ResultRemoteSettings = result(ref("RemoteSettings"));
  schemas.AdminView.properties.settings = ref("RemoteSettings");
  response("/admin/remote-config/settings", "put", "ResultRemoteSettings");
  schemas.RecommendationSettings = object({ personalized: bool });
  schemas.ResultRecommendationSettings = result(ref("RecommendationSettings"));
  request("/user/recommendation-settings", "put", "RecommendationSettings");
  for (const method of ["get", "put"])
    response(
      "/user/recommendation-settings",
      method,
      "ResultRecommendationSettings",
    );
  schemas.ConsentGrant = object({ policyVersion: string });
  request("/auth/consent/grant", "post", "ConsentGrant");
  schemas.TelemetryConsent = object({ enabled: bool, retentionDays: int32 });
  schemas.ResultTelemetryConsent = result(ref("TelemetryConsent"));
  for (const method of ["get", "put", "delete"])
    response("/telemetry/consent", method, "ResultTelemetryConsent");
  schemas.TelemetryAccepted = object({
    accepted: int32,
    duplicates: int32,
    enabled: bool,
  });
  schemas.ResultTelemetryAccepted = result(ref("TelemetryAccepted"));
  response("/telemetry/events", "post", "ResultTelemetryAccepted");

  schemas.PushSettings = object({
    categories: { type: "object", additionalProperties: bool },
  });
  schemas.ResultPushSettings = result(ref("PushSettings"));
  for (const [path, method] of [
    ["/push/settings", "get"],
    ["/push/settings/enable", "post"],
    ["/push/settings/disable", "post"],
  ])
    response(path, method, "ResultPushSettings");

  schemas.FeedbackAccepted = object({
    id: int64,
    kind: string,
    status: string,
    duplicate: bool,
    createdAt: int64,
  });
  schemas.ResultFeedbackAccepted = result(ref("FeedbackAccepted"));
  for (const path of [
    "/feedback/messages",
    "/feedback/catalog-errors",
    "/feedback/reports",
  ])
    response(path, "post", "ResultFeedbackAccepted");
  schemas.FeedbackTarget = object({ type: string, id: int64 });
  schemas.CaseView.properties.target = nullable(ref("FeedbackTarget"));

  for (const [name, fields] of Object.entries({
    PublicConsentPolicy: [
      "version",
      "privacyText",
      "crossBorderText",
      "publishedAt",
    ],
    ConsentPolicy: ["privacyText", "crossBorderText"],
    ConsentStatus: ["agreedVersion", "agreedAt", "currentVersion"],
    Pick: ["restaurant"],
    Stat: ["rate"],
    MyRatings: ["dineIn", "delivery"],
    Restaurant: [
      "pictureUrl",
      "distanceMeters",
      "isFavorite",
      "myRatings",
      "campusId",
      "hubId",
      "hubName",
      "poi",
    ],
    Card: [
      "pictureUrl",
      "distanceMeters",
      "isFavorite",
      "myRatings",
      "hubId",
      "hubName",
    ],
    SignatureFood: ["price", "pictureUrl", "stageColor", "coverCrop"],
    MyInfo: ["banReason", "banUntil"],
    UserListItem: ["banReason", "banUntil"],
    DeviceSessionPage: ["nextCursor"],
    Edited: ["revisionId"],
    OtherInfo: ["fansCount", "followingsCount"],
    Hub: ["boundary", "campusId"],
    Comment: ["rootId", "replyTo", "text", "isLiked"],
    CaseView: ["reason", "outcome", "closedAt"],
    Item: ["restaurant", "food"],
    ClientConfig: ["update"],
    TestResult: ["category", "tags", "failure"],
  })) {
    for (const field of fields) {
      schemas[name].properties[field] = {
        anyOf: [schemas[name].properties[field], { type: "null" }],
      };
    }
  }
  schemas.ResultVoid.properties.data = { type: "null" };
  schemas.ResultHub.properties.data = { anyOf: [ref("Hub"), { type: "null" }] };
  // Clearing a hub's campus association is a full replacement with null.
  schemas.HubRequest.properties.campusId = {
    type: ["integer", "null"],
    format: "int64",
  };

  const endpoints = {};
  const callbacks = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!operation.operationId) continue;
      if (/^\/(?:auth\/)?callback(?:\/|$)/.test(path)) {
        operation.responses = {
          302: { description: "School authentication browser redirect" },
        };
        callbacks.push(method.toUpperCase() + " " + path);
        continue;
      }
      const key = method.toUpperCase() + " " + path;
      const name = stableNames[key] ?? semanticName(method, path);
      if (name in endpoints) throw new Error("Duplicate operation: " + name);
      const summary = operation.summary ?? "";
      const access = summary.includes("verified 或 admin")
        ? "verifiedOrAdmin"
        : summary.includes("角色：verified")
          ? "verified"
          : summary.includes("角色：admin")
            ? "admin"
            : operation.security?.some(
                  (requirement) => Object.keys(requirement).length,
                )
              ? "login"
              : "public";
      endpoints[name] = {
        method: method.toUpperCase(),
        path,
        access,
        ...(summary.includes("同意前可用") ? { consentExempt: true } : {}),
        ...([
          "phoneCode",
          "passwordCode",
          "userCode",
          "changeOldCode",
          "changeNewCode",
          "sendEmail",
          "postAuthAccountDeleteCode",
        ].includes(name)
          ? { captcha: "required" }
          : name === "login"
            ? { captcha: "onDemand" }
            : {}),
      };
      operation.operationId = name;
    }
  }
  return { spec, endpoints, callbacks };
}

const { spec, endpoints, callbacks } = await readBackendV2();
if (Object.keys(endpoints).length !== 151 || callbacks.length !== 8) {
  throw new Error(
    "Backend v2 operation count changed; review the client coverage.",
  );
}
const routes =
  "// Generated from backend v2 OpenAPI by npm run api:generate.\n" +
  "export const endpoints = " +
  JSON.stringify(endpoints, null, 2) +
  " as const;\n";
const types = COMMENT_HEADER + astToString(await openapiTS(spec));
const files = [
  ["backend-v2-schema.d.ts", types],
  ["backend-v2-endpoints.ts", routes],
];
for (const [name, content] of files) {
  const url = new URL(name, out);
  if (process.argv.includes("--write")) await fs.writeFile(url, content);
  else if (
    (await fs.readFile(url, "utf8")).replaceAll("\r\n", "\n") !== content
  )
    throw new Error(name + " is stale; run npm run api:generate.");
}
console.log(
  "Backend v2: " +
    Object.keys(endpoints).length +
    " client operations, " +
    callbacks.length +
    " browser callbacks.",
);
