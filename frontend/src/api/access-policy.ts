import type { RequestOptions } from "./client";
import { requestAccessRules } from "./access-rules.generated";
import type { Schema } from "./models";

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
  | "public"
  | "login"
  | "verified"
  | "verifiedOrAdmin";
/** Backend v2 commands the APIv7 document (the generated rules) lacks. */
const v2Rules = [
  ["GET", "/foods/likes", "login"],
  ["PUT", "/foods/{id}/rating", "verified"],
  ["DELETE", "/foods/{id}/rating", "login"],
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
