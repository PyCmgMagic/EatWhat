import { endpoints } from "./backend-v2-endpoints";
import type { components, operations } from "./backend-v2-schema";
import {
  ApiError,
  createRequester,
  type Query,
  type RequestOptions,
  type Transport,
} from "./client";
import type { CaptchaRunner } from "./captcha";
import { putImage } from "./storage-upload";

export type V2Schema = components["schemas"];
export type Operation = keyof typeof endpoints;
type Params<K extends Operation> = operations[K]["parameters"];
type Body<T> = T extends { content: { "application/json": infer Value } }
  ? Value
  : never;
type QueryOptions<P> = P extends { query: infer Q }
  ? { query: Q }
  : P extends { query?: infer Q }
    ? { query?: Q }
    : {};
type PathOptions<P> = P extends { path: infer Path } ? { path: Path } : {};
type BodyOptions<K extends Operation> = [
  Body<operations[K]["requestBody"]>,
] extends [never]
  ? {}
  : { body: Body<operations[K]["requestBody"]> };
export type V2Options<K extends Operation> = QueryOptions<Params<K>> &
  PathOptions<Params<K>> &
  BodyOptions<K> &
  Pick<RequestOptions, "signal" | "public">;
export type V2Data<K extends Operation> =
  Body<operations[K]["responses"][200]> extends { data?: infer Data }
    ? Data
    : never;
export type CallV2 = <K extends Operation>(
  name: K,
  ...args: {} extends V2Options<K>
    ? [options?: V2Options<K>]
    : [options: V2Options<K>]
) => Promise<V2Data<K>>;
export type Identity = Pick<V2Schema["MyInfo"], "role" | "verified">;

export function accessFor(operation: Operation, body?: unknown, query?: Query) {
  if (
    (operation === "presign" || operation === "presignBatch") &&
    ["restaurants", "foods", "comments"].includes(
      (body as { biz?: string } | undefined)?.biz ?? "",
    )
  )
    return "verified";
  if (
    (operation === "search" || operation === "browse") &&
    query?.favoritesOnly === true
  )
    return "login";
  return endpoints[operation].access;
}

export function createV2Api({
  transport,
  captcha,
  hasSession,
  identity,
  onFailure,
}: {
  transport: Transport;
  captcha: CaptchaRunner;
  hasSession: () => boolean;
  identity: () => Identity | undefined;
  onFailure?: (error: ApiError, withSession: boolean) => void;
}): CallV2 {
  const request = createRequester(transport);
  return async <K extends Operation>(
    name: K,
    ...args: [options?: V2Options<K>]
  ) => {
    const { path: params, ...options } = (args[0] ?? {}) as RequestOptions & {
      path?: Record<string, string | number>;
    };
    const endpoint = endpoints[name];
    const path = endpoint.path.replace(/\{([^}]+)\}/g, (_, key: string) => {
      const value = params?.[key];
      if (value === undefined || value === "")
        throw new ApiError("缺少接口路径参数。");
      return encodeURIComponent(String(value));
    });
    const permission = accessFor(name, options.body, options.query);
    const withSession = !options.public && hasSession();
    const user = identity();
    if (permission !== "public" && !withSession)
      throw new ApiError("请先登录。", "20001");
    if (permission === "admin" && user?.role !== "admin")
      throw new ApiError("需要管理员身份。", "20004");
    if (
      (permission === "verified" && user?.verified !== true) ||
      (permission === "verifiedOrAdmin" &&
        user?.role !== "admin" &&
        user?.verified !== true)
    ) {
      throw new ApiError("请先完成学生认证。", "20004");
    }
    const send = (
      headers?: RequestOptions["headers"],
      signal = options.signal,
    ) =>
      request<V2Data<K>>(path, {
        ...options,
        method: endpoint.method,
        headers,
        signal,
        cache: "no-store",
      });
    const challenged = async () => {
      let result: V2Data<K> | undefined;
      await captcha(
        (signal) =>
          request("/auth/captcha/config", {
            public: true,
            cache: "no-store",
            signal,
          }),
        async (proof, signal) => {
          result = await send(proof, signal);
        },
        options.signal,
      );
      return result as V2Data<K>;
    };
    try {
      if ("captcha" in endpoint && endpoint.captcha === "required")
        return await challenged();
      try {
        return await send();
      } catch (error) {
        if (
          name === "login" &&
          error instanceof ApiError &&
          String(error.code) === "30015"
        )
          return await challenged();
        throw error;
      }
    } catch (error) {
      if (error instanceof ApiError) onFailure?.(error, withSession);
      throw error;
    }
  };
}

export async function uploadV2(
  call: CallV2,
  file: File,
  biz: "avatar" | "restaurants" | "foods" | "comments" | "feedback",
  signal?: AbortSignal,
) {
  if (
    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("请选择 JPG、PNG、WebP 或 GIF 图片。");
  if (!file.size || file.size > (biz === "avatar" ? 5 : 10) * 1024 * 1024)
    throw new Error(
      biz === "avatar" ? "头像不能超过 5 MiB。" : "图片不能超过 10 MiB。",
    );
  const signed = await call("presign", {
    body: {
      biz,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
    },
    signal,
  });
  if (!signed?.key || !signed.putUrl)
    throw new Error("未获取到上传地址，请重试。");
  await putImage(signed.putUrl, file, signal, fetch);
  const fileInfo = await call("complete", {
    body: { key: signed.key },
    signal,
  });
  if (!fileInfo?.key) throw new Error("图片上传未确认，请重试。");
  return fileInfo.key;
}
