import {
  AccessRequiredError,
  ApiError,
  type Session,
  type Transport,
} from "./client";
import { requestAccess } from "./access-policy";

type Identity = {
  verified?: boolean | null;
  banned?: boolean | null;
  role?: string | null;
};
export type AccessPrompt = {
  reason: "login" | "verification";
  context: string;
  serverRequired?: boolean;
  returnFocus?: HTMLElement | null;
};
type Dependencies = {
  session: () => Session | null;
  user: () => Identity | undefined;
  loadUser: () => Promise<Identity>;
  context: () => string;
  prompt: (request: AccessPrompt) => boolean;
  unavailable?: (path: string) => string | undefined;
  activeElement?: () => HTMLElement | null;
};
function sameSession(a: Session | null, b: Session | null) {
  return a?.tokenName === b?.tokenName && a?.tokenValue === b?.tokenValue;
}

/** A generic 403 also means admin/ownership denial. Only explicit student denial is handled. */
export function isVerificationRequired(error: unknown) {
  return (
    error instanceof ApiError &&
    ["20004", "NO_PERMISSION", "40002", "STATE_NOT_ALLOWED"].includes(
      String(error.code),
    ) &&
    /(?:用户未验证|用户未认证|尚未(?:完成)?学生认证|未(?:完成|通过)学生认证|(?:请|需要)(?:先)?(?:完成)?学生认证)/.test(
      error.message,
    )
  );
}

export function withActionAccess(
  send: Transport,
  deps: Dependencies,
): Transport {
  return async (path, options) => {
    const session = deps.session(),
      context = deps.context();
    const returnFocus = deps.activeElement?.();
    const current = () =>
      sameSession(session, deps.session()) && context === deps.context();
    const blocked = (
      reason: AccessPrompt["reason"],
      serverRequired = false,
    ): never => {
      const presented =
        !options.background &&
        current() &&
        deps.prompt({
          reason,
          context,
          serverRequired,
          ...(returnFocus !== undefined ? { returnFocus } : {}),
        });
      throw new AccessRequiredError(reason, presented);
    };
    // Reads run without opening unsolicited dialogs during background refresh.
    // Their pages retain existing login/verification gates and error handling.
    const command = (options.method ?? "GET").toUpperCase() !== "GET";
    const requirement = requestAccess(path, options);
    if (command && requirement !== "public") {
      options.signal?.throwIfAborted();
      const unavailable = deps.unavailable?.(path);
      if (unavailable) throw new ApiError(unavailable, "ACTION_UNAVAILABLE");
      if (!session) blocked("login");
      if (requirement === "verified" || requirement === "verifiedOrAdmin") {
        const user = deps.user() ?? (await deps.loadUser());
        options.signal?.throwIfAborted();
        if (!current())
          throw new ApiError(
            "页面或账号已变化，请重新操作。",
            "ACTION_CANCELLED",
          );
        if (user.banned)
          throw new ApiError(
            "账号暂时无法操作，请联系管理员。",
            "USER_DISABLED",
          );
        if (
          user.verified !== true &&
          !(requirement === "verifiedOrAdmin" && user.role === "admin")
        )
          blocked("verification");
      }
    }
    try {
      const response = await send(path, options);
      if (command && String(response.code) !== "0") {
        const error = new ApiError(response.msg ?? "", response.code);
        if (isVerificationRequired(error)) blocked("verification", true);
      }
      return response;
    } catch (error) {
      if (command && isVerificationRequired(error))
        blocked("verification", true);
      throw error;
    }
  };
}
