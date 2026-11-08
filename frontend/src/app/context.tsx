import {
  useCallback,
  useEffect,
  useMemo,
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
import { createApi, uploadFile, uploadFiles, type Api } from "../api/service";
import { AppContext } from "./state";
import { withActionAccess } from "../api/access";
import { showAccessPrompt } from "./access-prompt";
import type { User, Schema } from "../api/models";
import { actionUnavailable } from "../api/access-policy";
import {
  isDemo,
  readSession,
  sameSession,
  subscribeSession,
  writeSession,
} from "./runtime";
import { recoveryCommands } from "../api/recovery";
import { useExitPresence } from "../motion/hooks";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) =>
        !(error instanceof ApiError) || (!error.status && !error.code)
          ? count < 1
          : false,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
function useMe(api: Api, session: Session | null) {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.me(),
    enabled: !!session,
  });
}
function StateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(readSession),
    [message, setMessage] = useState("");
  const toastPresence = useExitPresence(message || null);
  const api = useMemo(() => {
    const live = createTransport(
      import.meta.env.VITE_API_BASE_URL || "/api",
      readSession,
    );
    const transport: Transport = async (path, options) => {
      const requestSession = readSession();
      try {
        const send = isDemo
          ? (await import("../demo/transport")).demoTransport
          : live;
        return await send(path, options);
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 401 &&
          !options.public &&
          requestSession &&
          sameSession(requestSession, readSession())
        )
          window.dispatchEvent(new Event("eatwhat:expired"));
        throw error;
      }
    };
    const guarded = withActionAccess(transport, {
      session: readSession,
      user: () => queryClient.getQueryData<User>(["me"]),
      loadUser: () =>
        queryClient.fetchQuery({
          queryKey: ["me"],
          queryFn: () => client.me(),
          retry: false,
        }),
      context: () => window.location.hash,
      prompt: showAccessPrompt,
      activeElement: () => document.activeElement as HTMLElement | null,
      unavailable: (path) => {
        // Keep account/security recovery available during content maintenance.
        if (
          !/^\/(foods|restaurant|activity|upload)\//.test(path) &&
          !/^\/user\/(un)?follow$/.test(path)
        )
          return;
        const remote = queryClient
          .getQueryCache()
          .findAll({ queryKey: ["remote-config"], type: "active" })
          .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)[0]
          ?.state.data as Schema["ClientConfigResponse"] | undefined;
        return actionUnavailable(remote, path);
      },
    });
    const client = createApi(guarded, async (...args) => {
      const captcha = await import("../api/captcha");
      return (isDemo ? captcha.runDemoCaptcha : captcha.runBrowserCaptcha)(
        ...args,
      );
    });
    return client;
  }, []);
  const me = useMe(api, session);
  const toast = useCallback((message: string) => setMessage(message), []);
  useEffect(() => {
    const syncSession = (next: Session | null) => {
      if (sameSession(session, next)) return;
      recoveryCommands.clear();
      // clear() also cancels pending queries, so data from the previous account
      // cannot repopulate this tab after another tab changes the shared login.
      queryClient.clear();
      setSession(next);
    };
    const unsubscribe = subscribeSession(syncSession);
    syncSession(readSession());
    return unsubscribe;
  }, [session]);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  useEffect(() => {
    const expire = () => {
      recoveryCommands.clear();
      writeSession(null);
      setSession(null);
      queryClient.clear();
      toast("登录已过期，请重新登录。");
    };
    window.addEventListener("eatwhat:expired", expire);
    return () => window.removeEventListener("eatwhat:expired", expire);
  }, [toast]);
  const signIn = async (s: Session) => {
    await queryClient.cancelQueries();
    // Guest pages must keep their cached content mounted while a login dialog
    // completes (comments, filters and scroll position belong to that page).
    // Logout/expiry already clear private data; replacing an existing identity
    // still requires a full reset to avoid showing another account's data.
    if (readSession()) queryClient.clear();
    writeSession(s);
    setSession(s);
    // Finish the identity refresh before a successful login/recovery navigates.
    // Otherwise a later pending transition can unmount the next page's form.
    try {
      await queryClient.fetchQuery({
        queryKey: ["me"],
        queryFn: () => api.me(),
        retry: false,
      });
    } catch {
      /* The normal account gate displays the identity read error. */
    } finally {
      recoveryCommands.clear();
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "me",
      });
    }
  };
  const clearLocalSession = async () => {
    recoveryCommands.clear();
    writeSession(null);
    queryClient.clear();
    setSession(null);
  };
  return (
    <AppContext.Provider
      value={{
        api,
        session,
        user: me.data,
        me,
        toast,
        signIn,
        signOut: async () => {
          const signingOut = readSession();
          await api.logout();
          if (sameSession(signingOut, readSession())) await clearLocalSession();
        },
        clearLocalSession,
        refreshMe: () =>
          void queryClient.invalidateQueries({ queryKey: ["me"] }),
        upload: async (file, biz, onPhase) =>
          isDemo
            ? (await import("../demo/transport")).demoUpload(file, biz)
            : uploadFile(api, file, biz, undefined, fetch, onPhase),
        uploadMany: async (files, biz, onComplete) => {
          if (!isDemo)
            return uploadFiles(api, files, biz, undefined, fetch, onComplete);
          const keys: string[] = [];
          const { demoUpload } = await import("../demo/transport");
          for (let i = 0; i < files.length; i++) {
            const key = await demoUpload(files[i], biz);
            keys.push(key);
            onComplete?.(i, key);
          }
          return keys;
        },
      }}
    >
      {children}
      <div
        className={`toast ${message ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toastPresence.value}
      </div>
    </AppContext.Provider>
  );
}
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <StateProvider>{children}</StateProvider>
    </QueryClientProvider>
  );
}
