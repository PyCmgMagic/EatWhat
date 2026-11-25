import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { BRAND_SLOGAN } from "../app/brand";
import { Link, useLocation } from "react-router-dom";
import { bannedPageAllowed } from "../api/banned-access";
import { ContentSkeleton } from "./LoadingSkeleton";
import { AccessWelcome } from "./AccessWelcome";
import { openModalLayer } from "./modal-layer";
import {
  LayoutGrid,
  Soup,
  Plus,
  Bookmark,
  UserRound,
  Search,
  MapPin,
  Bell,
  ArrowRight,
  Heart,
  Leaf,
  Coffee,
  CakeSlice,
  Sandwich,
  Clock,
  SlidersHorizontal,
  Shuffle,
  ShieldCheck,
  X,
  Check,
  ImagePlus,
  Store,
  Pencil,
  Settings,
  Info,
  Folder,
  LogOut,
  LoaderCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  UsersRound,
} from "lucide-react";
import { duplicateFoodId, errorMessage } from "../api/client";
import { useApp } from "../app/state";
import { mediaUrl } from "../api/models";
import { useSurfaceDismiss } from "../motion/hooks";
import { createAnchoredPopoverMotion } from "../motion/anchored-popover";
import "./origin-dialog.css";
import { ToastError } from "./feedback";
const icons = {
  discover: LayoutGrid,
  bowl: Soup,
  plus: Plus,
  bookmark: Bookmark,
  user: UserRound,
  search: Search,
  pin: MapPin,
  bell: Bell,
  arrow: ArrowRight,
  heart: Heart,
  leaf: Leaf,
  cup: Coffee,
  cake: CakeSlice,
  snack: Sandwich,
  clock: Clock,
  sliders: SlidersHorizontal,
  shuffle: Shuffle,
  shield: ShieldCheck,
  close: X,
  check: Check,
  image: ImagePlus,
  store: Store,
  edit: Pencil,
  settings: Settings,
  info: Info,
  folder: Folder,
  logout: LogOut,
  loader: LoaderCircle,
  left: ChevronLeft,
  right: ChevronRight,
  trash: Trash2,
  users: UsersRound,
};
export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const I = icons[name as keyof typeof icons] ?? Soup;
  return <I aria-hidden="true" strokeWidth={1.5} className={className} />;
}
export function Intro({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="page-intro">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <span className="date-note">
        <Icon name="leaf" />
        {BRAND_SLOGAN}
      </span>
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Icon name="bowl" />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return <ContentSkeleton kind="rows" count={3} />;
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  const duplicate = duplicateFoodId(error);
  if (!retry)
    return (
      <>
        <ToastError error={error} />
        {duplicate && (
          <Link className="text-link" to={`/foods/${duplicate}`}>
            查看已有菜品（输入已保留） →
          </Link>
        )}
      </>
    );
  return (
    <div className="error-state" role="alert">
      <Icon name="info" />
      <p>{errorMessage(error)}</p>
      {duplicate && (
        <Link className="text-link" to={`/foods/${duplicate}`}>
          查看已有菜品（输入已保留） →
        </Link>
      )}
      {retry && (
        <button className="btn btn-secondary" onClick={retry}>
          重新加载
        </button>
      )}
    </div>
  );
}
export function Gate({
  children,
  verified = true,
  recovery = false,
  allowBanned,
}: {
  children: ReactNode;
  verified?: boolean;
  recovery?: boolean;
  /** Read-only account pages may remain available; login and verification still apply. */
  allowBanned?: boolean;
}) {
  const { session, user, me } = useApp();
  const { pathname } = useLocation();
  if (recovery) return children;
  if (!session) return <AccessWelcome />;
  if (me.isPending) return <Loading />;
  if (me.isError)
    return <ErrorState error={me.error} retry={() => void me.refetch()} />;
  if (user?.banned && !(allowBanned ?? bannedPageAllowed(pathname)))
    return (
      <Empty title="账号暂时无法使用" action={<Link className="text-link" to="/feedback?appeal=1">申诉</Link>}>
        {user.banReason || "请联系管理员了解账号状态。"}
      </Empty>
    );
  if (verified && user?.verified !== true)
    return <AccessWelcome verification />;
  return children;
}
export function Modal({
  title,
  children,
  onClose,
  className = "",
  dismissible = true,
  returnFocus,
  motionOrigin,
  onKeyDown,
}: {
  title: string;
  children: ReactNode | ((dismiss: () => void) => ReactNode);
  onClose: () => void;
  className?: string;
  dismissible?: boolean;
  returnFocus?: HTMLElement | null;
  motionOrigin?: HTMLElement | null;
  onKeyDown?: (event: KeyboardEvent<HTMLDialogElement>, dismiss: () => void) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const originMotion = useRef<ReturnType<
    typeof createAnchoredPopoverMotion
  > | null>(null);
  const closing = useRef(false);
  const closeCallback = useRef(onClose);
  closeCallback.current = onClose;
  const titleId = useId();
  const defaultDismiss = useSurfaceDismiss(ref, onClose);
  const dismiss = () => {
    if (!dismissible || closing.current) return;
    if (!originMotion.current || !ref.current) return defaultDismiss();
    closing.current = true;
    ref.current.dataset.dismissing = "true";
    ref.current.inert = true;
    originMotion.current.setOpen(false, () => closeCallback.current());
  };
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const closeLayer = openModalLayer(dialog, returnFocus);
    // Measure after the native dialog enters its top layer. Only the shell
    // changes size; counter-scaling keeps controls readable throughout.
    if (
      dialog &&
      surface.current &&
      content.current &&
      motionOrigin?.isConnected
    ) {
      let target = dialog.getBoundingClientRect();
      let source = motionOrigin.getBoundingClientRect();
      let settled = false;
      if (
        target.width > 0 &&
        target.height > 0 &&
        source.width > 0 &&
        source.height > 0
      ) {
        let zoom = target.width / (dialog.offsetWidth || target.width);
        const motion = createAnchoredPopoverMotion(
          dialog,
          surface.current,
          content.current,
          {
            openDuration: 340,
            closeDuration: 180,
            origin: () => {
              // A settled card can move when the viewport or its contents change.
              if (settled) {
                target = dialog.getBoundingClientRect();
                zoom = target.width / (dialog.offsetWidth || target.width);
              }
              if (motionOrigin.isConnected) {
                const next = motionOrigin.getBoundingClientRect();
                if (next.width > 0 && next.height > 0) source = next;
              }
              return {
                x: (source.left - target.left) / zoom,
                y: (source.top - target.top) / zoom,
                sx: Math.max(0.05, source.width / target.width),
                sy: Math.max(0.05, source.height / target.height),
              };
            },
          },
        );
        originMotion.current = motion;
        motion.setOpen(true, () => {
          settled = true;
        });
      }
    }
    return () => {
      originMotion.current?.cancel();
      originMotion.current = null;
      // Strict Mode may mount again on the same DOM; restore its destination box.
      if (motionOrigin && dialog) {
        dialog.style.transform = "";
        if (surface.current) surface.current.style.opacity = "";
        if (content.current) {
          content.current.style.transform = "";
          content.current.style.opacity = "";
        }
      }
      closeLayer();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      data-origin-motion={motionOrigin ? "true" : undefined}
      aria-labelledby={titleId}
      onKeyDown={(event) => onKeyDown?.(event, dismiss)}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) dismiss();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) dismiss();
      }}
    >
      {motionOrigin && (
        <div
          ref={surface}
          className="origin-dialog-surface"
          aria-hidden="true"
        />
      )}
      <div ref={content} className="modal-pad">
        <button
          className="modal-close"
          onClick={dismiss}
          disabled={!dismissible}
          aria-label="关闭弹窗"
        >
          <Icon name="close" />
        </button>
        <h2 id={titleId}>{title}</h2>
        {typeof children === "function" ? children(dismiss) : children}
      </div>
    </dialog>
  );
}
export function Picture({
  src,
  alt,
  className = "",
  eager = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const url = mediaUrl(src);
  return url ? (
    <img
      key={url}
      src={url}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      onLoad={(e) => {
        e.currentTarget.hidden = false;
        e.currentTarget.parentElement?.classList.remove("image-unavailable");
      }}
      onError={(e) => {
        e.currentTarget.hidden = true;
        e.currentTarget.parentElement?.classList.add("image-unavailable");
      }}
    />
  ) : (
    <div className={`image-placeholder ${className}`}>
      <Icon name="image" />
      <span>图片暂不可用</span>
    </div>
  );
}
export function Pagination({
  page,
  hasNext,
  totalPages,
  onPage,
}: {
  page: number;
  hasNext?: boolean | null;
  totalPages?: number | null;
  onPage: (page: number) => void;
}) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav className="pagination" aria-label="分页">
      <button
        className="btn btn-secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <Icon name="left" />
        上一页
      </button>
      <span>
        第 {page} 页{totalPages != null ? ` / 共 ${totalPages} 页` : ""}
      </span>
      <button
        className="btn btn-secondary"
        disabled={!hasNext}
        onClick={() => onPage(page + 1)}
      >
        下一页
        <Icon name="right" />
      </button>
    </nav>
  );
}
