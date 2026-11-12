import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  ApiError,
  createTransport,
  type Session,
  type Transport,
} from "../api/client";
import {
  createV2Api,
  uploadV2,
  type CallV2,
  type V2Schema,
} from "../api/backend-v2";
import { runBrowserCaptcha } from "../api/captcha";
import { demoEnabled } from "../app/mode";

export const isV2Demo = demoEnabled(
  location.search,
  import.meta.env.DEV,
  import.meta.env.VITE_ENABLE_DEMO === "true",
);
const persona = new URLSearchParams(location.search).get("persona");
const storageKey = isV2Demo ? "eatwhat-v2-demo-session" : "eatwhat-v2-session";
const demoToken =
  persona === "admin"
    ? "v2-demo-admin"
    : persona === "unverified"
      ? "v2-demo-user"
      : "v2-demo-student";

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null && isV2Demo)
      return { tokenName: "satoken", tokenValue: demoToken };
    const value = JSON.parse(raw ?? "null");
    if (
      value?.tokenName === "satoken" &&
      typeof value.tokenValue === "string" &&
      value.tokenValue &&
      (!isV2Demo || /^v2-demo-(student|admin|user)$/.test(value.tokenValue))
    )
      return value as Session;
  } catch {
    // Storage is optional in private browsing.
  }
  return null;
}

type State = {
  call: CallV2;
  session: Session | null;
  user?: V2Schema["MyInfo"];
  identityPending: boolean;
  identityError: unknown;
  consentRequired: boolean;
  signIn: (token: V2Schema["SaTokenInfo"]) => void;
  signOut: () => Promise<void>;
  agree: (policyVersion: string) => Promise<void>;
  refreshIdentity: () => Promise<unknown>;
  upload: (
    file: File,
    biz: "avatar" | "restaurants" | "foods" | "comments" | "feedback",
    signal?: AbortSignal,
  ) => Promise<string>;
};

const V2State = createContext<State | null>(null);
export function useV2() {
  const state = useContext(V2State);
  if (!state) throw new Error("Missing v2 provider");
  return state;
}

export function V2Provider({ children }: { children: ReactNode }) {
  const [cache] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  const [session, setSession] = useState(readSession);
  const [consentRequired, setConsentRequired] = useState(false);
  const owner = useRef(session);
  const lifetime = useRef(new AbortController());
  const activeIdentity = useRef<V2Schema["MyInfo"] | undefined>(undefined);
  const switchSession = useMemo(
    () =>
      (next: Session | null, persist = true) => {
        if (owner.current?.tokenValue !== next?.tokenValue) {
          owner.current = next;
          lifetime.current.abort(
            new DOMException("登录身份已变化。", "AbortError"),
          );
          lifetime.current = new AbortController();
          activeIdentity.current = undefined;
          cache.clear();
          setConsentRequired(false);
          setSession(next);
        }
        if (persist) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            /* Continue with the in-memory session. */
          }
        }
      },
    [cache],
  );

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null)
        switchSession(readSession(), false);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [switchSession]);

  const call = useMemo(() => {
    const sessionSignal = lifetime.current.signal;
    const live = createTransport(
      import.meta.env.VITE_API_BASE_URL || "/api",
      () => session,
    );
    const transport: Transport = async (path, options) => {
      const signal = options.signal
        ? AbortSignal.any([sessionSignal, options.signal])
        : sessionSignal;
      signal.throwIfAborted();
      const result = isV2Demo
        ? await (
            await import("./demo")
          ).demoTransport(path, { ...options, signal }, session?.tokenValue)
        : await live(path, { ...options, signal });
      signal.throwIfAborted();
      return result;
    };
    return createV2Api({
      transport,
      captcha: isV2Demo
        ? async (_, send, signal) => {
            await send(undefined, signal ?? new AbortController().signal);
          }
        : runBrowserCaptcha,
      hasSession: () => !!session,
      identity: () => activeIdentity.current,
      onFailure: (error, withSession) => {
        if (!withSession || owner.current !== session) return;
        if (String(error.code) === "20009") setConsentRequired(true);
        if (
          [20001, 20002, 20003, 30002].includes(Number(error.code)) ||
          error.status === 401
        )
          switchSession(null);
      },
    });
  }, [session, switchSession]);

  return (
    <QueryClientProvider client={cache}>
      <AccountState
        {...{
          children,
          call,
          session,
          activeIdentity,
          consentRequired,
          setConsentRequired,
          switchSession,
        }}
      />
    </QueryClientProvider>
  );
}

function AccountState({
  children,
  call,
  session,
  activeIdentity,
  consentRequired,
  setConsentRequired,
  switchSession,
}: {
  children: ReactNode;
  call: CallV2;
  session: Session | null;
  activeIdentity: { current: V2Schema["MyInfo"] | undefined };
  consentRequired: boolean;
  setConsentRequired: (required: boolean) => void;
  switchSession: (session: Session | null) => void;
}) {
  const me = useQuery({
    queryKey: ["v2", "me"],
    enabled: !!session && !consentRequired,
    queryFn: ({ signal }) => call("me", { signal }),
  });
  activeIdentity.current = session ? me.data : undefined;
  return (
    <V2State.Provider
      value={{
        call,
        session,
        user: session ? me.data : undefined,
        identityPending: !!session && me.isPending,
        identityError: me.error,
        consentRequired,
        signIn: (token) => {
          if (!token?.tokenValue || token.tokenName !== "satoken")
            throw new Error("服务未返回有效的登录凭据。");
          switchSession({
            tokenName: token.tokenName,
            tokenValue: token.tokenValue,
          });
        },
        signOut: async () => {
          try {
            await call("logout");
          } catch (error) {
            if (
              !(error instanceof ApiError) ||
              ![20001, 20002, 20003].includes(Number(error.code))
            )
              throw error;
          }
          switchSession(null);
        },
        agree: async (policyVersion) => {
          await call("grant", { body: { policyVersion } });
          setConsentRequired(false);
        },
        refreshIdentity: () => me.refetch(),
        upload: async (file, biz, signal) => {
          if (isV2Demo) {
            if (!session) throw new Error("请先登录。");
            if (
              ["restaurants", "foods", "comments"].includes(biz) &&
              activeIdentity.current?.verified !== true
            )
              throw new Error("请先完成学生认证。");
            return (await import("./demo")).storeDemoImage(file, biz, signal);
          }
          return uploadV2(call, file, biz, signal);
        },
      }}
    >
      {children}
    </V2State.Provider>
  );
}
