import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { AppContext } from "../app/state";
import { createApi } from "../api/service";
import type { User } from "../api/models";
import { LoginDialogProvider } from "../app/auth-dialog";
import { VerificationDialogProvider } from "../app/verification-dialog";
import MobileApp from "../mobile/App";

// Reference artboards use their compiled sample content and have no network transport.
const cache = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const unavailable = async (): Promise<never> => {
  throw new Error("设计画板仅供预览。");
};
const api = createApi(unavailable);

function Artboards() {
  const me = useQuery<User>({
    queryKey: ["reference-user"],
    queryFn: unavailable,
    enabled: false,
  });
  return (
    <AppContext.Provider
      value={{
        api,
        me,
        session: null,
        toast: () => {},
        signIn: unavailable,
        signOut: unavailable,
        clearLocalSession: unavailable,
        refreshMe: () => {},
        upload: unavailable,
        uploadMany: unavailable,
      }}
    >
      <LoginDialogProvider>
        <VerificationDialogProvider>
          <MobileApp />
        </VerificationDialogProvider>
      </LoginDialogProvider>
    </AppContext.Provider>
  );
}

export default function DesignReference() {
  return (
    <QueryClientProvider client={cache}>
      <Artboards />
    </QueryClientProvider>
  );
}
