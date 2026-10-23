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
import { createApi, uploadFile, type Api } from "../api/service";
import { AppContext } from "./state";
import { isDemo, readSession, writeSession } from "./runtime";
import { demoTransport, demoUpload } from "../demo/transport";

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
  const api = useMemo(() => {
    const live = createTransport(
      import.meta.env.VITE_API_BASE_URL || "/api",
      readSession,
    );
    const transport: Transport = async (path, options) => {
      try {
        return await (isDemo ? demoTransport : live)(path, options);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401)
          window.dispatchEvent(new Event("eatwhat:expired"));
        throw error;
      }
    };
    return createApi(transport);
  }, []);
  const me = useMe(api, session);
  const toast = useCallback((message: string) => setMessage(message), []);
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  useEffect(() => {
    const expire = () => {
      writeSession(null);
      setSession(null);
      void queryClient.cancelQueries().then(() => queryClient.clear());
      toast("登录已过期，请重新登录。");
    };
    window.addEventListener("eatwhat:expired", expire);
    return () => window.removeEventListener("eatwhat:expired", expire);
  }, [toast]);
  const signIn = async (s: Session) => {
    await queryClient.cancelQueries();
    queryClient.clear();
    writeSession(s);
    setSession(s);
  };
  const signOut = async () => {
    await api.logout();
    await queryClient.cancelQueries();
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
        signOut,
        refreshMe: () =>
          void queryClient.invalidateQueries({ queryKey: ["me"] }),
        upload: (file, biz, onPhase) =>
          isDemo
            ? demoUpload(file)
            : uploadFile(api, file, biz, undefined, fetch, onPhase),
      }}
    >
      {children}
      <div
        className={`toast ${message ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message}
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
