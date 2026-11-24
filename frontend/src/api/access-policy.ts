import type { RequestOptions } from "./client";
import { requestAccessRules } from "./access-rules.generated";
import type { Schema } from "./models";
import { withdrawalAllowed } from "./banned-access";

export function actionUnavailable(
  remote: Schema["ClientConfigResponse"] | undefined,
  path: string,
) {
  const feature =
    path.startsWith("/publish") || path === "/foods/upload"
      ? "publish"
      : path.startsWith("/restaurants/new") || path === "/restaurant/add"
        ? "newShop"
        : undefined;
  const flag = feature ? remote?.flags?.[feature] : undefined;
  if (remote?.update?.decision === "FORCE") return "请先更新版本，再继续操作。";
  if (
    ["DOWN", "READ_ONLY"].includes(remote?.maintenance?.mode ?? "") ||
    flag?.on === false
  )
    return (
      flag?.reason ||
      remote?.maintenance?.message ||
      "这项操作暂时暂停，请稍后再试。"
    );
}

export type AccessRequirement =
  "public" | "login" | "verified" | "verifiedOrAdmin";
/** Backend v2 commands the APIv7 document (the generated rules) lacks. */
const v2Rules = [
  ["POST", "/recommend/dismiss/{id}", "login"],
  ["GET", "/foods/likes", "login"],
  ["GET", "/user/titles", "login"],
  ["PUT", "/user/titles/equipped/{code}", "login"],
  ["DELETE", "/user/titles/equipped", "login"],
  ["PUT", "/foods/{id}/rating", "verified"],
  ["DELETE", "/foods/{id}/rating", "login"],
  ["POST", "/restaurant/{restaurantId}/comments", "verifiedOrAdmin"],
  ["POST", "/restaurant/{restaurantId}/comments/{commentId}/replies", "verifiedOrAdmin"],
  ["PUT", "/comments/{id}/reactions/{reaction}", "verifiedOrAdmin"],
  ["DELETE", "/comments/{id}/reactions/{reaction}", "login"],
] as const;
const rules = [...requestAccessRules, ...v2Rules].map(
  ([method, path, access]) => ({
    method,
    pattern: new RegExp(
      "^" +
        path
          .split("/")
          .map((part) =>
            /^\{[^}]+\}$/.test(part)
              ? "[^/]+"
              : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          )
          .join("/") +
        "$",
    ),
    access,
  }),
);

/** UI preflights and actual requests consult the same contract-derived policy. */
export function requestAccess(
  path: string,
  options: RequestOptions = {},
): AccessRequirement {
  if (options.public && (
    (path === "/telemetry/events" && options.method === "POST") ||
    (path === "/telemetry/consent" && options.method === "DELETE")
  )) return "public";
  if (withdrawalAllowed(path, options)) return "login";
  // These legacy aliases send a binding code in v2, which does not need student verification.
  if (
    (options.method ?? "GET").toUpperCase() === "POST" &&
    ["/user/getCode", "/auth/getCode"].includes(path)
  )
    return "login";
  const rule = rules.find(
    (item) =>
      item.method === (options.method ?? "GET").toUpperCase() &&
      item.pattern.test(path),
  );
  if (!rule) return "public";
  if (rule.access !== "upload") return rule.access;
  const biz = (options.body as { biz?: string } | undefined)?.biz;
  return ["foods", "restaurants", "comments", "activity"].includes(biz ?? "")
    ? "verified"
    : "login";
}
