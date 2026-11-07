import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Modal } from "../components/ui";
import { useApp } from "./state";
import "./verification-dialog.css";

const VerificationDialogContext = createContext<
  ((serverRequired?: boolean, returnFocus?: HTMLElement | null) => void) | null
>(null);

export function useVerificationDialog() {
  const open = useContext(VerificationDialogContext);
  if (!open) throw new Error("VerificationDialogProvider missing");
  return open;
}

/** Asking for access never runs the blocked action or changes the current route. */
export function VerificationDialogProvider({
  children,
}: {
  children: ReactNode;
}) {
  const location = useLocation(),
    navigate = useNavigate();
  const { session, user } = useApp();
  const [request, setRequest] = useState<{
    key: string;
    returnTo: string;
    serverRequired: boolean;
    returnFocus: HTMLElement | null;
  } | null>(null);
  const close = useCallback(() => setRequest(null), []);
  const open = useCallback(
    (
      serverRequired = false,
      returnFocus = document.activeElement as HTMLElement | null,
    ) => {
      setRequest(
        (current) =>
          current ?? {
            key: location.key,
            returnTo: location.pathname + location.search + location.hash,
            serverRequired,
            returnFocus,
          },
      );
    },
    [location],
  );
  useEffect(() => {
    if (
      request &&
      (request.key !== location.key ||
        !session ||
        (user?.verified && !request.serverRequired) ||
        user?.banned)
    )
      close();
  }, [request, location.key, session, user?.verified, user?.banned, close]);
  return (
    <VerificationDialogContext.Provider value={open}>
      {children}
      {request &&
        createPortal(
          <Modal
            title="先完成学生认证"
            className="ew-verification-dialog"
            onClose={close}
            returnFocus={request.returnFocus}
          >
            <span className="ew-verification-icon" aria-hidden="true">
              <ShieldCheck size={30} strokeWidth={1.6} />
            </span>
            <p>
              你还没有完成学生认证。认证后即可收藏和喜欢菜品、添加标签、发布分享。
            </p>
            <div className="ew-verification-actions">
              <button
                type="button"
                className="ew-verification-later"
                onClick={close}
              >
                暂不
              </button>
              <button
                type="button"
                className="ew-verification-go"
                onClick={() => {
                  const returnTo = request.returnTo;
                  close();
                  void navigate(
                    "/verify?next=" + encodeURIComponent(returnTo),
                    { state: { returnTo } },
                  );
                }}
              >
                去认证
              </button>
            </div>
          </Modal>,
          document.body,
        )}
    </VerificationDialogContext.Provider>
  );
}
