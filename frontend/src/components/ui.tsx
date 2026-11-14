import { useEffect, useId, useRef, type ReactNode } from "react";
import { BRAND_SLOGAN } from "../app/brand";
import { Link } from "react-router-dom";
import { ContentSkeleton } from "./LoadingSkeleton";
import { AccessWelcome } from "./AccessWelcome";
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
}: {
  children: ReactNode;
  verified?: boolean;
  recovery?: boolean;
}) {
  const { session, user, me } = useApp();
  if (recovery) return children;
  if (!session) return <AccessWelcome />;
  if (me.isPending) return <Loading />;
  if (me.isError)
    return <ErrorState error={me.error} retry={() => void me.refetch()} />;
  if (user?.banned)
    return (
      <Empty title="账号暂时无法使用">
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
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  dismissible?: boolean;
  returnFocus?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const dismiss = useSurfaceDismiss(ref, onClose);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus =
      returnFocus ?? (document.activeElement as HTMLElement | null);
    // Lock scrolling on <html>. Browsers that keep the reserved scrollbar
    // gutter (scrollbar-gutter: stable) keep the page width; others (Safari)
    // drop the scrollbar, so measure what was lost and pad it back.
    const root = document.documentElement,
      body = document.body,
      gutter = () => window.innerWidth - root.clientWidth;
    const scrollbar = gutter();
    dialog?.showModal();
    const prev = root.style.overflow,
      prevPadding = body.style.paddingRight;
    root.style.overflow = "hidden";
    const lost = scrollbar - gutter();
    if (lost > 0) body.style.paddingRight = `${lost}px`;
    return () => {
      dialog?.close();
      root.style.overflow = prev;
      body.style.paddingRight = prevPadding;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) dismiss();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) dismiss();
      }}
    >
      <div className="modal-pad">
        <button
          className="modal-close"
          onClick={dismiss}
          disabled={!dismissible}
          aria-label="关闭弹窗"
        >
          <Icon name="close" />
        </button>
        <h2 id={titleId}>{title}</h2>
        {children}
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
