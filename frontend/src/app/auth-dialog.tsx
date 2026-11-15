import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Soup, X } from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  type LinkProps,
  type Location,
} from "react-router-dom";
import { desktopLayout } from "./layout";
import { normalizeAuthRoute } from "./auth-routes";
import "./auth-dialog.css";

const AuthDialogContent = lazy(() => import("../components/AuthDialogContent"));
const RegistrationGuide = lazy(() => import("./RegistrationGuide"));
const dialogPaths = new Set([
  "/auth",
  "/auth/password",
  "/auth/register",
  "/auth/register/confirm",
  "/auth/forgot",
]);

export function safeLoginNext(value: string | null) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !value.startsWith("/auth")
    ? value
    : null;
}

type LoginRequest = {
  id: number;
  to: string;
  origin: Location;
  next: string;
  returnFocus: HTMLElement | null;
};
type LoginOptions = {
  replace?: boolean;
  returnTo?: string;
  returnFocus?: HTMLElement | null;
};
type AuthFlow = {
  location: Location;
  navigate: (to: string) => void;
  finish: (fallback: string, registration?: AbortSignal) => void;
  setBusy: (busy: boolean) => void;
};
const LoginDialogContext = createContext<{
  openLogin: (to?: string, options?: LoginOptions) => void;
  showRegistrationGuide: (registration: AbortSignal) => void;
} | null>(null);
const AuthFlowContext = createContext<AuthFlow | null>(null);

export function useLoginDialog() {
  const context = useContext(LoginDialogContext);
  if (!context) throw new Error("LoginDialogProvider missing");
  return context;
}

/** The same forms can navigate inside a dialog or on the standalone auth route. */
export function useAuthFlow() {
  const flow = useContext(AuthFlowContext);
  const loginDialog = useContext(LoginDialogContext);
  const location = useLocation();
  const navigate = useNavigate();
  return (
    flow ?? {
      location,
      navigate: (to: string) => {
        void navigate(normalizeAuthRoute(to));
      },
      finish: (fallback: string, registration?: AbortSignal) => {
        void navigate(
          safeLoginNext(new URLSearchParams(location.search).get("next")) ??
            fallback,
        );
        if (registration) loginDialog?.showRegistrationGuide(registration);
      },
      setBusy: () => {},
    }
  );
}

export function useAuthBusy(busy: boolean) {
  const flow = useContext(AuthFlowContext);
  const setBusy = flow?.setBusy;
  useEffect(() => {
    setBusy?.(busy);
    return () => setBusy?.(false);
  }, [busy, setBusy]);
}

/** Preserve normal link semantics (including opening a standalone page in a new tab). */
export function LoginLink({ to, onClick, ...props }: LinkProps) {
  const { openLogin } = useLoginDialog();
  const location = useLocation();
  const path = normalizeAuthRoute(
    typeof to === "string" ? to : (to.pathname ?? "") + (to.search ?? ""),
  );
  return (
    <Link
      {...props}
      to={to}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (props.target && props.target !== "_self") ||
          props.reloadDocument
        )
          return;
        if (
          dialogPaths.has(path.split("?")[0]) &&
          !location.pathname.startsWith("/auth")
        ) {
          event.preventDefault();
          openLogin(path);
        }
      }}
    />
  );
}

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [request, setRequest] = useState<LoginRequest | null>(null);
  const [registration, setRegistration] = useState<AbortSignal | null>(null);
  const closeGuide = useCallback(() => setRegistration(null), []);
  const showRegistrationGuide = useCallback((signal: AbortSignal) => {
    if (!signal.aborted) setRegistration(signal);
  }, []);
  useEffect(() => {
    if (!registration) return;
    if (registration.aborted) {
      closeGuide();
      return;
    }
    registration.addEventListener("abort", closeGuide);
    return () => registration.removeEventListener("abort", closeGuide);
  }, [registration, closeGuide]);
  const active = useRef<LoginRequest | null>(null);
  const sequence = useRef(0);
  const close = useCallback(() => {
    active.current = null;
    setRequest(null);
  }, []);
  const openLogin = useCallback(
    (requested = "/auth", options?: LoginOptions) => {
      if (active.current) return;
      const to = normalizeAuthRoute(requested);
      const next =
        safeLoginNext(new URLSearchParams(to.split("?")[1]).get("next")) ??
        location.pathname + location.search + location.hash;
      if (
        !desktopLayout(
          window.innerWidth,
          new URLSearchParams(window.location.search).get("view"),
          false,
          false,
        )
      ) {
        const [path, search = ""] = to.split("?");
        const params = new URLSearchParams(search);
        params.set("next", next);
        void navigate(path + "?" + params, {
          replace: options?.replace,
          state: {
            returnTo:
              options?.returnTo ??
              location.pathname + location.search + location.hash,
          },
        });
        return;
      }
      const value = {
        id: ++sequence.current,
        to,
        origin: location,
        next,
        returnFocus:
          options?.returnFocus ??
          (document.activeElement as HTMLElement | null),
      };
      active.current = value;
      setRequest(value);
    },
    [location, navigate],
  );
  useEffect(() => {
    if (active.current && active.current.origin.key !== location.key) close();
  }, [location.key, close]);
  return (
    <LoginDialogContext.Provider value={{ openLogin, showRegistrationGuide }}>
      {children}
      {request &&
        createPortal(
          <LoginDialog
            key={request.id}
            request={request}
            onClose={close}
            onFinish={(next, registration) => {
              // Ignore completions from a dialog dismissed before its request returned.
              if (active.current?.id !== request.id) return;
              close();
              if (next !== location.pathname + location.search + location.hash)
                void navigate(next);
              if (registration) showRegistrationGuide(registration);
            }}
          />,
          document.body,
        )}
      {registration && !registration.aborted && (
        <Suspense fallback={null}>
          <RegistrationGuide onClose={closeGuide} />
        </Suspense>
      )}
    </LoginDialogContext.Provider>
  );
}

