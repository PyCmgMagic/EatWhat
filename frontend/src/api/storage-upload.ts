import { uploadRequestUrl } from "./upload-target";

/** Object storage has its own signed authorization, never the application session. */
export async function putImage(
  signedUrl: string,
  file: File,
  signal: AbortSignal | undefined,
  fetcher: typeof fetch,
  label = "图片",
) {
  signal?.throwIfAborted();
  const target = uploadRequestUrl(signedUrl);
  let response: Response;
  try {
    response = await fetcher(target, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
      credentials: "omit",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(60_000)])
        : AbortSignal.timeout(60_000),
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") throw cause;
    const timeout = cause instanceof Error && cause.name === "TimeoutError";
    throw new Error(
      timeout
        ? `${label}上传超时，请检查网络后重试。`
        : `${label}未能连接上传服务，请检查网络后重试；若仍失败，请联系管理员检查图片服务配置。`,
      { cause },
    );
  }
  if (!response.ok)
    throw new Error(`${label}上传失败（HTTP ${response.status}），请重试。`);
}
