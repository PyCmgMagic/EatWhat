import { useEffect, useId, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
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
import { errorMessage } from "../api/client";
import { useApp } from "../app/state";
import { mediaUrl } from "../api/models";
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
  subtitle: string;
}) {
  return (
    <div className="page-intro">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <span className="date-note">
        <Icon name="leaf" />
        今天，也要记得好好吃饭
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
  return (
    <div className="loading-state" role="status">
      <Icon name="loader" className="spin" />
      正在端上好味道…
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <Icon name="info" />
      <p>{errorMessage(error)}</p>
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
}: {
  children: ReactNode;
  verified?: boolean;
}) {
  const { session, user, me } = useApp();
  const location = useLocation();
  if (!session)
    return (
      <Empty
        title="和同校的你，一起好好吃饭"
        action={
          <Link
            to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`}
            className="btn btn-primary"
          >
            登录 / 注册
            <Icon name="arrow" />
          </Link>
        }
      >
        登录后发现餐厅与校园美味，整理自己的想吃清单。
      </Empty>
    );
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
    return (
      <Empty
        title="先认识一下，同校的你"
        action={
          <Link className="btn btn-primary" to="/settings">
            去完成认证
            <Icon name="shield" />
          </Link>
        }
      >
        完成身份认证后，即可浏览菜品、收藏和分享。认证状态以服务端确认为准。
      </Empty>
    );
  return children;
}
export function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-pad">
        <button className="modal-close" onClick={onClose} aria-label="关闭弹窗">
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
