import { createContext, useContext } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Session } from "../api/client";
import type { Api } from "../api/service";
import type { User } from "../api/models";
export type AppState = {
  api: Api;
  session: Session | null;
  user?: User;
  me: UseQueryResult<User, Error>;
  toast: (message: string) => void;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => void;
  upload: (
    file: File,
    biz: "foods" | "avatar" | "restaurants",
    onPhase?: (phase: "uploading" | "confirming") => void,
  ) => Promise<string>;
};
export const AppContext = createContext<AppState | null>(null);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("AppProvider missing");
  return ctx;
}