function LoginDialog({
  request,
  onClose,
  onFinish,
}: {
  request: LoginRequest;
  onClose: () => void;
  onFinish: (next: string, registration?: AbortSignal) => void;
}) {
  const [route, setRoute] = useState(request.to);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const next = useRef(request.next);
  const path = route.split("?")[0];
  const search = route.includes("?") ? route.slice(route.indexOf("?")) : "";
  const navigate = (to: string) => {
    const requestedNext = safeLoginNext(
      new URLSearchParams(to.split("?")[1]).get("next"),
    );
    if (requestedNext) next.current = requestedNext;
    setRoute(normalizeAuthRoute(to));
  };
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = request.returnFocus;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const dialog = ref.current;
      if (!dialog) return;
      const content = dialog.querySelector(".ew-login-dialog-content");
      if (content) content.scrollTop = 0;
      // A mode switch removes its focused link. Keep keyboard navigation in
      // the dialog without opening the phone's software keyboard automatically.
      if (!dialog.contains(document.activeElement))
        dialog
          .querySelector<HTMLButtonElement>(".ew-login-dialog-close")
          ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [path]);
  return (
    <dialog
      ref={ref}
      className="ew-login-dialog"
      aria-label="登录 / 注册"
      aria-modal="true"
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Tab")
          event.stopPropagation();
      }}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (!busy && event.target === event.currentTarget) onClose();
      }}
      onClickCapture={(event) => {
        const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>(
          "a[href]",
        );
        if (
          !anchor ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (anchor.target && anchor.target !== "_self")
        )
          return;
        const to = normalizeAuthRoute(anchor.hash.slice(1));
        if (!dialogPaths.has(to.split("?")[0])) return;
        event.preventDefault();
        if (!busy) navigate(to);
      }}
    >
      <div className="ew-login-dialog-inner">
        <header className="ew-login-dialog-header">
          <span className="ew-login-dialog-brand">
            <span className="ew-login-dialog-mark" aria-hidden="true">
              <Soup size={20} strokeWidth={1.7} />
            </span>
            山软 <i aria-hidden="true">·</i> 今天吃什么
          </span>
          <button
            type="button"
            className="ew-login-dialog-close"
            aria-label="关闭登录"
            disabled={busy}
            onClick={onClose}
          >
            <X size={19} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </header>
        <AuthFlowContext.Provider
          value={{
            location: { ...request.origin, pathname: path, search, hash: "" },
            navigate,
            finish: (_, registration) => onFinish(next.current, registration),
            setBusy,
          }}
        >
          <div
            className="ew-login-dialog-content pc-secondary-auth-content"
            key={path}
          >
            <Suspense fallback={<p role="status">正在准备登录…</p>}>
              <AuthDialogContent path={path} />
            </Suspense>
          </div>
        </AuthFlowContext.Provider>
      </div>
    </dialog>
  );
}
