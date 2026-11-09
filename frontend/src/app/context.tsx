import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  sessionSignal,
  subscribeSession,
  writeSession,
} from "./runtime";
import { recoveryCommands } from "../api/recovery";
import { ToastViewport, useToasts } from "./toast";

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
function clientForSession(session: Session | null) {
  const signal = sessionSignal(session);
  const checkOwner = () => {
    // Read shared storage too: another tab can switch before its event is delivered.
    readSession();
    signal.throwIfAborted();
  };
  const live = createTransport(
    import.meta.env.VITE_API_BASE_URL || "/api",
    () => session,
  );
  const transport: Transport = async (path, options) => {
    try {
      const send = isDemo
        ? (await import("../demo/transport")).demoTransport
        : live;
      checkOwner();
      const result = await send(path, {
        ...options,
        signal: options.signal
          ? AbortSignal.any([signal, options.signal])
          : signal,
      });
      checkOwner();
      return result;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        !options.public &&
        session &&
        !signal.aborted &&
        sameSession(session, readSession())
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
        .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)[0]?.state
        .data as Schema["ClientConfigResponse"] | undefined;
      return actionUnavailable(remote, path);
    },
  });
  const client = createApi(
    async (path, options) => {
      checkOwner();
      return guarded(path, options);
    },
    async (...args) => {
      const captcha = await import("../api/captcha");
      return (isDemo ? captcha.runDemoCaptcha : captcha.runBrowserCaptcha)(
        ...args,
      );
    },
  );
  return { api: client, signal, checkOwner };
}
function StateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(readSession);
  const { items, toast, dismiss } = useToasts();
  const { api, signal, checkOwner } = useMemo(
    () => clientForSession(session),
    [session],
  );
  const me = useMe(api, session);
  useEffect(() => {
    let observed = session;
    const syncSession = (next: Session | null) => {
      if (observed === next) return;
      observed = next;
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
    setSession(readSession());
    // Finish the identity refresh before a successful login/recovery navigates.
    // Otherwise a later pending transition can unmount the next page's form.
    try {
      await queryClient.fetchQuery({
        queryKey: ["me"],
        queryFn: () => clientForSession(s).api.me(),
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
        upload: async (file, biz, onPhase) => {
          checkOwner();
          const key = isDemo
            ? await (await import("../demo/transport")).demoUpload(file, biz)
            : await uploadFile(api, file, biz, signal, fetch, onPhase);
          checkOwner();
          return key;
        },
        uploadMany: async (files, biz, onComplete) => {
          checkOwner();
          if (!isDemo)
            return uploadFiles(api, files, biz, signal, fetch, onComplete);
          const keys: string[] = [];
          const { demoUpload } = await import("../demo/transport");
          for (let i = 0; i < files.length; i++) {
            checkOwner();
            const key = await demoUpload(files[i], biz);
            checkOwner();
            keys.push(key);
            onComplete?.(i, key);
          }
          return keys;
        },
      }}
    >
      {children}
      <ToastViewport items={items} dismiss={dismiss} />
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
